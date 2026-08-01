// =============================================================
// CLOUD FUNCTIONS: acciones sobre órdenes (callables)
// =============================================================
// advanceOrder — máquina de estados del ciclo de una orden.
//   Antes el cliente escribía el status directo y las reglas solo
//   validaban el destino: un vendedor podía saltar a "shipped",
//   devolver una entregada o cancelar una pagada. Ahora la única
//   vía es esta Function, que valida la transición de ORIGEN:
//     pending_payment → payment_confirmed   (vendedor)
//     payment_confirmed → shipped           (vendedor)
//     shipped → delivered                   (comprador)
//   Cancelar y disputar quedan para el admin (reglas isAdmin).
//
// submitRating — calificación atada a la orden.
//   Antes cualquier usuario podía crear ratings ilimitados a
//   cualquier UID. Ahora: solo el comprador, solo con la orden
//   entregada, y UNA vez — el doc de rating usa el orderId como
//   ID, así el duplicado es imposible por construcción.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

const METODOS_PAGO = ["pago_movil", "zelle", "binance", "efectivo", "wallet"];

export const advanceOrder = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    const { orderId, action, paymentMethod, paymentReference } = (data ?? {}) as {
      orderId?: string;
      action?: string;
      paymentMethod?: string;
      paymentReference?: string;
    };
    if (!orderId || !action) {
      throw new functions.https.HttpsError("invalid-argument", "orderId y action son requeridos");
    }

    const uid = context.auth.uid;
    const orderRef = db.doc(`${COLLECTIONS.ORDERS}/${orderId}`);
    const now = Timestamp.now();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Orden no encontrada");
      }
      const o = snap.data()!;

      if (action === "confirm_payment") {
        if (o.sellerId !== uid) {
          throw new functions.https.HttpsError("permission-denied", "Solo el vendedor confirma el pago");
        }
        if (o.status !== "pending_payment") {
          throw new functions.https.HttpsError("failed-precondition", `La orden está en '${o.status}', no se puede confirmar el pago`);
        }
        const method = typeof paymentMethod === "string" && METODOS_PAGO.includes(paymentMethod) ? paymentMethod : null;
        const ref = typeof paymentReference === "string" ? paymentReference.trim().slice(0, 60) : null;
        tx.update(orderRef, {
          status: "payment_confirmed",
          paymentConfirmedAt: now,
          paymentConfirmedBy: uid,
          ...(method ? { paymentMethod: method } : {}),
          ...(ref ? { paymentReference: ref } : {}),
          updatedAt: now,
        });
        return;
      }

      if (action === "mark_shipped") {
        if (o.sellerId !== uid) {
          throw new functions.https.HttpsError("permission-denied", "Solo el vendedor marca el envío");
        }
        if (o.status !== "payment_confirmed") {
          throw new functions.https.HttpsError("failed-precondition", `La orden está en '${o.status}', no se puede marcar enviada`);
        }
        tx.update(orderRef, { status: "shipped", shippedAt: now, updatedAt: now });
        return;
      }

      if (action === "mark_delivered") {
        if (o.buyerId !== uid) {
          throw new functions.https.HttpsError("permission-denied", "Solo el comprador confirma que recibió");
        }
        if (o.status !== "shipped") {
          throw new functions.https.HttpsError("failed-precondition", `La orden está en '${o.status}', no se puede marcar entregada`);
        }
        tx.update(orderRef, { status: "delivered", deliveredAt: now, updatedAt: now });
        return;
      }

      throw new functions.https.HttpsError("invalid-argument", `Acción desconocida: ${action}`);
    });

    functions.logger.info("Orden avanzada", { orderId, action, uid });
    return { success: true };
  });

export const submitRating = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    const { orderId, score, comment } = (data ?? {}) as {
      orderId?: string;
      score?: number;
      comment?: string;
    };
    if (!orderId || typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new functions.https.HttpsError("invalid-argument", "orderId y un score entero de 1 a 5 son requeridos");
    }
    const texto = typeof comment === "string" ? comment.trim().slice(0, 300) : "";

    const uid = context.auth.uid;
    const orderRef = db.doc(`${COLLECTIONS.ORDERS}/${orderId}`);
    // El ID del rating ES el orderId: una orden, una calificación.
    const ratingRef = db.doc(`ratings/${orderId}`);
    const now = Timestamp.now();

    await db.runTransaction(async (tx) => {
      const [orderSnap, ratingSnap, userSnap] = await Promise.all([
        tx.get(orderRef),
        tx.get(ratingRef),
        tx.get(db.doc(`${COLLECTIONS.USERS}/${uid}`)),
      ]);

      if (!orderSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Orden no encontrada");
      }
      const o = orderSnap.data()!;

      if (o.buyerId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Solo el comprador de la orden puede calificar");
      }
      if (o.status !== "delivered") {
        throw new functions.https.HttpsError("failed-precondition", "Solo se califica una orden entregada");
      }
      if (ratingSnap.exists || o.ratingGiven != null) {
        throw new functions.https.HttpsError("already-exists", "Esta orden ya tiene calificación");
      }

      // onRatingCreated recalcula la reputación del vendedor al ver
      // nacer este doc; como nace una sola vez, suma una sola vez.
      tx.set(ratingRef, {
        id: orderId,
        orderId,
        fromUid: uid,
        fromName: (userSnap.data()?.displayName as string) ?? "",
        toUid: o.sellerId,
        score,
        comment: texto,
        createdAt: now,
      });
      tx.update(orderRef, {
        ratingGiven: score,
        ratingComment: texto || null,
        ratingAt: now,
        updatedAt: now,
      });
    });

    functions.logger.info("Calificación registrada", { orderId, score, uid });
    return { success: true };
  });
