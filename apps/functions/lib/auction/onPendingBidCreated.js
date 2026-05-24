"use strict";
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
exports.onPendingBidCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("../firebase");
const constants_1 = require("../constants");
const TIMER_EXTENSION_THRESHOLD_S = 10; // si quedan < 10s, extender
const TIMER_EXTENSION_S = 30; // extiende a 30s
exports.onPendingBidCreated = functions
    .region("us-central1")
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .firestore.document("pendingBids/{pendingBidId}")
    .onCreate(async (snap, context) => {
    const pendingBidId = context.params.pendingBidId;
    const pendingBid = snap.data();
    const { showId, productId, bidderId, bidderName, amountUsd } = pendingBid;
    const pendingBidRef = firebase_1.db.doc(`pendingBids/${pendingBidId}`);
    const productRef = firebase_1.db.doc(`${constants_1.COLLECTIONS.SHOW_PRODUCTS(showId)}/${productId}`);
    const showRef = firebase_1.db.doc(`${constants_1.COLLECTIONS.SHOWS}/${showId}`);
    const bidColRef = firebase_1.db.collection(constants_1.COLLECTIONS.PRODUCT_BIDS(showId, productId));
    const messageColRef = firebase_1.db.collection(constants_1.COLLECTIONS.SHOW_MESSAGES(showId));
    let rejectedReason = null;
    let previousBidderId;
    let previousBidderFcmToken;
    let acceptedBid = false;
    try {
        await firebase_1.db.runTransaction(async (tx) => {
            // ── Leer estado actual (dentro de la transacción) ──────────
            const [productSnap, showSnap] = await Promise.all([
                tx.get(productRef),
                tx.get(showRef),
            ]);
            if (!productSnap.exists || !showSnap.exists) {
                throw new Error("Producto o show no encontrado");
            }
            const product = productSnap.data();
            const show = showSnap.data();
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
            const auctionEndsAt = product.auctionEndsAt;
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
            const minRequired = Math.round((product.currentBidUsd + product.minIncrementUsd) * 100) / 100;
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
                newAuctionEndsAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + TIMER_EXTENSION_S * 1000);
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
    }
    catch (err) {
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
async function sendOutbidNotification(params) {
    try {
        const userSnap = await firebase_1.db
            .doc(`${constants_1.COLLECTIONS.USERS}/${params.outbidUserId}`)
            .get();
        if (!userSnap.exists)
            return;
        const user = userSnap.data();
        const fcmToken = user.fcmToken;
        if (!fcmToken)
            return;
        await firebase_1.messaging.send({
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
    }
    catch (err) {
        functions.logger.warn("Error enviando FCM outbid", err);
    }
}
function formatUsd(amount) {
    return `$${amount.toFixed(2)}`;
}
//# sourceMappingURL=onPendingBidCreated.js.map