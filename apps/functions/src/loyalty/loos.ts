// =============================================================
// LOOS — motor de puntos
// =============================================================
// Regla única: 1 LOO por dólar movido, para el comprador Y para el
// vendedor, acreditado cuando la orden queda ENTREGADA. Más tres bonos
// de arranque (primera compra, primera venta, primer show) y uno por
// calificar.
//
// La idempotencia es la pieza que importa: los triggers de Firestore son
// at-least-once, así que cada concesión lleva un ID determinístico
// (`order_{orderId}_buyer`, `firstsale_{uid}`…). Si el movimiento ya
// existe, no se vuelve a sumar. Un reintento del trigger no regala
// puntos, y por eso los bonos "primera vez" no necesitan preguntar si ya
// hubo una compra antes: su propio ID ya lo responde.
//
// Los LOOS no son plata: no se recargan, no se retiran, no pagan órdenes.
// Solo se cambian por mercancía. Por eso el ledger vive en /loosTxs y no
// se mezcla con /walletTransactions.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";
import {
  MAX_CANJES_PENDIENTES,
  costoPremio,
  leerReglas,
} from "./reglas";

export interface Concesion {
  /** ID determinístico del movimiento. Es lo que hace idempotente todo esto. */
  movimientoId: string;
  userId: string;
  tipo: string;
  cantidad: number;
  orderId?: string | null;
  nota?: string | null;
}

const entero = (n: unknown): number => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? v : 0;
};

/**
 * Acredita varias concesiones en UNA transacción.
 *
 * Devuelve cuántas se aplicaron de verdad (las repetidas devuelven 0).
 * Nunca lanza por una concesión inválida: otorgar puntos jamás debe
 * tumbar la operación de negocio que la disparó (entregar una orden,
 * arrancar un show). Los problemas se registran y se siguen.
 */
export async function otorgarLoos(concesiones: Concesion[]): Promise<number> {
  const validas = concesiones.filter((c) => c.userId && c.movimientoId && entero(c.cantidad) > 0);
  if (!validas.length) return 0;

  return db.runTransaction(async (tx) => {
    const movRefs = validas.map((c) => db.doc(`${COLLECTIONS.LOOS_TXS}/${c.movimientoId}`));
    const userIds = Array.from(new Set(validas.map((c) => c.userId)));
    const userRefs = userIds.map((id) => db.doc(`${COLLECTIONS.USERS}/${id}`));

    // Todas las lecturas antes de cualquier escritura: Firestore lo exige.
    const [movSnaps, userSnaps] = await Promise.all([
      Promise.all(movRefs.map((r) => tx.get(r))),
      Promise.all(userRefs.map((r) => tx.get(r))),
    ]);

    const saldo = new Map<string, number>();
    const acumulado = new Map<string, number>();
    const existe = new Map<string, boolean>();
    userSnaps.forEach((s, i) => {
      saldo.set(userIds[i], entero(s.data()?.loos));
      acumulado.set(userIds[i], entero(s.data()?.loosLifetime));
      existe.set(userIds[i], s.exists);
    });

    const now = Timestamp.now();
    let aplicadas = 0;

    validas.forEach((c, i) => {
      if (movSnaps[i].exists) return;          // ya se otorgó antes
      if (!existe.get(c.userId)) return;       // el usuario ya no está
      const cantidad = entero(c.cantidad);

      const nuevoSaldo = (saldo.get(c.userId) ?? 0) + cantidad;
      const nuevoTotal = (acumulado.get(c.userId) ?? 0) + cantidad;
      saldo.set(c.userId, nuevoSaldo);
      acumulado.set(c.userId, nuevoTotal);

      tx.set(movRefs[i], {
        id: c.movimientoId,
        userId: c.userId,
        type: c.tipo,
        amount: cantidad,
        balanceAfter: nuevoSaldo,
        orderId: c.orderId ?? null,
        redemptionId: null,
        note: c.nota ?? null,
        createdAt: now,
      });
      aplicadas += 1;
    });

    // Un solo write por usuario aunque le hayan tocado varias concesiones
    // (la orden y el bono de primera compra caen juntos, por ejemplo).
    userIds.forEach((id) => {
      if (!existe.get(id)) return;
      tx.set(
        db.doc(`${COLLECTIONS.USERS}/${id}`),
        { loos: saldo.get(id) ?? 0, loosLifetime: acumulado.get(id) ?? 0, updatedAt: now },
        { merge: true },
      );
    });

    return aplicadas;
  });
}

/** Envoltorio para llamarlo desde un trigger sin arriesgar la operación. */
export async function otorgarLoosSeguro(concesiones: Concesion[], contexto: object): Promise<void> {
  try {
    const n = await otorgarLoos(concesiones);
    if (n > 0) functions.logger.info("LOOS otorgados", { aplicadas: n, ...contexto });
  } catch (err) {
    functions.logger.error("No se pudieron otorgar LOOS", { err, ...contexto });
  }
}

// =============================================================
// redeemPrize — el usuario cambia LOOS por mercancía
// =============================================================
// Los LOOS se descuentan al pedir, no al entregar: si no, dos canjes
// seguidos gastarían los mismos puntos. La entrega es física y la marca
// el admin; si algo sale mal, cancelar devuelve los puntos.

export const redeemPrize = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Entra a tu cuenta para canjear");
    }

    const { prizeId } = (data ?? {}) as { prizeId?: string };
    if (!prizeId || typeof prizeId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "prizeId es requerido");
    }

    const uid = context.auth.uid;
    const reglas = await leerReglas();
    const premio = reglas.premios.find((p) => p.id === prizeId);
    if (!premio) {
      throw new functions.https.HttpsError("not-found", "Ese premio no existe");
    }
    if (!premio.activo) {
      throw new functions.https.HttpsError("failed-precondition", `${premio.nombre} todavía no está disponible`);
    }

    const userRef = db.doc(`${COLLECTIONS.USERS}/${uid}`);
    const canjeRef = db.collection(COLLECTIONS.REDEMPTIONS).doc();
    const movRef = db.doc(`${COLLECTIONS.LOOS_TXS}/redeem_${canjeRef.id}`);

    const resultado = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Tu perfil todavía se está preparando");
      }
      const u = userSnap.data()!;

      // La entrega es a mano y por WhatsApp. Sin número, el canje nace
      // muerto: nadie tiene cómo coordinar contigo.
      const whatsapp = String(u.whatsapp ?? "").trim();
      if (!whatsapp) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Agrega tu WhatsApp en tu perfil: es como coordinamos la entrega de tu premio",
        );
      }

      const esVendedor = u.sellerStatus === "approved";
      const costo = costoPremio(premio, esVendedor);
      const disponibles = entero(u.loos);
      if (disponibles < costo) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Te faltan ${costo - disponibles} LOOS para ${premio.nombre}`,
        );
      }

      const pendientesSnap = await tx.get(
        db
          .collection(COLLECTIONS.REDEMPTIONS)
          .where("userId", "==", uid)
          .where("status", "==", "pending")
          .limit(MAX_CANJES_PENDIENTES),
      );
      if (pendientesSnap.size >= MAX_CANJES_PENDIENTES) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Ya tienes ${pendientesSnap.size} premios por recibir. Espera a que te los entreguemos.`,
        );
      }

      const now = Timestamp.now();
      const restante = disponibles - costo;

      tx.set(canjeRef, {
        id: canjeRef.id,
        userId: uid,
        userName: (u.displayName as string) ?? (u.email as string) ?? "",
        userWhatsapp: whatsapp,
        prizeId: premio.id,
        prizeName: premio.nombre,
        loosCost: costo,
        status: "pending",
        note: null,
        createdAt: now,
      });

      tx.set(movRef, {
        id: movRef.id,
        userId: uid,
        type: "redeem",
        amount: -costo,
        balanceAfter: restante,
        orderId: null,
        redemptionId: canjeRef.id,
        note: `Canje: ${premio.nombre}`,
        createdAt: now,
      });

      // loosLifetime NO baja: es lo ganado de por vida, no el saldo.
      tx.update(userRef, { loos: restante, updatedAt: now });

      return { redemptionId: canjeRef.id, loosCost: costo, loos: restante, prizeName: premio.nombre };
    });

    functions.logger.info("Premio canjeado", { uid, ...resultado });
    return resultado;
  });

// =============================================================
// manageRedemption — el admin entrega o cancela un canje
// =============================================================

export const manageRedemption = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    const adminSnap = await db.doc(`${COLLECTIONS.USERS}/${context.auth.uid}`).get();
    if (adminSnap.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const { redemptionId, action, note } = (data ?? {}) as {
      redemptionId?: string;
      action?: "deliver" | "cancel";
      note?: string;
    };
    if (!redemptionId || !["deliver", "cancel"].includes(action ?? "")) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        'redemptionId y action ("deliver"|"cancel") son requeridos',
      );
    }

    const adminUid = context.auth.uid;
    const canjeRef = db.doc(`${COLLECTIONS.REDEMPTIONS}/${redemptionId}`);

    const resultado = await db.runTransaction(async (tx) => {
      const canjeSnap = await tx.get(canjeRef);
      if (!canjeSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Ese canje no existe");
      }
      const c = canjeSnap.data()!;
      if (c.status !== "pending") {
        throw new functions.https.HttpsError("failed-precondition", `El canje ya fue ${c.status === "delivered" ? "entregado" : "cancelado"}`);
      }

      const now = Timestamp.now();
      const notaLimpia = (note ?? "").trim().slice(0, 200) || null;

      if (action === "deliver") {
        tx.update(canjeRef, { status: "delivered", note: notaLimpia, decidedAt: now, decidedBy: adminUid });
        return { status: "delivered" as const, prizeName: c.prizeName, userName: c.userName };
      }

      // Cancelar devuelve los puntos. El movimiento de reintegro también
      // tiene ID determinístico: cancelar dos veces no regala LOOS.
      const userRef = db.doc(`${COLLECTIONS.USERS}/${c.userId}`);
      const refundRef = db.doc(`${COLLECTIONS.LOOS_TXS}/redeem_refund_${redemptionId}`);
      const [userSnap, refundSnap] = await Promise.all([tx.get(userRef), tx.get(refundRef)]);

      tx.update(canjeRef, { status: "cancelled", note: notaLimpia, decidedAt: now, decidedBy: adminUid });

      if (userSnap.exists && !refundSnap.exists) {
        const costo = entero(c.loosCost);
        const restante = entero(userSnap.data()?.loos) + costo;
        tx.set(refundRef, {
          id: refundRef.id,
          userId: c.userId,
          type: "redeem_refund",
          amount: costo,
          balanceAfter: restante,
          orderId: null,
          redemptionId,
          note: `Canje cancelado: ${c.prizeName}`,
          createdAt: now,
        });
        tx.update(userRef, { loos: restante, updatedAt: now });
      }

      return { status: "cancelled" as const, prizeName: c.prizeName, userName: c.userName };
    });

    functions.logger.info("Canje decidido", { redemptionId, ...resultado, por: adminUid });
    return resultado;
  });
