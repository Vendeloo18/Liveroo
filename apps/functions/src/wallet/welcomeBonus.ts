// =============================================================
// Bono de bienvenida — $1 promocional por usuario
// =============================================================
// El cliente únicamente solicita el bono. La acreditación real ocurre en
// una transacción del servidor y usa un movimiento con ID determinístico,
// por lo que repetir el onboarding, refrescar o enviar dos solicitudes a la
// vez nunca suma más de un dólar al mismo UID.
//
// Este saldo no es retirable: Vendeloo no expone retiros de billetera y el
// movimiento queda marcado como promocional para mantener la auditoría.

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

const WELCOME_BONUS_USD = 1;
const redondear = (n: number) => Math.round(n * 100) / 100;

export const claimWelcomeBonus = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 15 })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Crea o inicia sesión en tu cuenta para recibir el bono"
      );
    }

    const userId = context.auth.uid;
    const userRef = db.doc(`${COLLECTIONS.USERS}/${userId}`);
    const walletRef = db.doc(`${COLLECTIONS.WALLETS}/${userId}`);
    const movementRef = db.doc(
      `${COLLECTIONS.WALLET_TXS}/welcome_bonus_${userId}`
    );

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, walletSnap, movementSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(walletRef),
        tx.get(movementRef),
      ]);

      if (!userSnap.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Tu perfil todavía se está preparando. Intenta de nuevo."
        );
      }

      const currentBalance = redondear(
        (walletSnap.data()?.balanceUsd as number) ?? 0
      );

      // El movimiento determinístico es la fuente de idempotencia. Aunque
      // dos dispositivos reclamen al mismo tiempo, Firestore reintenta una
      // transacción y la segunda ve que este documento ya existe.
      if (movementSnap.exists) {
        return {
          status: "already_claimed" as const,
          awardedUsd: 0,
          balanceUsd: currentBalance,
        };
      }

      const now = Timestamp.now();
      const nextBalance = redondear(currentBalance + WELCOME_BONUS_USD);

      tx.set(walletRef, {
        userId,
        balanceUsd: nextBalance,
        updatedAt: now,
        ...(walletSnap.exists ? {} : { createdAt: now }),
      }, { merge: true });

      tx.set(movementRef, {
        id: movementRef.id,
        userId,
        type: "welcome_bonus",
        amountUsd: WELCOME_BONUS_USD,
        balanceAfterUsd: nextBalance,
        depositId: null,
        method: "promotional",
        reference: null,
        note: "Bono de bienvenida para usar SUBELOO",
        by: "system",
        promotional: true,
        withdrawable: false,
        createdAt: now,
      });

      tx.set(userRef, {
        onboardingDone: true,
        welcomeBonusClaimed: true,
        welcomeBonusClaimedAt: now,
      }, { merge: true });

      return {
        status: "awarded" as const,
        awardedUsd: WELCOME_BONUS_USD,
        balanceUsd: nextBalance,
      };
    });

    functions.logger.info("Bono de bienvenida procesado", {
      userId,
      status: result.status,
      balanceUsd: result.balanceUsd,
    });

    return result;
  });
