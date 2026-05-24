// =============================================================
// CLOUD FUNCTIONS: Admin — gestión de vendedores y configuración
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db } from "../firebase";
import { COLLECTIONS, CONFIG_DOCS, EXCHANGE_RATE_DOCS } from "../constants";

// --------------------------------------------------
// Helper: verificar que el caller es admin
// --------------------------------------------------

async function assertAdmin(uid: string) {
  const userSnap = await db.doc(`${COLLECTIONS.USERS}/${uid}`).get();
  if (!userSnap.exists || userSnap.data()!.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo administradores pueden realizar esta acción"
    );
  }
}

// --------------------------------------------------
// approveSeller
// --------------------------------------------------

export const approveSeller = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);

    const { sellerUid } = data as { sellerUid: string };
    const now = admin.firestore.Timestamp.now();

    await db.doc(`${COLLECTIONS.USERS}/${sellerUid}`).update({
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

export const suspendSeller = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);

    const { sellerUid } = data as { sellerUid: string };
    const now = admin.firestore.Timestamp.now();

    await db.doc(`${COLLECTIONS.USERS}/${sellerUid}`).update({
      sellerStatus: "suspended",
      updatedAt: now,
    });

    return { success: true };
  });

// --------------------------------------------------
// updateExchangeRate
// --------------------------------------------------

export const updateExchangeRate = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);

    const { usdToBs } = data as { usdToBs: number };
    if (!usdToBs || usdToBs <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "Tasa inválida");
    }

    const now = admin.firestore.Timestamp.now();
    const rateRef = db.doc(`${COLLECTIONS.EXCHANGE_RATES}/${EXCHANGE_RATE_DOCS.CURRENT}`);

    await rateRef.set({
      id: EXCHANGE_RATE_DOCS.CURRENT,
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

export const updateCommissionConfig = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    await assertAdmin(context.auth.uid);

    const { mode, platformFeePct } = data as {
      mode: "platform_collects" | "seller_collects";
      platformFeePct: number;
    };

    if (!["platform_collects", "seller_collects"].includes(mode)) {
      throw new functions.https.HttpsError("invalid-argument", "Modo de comisión inválido");
    }
    if (platformFeePct < 0 || platformFeePct > 100) {
      throw new functions.https.HttpsError("invalid-argument", "Porcentaje debe ser 0-100");
    }

    const now = admin.firestore.Timestamp.now();
    await db.doc(`${COLLECTIONS.CONFIG}/${CONFIG_DOCS.COMMISSION}`).set({
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

export const generateAgoraToken = functions
  .region("us-central1")
  .runWith({ secrets: ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");

    const { showId, role } = data as { showId: string; role: "publisher" | "subscriber" };

    // Verificar que el show existe y el caller tiene acceso
    const showSnap = await db.doc(`${COLLECTIONS.SHOWS}/${showId}`).get();
    if (!showSnap.exists) throw new functions.https.HttpsError("not-found", "Show no encontrado");

    const show = showSnap.data()!;
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
