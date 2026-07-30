// =============================================================
// CLOUD FUNCTIONS: billetera (solo admin)
// =============================================================
// La plata solo se mueve aquí. El cliente puede CREAR una solicitud de
// depósito ("ya te envié Bs por pago móvil, referencia 1234") y nada
// más: las reglas mantienen /wallets y /walletTransactions cerrados a
// escritura, y la solicitud no puede tocarse una vez creada.
//
// manageDeposit — el admin aprueba o rechaza una solicitud. Aprobar
//   acredita el saldo y deja el movimiento en el ledger, todo en UNA
//   transacción: no existe el estado "aprobado pero sin acreditar".
// adjustWallet — el admin suma o resta saldo a mano (regalos, ajustes,
//   correcciones), siempre con nota y siempre en el ledger.
//
// El ledger es la fuente de verdad para auditar: el saldo de /wallets
// debe poder reconstruirse sumando /walletTransactions del usuario.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

async function esAdmin(uid: string): Promise<boolean> {
  const snap = await db.doc(`${COLLECTIONS.USERS}/${uid}`).get();
  return snap.data()?.role === "admin";
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export const manageDeposit = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    if (!(await esAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const { depositId, action, reason } = (data ?? {}) as {
      depositId?: string; action?: "approve" | "reject"; reason?: string;
    };
    if (!depositId || !["approve", "reject"].includes(action ?? "")) {
      throw new functions.https.HttpsError("invalid-argument", 'depositId y action ("approve"|"reject") son requeridos');
    }

    const depositRef = db.doc(`${COLLECTIONS.DEPOSITS}/${depositId}`);
    const adminUid = context.auth.uid;

    const resultado = await db.runTransaction(async (tx) => {
      // ── lecturas ──
      const depSnap = await tx.get(depositRef);
      if (!depSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Solicitud de depósito no encontrada");
      }
      const dep = depSnap.data()!;
      if (dep.status !== "pending") {
        // Idempotencia: aprobar dos veces no acredita dos veces.
        throw new functions.https.HttpsError("failed-precondition", `La solicitud ya fue decidida: ${dep.status}`);
      }

      const userId = dep.userId as string;
      const monto = redondear(dep.amountUsd as number);
      if (!userId || !isFinite(monto) || monto <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "La solicitud está malformada");
      }

      const now = Timestamp.now();

      if (action === "reject") {
        tx.update(depositRef, {
          status: "rejected",
          rejectReason: (reason ?? "").slice(0, 300) || null,
          decidedBy: adminUid,
          decidedAt: now,
        });
        return { status: "rejected" as const };
      }

      const walletRef = db.doc(`${COLLECTIONS.WALLETS}/${userId}`);
      const walletSnap = await tx.get(walletRef);
      const saldoActual = redondear((walletSnap.data()?.balanceUsd as number) ?? 0);
      const saldoNuevo = redondear(saldoActual + monto);

      // ── escrituras ──
      tx.update(depositRef, { status: "approved", decidedBy: adminUid, decidedAt: now });

      tx.set(walletRef, {
        userId,
        balanceUsd: saldoNuevo,
        updatedAt: now,
        ...(walletSnap.exists ? {} : { createdAt: now }),
      }, { merge: true });

      const txRef = db.collection(COLLECTIONS.WALLET_TXS).doc();
      tx.set(txRef, {
        id: txRef.id,
        userId,
        type: "deposit",
        amountUsd: monto,
        balanceAfterUsd: saldoNuevo,
        depositId,
        method: dep.method ?? null,
        reference: dep.reference ?? null,
        note: null,
        by: adminUid,
        createdAt: now,
      });

      return { status: "approved" as const, balanceUsd: saldoNuevo };
    });

    functions.logger.info("Depósito decidido", { depositId, ...resultado, por: adminUid });
    return resultado;
  });

export const adjustWallet = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    if (!(await esAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const { userId, amountUsd, note } = (data ?? {}) as {
      userId?: string; amountUsd?: number; note?: string;
    };
    const monto = redondear(Number(amountUsd));
    if (!userId || !isFinite(monto) || monto === 0 || Math.abs(monto) > 100000) {
      throw new functions.https.HttpsError("invalid-argument", "userId y un monto distinto de cero (máx 100000) son requeridos");
    }
    // La nota es obligatoria: un movimiento manual de plata sin explicación
    // es exactamente lo que un ledger existe para impedir.
    if (!note || note.trim().length < 3) {
      throw new functions.https.HttpsError("invalid-argument", "La nota es obligatoria (mínimo 3 caracteres)");
    }

    const adminUid = context.auth.uid;

    const resultado = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(db.doc(`${COLLECTIONS.USERS}/${userId}`));
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Ese usuario no existe");
      }

      const walletRef = db.doc(`${COLLECTIONS.WALLETS}/${userId}`);
      const walletSnap = await tx.get(walletRef);
      const saldoActual = redondear((walletSnap.data()?.balanceUsd as number) ?? 0);
      const saldoNuevo = redondear(saldoActual + monto);

      if (saldoNuevo < 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `El saldo quedaría negativo (actual: ${saldoActual}, ajuste: ${monto})`
        );
      }

      const now = Timestamp.now();
      tx.set(walletRef, {
        userId,
        balanceUsd: saldoNuevo,
        updatedAt: now,
        ...(walletSnap.exists ? {} : { createdAt: now }),
      }, { merge: true });

      const txRef = db.collection(COLLECTIONS.WALLET_TXS).doc();
      tx.set(txRef, {
        id: txRef.id,
        userId,
        type: monto > 0 ? "admin_credit" : "admin_debit",
        amountUsd: monto,
        balanceAfterUsd: saldoNuevo,
        depositId: null,
        method: null,
        reference: null,
        note: note.trim().slice(0, 300),
        by: adminUid,
        createdAt: now,
      });

      return { balanceUsd: saldoNuevo };
    });

    functions.logger.info("Ajuste de billetera", { userId, monto, por: adminUid });
    return resultado;
  });
