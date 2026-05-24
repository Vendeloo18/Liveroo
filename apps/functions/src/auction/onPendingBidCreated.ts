// =============================================================
// CLOUD FUNCTION: onPendingBidCreated
// =============================================================
// Se dispara cuando el cliente crea un documento en /pendingBids.
// Valida la puja con una transacción atómica y:
//   1. Verifica que la subasta siga activa
//   2. Verifica que el monto supere el mínimo
//   3. Actualiza currentBid en el producto (atomic)
//   4. Extiende el timer si quedan < umbral segundos
//   5. Registra la puja en /shows/{showId}/products/{productId}/bids
//   6. Marca el pendingBid como processed o rejected
//   7. Envía notificación FCM al pujador anterior (outbid)
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db, messaging } from "../firebase";
import {
  COLLECTIONS,
  BidRejectedReason,
} from "../constants";

const TIMER_EXTENSION_THRESHOLD_S = 10; // si quedan < 10s, extender
const TIMER_EXTENSION_S = 30;           // extiende a 30s

interface PendingBidData {
  showId: string;
  productId: string;
  bidderId: string;
  bidderName: string;
  amountUsd: number;
  submittedAt: admin.firestore.Timestamp;
  status: "pending" | "processed" | "rejected";
}

export const onPendingBidCreated = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .firestore.document("pendingBids/{pendingBidId}")
  .onCreate(async (snap, context) => {
    const pendingBidId = context.params.pendingBidId;
    const pendingBid = snap.data() as PendingBidData;

    const { showId, productId, bidderId, bidderName, amountUsd } = pendingBid;

    const pendingBidRef = db.doc(`pendingBids/${pendingBidId}`);
    const productRef = db.doc(`${COLLECTIONS.SHOW_PRODUCTS(showId)}/${productId}`);
    const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);
    const bidColRef = db.collection(COLLECTIONS.PRODUCT_BIDS(showId, productId));
    const messageColRef = db.collection(COLLECTIONS.SHOW_MESSAGES(showId));

    let rejectedReason: BidRejectedReason | null = null;
    let previousBidderId: string | undefined;
    let previousBidderFcmToken: string | undefined;
    let acceptedBid = false;

    try {
      await db.runTransaction(async (tx) => {
        // ── Leer estado actual (dentro de la transacción) ──────────
        const [productSnap, showSnap] = await Promise.all([
          tx.get(productRef),
          tx.get(showRef),
        ]);

        if (!productSnap.exists || !showSnap.exists) {
          throw new Error("Producto o show no encontrado");
        }

        const product = productSnap.data()!;
        const show = showSnap.data()!;

        // ── Validaciones ────────────────────────────────────────────

        // 1. Show debe estar en vivo
        if (show.status !== "live") {
          rejectedReason = "auction_closed";
          return;
        }

        // 2. Producto debe estar activo
        if (product.auctionStatus !== "active") {
          rejectedReason = "auction_closed";
          return;
        }

        // 3. La subasta no debe haber expirado
        const now = admin.firestore.Timestamp.now();
        const auctionEndsAt = product.auctionEndsAt as admin.firestore.Timestamp;
        if (now.toMillis() > auctionEndsAt.toMillis()) {
          rejectedReason = "auction_closed";
          return;
        }

        // 4. No puede pujarse a sí mismo
        if (product.currentBidderId === bidderId) {
          rejectedReason = "own_bid";
          return;
        }

        // 5. Monto mínimo = currentBid + minIncrement
        const minRequired =
          Math.round((product.currentBidUsd + product.minIncrementUsd) * 100) / 100;

        if (amountUsd < minRequired) {
          rejectedReason = "too_low";
          return;
        }

        // ── Puja aceptada: actualizar estado ────────────────────────

        previousBidderId = product.currentBidderId;

        // Calcular nuevo auctionEndsAt
        const remainingMs = auctionEndsAt.toMillis() - now.toMillis();
        const remainingS = remainingMs / 1000;
        let newAuctionEndsAt = auctionEndsAt;

        if (remainingS < TIMER_EXTENSION_THRESHOLD_S) {
          // Extender el timer
          newAuctionEndsAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + TIMER_EXTENSION_S * 1000
          );
        }

        // Actualizar producto
        tx.update(productRef, {
          currentBidUsd: amountUsd,
          currentBidderId: bidderId,
          currentBidderName: bidderName,
          auctionEndsAt: newAuctionEndsAt,
          updatedAt: now,
        });

        // Registrar bid en sub-colección
        const bidRef = bidColRef.doc();
        tx.set(bidRef, {
          id: bidRef.id,
          showId,
          productId,
          bidderId,
          bidderName,
          amountUsd,
          placedAt: now,
          accepted: true,
        });

        // Mensaje de sistema en chat
        const msgRef = messageColRef.doc();
        tx.set(msgRef, {
          id: msgRef.id,
          showId,
          authorId: "system",
          authorName: "Sistema",
          type: "bid_placed",
          text: `💰 ${bidderName} pujó ${formatUsd(amountUsd)}`,
          createdAt: now,
        });

        // Marcar pendingBid como procesado
        tx.update(pendingBidRef, {
          status: "processed",
          processedAt: now,
        });

        acceptedBid = true;
      });

      // ── Fuera de la transacción: FCM notificación "te superaron" ──
      if (acceptedBid && previousBidderId) {
        await sendOutbidNotification({
          outbidUserId: previousBidderId,
          showId,
          productId,
          newBidUsd: amountUsd,
          newBidderName: bidderName,
        });
      }
    } catch (err) {
      functions.logger.error("Error procesando puja", {
        pendingBidId,
        showId,
        productId,
        error: err,
      });

      // En caso de error no manejado, marcar como rechazada
      if (!acceptedBid) {
        await pendingBidRef.update({
          status: "rejected",
          rejectedReason: "race_condition",
          processedAt: admin.firestore.Timestamp.now(),
        });
      }
      return;
    }

    // Si fue rechazada por validación de negocio, actualizar pendingBid
    if (rejectedReason && !acceptedBid) {
      await pendingBidRef.update({
        status: "rejected",
        rejectedReason,
        processedAt: admin.firestore.Timestamp.now(),
      });

      functions.logger.info("Puja rechazada", {
        pendingBidId,
        bidderId,
        amountUsd,
        reason: rejectedReason,
      });
    }
  });

// --------------------------------------------------
// Notificación FCM: "te superaron"
// --------------------------------------------------

async function sendOutbidNotification(params: {
  outbidUserId: string;
  showId: string;
  productId: string;
  newBidUsd: number;
  newBidderName: string;
}) {
  try {
    const userSnap = await db
      .doc(`${COLLECTIONS.USERS}/${params.outbidUserId}`)
      .get();
    if (!userSnap.exists) return;

    const user = userSnap.data()!;
    const fcmToken = user.fcmToken as string | undefined;
    if (!fcmToken) return;

    await messaging.send({
      token: fcmToken,
      notification: {
        title: "¡Te superaron en la puja!",
        body: `${params.newBidderName} pujó ${formatUsd(params.newBidUsd)}. ¡Vuelve a pujar!`,
      },
      data: {
        type: "outbid",
        showId: params.showId,
        productId: params.productId,
        newBidUsd: String(params.newBidUsd),
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    });
  } catch (err) {
    functions.logger.warn("Error enviando FCM outbid", err);
  }
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
