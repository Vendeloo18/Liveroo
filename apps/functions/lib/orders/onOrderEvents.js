"use strict";
// =============================================================
// CLOUD FUNCTION: onRatingCreated
// Recalcula el promedio de rating del vendedor cuando
// se agrega una calificación nueva a /ratings
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
exports.onOrderDelivered = exports.onRatingCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("../firebase");
const constants_1 = require("../constants");
exports.onRatingCreated = functions
    .region("us-central1")
    .firestore.document("ratings/{ratingId}")
    .onCreate(async (snap) => {
    const rating = snap.data();
    const sellerId = rating.toUid;
    const score = rating.score;
    const sellerRef = firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${sellerId}`);
    await firebase_1.db.runTransaction(async (tx) => {
        const sellerSnap = await tx.get(sellerRef);
        if (!sellerSnap.exists)
            return;
        const seller = sellerSnap.data();
        const oldCount = seller.ratingCount ?? 0;
        const oldAvg = seller.ratingAvg ?? 0;
        const newCount = oldCount + 1;
        const newAvg = Math.round(((oldAvg * oldCount + score) / newCount) * 100) / 100;
        tx.update(sellerRef, {
            ratingCount: newCount,
            ratingAvg: newAvg,
            updatedAt: admin.firestore.Timestamp.now(),
        });
    });
});
// =============================================================
// CLOUD FUNCTION: onOrderDelivered
// Cuando una orden pasa a 'delivered', crea la entrada de rating
// y envía FCM al comprador invitándolo a calificar
// =============================================================
exports.onOrderDelivered = functions
    .region("us-central1")
    .firestore.document("orders/{orderId}")
    .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    // Solo cuando pasa a 'delivered'
    if (before.status === after.status || after.status !== "delivered")
        return;
    const orderId = change.after.id;
    const buyerId = after.buyerId;
    const now = admin.firestore.Timestamp.now();
    // Notificar al comprador para que califique
    try {
        const userSnap = await firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${buyerId}`).get();
        const fcmToken = userSnap.data()?.fcmToken;
        if (fcmToken) {
            await firebase_1.db
                .collection(constants_1.COLLECTIONS.USERS)
                .doc(buyerId);
            // Importing messaging from firebase.ts
            const { messaging } = await Promise.resolve().then(() => __importStar(require("../firebase")));
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
    }
    catch (err) {
        functions.logger.warn("Error enviando FCM order_delivered", err);
    }
});
//# sourceMappingURL=onOrderEvents.js.map