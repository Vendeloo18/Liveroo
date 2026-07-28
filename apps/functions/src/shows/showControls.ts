// =============================================================
// CLOUD FUNCTIONS: control del show en vivo
// =============================================================
// startShow   — el vendedor arranca; activa la primera subasta de la cola
// endShow     — termina el show y cancela lo que quedó sin subastar
// skipAuction — salta la subasta actual y pasa a la siguiente
//
// Las subastas del show viven en /auctions con mode="live" y showId.
// Son los mismos documentos que las subastas sueltas: cambia el modo,
// no el motor.
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS, DEFAULT_LIVE_TIMER_S } from "../constants";

// limit(2) y no 1: skipAuction necesita descartar la propia subasta
// saltada si todavía figuraba en la cola, y quedarse con la siguiente real.
const nextWaitingQuery = (showId: string) =>
  db
    .collection(COLLECTIONS.AUCTIONS)
    .where("showId", "==", showId)
    .where("status", "==", "waiting")
    .orderBy("sortOrder", "asc")
    .limit(2);

// =============================================================
// startShow
// =============================================================

export const startShow = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId } = (data ?? {}) as { showId?: string };
    if (!showId) {
      throw new functions.https.HttpsError("invalid-argument", "showId es requerido");
    }

    const callerId = context.auth.uid;
    const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);

    await db.runTransaction(async (tx) => {
      // ── lecturas ──
      const showSnap = await tx.get(showRef);
      if (!showSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Show no encontrado");
      }
      const show = showSnap.data()!;

      if (show.sellerId !== callerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el dueño del show");
      }
      if (!["scheduled", "draft"].includes(show.status)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `El show está en estado '${show.status}' y no puede iniciarse`
        );
      }

      const firstSnap = await tx.get(nextWaitingQuery(showId));
      if (firstSnap.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "El show no tiene subastas. Agrega al menos una antes de iniciar."
        );
      }

      // ── escrituras ──
      const first = firstSnap.docs[0];
      const firstData = first.data();
      const timerS = (firstData.timerSeconds as number) ?? DEFAULT_LIVE_TIMER_S;
      const now = Timestamp.now();

      tx.update(showRef, {
        status: "live",
        startedAt: now,
        currentAuctionId: first.id,
        currentAuctionIndex: firstData.sortOrder ?? 0,
        updatedAt: now,
      });

      tx.update(first.ref, {
        status: "active",
        currentBidUsd: firstData.startingPriceUsd,
        startsAt: now,
        endsAt: Timestamp.fromMillis(now.toMillis() + timerS * 1000),
        updatedAt: now,
      });
    });

    functions.logger.info("Show iniciado", { showId, callerId });
    return { success: true, message: "¡Show iniciado!" };
  });

// =============================================================
// endShow
// =============================================================
// Cancela las subastas que quedaron en cola. La que esté activa se
// deja cerrar sola: si alguien ya pujó, merece su orden.

export const endShow = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId } = (data ?? {}) as { showId?: string };
    if (!showId) {
      throw new functions.https.HttpsError("invalid-argument", "showId es requerido");
    }

    const callerId = context.auth.uid;
    const [showSnap, userSnap] = await Promise.all([
      db.doc(`${COLLECTIONS.SHOWS}/${showId}`).get(),
      db.doc(`${COLLECTIONS.USERS}/${callerId}`).get(),
    ]);

    if (!showSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Show no encontrado");
    }

    const isOwner = showSnap.data()!.sellerId === callerId;
    const isAdmin = userSnap.data()?.role === "admin";
    if (!isOwner && !isAdmin) {
      throw new functions.https.HttpsError("permission-denied", "Sin permiso para terminar el show");
    }

    const now = Timestamp.now();

    const pending = await db
      .collection(COLLECTIONS.AUCTIONS)
      .where("showId", "==", showId)
      .where("status", "==", "waiting")
      .get();

    const batch = db.batch();
    batch.update(showSnap.ref, {
      status: "ended",
      endedAt: now,
      currentAuctionId: null,
      updatedAt: now,
    });
    pending.docs.forEach((d) =>
      batch.update(d.ref, { status: "cancelled", endedAt: now, updatedAt: now })
    );
    await batch.commit();

    functions.logger.info("Show terminado", { showId, canceladas: pending.size });
    return { success: true, cancelled: pending.size };
  });

// =============================================================
// skipAuction
// =============================================================

export const skipAuction = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId, auctionId } = (data ?? {}) as { showId?: string; auctionId?: string };
    if (!showId || !auctionId) {
      throw new functions.https.HttpsError("invalid-argument", "showId y auctionId son requeridos");
    }

    const callerId = context.auth.uid;
    const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);
    const auctionRef = db.doc(`${COLLECTIONS.AUCTIONS}/${auctionId}`);

    await db.runTransaction(async (tx) => {
      // ── lecturas ──
      const [showSnap, auctionSnap] = await Promise.all([
        tx.get(showRef),
        tx.get(auctionRef),
      ]);

      if (!showSnap.exists || !auctionSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Show o subasta no encontrada");
      }
      if (showSnap.data()!.sellerId !== callerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el dueño");
      }

      const auction = auctionSnap.data()!;
      if (auction.showId !== showId) {
        throw new functions.https.HttpsError("invalid-argument", "La subasta no es de este show");
      }
      // Con pujas encima no se salta: alguien ya puso plata.
      if (auction.currentBidderId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "No puedes saltar una subasta que ya tiene pujas"
        );
      }

      const nextSnap = await tx.get(nextWaitingQuery(showId));
      const now = Timestamp.now();

      // ── escrituras ──
      tx.update(auctionRef, { status: "skipped", endedAt: now, updatedAt: now });

      const msgRef = db.collection(COLLECTIONS.SHOW_MESSAGES(showId)).doc();
      tx.set(msgRef, {
        id: msgRef.id,
        showId,
        authorId: "system",
        authorName: "Sistema",
        type: "system",
        text: `⏭ El vendedor saltó "${auction.title}"`,
        createdAt: now,
      });

      // La saltada puede ser la misma que devuelve la query si estaba
      // en waiting; en ese caso no hay siguiente real.
      const next = nextSnap.docs.find((d) => d.id !== auctionId);

      if (!next) {
        tx.update(showRef, {
          status: "ended",
          endedAt: now,
          currentAuctionId: null,
          updatedAt: now,
        });
        return;
      }

      const nextData = next.data();
      const timerS = (nextData.timerSeconds as number) ?? DEFAULT_LIVE_TIMER_S;

      tx.update(next.ref, {
        status: "active",
        currentBidUsd: nextData.startingPriceUsd,
        startsAt: now,
        endsAt: Timestamp.fromMillis(now.toMillis() + timerS * 1000),
        updatedAt: now,
      });

      tx.update(showRef, {
        currentAuctionId: next.id,
        currentAuctionIndex: nextData.sortOrder ?? 0,
        updatedAt: now,
      });
    });

    return { success: true };
  });
