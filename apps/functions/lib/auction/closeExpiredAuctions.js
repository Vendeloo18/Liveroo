"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeExpiredAuctions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("../firebase");
const constants_1 = require("../constants");
exports.closeExpiredAuctions = functions
    .region("us-central1")
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("every 10 seconds")
    .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    // Buscar todos los productos activos cuyo timer ya expiró
    const expiredSnap = await firebase_1.db
        .collectionGroup("products")
        .where("auctionStatus", "==", "active")
        .where("auctionEndsAt", "<=", now)
        .limit(20) // procesar en lotes
        .get();
    if (expiredSnap.empty)
        return;
    functions.logger.info(`Cerrando ${expiredSnap.size} subasta(s) expirada(s)`);
    // Leer configuración (tasa de cambio y comisión) una sola vez
    const [rateSnap, commissionSnap] = await Promise.all([
        firebase_1.db.doc(`${constants_1.COLLECTIONS.EXCHANGE_RATES}/${constants_1.EXCHANGE_RATE_DOCS.CURRENT}`).get(),
        firebase_1.db.doc(`${constants_1.COLLECTIONS.CONFIG}/${constants_1.CONFIG_DOCS.COMMISSION}`).get(),
    ]);
    const currentRate = rateSnap.data()?.usdToBs ?? 36;
    const commissionMode = commissionSnap.data()?.mode ?? "seller_collects";
    const platformFeePct = commissionSnap.data()?.platformFeePct ?? 10;
    // Procesar cada subasta expirada en paralelo (con su propia transacción)
    await Promise.allSettled(expiredSnap.docs.map((productDoc) => closeOneAuction({
        productDoc,
        currentRate,
        commissionMode,
        platformFeePct,
        now,
    })));
});
// --------------------------------------------------
// Cierra una subasta específica (transacción atómica)
// --------------------------------------------------
async function closeOneAuction(params) {
    const { productDoc, currentRate, commissionMode, platformFeePct, now } = params;
    const product = productDoc.data();
    const productRef = productDoc.ref;
    // Extraer showId del path: shows/{showId}/products/{productId}
    const showId = productRef.parent.parent.id;
    const productId = productRef.id;
    const showRef = firebase_1.db.doc(`${constants_1.COLLECTIONS.SHOWS}/${showId}`);
    try {
        await firebase_1.db.runTransaction(async (tx) => {
            // Re-leer el producto para garantizar idempotencia
            const freshProduct = (await tx.get(productRef)).data();
            // Doble chequeo: si ya no está active, alguien más lo procesó
            if (freshProduct.auctionStatus !== "active")
                return;
            // Re-chequear que el timer sí expiró (puede haber race con una puja que extendió)
            const auctionEndsAt = freshProduct.auctionEndsAt;
            if (now.toMillis() < auctionEndsAt.toMillis()) {
                // El timer fue extendido por una puja reciente; no cerrar aún
                return;
            }
            const hasWinner = !!freshProduct.currentBidderId;
            if (hasWinner) {
                // ── SUBASTA GANADA ──────────────────────────────────────────
                const finalBidUsd = freshProduct.currentBidUsd;
                const frozenRate = currentRate;
                const finalBidBs = Math.round(finalBidUsd * frozenRate * 100) / 100;
                const commissionUsd = Math.round((finalBidUsd * platformFeePct) / 100 * 100) / 100;
                const sellerReceivesUsd = commissionMode === "platform_collects"
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
                const orderRef = firebase_1.db.collection(constants_1.COLLECTIONS.ORDERS).doc();
                const sellerSnap = await tx.get(firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${freshProduct.sellerId}`));
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
                const msgRef = firebase_1.db.collection(constants_1.COLLECTIONS.SHOW_MESSAGES(showId)).doc();
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
            }
            else {
                // ── SIN GANADOR ──────────────────────────────────────────────
                tx.update(productRef, {
                    auctionStatus: "unsold",
                    auctionEndedAt: now,
                    updatedAt: now,
                });
                const msgRef = firebase_1.db.collection(constants_1.COLLECTIONS.SHOW_MESSAGES(showId)).doc();
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
    }
    catch (err) {
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
async function advanceToNextProduct(params) {
    const { tx, showRef, showId, currentIndex, now } = params;
    // Buscar el siguiente producto en espera
    const nextProductSnap = await firebase_1.db
        .collection(constants_1.COLLECTIONS.SHOW_PRODUCTS(showId))
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
    const timerSeconds = nextData.timerSeconds ?? 30;
    const auctionEndsAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + timerSeconds * 1000);
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
async function sendAuctionWonNotification(params) {
    try {
        const userSnap = await firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${params.winnerId}`).get();
        if (!userSnap.exists)
            return;
        const fcmToken = userSnap.data().fcmToken;
        if (!fcmToken)
            return;
        await firebase_1.messaging.send({
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
    }
    catch (err) {
        functions.logger.warn("Error enviando FCM auction_won", err);
    }
}
//# sourceMappingURL=closeExpiredAuctions.js.map