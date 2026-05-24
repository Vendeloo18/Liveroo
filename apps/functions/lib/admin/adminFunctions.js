"use strict";
// =============================================================
// CLOUD FUNCTIONS: Admin — gestión de vendedores y configuración
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
exports.generateAgoraToken = exports.updateCommissionConfig = exports.updateExchangeRate = exports.suspendSeller = exports.approveSeller = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firebase_1 = require("../firebase");
const constants_1 = require("../constants");
// --------------------------------------------------
// Helper: verificar que el caller es admin
// --------------------------------------------------
async function assertAdmin(uid) {
    const userSnap = await firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${uid}`).get();
    if (!userSnap.exists || userSnap.data().role !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "Solo administradores pueden realizar esta acción");
    }
}
// --------------------------------------------------
// approveSeller
// --------------------------------------------------
exports.approveSeller = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);
    const { sellerUid } = data;
    const now = admin.firestore.Timestamp.now();
    await firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${sellerUid}`).update({
        role: "seller",
        sellerStatus: "approved",
        sellerApprovedAt: now,
        sellerApprovedBy: context.auth.uid,
        updatedAt: now,
    });
    functions.logger.info("Vendedor aprobado", { sellerUid, by: context.auth.uid });
    return { success: true };
});
// --------------------------------------------------
// suspendSeller
// --------------------------------------------------
exports.suspendSeller = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);
    const { sellerUid } = data;
    const now = admin.firestore.Timestamp.now();
    await firebase_1.db.doc(`${constants_1.COLLECTIONS.USERS}/${sellerUid}`).update({
        sellerStatus: "suspended",
        updatedAt: now,
    });
    return { success: true };
});
// --------------------------------------------------
// updateExchangeRate
// --------------------------------------------------
exports.updateExchangeRate = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);
    const { usdToBs } = data;
    if (!usdToBs || usdToBs <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Tasa inválida");
    }
    const now = admin.firestore.Timestamp.now();
    const rateRef = firebase_1.db.doc(`${constants_1.COLLECTIONS.EXCHANGE_RATES}/${constants_1.EXCHANGE_RATE_DOCS.CURRENT}`);
    await rateRef.set({
        id: constants_1.EXCHANGE_RATE_DOCS.CURRENT,
        usdToBs,
        updatedAt: now,
        updatedBy: context.auth.uid,
    });
    functions.logger.info("Tasa actualizada", { usdToBs, by: context.auth.uid });
    return { success: true };
});
// --------------------------------------------------
// updateCommissionConfig
// --------------------------------------------------
exports.updateCommissionConfig = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);
    const { mode, platformFeePct } = data;
    if (!["platform_collects", "seller_collects"].includes(mode)) {
        throw new functions.https.HttpsError("invalid-argument", "Modo de comisión inválido");
    }
    if (platformFeePct < 0 || platformFeePct > 100) {
        throw new functions.https.HttpsError("invalid-argument", "Porcentaje debe ser 0-100");
    }
    const now = admin.firestore.Timestamp.now();
    await firebase_1.db.doc(`${constants_1.COLLECTIONS.CONFIG}/${constants_1.CONFIG_DOCS.COMMISSION}`).set({
        mode,
        platformFeePct,
        updatedAt: now,
        updatedBy: context.auth.uid,
    });
    return { success: true };
});
// --------------------------------------------------
// generateAgoraToken (callable - para el vendedor broadcaster)
// En producción usar Agora Token Server; aquí generamos
// un placeholder. Integrar con Agora Token Builder.
// --------------------------------------------------
exports.generateAgoraToken = functions
    .region("us-central1")
    .runWith({ secrets: ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    const { showId, role } = data;
    // Verificar que el show existe y el caller tiene acceso
    const showSnap = await firebase_1.db.doc(`${constants_1.COLLECTIONS.SHOWS}/${showId}`).get();
    if (!showSnap.exists)
        throw new functions.https.HttpsError("not-found", "Show no encontrado");
    const show = showSnap.data();
    if (role === "publisher" && show.sellerId !== context.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "Solo el vendedor puede transmitir");
    }
    // ⚠️  INTEGRAR CON AGORA TOKEN BUILDER:
    // const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
    // const appId = process.env.AGORA_APP_ID;
    // const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    // const channelName = show.agoraChannelName;
    // const uid = 0;
    // const expirationTimeInSeconds = 3600;
    // const currentTimestamp = Math.floor(Date.now() / 1000);
    // const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    // const agoraRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    // const token = RtcTokenBuilder.buildTokenWithUid(
    //   appId, appCertificate, channelName, uid, agoraRole, privilegeExpiredTs
    // );
    // Por ahora devolver channel name para que el cliente pueda conectar sin token
    // en modo de prueba (Agora permite esto con APP_ID solo en modo testing)
    return {
        channelName: show.agoraChannelName,
        token: null, // reemplazar con token real
        appId: process.env.AGORA_APP_ID ?? "TU_AGORA_APP_ID",
    };
});
//# sourceMappingURL=adminFunctions.js.map