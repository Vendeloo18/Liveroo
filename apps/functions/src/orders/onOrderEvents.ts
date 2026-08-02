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
import { otorgarLoosSeguro } from "../loyalty/loos";
import { leerReglas, loosPorOrden } from "../loyalty/reglas";

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

    // LOOS por calificar. El ID del rating ES el orderId (una orden, una
    // calificación), así que este bono no se puede cobrar dos veces.
    const reglas = await leerReglas();
    await otorgarLoosSeguro(
      [{
        movimientoId: `rating_${snap.id}`,
        userId: rating.fromUid as string,
        tipo: "rating",
        cantidad: reglas.bonos.calificar,
        orderId: (rating.orderId as string) ?? snap.id,
        nota: "Bono por calificar tu compra",
      }],
      { ratingId: snap.id },
    );
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
    const sellerId = after.sellerId as string;
    const now = Timestamp.now();

    // ── LOOS ──────────────────────────────────────────────────
    // Aquí es donde el programa de puntos toca la realidad: la orden se
    // entregó, hubo plata de verdad y ambas partes cumplieron. 1 LOO por
    // dólar a cada lado, más el bono de "primera vez" que cada quien
    // tenga pendiente. Los IDs determinísticos hacen que un reintento del
    // trigger no regale nada.
    const reglas = await leerReglas();
    const puntos = loosPorOrden(after.bidAmountUsd as number, reglas.loosPorUsd);
    await otorgarLoosSeguro(
      [
        { movimientoId: `order_${orderId}_buyer`, userId: buyerId, tipo: "order_buyer", cantidad: puntos, orderId, nota: "Compra entregada" },
        { movimientoId: `order_${orderId}_seller`, userId: sellerId, tipo: "order_seller", cantidad: puntos, orderId, nota: "Venta entregada" },
        { movimientoId: `firstpurchase_${buyerId}`, userId: buyerId, tipo: "first_purchase", cantidad: reglas.bonos.primeraCompra, orderId, nota: "Bono por tu primera compra" },
        { movimientoId: `firstsale_${sellerId}`, userId: sellerId, tipo: "first_sale", cantidad: reglas.bonos.primeraVenta, orderId, nota: "Bono por tu primera venta" },
      ],
      { orderId },
    );

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
