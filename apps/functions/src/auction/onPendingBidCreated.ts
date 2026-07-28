// =============================================================
// CLOUD FUNCTION: onPendingBidCreated
// =============================================================
// Único camino por el que una puja puede afectar el precio.
// El cliente NO escribe precios: solo crea un doc en /pendingBids
// y esta función decide, en una transacción atómica, si la acepta.
//
// Sirve por igual a subastas en vivo (dentro de un show) y a
// subastas sueltas: ambas viven en /auctions y solo cambian el
// timer y las validaciones de show.
//
// ── Sobre los reintentos ─────────────────────────────────────
// Cuando dos pujas caen a la vez, Firestore aborta una y RE-EJECUTA
// su callback completo. Por eso el resultado se DEVUELVE desde la
// transacción en vez de escribirse en variables de afuera: si se
// mutaran, el reintento arrastraría el veredicto del intento
// anterior y una puja rechazada quedaría marcada como aceptada.
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db, messaging } from "../firebase";
import {
  COLLECTIONS,
  ANTI_SNIPE,
  AuctionMode,
  BidRejectedReason,
} from "../constants";

interface PendingBidData {
  auctionId: string;
  bidderId: string;
  amountUsd: number;
  status: "pending" | "processed" | "rejected";
}

/** Veredicto de un intento de la transacción. Se recalcula entero en cada reintento. */
type Veredicto =
  | { ok: true; previousBidderId?: string; auctionTitle: string }
  | { ok: false; motivo: BidRejectedReason };

export const onPendingBidCreated = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .firestore.document("pendingBids/{pendingBidId}")
  .onCreate(async (snap, context) => {
    const pendingBidId = context.params.pendingBidId;
    const pendingBid = snap.data() as PendingBidData;
    const { auctionId, bidderId, amountUsd } = pendingBid;

    const pendingBidRef = db.doc(`${COLLECTIONS.PENDING_BIDS}/${pendingBidId}`);

    // Validación de forma antes de tocar la base
    if (
      !auctionId || typeof auctionId !== "string" ||
      !bidderId || typeof bidderId !== "string" ||
      typeof amountUsd !== "number" || !isFinite(amountUsd) || amountUsd <= 0
    ) {
      await marcarRechazada(pendingBidRef, "not_found");
      return;
    }

    // El nombre sale del perfil, no de lo que mande el cliente:
    // así nadie puja como "Pepe" siendo otro.
    const bidderSnap = await db.doc(`${COLLECTIONS.USERS}/${bidderId}`).get();
    const bidderName = (bidderSnap.data()?.displayName as string | undefined) ?? "Anónimo";

    const auctionRef = db.doc(`${COLLECTIONS.AUCTIONS}/${auctionId}`);
    let veredicto: Veredicto;

    try {
      veredicto = await db.runTransaction(async (tx): Promise<Veredicto> => {
        // ── TODAS las lecturas primero (Firestore lo exige) ─────────
        const auctionSnap = await tx.get(auctionRef);
        if (!auctionSnap.exists) return { ok: false, motivo: "not_found" };

        const auction = auctionSnap.data()!;
        const mode = (auction.mode as AuctionMode) ?? "standalone";

        // Si es en vivo, el show tiene que estar transmitiendo
        if (mode === "live") {
          if (!auction.showId) return { ok: false, motivo: "not_found" };
          const showSnap = await tx.get(db.doc(`${COLLECTIONS.SHOWS}/${auction.showId}`));
          if (!showSnap.exists) return { ok: false, motivo: "not_found" };
          if (showSnap.data()!.status !== "live") return { ok: false, motivo: "show_not_live" };
        }

        // ── Validaciones de negocio ─────────────────────────────────
        // `now` se toma dentro de la transacción: en un reintento, el
        // reloj tiene que ser el del reintento, no el del primer intento.
        const now = Timestamp.now();

        if (auction.status !== "active") return { ok: false, motivo: "auction_closed" };

        const endsAt = auction.endsAt as Timestamp | undefined;
        if (!endsAt || now.toMillis() > endsAt.toMillis()) {
          return { ok: false, motivo: "auction_closed" };
        }

        if (auction.sellerId === bidderId) return { ok: false, motivo: "own_bid" };
        if (auction.currentBidderId === bidderId) return { ok: false, motivo: "own_bid" };

        // El piso es el precio de salida mientras nadie haya pujado
        const hayPujas = !!auction.currentBidderId;
        const base = hayPujas
          ? (auction.currentBidUsd as number)
          : (auction.startingPriceUsd as number);
        const incremento = (auction.minIncrementUsd as number) ?? 1;
        const minimo = hayPujas
          ? Math.round((base + incremento) * 100) / 100
          : Math.round(base * 100) / 100;

        if (amountUsd < minimo) return { ok: false, motivo: "too_low" };

        // ── Aceptada: de aquí en adelante, solo escrituras ──────────
        const previousBidderId = auction.currentBidderId as string | undefined;
        const showId = mode === "live" ? (auction.showId as string) : null;

        // Anti-sniping: si queda poco, se estira el cierre
        const reglas = ANTI_SNIPE[mode] ?? ANTI_SNIPE.standalone;
        const faltanS = (endsAt.toMillis() - now.toMillis()) / 1000;
        const nuevoFin = faltanS < reglas.thresholdS
          ? Timestamp.fromMillis(now.toMillis() + reglas.extendToS * 1000)
          : endsAt;

        tx.update(auctionRef, {
          currentBidUsd: amountUsd,
          currentBidderId: bidderId,
          currentBidderName: bidderName,
          bidsCount: FieldValue.increment(1),
          endsAt: nuevoFin,
          updatedAt: now,
        });

        const bidRef = db.collection(COLLECTIONS.AUCTION_BIDS(auctionId)).doc();
        tx.set(bidRef, {
          id: bidRef.id,
          auctionId,
          showId,
          bidderId,
          bidderName,
          amountUsd,
          placedAt: now,
        });

        if (showId) {
          const msgRef = db.collection(COLLECTIONS.SHOW_MESSAGES(showId)).doc();
          tx.set(msgRef, {
            id: msgRef.id,
            showId,
            authorId: "system",
            authorName: "Sistema",
            type: "bid_placed",
            text: `💰 ${bidderName} pujó ${formatUsd(amountUsd)}`,
            createdAt: now,
          });
        }

        tx.update(pendingBidRef, { status: "processed", processedAt: now });

        return { ok: true, previousBidderId, auctionTitle: (auction.title as string) ?? "" };
      });
    } catch (err) {
      functions.logger.error("Error procesando puja", { pendingBidId, auctionId, error: err });
      await marcarRechazada(pendingBidRef, "race_condition");
      return;
    }

    // ── Post-commit ────────────────────────────────────────────────
    if (!veredicto.ok) {
      await marcarRechazada(pendingBidRef, veredicto.motivo);
      functions.logger.info("Puja rechazada", {
        pendingBidId, auctionId, bidderId, amountUsd, motivo: veredicto.motivo,
      });
      return;
    }

    if (veredicto.previousBidderId && veredicto.previousBidderId !== bidderId) {
      await notificarSuperado({
        superadoId: veredicto.previousBidderId,
        auctionId,
        auctionTitle: veredicto.auctionTitle,
        montoUsd: amountUsd,
        nuevoPostor: bidderName,
      });
    }
  });

// --------------------------------------------------

async function marcarRechazada(
  ref: admin.firestore.DocumentReference,
  motivo: BidRejectedReason
) {
  try {
    await ref.update({
      status: "rejected",
      rejectedReason: motivo,
      processedAt: Timestamp.now(),
    });
  } catch (err) {
    functions.logger.warn("No se pudo marcar la puja como rechazada", err);
  }
}

async function notificarSuperado(params: {
  superadoId: string;
  auctionId: string;
  auctionTitle: string;
  montoUsd: number;
  nuevoPostor: string;
}) {
  try {
    const userSnap = await db.doc(`${COLLECTIONS.USERS}/${params.superadoId}`).get();
    const fcmToken = userSnap.data()?.fcmToken as string | undefined;
    if (!fcmToken) return;

    await messaging.send({
      token: fcmToken,
      notification: {
        title: "¡Te superaron en la puja!",
        body: `${params.nuevoPostor} pujó ${formatUsd(params.montoUsd)} por "${params.auctionTitle}". ¡Vuelve a pujar!`,
      },
      data: {
        type: "outbid",
        auctionId: params.auctionId,
        newBidUsd: String(params.montoUsd),
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    });
  } catch (err) {
    functions.logger.warn("Error enviando FCM outbid", err);
  }
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
