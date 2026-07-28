// =============================================================
// CLOUD FUNCTIONS: Admin — gestión de vendedores y configuración
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp } from "firebase-admin/firestore";
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
    const now = Timestamp.now();

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
    const now = Timestamp.now();

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

    const now = Timestamp.now();
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

    const now = Timestamp.now();
    await db.doc(`${COLLECTIONS.CONFIG}/${CONFIG_DOCS.COMMISSION}`).set({
      mode,
      platformFeePct,
      updatedAt: now,
      updatedBy: context.auth.uid,
    });

    return { success: true };
  });

// --------------------------------------------------
// generateAgoraToken (callable — token de transmisión)
// --------------------------------------------------
// TODAVÍA NO IMPLEMENTADA. Antes declaraba
// runWith({ secrets: ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"] }),
// y como esos secrets no existen en el proyecto, hacían fallar el
// despliegue COMPLETO de functions — no solo el de esta.
//
// Se deja sin secrets para que el resto pueda desplegarse, y falla con
// un mensaje claro en vez de devolver un token nulo que el cliente
// interpretaba como válido.
//
// Para terminarla:
//   1. firebase functions:secrets:set AGORA_APP_ID
//   2. firebase functions:secrets:set AGORA_APP_CERTIFICATE
//   3. pnpm --filter functions add agora-token
//   4. Devolver aquí RtcTokenBuilder.buildTokenWithUid(...) y volver a
//      declarar los secrets en runWith.

export const generateAgoraToken = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "No autenticado");

    const { showId, role } = (data ?? {}) as { showId?: string; role?: "publisher" | "subscriber" };
    if (!showId) throw new functions.https.HttpsError("invalid-argument", "showId es requerido");

    const showSnap = await db.doc(`${COLLECTIONS.SHOWS}/${showId}`).get();
    if (!showSnap.exists) throw new functions.https.HttpsError("not-found", "Show no encontrado");

    if (role === "publisher" && showSnap.data()!.sellerId !== context.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Solo el vendedor puede transmitir");
    }

    throw new functions.https.HttpsError(
      "failed-precondition",
      "La generación de tokens de Agora todavía no está configurada en este proyecto."
    );
  });
