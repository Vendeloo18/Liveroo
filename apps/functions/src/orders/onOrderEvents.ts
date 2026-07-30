// =============================================================
// CLOUD FUNCTION: onRatingCreated
// Recalcula el promedio de rating del vendedor cuando
// se agrega una calificación nueva a /ratings
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";
import { tokenParaAviso } from "../notifications/destinatario";

export const onRatingCreated = functions
  .region("us-central1")
  .firestore.document("ratings/{ratingId}")
  .onCreate(async (snap) => {
    const rating = snap.data();
    const sellerId = rating.toUid as string;
    const score = rating.score as number;

    const sellerRef = db.doc(`${COLLECTIONS.USERS}/${sellerId}`);

    await db.runTransaction(async (tx) => {
      const sellerSnap = await tx.get(sellerRef);
      if (!sellerSnap.exists) return;

      const seller = sellerSnap.data()!;
      const oldCount = (seller.ratingCount as number) ?? 0;
      const oldAvg = (seller.ratingAvg as number) ?? 0;

      const newCount = oldCount + 1;
      const newAvg = Math.round(((oldAvg * oldCount + score) / newCount) * 100) / 100;

      tx.update(sellerRef, {
        ratingCount: newCount,
        ratingAvg: newAvg,
        updatedAt: Timestamp.now(),
      });
    });
  });

// =============================================================
// CLOUD FUNCTION: onOrderDelivered
// Cuando una orden pasa a 'delivered', crea la entrada de rating
// y envía FCM al comprador invitándolo a calificar
// =============================================================

export const onOrderDelivered = functions
  .region("us-central1")
  .firestore.document("orders/{orderId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Solo cuando pasa a 'delivered'
    if (before.status === after.status || after.status !== "delivered") return;

    const orderId = change.after.id;
    const buyerId = after.buyerId as string;
    const now = Timestamp.now();

    // Notificar al comprador para que califique
    try {
      const fcmToken = await tokenParaAviso(buyerId, "ordenes");

      if (fcmToken) {
        const { messaging } = await import("../firebase");
        await messaging.send({
          token: fcmToken,
          notification: {
            title: "📦 ¡Tu pedido fue entregado!",
            body: "¿Cómo fue tu experiencia? Deja tu calificación.",
          },
          data: {
            type: "order_confirmed",
            orderId,
          },
        });
      }
    } catch (err) {
      functions.logger.warn("Error enviando FCM order_delivered", err);
    }
  });
