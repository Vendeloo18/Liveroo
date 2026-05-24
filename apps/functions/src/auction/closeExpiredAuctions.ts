// =============================================================
// CLOUD FUNCTION: closeExpiredAuctions
// =============================================================
// Corre cada 10 segundos vía Cloud Scheduler / Pub-Sub.
// Busca productos con auctionStatus = 'active' cuyo
// auctionEndsAt ya pasó y los cierra atómicamente.
//
// Flujo de cierre:
//   1. Congela la tasa de cambio actual
//   2. Calcula monto en Bs
//   3. Crea la Orden
//   4. Actualiza el producto (sold / unsold)
//   5. Lanza FCM al ganador
//   6. Inicia el siguiente producto del show (si hay)
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db, messaging } from "../firebase";
import {
  COLLECTIONS,
  CONFIG_DOCS,
  EXCHANGE_RATE_DOCS,
  CommissionMode,
} from "../constants";

export const closeExpiredAuctions = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("every 10 seconds")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    // Buscar todos los productos activos cuyo timer ya expiró
    const expiredSnap = await db
      .collectionGroup("products")
      .where("auctionStatus", "==", "active")
      .where("auctionEndsAt", "<=", now)
      .limit(20) // procesar en lotes
      .get();

    if (expiredSnap.empty) return;

    functions.logger.info(`Cerrando ${expiredSnap.size} subasta(s) expirada(s)`);

    // Leer configuración (tasa de cambio y comisión) una sola vez
    const [rateSnap, commissionSnap] = await Promise.all([
      db.doc(`${COLLECTIONS.EXCHANGE_RATES}/${EXCHANGE_RATE_DOCS.CURRENT}`).get(),
      db.doc(`${COLLECTIONS.CONFIG}/${CONFIG_DOCS.COMMISSION}`).get(),
    ]);

    const currentRate = (rateSnap.data()?.usdToBs as number) ?? 36;
    const commissionMode = (commissionSnap.data()?.mode as CommissionMode) ?? "seller_collects";
    const platformFeePct = (commissionSnap.data()?.platformFeePct as number) ?? 10;

    // Procesar cada subasta expirada en paralelo (con su propia transacción)
    await Promise.allSettled(
      expiredSnap.docs.map((productDoc) =>
        closeOneAuction({
          productDoc,
          currentRate,
          commissionMode,
          platformFeePct,
          now,
        })
      )
    );
  });

// --------------------------------------------------
// Cierra una subasta específica (transacción atómica)
// --------------------------------------------------

async function closeOneAuction(params: {
  productDoc: admin.firestore.QueryDocumentSnapshot;
  currentRate: number;
  commissionMode: CommissionMode;
  platformFeePct: number;
  now: admin.firestore.Timestamp;
}) {
  const { productDoc, currentRate, commissionMode, platformFeePct, now } = params;
  const product = productDoc.data();
  const productRef = productDoc.ref;

  // Extraer showId del path: shows/{showId}/products/{productId}
  const showId = productRef.parent.parent!.id;
  const productId = productRef.id;
  const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);

  try {
    await db.runTransaction(async (tx) => {
      // Re-leer el producto para garantizar idempotencia
      const freshProduct = (await tx.get(productRef)).data()!;

      // Doble chequeo: si ya no está active, alguien más lo procesó
      if (freshProduct.auctionStatus !== "active") return;

      // Re-chequear que el timer sí expiró (puede haber race con una puja que extendió)
      const auctionEndsAt = freshProduct.auctionEndsAt as admin.firestore.Timestamp;
      if (now.toMillis() < auctionEndsAt.toMillis()) {
        // El timer fue extendido por una puja reciente; no cerrar aún
        return;
      }

      const hasWinner = !!freshProduct.currentBidderId;

      if (hasWinner) {
        // ── SUBASTA GANADA ──────────────────────────────────────────
        const finalBidUsd = freshProduct.currentBidUsd as number;
        const frozenRate = currentRate;
        const finalBidBs = Math.round(finalBidUsd * frozenRate * 100) / 100;
        const commissionUsd = Math.round((finalBidUsd * platformFeePct) / 100 * 100) / 100;
        const sellerReceivesUsd =
          commissionMode === "platform_collects"
            ? Math.round((finalBidUsd - commissionUsd) * 100) / 100
            : finalBidUsd; // vendedor cobra directo; plataforma solo registra

        // Actualizar producto
        tx.update(productRef, {
          auctionStatus: "sold",
          auctionEndedAt: now,
          winnerUid: freshProduct.currentBidderId,
          winnerName: freshProduct.currentBidderName,
          finalBidUsd,
          frozenExchangeRate: frozenRate,
          finalBidBs,
          updatedAt: now,
        });

        // Crear orden
        const orderRef = db.collection(COLLECTIONS.ORDERS).doc();
        const sellerSnap = await tx.get(db.doc(`${COLLECTIONS.USERS}/${freshProduct.sellerId}`));
        const sellerData = sellerSnap.data() ?? {};

        tx.set(orderRef, {
          id: orderRef.id,
          showId,
          productId,
          buyerId: freshProduct.currentBidderId,
          buyerName: freshProduct.currentBidderName,
          buyerWhatsapp: null,
          sellerId: freshProduct.sellerId,
          sellerName: freshProduct.sellerName,
          sellerWhatsapp: sellerData.whatsapp ?? null,
          // Montos
          bidAmountUsd: finalBidUsd,
          frozenExchangeRate: frozenRate,
          bidAmountBs: finalBidBs,
          // Comisión
          commissionMode,
          platformFeePct,
          commissionUsd,
          sellerReceivesUsd,
          // Estado
          status: "pending_payment",
          paymentMethod: null,
          paymentReference: null,
          paymentConfirmedAt: null,
          paymentConfirmedBy: null,
          whatsappMessageSent: false,
          // Rating
          ratingGiven: null,
          ratingComment: null,
          ratingAt: null,
          // Meta
          createdAt: now,
          updatedAt: now,
        });

        // Mensaje de sistema en chat
        const msgRef = db.collection(COLLECTIONS.SHOW_MESSAGES(showId)).doc();
        tx.set(msgRef, {
          id: msgRef.id,
          showId,
          authorId: "system",
          authorName: "Sistema",
          type: "auction_won",
          text: `🏆 ¡${freshProduct.currentBidderName} ganó por $${finalBidUsd.toFixed(2)}!`,
          createdAt: now,
        });

        // ── Avanzar al siguiente producto ───────────────────────────
        await advanceToNextProduct({ tx, showRef, showId, currentIndex: product.sortOrder, now });

        // ── FCM al ganador (fuera de tx, pero lo encolamos) ─────────
        // No puede estar en la transacción; lo hacemos post-commit
        // Guardamos el uid para disparar después
        setTimeout(() => {
          sendAuctionWonNotification({
            winnerId: freshProduct.currentBidderId,
            showId,
            productId,
            orderId: orderRef.id,
            productTitle: freshProduct.title,
            finalBidUsd,
          });
        }, 0);
      } else {
        // ── SIN GANADOR ──────────────────────────────────────────────
        tx.update(productRef, {
          auctionStatus: "unsold",
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
          text: `❌ ${freshProduct.title} quedó sin ganador.`,
          createdAt: now,
        });

        await advanceToNextProduct({ tx, showRef, showId, currentIndex: product.sortOrder, now });
      }
    });
  } catch (err) {
    functions.logger.error("Error cerrando subasta", {
      showId,
      productId,
      error: err,
    });
  }
}

// --------------------------------------------------
// Avanza al siguiente producto del show
// Si no hay más, cierra el show
// --------------------------------------------------

async function advanceToNextProduct(params: {
  tx: admin.firestore.Transaction;
  showRef: admin.firestore.DocumentReference;
  showId: string;
  currentIndex: number;
  now: admin.firestore.Timestamp;
}) {
  const { tx, showRef, showId, currentIndex, now } = params;

  // Buscar el siguiente producto en espera
  const nextProductSnap = await db
    .collection(COLLECTIONS.SHOW_PRODUCTS(showId))
    .where("auctionStatus", "==", "waiting")
    .orderBy("sortOrder", "asc")
    .limit(1)
    .get();

  if (nextProductSnap.empty) {
    // No hay más productos → cerrar el show
    tx.update(showRef, {
      status: "ended",
      endedAt: now,
      currentAuctionId: null,
      updatedAt: now,
    });
    return;
  }

  const nextProduct = nextProductSnap.docs[0];
  const nextProductRef = nextProduct.ref;
  const nextData = nextProduct.data();
  const timerSeconds = (nextData.timerSeconds as number) ?? 30;

  const auctionEndsAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + timerSeconds * 1000
  );

  // Activar siguiente producto
  tx.update(nextProductRef, {
    auctionStatus: "active",
    currentBidUsd: nextData.startingPriceUsd,
    auctionStartedAt: now,
    auctionEndsAt,
    updatedAt: now,
  });

  // Actualizar show con la referencia al nuevo producto
  tx.update(showRef, {
    currentAuctionId: nextProduct.id,
    currentAuctionIndex: nextData.sortOrder,
    updatedAt: now,
  });
}

// --------------------------------------------------
// FCM: ganaste la subasta
// --------------------------------------------------

async function sendAuctionWonNotification(params: {
  winnerId: string;
  showId: string;
  productId: string;
  orderId: string;
  productTitle: string;
  finalBidUsd: number;
}) {
  try {
    const userSnap = await db.doc(`${COLLECTIONS.USERS}/${params.winnerId}`).get();
    if (!userSnap.exists) return;
    const fcmToken = userSnap.data()!.fcmToken as string | undefined;
    if (!fcmToken) return;

    await messaging.send({
      token: fcmToken,
      notification: {
        title: "🏆 ¡Ganaste la subasta!",
        body: `"${params.productTitle}" es tuyo por $${params.finalBidUsd.toFixed(2)}`,
      },
      data: {
        type: "auction_won",
        showId: params.showId,
        productId: params.productId,
        orderId: params.orderId,
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    });
  } catch (err) {
    functions.logger.warn("Error enviando FCM auction_won", err);
  }
}
