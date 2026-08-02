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

// limit(5) y no 1: skipAuction necesita descartar la propia subasta
// saltada, y además la cola puede traer artículos AJENOS colados antes
// de que exigiéramos dueño (ver elegirSiguiente) — hay que poder
// pasarlos de largo.
const nextWaitingQuery = (showId: string) =>
  db
    .collection(COLLECTIONS.AUCTIONS)
    .where("showId", "==", showId)
    .where("status", "==", "waiting")
    .orderBy("sortOrder", "asc")
    .limit(5);

// De los candidatos en cola, el primero que de verdad pertenece al dueño
// del show. Un artículo de OTRO vendedor (colado antes del candado en las
// reglas) se cancela en la misma transacción: nunca se subasta en un show
// ajeno. Devuelve null si no queda ninguno legítimo en la página leída.
function elegirSiguiente(params: {
  tx: FirebaseFirestore.Transaction;
  docs: FirebaseFirestore.QueryDocumentSnapshot[];
  ownerId: string;
  excluirId?: string;
  now: Timestamp;
}): FirebaseFirestore.QueryDocumentSnapshot | null {
  const { tx, docs, ownerId, excluirId, now } = params;
  for (const d of docs) {
    if (excluirId && d.id === excluirId) continue;
    if (d.data().sellerId === ownerId) return d;
    functions.logger.warn("Artículo ajeno en cola de show, cancelado", { auctionId: d.id, ownerId });
    tx.update(d.ref, { status: "cancelled", endedAt: now, updatedAt: now });
  }
  return null;
}

// El que opera un show tiene que seguir siendo vendedor aprobado: un
// suspendido conserva sus shows viejos, pero no puede transmitir con ellos.
function exigirAprobado(userSnap: FirebaseFirestore.DocumentSnapshot) {
  if (userSnap.data()?.sellerStatus !== "approved") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Tu cuenta de vendedor no está activa"
    );
  }
}

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
      const [showSnap, userSnap] = await Promise.all([
        tx.get(showRef),
        tx.get(db.doc(`${COLLECTIONS.USERS}/${callerId}`)),
      ]);
      if (!showSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Show no encontrado");
      }
      const show = showSnap.data()!;

      if (show.sellerId !== callerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el dueño del show");
      }
      exigirAprobado(userSnap);
      if (!["scheduled", "draft"].includes(show.status)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `El show está en estado '${show.status}' y no puede iniciarse`
        );
      }

      const firstSnap = await tx.get(nextWaitingQuery(showId));
      const now = Timestamp.now();

      // ── escrituras ──
      // Modelo "vende en vivo": se puede salir en vivo con la cola vacía y
      // agregar los artículos mientras transmites (presentAuction los activa
      // al momento). Si ya hay algo en cola, se activa la primera de una vez.
      const first = elegirSiguiente({ tx, docs: firstSnap.docs, ownerId: callerId, now });
      if (!first) {
        tx.update(showRef, {
          status: "live",
          startedAt: now,
          currentAuctionId: null,
          currentAuctionIndex: null,
          updatedAt: now,
        });
      } else {
        const firstData = first.data();
        const timerS = (firstData.timerSeconds as number) ?? DEFAULT_LIVE_TIMER_S;

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
      }
    });

    functions.logger.info("Show iniciado", { showId, callerId });
    return { success: true, message: "¡Show iniciado!" };
  });

// =============================================================
// presentAuction — "vende en vivo": activa un artículo al instante
// =============================================================
// Mientras el show está en vivo, el vendedor agrega un artículo y lo
// subasta al momento. Pone la subasta activa (con su timer) y la marca
// como la actual del show. No deja dos activas a la vez.

export const presentAuction = functions
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
      const [showSnap, auctionSnap, userSnap] = await Promise.all([
        tx.get(showRef),
        tx.get(auctionRef),
        tx.get(db.doc(`${COLLECTIONS.USERS}/${callerId}`)),
      ]);
      if (!showSnap.exists || !auctionSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Show o subasta no encontrada");
      }
      const show = showSnap.data()!;
      const auction = auctionSnap.data()!;

      if (show.sellerId !== callerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el dueño del show");
      }
      exigirAprobado(userSnap);
      if (show.status !== "live") {
        throw new functions.https.HttpsError("failed-precondition", "El show no está en vivo");
      }
      if (auction.showId !== showId || auction.sellerId !== show.sellerId) {
        throw new functions.https.HttpsError("invalid-argument", "Ese artículo no pertenece a este show");
      }
      if (auction.status !== "waiting") {
        throw new functions.https.HttpsError("failed-precondition", "Ese artículo ya no está en espera");
      }

      // Nunca dos subastas activas a la vez: si la actual sigue viva, hay
      // que esperar a que cierre.
      const currentId = show.currentAuctionId as string | undefined;
      if (currentId && currentId !== auctionId) {
        const currentSnap = await tx.get(db.doc(`${COLLECTIONS.AUCTIONS}/${currentId}`));
        if (currentSnap.exists && currentSnap.data()!.status === "active") {
          throw new functions.https.HttpsError("failed-precondition", "Ya hay un artículo subastándose. Espera a que cierre.");
        }
      }

      const timerS = (auction.timerSeconds as number) ?? DEFAULT_LIVE_TIMER_S;
      const now = Timestamp.now();

      tx.update(showRef, {
        currentAuctionId: auctionId,
        currentAuctionIndex: auction.sortOrder ?? 0,
        updatedAt: now,
      });
      tx.update(auctionRef, {
        status: "active",
        currentBidUsd: auction.startingPriceUsd,
        startsAt: now,
        endsAt: Timestamp.fromMillis(now.toMillis() + timerS * 1000),
        updatedAt: now,
      });
    });

    functions.logger.info("Artículo presentado en vivo", { showId, auctionId, callerId });
    return { success: true };
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

    // El vendedor NO puede terminar mientras el artículo en subasta tiene
    // pujas encima: si se arrepiente a mitad de una puja, deja colgado al
    // comprador que iba ganando. Tiene que esperar a que ese cierre (son
    // segundos). El admin sí puede forzar el cierre (moderación).
    if (isOwner && !isAdmin) {
      const currentId = showSnap.data()!.currentAuctionId as string | undefined;
      if (currentId) {
        const cur = (await db.doc(`${COLLECTIONS.AUCTIONS}/${currentId}`).get()).data();
        if (cur && cur.status === "active" && cur.currentBidderId) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "No puedes terminar el show mientras un artículo tiene pujas. Espera a que cierre — son segundos."
          );
        }
      }
    }

    const now = Timestamp.now();

    const pending = await db
      .collection(COLLECTIONS.AUCTIONS)
      .where("showId", "==", showId)
      .where("status", "==", "waiting")
      .get();

    // El show se termina PRIMERO y en su propio lote: si la cola es larga,
    // lo importante es que deje de aparecer "EN VIVO" en el inicio.
    await showSnap.ref.update({
      status: "ended",
      endedAt: now,
      currentAuctionId: null,
      updatedAt: now,
    });

    // La cola se cancela por tandas. Firestore corta un lote en 500
    // escrituras: con una cola larga, el lote único fallaba entero y el
    // show no se podía terminar nunca.
    const TANDA = 400;
    for (let i = 0; i < pending.docs.length; i += TANDA) {
      const lote = db.batch();
      pending.docs.slice(i, i + TANDA).forEach((d) =>
        lote.update(d.ref, { status: "cancelled", endedAt: now, updatedAt: now })
      );
      await lote.commit();
    }

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
      const show = showSnap.data()!;
      if (show.sellerId !== callerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el dueño");
      }
      // Solo se salta LO QUE SE ESTÁ SUBASTANDO en un show EN VIVO. Sin
      // esto se podía "saltar" un artículo histórico o activar una segunda
      // subasta en paralelo.
      if (show.status !== "live") {
        throw new functions.https.HttpsError("failed-precondition", "El show no está en vivo");
      }
      if (show.currentAuctionId !== auctionId) {
        throw new functions.https.HttpsError("failed-precondition", "Ese artículo no es el que se está subastando");
      }

      const auction = auctionSnap.data()!;
      if (auction.showId !== showId) {
        throw new functions.https.HttpsError("invalid-argument", "La subasta no es de este show");
      }
      if (auction.status !== "active") {
        throw new functions.https.HttpsError("failed-precondition", "Ese artículo no está en subasta");
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

      // Siguiente legítimo de la cola (excluye la saltada y descarta lo
      // ajeno). Sin siguiente, el show SIGUE EN VIVO con la cola vacía:
      // en el modelo "vende en vivo" el vendedor agrega el próximo
      // artículo en el momento; terminar es decisión suya (endShow).
      const next = elegirSiguiente({ tx, docs: nextSnap.docs, ownerId: callerId, excluirId: auctionId, now });

      if (!next) {
        tx.update(showRef, {
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
