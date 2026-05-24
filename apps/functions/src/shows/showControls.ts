// =============================================================
// CLOUD FUNCTION: startShow (callable)
// =============================================================
// El vendedor llama a esta función para iniciar su show en vivo.
// Valida que sea el dueño del show, que esté scheduled, y que
// tenga al menos un producto. Activa el primer producto.
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

export const startShow = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId } = data as { showId: string };
    if (!showId) {
      throw new functions.https.HttpsError("invalid-argument", "showId es requerido");
    }

    const callerId = context.auth.uid;
    const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);

    await db.runTransaction(async (tx) => {
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

      // Buscar el primer producto (sortOrder 0)
      const firstProductSnap = await db
        .collection(COLLECTIONS.SHOW_PRODUCTS(showId))
        .where("auctionStatus", "==", "waiting")
        .orderBy("sortOrder", "asc")
        .limit(1)
        .get();

      if (firstProductSnap.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "El show no tiene productos. Agrega al menos uno antes de iniciar."
        );
      }

      const firstProduct = firstProductSnap.docs[0];
      const firstProductData = firstProduct.data();
      const timerSeconds = (firstProductData.timerSeconds as number) ?? 30;
      const now = admin.firestore.Timestamp.now();

      const auctionEndsAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + timerSeconds * 1000
      );

      // Iniciar show
      tx.update(showRef, {
        status: "live",
        startedAt: now,
        currentAuctionId: firstProduct.id,
        currentAuctionIndex: firstProductData.sortOrder ?? 0,
        updatedAt: now,
      });

      // Activar primer producto
      tx.update(firstProduct.ref, {
        auctionStatus: "active",
        currentBidUsd: firstProductData.startingPriceUsd,
        auctionStartedAt: now,
        auctionEndsAt,
        updatedAt: now,
      });
    });

    functions.logger.info("Show iniciado", { showId, callerId });
    return { success: true, message: "¡Show iniciado!" };
  });

// =============================================================
// CLOUD FUNCTION: endShow (callable)
// Termina el show manualmente antes de que agoten los productos
// =============================================================

export const endShow = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId } = data as { showId: string };
    const callerId = context.auth.uid;

    const userSnap = await db.doc(`${COLLECTIONS.USERS}/${callerId}`).get();
    const userRole = userSnap.data()?.role;

    const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);
    const showSnap = await showRef.get();
    if (!showSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Show no encontrado");
    }

    const show = showSnap.data()!;
    const isOwner = show.sellerId === callerId;
    const isAdmin = userRole === "admin";

    if (!isOwner && !isAdmin) {
      throw new functions.https.HttpsError("permission-denied", "Sin permiso para terminar el show");
    }

    const now = admin.firestore.Timestamp.now();
    await showRef.update({
      status: "ended",
      endedAt: now,
      currentAuctionId: null,
      updatedAt: now,
    });

    return { success: true };
  });

// =============================================================
// CLOUD FUNCTION: skipProduct (callable)
// El vendedor salta un producto durante el show
// =============================================================

export const skipProduct = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId, productId } = data as { showId: string; productId: string };
    const callerId = context.auth.uid;
    const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);
    const productRef = db.doc(`${COLLECTIONS.SHOW_PRODUCTS(showId)}/${productId}`);
    const now = admin.firestore.Timestamp.now();

    await db.runTransaction(async (tx) => {
      const [showSnap, productSnap] = await Promise.all([
        tx.get(showRef),
        tx.get(productRef),
      ]);

      if (!showSnap.exists || !productSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Show o producto no encontrado");
      }

      if (showSnap.data()!.sellerId !== callerId) {
        throw new functions.https.HttpsError("permission-denied", "No eres el dueño");
      }

      tx.update(productRef, {
        auctionStatus: "skipped",
        auctionEndedAt: now,
        updatedAt: now,
      });

      const msgRef = db.collection(COLLECTIONS.SHOW_MESSAGES(showId)).doc();
      tx.set(msgRef, {
        id: msgRef.id,
        showId,
        authorId: "system",
        authorName: "Sistema",
        type: "system",
        text: `⏭ El vendedor saltó "${productSnap.data()!.title}"`,
        createdAt: now,
      });

      // Avanzar al siguiente (read-only en la transacción: hacemos get separado)
      const nextSnap = await db
        .collection(COLLECTIONS.SHOW_PRODUCTS(showId))
        .where("auctionStatus", "==", "waiting")
        .orderBy("sortOrder", "asc")
        .limit(1)
        .get();

      if (nextSnap.empty) {
        tx.update(showRef, { status: "ended", endedAt: now, currentAuctionId: null, updatedAt: now });
        return;
      }

      const next = nextSnap.docs[0];
      const nextData = next.data();
      const timerS = (nextData.timerSeconds as number) ?? 30;
      const endsAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + timerS * 1000);

      tx.update(next.ref, {
        auctionStatus: "active",
        currentBidUsd: nextData.startingPriceUsd,
        auctionStartedAt: now,
        auctionEndsAt: endsAt,
        updatedAt: now,
      });

      tx.update(showRef, {
        currentAuctionId: next.id,
        currentAuctionIndex: nextData.sortOrder,
        updatedAt: now,
      });
    });

    return { success: true };
  });
