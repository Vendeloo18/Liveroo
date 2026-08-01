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
import * as crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
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

      // La misma referencia bancaria no se acredita dos veces: el clásico
      // "mando dos solicitudes con el mismo comprobante" (o dos personas
      // con el mismo pantallazo). Se compara contra las ya APROBADAS del
      // mismo método, dentro de la transacción.
      const referencia = String(dep.reference ?? "").trim();
      const metodo = String(dep.method ?? "").trim().toLowerCase();
      const referenciaNormalizada = referencia.toLowerCase();
      const claimId = crypto
        .createHash("sha256")
        .update(`${metodo}:${referenciaNormalizada}`)
        .digest("hex");
      const claimRef = db.doc(`${COLLECTIONS.DEPOSIT_REFERENCE_CLAIMS}/${claimId}`);
      const claimSnap = action === "approve" && referencia
        ? await tx.get(claimRef)
        : null;

      if (claimSnap?.exists && claimSnap.data()?.depositId !== depositId) {
        throw new functions.https.HttpsError(
          "already-exists",
          `La referencia ${referencia} ya fue acreditada en otra solicitud.`
        );
      }

      if (action === "approve" && referencia) {
        const dupSnap = await tx.get(
          db
            .collection(COLLECTIONS.DEPOSITS)
            .where("reference", "==", referencia)
            .where("method", "==", dep.method ?? null)
            .where("status", "==", "approved")
            .limit(1)
        );
        if (!dupSnap.empty) {
          throw new functions.https.HttpsError(
            "already-exists",
            `La referencia ${referencia} ya fue acreditada en otra solicitud. Verifica el comprobante antes de aprobar.`
          );
        }
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

      // Documento de exclusión con ID determinístico. Dos aprobaciones
      // concurrentes de la misma referencia chocan sobre ESTE documento:
      // una confirma y la otra reintenta, ve el claim y se rechaza.
      if (referencia) {
        tx.set(claimRef, {
          depositId,
          userId,
          method: metodo,
          reference: referencia,
          referenceNormalized: referenciaNormalizada,
          approvedAt: now,
          approvedBy: adminUid,
        });
      }

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
      const retenido = redondear((walletSnap.data()?.heldUsd as number) ?? 0);
      const saldoNuevo = redondear(saldoActual + monto);

      if (saldoNuevo < 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `El saldo quedaría negativo (actual: ${saldoActual}, ajuste: ${monto})`
        );
      }
      // Lo retenido respalda pujas que van ganando: un débito manual no
      // puede dejar el saldo por debajo de eso, o el cierre no podría
      // cobrar lo que la retención prometió.
      if (monto < 0 && saldoNuevo < retenido) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `El usuario tiene ${retenido} retenidos en pujas activas; el máximo a descontar es ${redondear(saldoActual - retenido)}`
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

// =============================================================
// markSellerPaid — liquidación manual al vendedor
// =============================================================
// Cuando el comprador paga con billetera, la plata entra a la
// PLATAFORMA y al vendedor se le debe su parte (la orden queda con
// payoutStatus "pending"). El admin le paga por fuera (pago móvil,
// Zelle…) y aquí lo deja asentado: marca las órdenes como liquidadas
// y escribe el registro de auditoría en /sellerPayouts. Sin esto, lo
// que se le debía a cada vendedor vivía solo en la memoria de quien
// opera.

export const markSellerPaid = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    if (!(await esAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const { orderIds, note } = (data ?? {}) as { orderIds?: string[]; note?: string };
    if (!Array.isArray(orderIds) || orderIds.length === 0 || orderIds.length > 50
        || orderIds.some((x) => typeof x !== "string" || !x)) {
      throw new functions.https.HttpsError("invalid-argument", "orderIds debe ser una lista de 1 a 50 órdenes");
    }
    if (new Set(orderIds).size !== orderIds.length) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "orderIds no puede contener la misma orden más de una vez"
      );
    }

    const adminUid = context.auth.uid;

    const resultado = await db.runTransaction(async (tx) => {
      const snaps = await Promise.all(
        orderIds.map((id) => tx.get(db.doc(`${COLLECTIONS.ORDERS}/${id}`)))
      );

      let sellerId: string | null = null;
      let sellerName = "";
      let total = 0;

      for (const s of snaps) {
        if (!s.exists) {
          throw new functions.https.HttpsError("not-found", `La orden ${s.id} no existe`);
        }
        const o = s.data()!;
        if (o.paymentMethod !== "wallet") {
          throw new functions.https.HttpsError("failed-precondition", `La orden ${s.id} no se pagó por billetera: ahí no hay nada que liquidar`);
        }
        if (o.status === "cancelled") {
          throw new functions.https.HttpsError("failed-precondition", `La orden ${s.id} está cancelada`);
        }
        if (o.payoutStatus === "paid") {
          throw new functions.https.HttpsError("already-exists", `La orden ${s.id} ya fue liquidada`);
        }
        if (sellerId && o.sellerId !== sellerId) {
          throw new functions.https.HttpsError("invalid-argument", "Todas las órdenes deben ser del mismo vendedor");
        }
        sellerId = o.sellerId as string;
        sellerName = (o.sellerName as string) ?? "";
        total += redondear((o.payoutUsd as number) ?? (o.sellerReceivesUsd as number) ?? 0);
      }
      total = redondear(total);

      const now = Timestamp.now();
      const payRef = db.collection(COLLECTIONS.SELLER_PAYOUTS).doc();

      snaps.forEach((s) =>
        tx.update(s.ref, {
          payoutStatus: "paid",
          payoutAt: now,
          payoutBy: adminUid,
          payoutId: payRef.id,
          updatedAt: now,
        })
      );

      tx.set(payRef, {
        id: payRef.id,
        sellerId,
        sellerName,
        orderIds,
        totalUsd: total,
        note: (note ?? "").trim().slice(0, 200) || null,
        paidBy: adminUid,
        createdAt: now,
      });

      return { totalUsd: total, orders: snaps.length, sellerName };
    });

    functions.logger.info("Liquidación a vendedor", { ...resultado, por: adminUid });
    return resultado;
  });
