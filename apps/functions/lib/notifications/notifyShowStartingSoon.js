"use strict";
// =============================================================
// CLOUD FUNCTION: notifyShowStartingSoon
// Corre cada minuto y notifica vía FCM a compradores que
// siguen a un vendedor cuyo show empieza en ~5 minutos.
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
exports.notifyShowStartingSoon = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("../firebase");
const constants_1 = require("../constants");
exports.notifyShowStartingSoon = functions
    .region("us-central1")
    .pubsub.schedule("every 1 minutes")
    .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const fiveMinutesFromNow = admin.firestore.Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000);
    const sixMinutesFromNow = admin.firestore.Timestamp.fromMillis(now.toMillis() + 6 * 60 * 1000);
    // Shows que empiezan entre 5 y 6 minutos desde ahora y aún no notificaron
    const showsSnap = await firebase_1.db
        .collection(constants_1.COLLECTIONS.SHOWS)
        .where("status", "==", "scheduled")
        .where("scheduledAt", ">=", fiveMinutesFromNow)
        .where("scheduledAt", "<=", sixMinutesFromNow)
        .where("notifiedScheduled", "==", false)
        .get();
    if (showsSnap.empty)
        return;
    for (const showDoc of showsSnap.docs) {
        const show = showDoc.data();
        try {
            // Topic: todos los suscriptores del vendedor
            // Los clientes se suscriben al topic `seller_{sellerId}` al seguir al vendedor
            await firebase_1.messaging.send({
                topic: `seller_${show.sellerId}`,
                notification: {
                    title: `📡 ${show.sellerName} empieza en 5 minutos`,
                    body: show.title,
                },
                data: {
                    type: "show_starting_soon",
                    showId: showDoc.id,
                },
                android: { priority: "high" },
                apns: { payload: { aps: { sound: "default" } } },
            });
            // Marcar como notificado
            await showDoc.ref.update({ notifiedScheduled: true });
            functions.logger.info("FCM show_starting_soon enviado", {
                showId: showDoc.id,
                sellerId: show.sellerId,
            });
        }
        catch (err) {
            functions.logger.error("Error enviando FCM show_starting_soon", {
                showId: showDoc.id,
                error: err,
            });
        }
    }
});
//# sourceMappingURL=notifyShowStartingSoon.js.map