// =============================================================
// CLOUD FUNCTIONS: cierre de subastas
// =============================================================
// closeExpiredAuctions — barrido programado (cada minuto)
// closeAuctionNow      — callable, cierre inmediato al vencer el timer
//
// Ambas terminan en el mismo closeOneAuction(), que es la única
// autoridad sobre quién ganó. El callable existe porque Cloud
// Scheduler no baja de 1 minuto y una subasta en vivo dura 30s:
// cuando al cliente se le acaba el reloj, pide el cierre y el
// servidor revalida todo desde cero. El barrido queda de red de
// seguridad para lo que nadie esté mirando.
//
// Flujo de cierre (transacción atómica):
//   1. Re-verifica que siga activa y vencida (idempotencia)
//   2. Congela la tasa de cambio y calcula el monto en Bs
//   3. Crea la Orden
//   4. Marca la subasta sold / unsold
//   5. Si es de un show, activa la siguiente de la cola
//   6. FCM al ganador (después del commit, nunca dentro)
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp } from "firebase-admin/firestore";
import { db, messaging } from "../firebase";
import { tokenParaAviso } from "../notifications/destinatario";
import {
  COLLECTIONS,
  CONFIG_DOCS,
  EXCHANGE_RATE_DOCS,
  DEFAULT_LIVE_TIMER_S,
  AuctionMode,
  CommissionMode,
} from "../constants";

interface WonNotice {
  winnerId: string;
  orderId: string;
  title: string;
  finalUsd: number;
}

// Una sola pasada debe poder absorber el objetivo operativo completo:
// 100 vendedores venciendo al mismo tiempo. Las Cloud Tasks son el reloj
// principal; este lote es la red de seguridad si una tarea no se entrega.
const BATCH_LIMIT = 100;
const SWEEP_BUDGET_MS = 50_000; // margen dentro del timeout de 540s
const SWEEP_INTERVAL_MS = 5_000;

// --------------------------------------------------
// Barrido programado
// --------------------------------------------------
// Corre cada minuto. Si hay un show en vivo, sigue barriendo cada
// 5s durante el resto del minuto para no dejar subastas de 30s
// colgadas. Si no hay nada en vivo, hace una pasada y se va — así
// no pagamos por una función encendida las 24 horas.

export const closeExpiredAuctions = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    const startedAt = Date.now();
    let totalClosed = await sweep();

    while (Date.now() - startedAt < SWEEP_BUDGET_MS) {
      const liveShows = await db
        .collection(COLLECTIONS.SHOWS)
        .where("status", "==", "live")
        .limit(1)
        .get();
      if (liveShows.empty) break;

      await delay(SWEEP_INTERVAL_MS);
      totalClosed += await sweep();
    }

    if (totalClosed > 0) {
      functions.logger.info(`Barrido: ${totalClosed} subasta(s) cerrada(s)`);
    }

    await cerrarShowsZombis();
    return null;
  });

// Con el modelo "vende en vivo" un show ya no se termina solo al vaciarse
// la cola — pero si el vendedor cierra la app y lo abandona, quedaba EN
// VIVO para siempre en el home. Un show sin subasta actual y sin actividad
// por 45 minutos se termina de oficio.
async function cerrarShowsZombis(): Promise<void> {
  try {
    const ahora = Timestamp.now();
    const limite = Timestamp.fromMillis(ahora.toMillis() - 45 * 60_000);
    const vivos = await db
      .collection(COLLECTIONS.SHOWS)
      .where("status", "==", "live")
      .limit(200)
      .get();

    const zombis = vivos.docs.filter((d) => {
      const s = d.data();
      const upd = s.updatedAt as Timestamp | undefined;
      return !s.currentAuctionId && upd && upd.toMillis() < limite.toMillis();
    });
    if (zombis.length === 0) return;

    const lote = db.batch();
    zombis.forEach((d) =>
      lote.update(d.ref, { status: "ended", endedAt: ahora, updatedAt: ahora, currentAuctionId: null })
    );
    await lote.commit();
    functions.logger.info(`Shows zombis terminados: ${zombis.length}`);
  } catch (e) {
    functions.logger.warn("cerrarShowsZombis falló", e);
  }
}

// --------------------------------------------------
// Cierre inmediato pedido por el cliente
// --------------------------------------------------
// No confía en el cliente: solo le hace caso si el servidor
// también ve la subasta vencida. Sirve para que en un show en vivo
// el ganador se anuncie al instante en vez de esperar al barrido.

export const closeAuctionNow = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    // Toda callable de Firebase se despliega con invoker allUsers: el
    // filtro de quién puede usarla va en el código, no en IAM. Sin este
    // chequeo era un endpoint abierto que cualquiera podía machacar, y
    // cada llamada cuesta un getDoc. Quien necesita el cierre inmediato
    // es el que está pujando, y ese tiene sesión.
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { auctionId } = (data ?? {}) as { auctionId?: string };
    if (!auctionId) {
      throw new functions.https.HttpsError("invalid-argument", "auctionId es requerido");
    }

    return { closed: await closeAuctionById(auctionId) };
  });

// --------------------------------------------------

async function sweep(): Promise<number> {
  const now = Timestamp.now();

  const expired = await db
    .collection(COLLECTIONS.AUCTIONS)
    .where("status", "==", "active")
    .where("endsAt", "<=", now)
    .limit(BATCH_LIMIT)
    .get();

  if (expired.empty) return 0;

  const cfg = await loadConfig();

  const results = await Promise.allSettled(
    expired.docs.map((auctionSnap) => closeOneAuction({ auctionSnap, ...cfg, now }))
  );

  return results.filter((r) => r.status === "fulfilled").length;
}

async function loadConfig() {
  const [rateSnap, commissionSnap] = await Promise.all([
    db.doc(`${COLLECTIONS.EXCHANGE_RATES}/${EXCHANGE_RATE_DOCS.CURRENT}`).get(),
    db.doc(`${COLLECTIONS.CONFIG}/${CONFIG_DOCS.COMMISSION}`).get(),
  ]);

  const currentRate = rateSnap.data()?.usdToBs as number | undefined;
  if (!currentRate) {
    // Sin tasa no se puede congelar el precio en Bs de forma honesta.
    functions.logger.error(
      "exchangeRates/current no existe o no tiene usdToBs — las órdenes quedarán sin monto en Bs"
    );
  }

  return {
    currentRate: currentRate ?? null,
    commissionMode: (commissionSnap.data()?.mode as CommissionMode) ?? "seller_collects",
    platformFeePct: (commissionSnap.data()?.platformFeePct as number) ?? 10,
  };
}

// Puerta compartida por el callable, el barrido y la Cloud Task exacta.
// Siempre relee el documento antes de cerrar: si una puja anti-sniping
// extendió el reloj, la tarea vieja se vuelve un no-op seguro.
export async function closeAuctionById(auctionId: string): Promise<boolean> {
  const snap = await db.doc(`${COLLECTIONS.AUCTIONS}/${auctionId}`).get();
  if (!snap.exists) return false;

  const auction = snap.data()!;
  const now = Timestamp.now();
  const endsAt = auction.endsAt as Timestamp | undefined;
  if (auction.status !== "active" || !endsAt || now.toMillis() < endsAt.toMillis()) {
    return false;
  }

  const cfg = await loadConfig();
  await closeOneAuction({ auctionSnap: snap, ...cfg, now });
  return true;
}

// --------------------------------------------------
// Cierra una subasta. Idempotente: si otra ejecución llegó
// primero, la re-lectura dentro de la transacción la frena.
// --------------------------------------------------

async function closeOneAuction(params: {
  auctionSnap: admin.firestore.DocumentSnapshot;
  currentRate: number | null;
  commissionMode: CommissionMode;
  platformFeePct: number;
  now: Timestamp;
}) {
  const { auctionSnap, currentRate, commissionMode, platformFeePct, now } = params;
  const auctionRef = auctionSnap.ref;
  const auctionId = auctionRef.id;

  // La transacción devuelve a quién hay que notificar (o null). No se usa
  // una variable de cierre: TypeScript no puede saber que el callback corrió.
  let notify: WonNotice | null = null;

  try {
    notify = await db.runTransaction(async (tx): Promise<WonNotice | null> => {
      // ════ TODAS LAS LECTURAS PRIMERO ════
      // Firestore rechaza cualquier lectura posterior a una escritura.

      const fresh = await tx.get(auctionRef);
      if (!fresh.exists) return null;
      const auction = fresh.data()!;

      if (auction.status !== "active") return null; // ya la cerró otro

      const endsAt = auction.endsAt as Timestamp | undefined;
      if (!endsAt || now.toMillis() < endsAt.toMillis()) {
        return null; // una puja extendió el timer entre el query y la transacción
      }

      const mode = (auction.mode as AuctionMode) ?? "standalone";
      const showId = (auction.showId as string | null) ?? null;
      const hasWinner = !!auction.currentBidderId;

      const sellerSnap = hasWinner
        ? await tx.get(db.doc(`${COLLECTIONS.USERS}/${auction.sellerId}`))
        : null;

      // La billetera del ganador: si el saldo cubre el precio final, la
      // orden nace pagada y el saldo se debita en esta misma transacción.
      const winnerWalletSnap = hasWinner
        ? await tx.get(db.doc(`${COLLECTIONS.WALLETS}/${auction.currentBidderId}`))
        : null;

      // Siguiente de la cola del show (si esto es parte de un show).
      // limit(5): la cola puede traer artículos ajenos colados antes del
      // candado de dueño; advanceShow los descarta y necesita alternativas.
      const nextSnap =
        mode === "live" && showId
          ? await tx.get(
              db
                .collection(COLLECTIONS.AUCTIONS)
                .where("showId", "==", showId)
                .where("status", "==", "waiting")
                .orderBy("sortOrder", "asc")
                .limit(5)
            )
          : null;
      // Dueño real del show: la vara contra la que se filtra la cola.
      const showOwnerId =
        mode === "live" && showId
          ? ((await tx.get(db.doc(`${COLLECTIONS.SHOWS}/${showId}`))).data()?.sellerId as string | undefined) ?? null
          : null;

      // ════ A PARTIR DE AQUÍ, SOLO ESCRITURAS ════

      // Vitrina demo: se puja de verdad, pero al cierre NO se cobra ni se
      // crea orden — no existe vendedor que entregue. Se libera la
      // retención del líder y la subasta queda sin ganador.
      if (auction.isDemo === true) {
        tx.update(auctionRef, { status: "unsold", endedAt: now, updatedAt: now });
        if (hasWinner && winnerWalletSnap?.exists) {
          const r2demo = (x: number) => Math.round(x * 100) / 100;
          const heldDemo = r2demo((winnerWalletSnap.data()?.heldUsd as number) ?? 0);
          tx.set(db.doc(`${COLLECTIONS.WALLETS}/${auction.currentBidderId}`), {
            userId: auction.currentBidderId,
            heldUsd: Math.max(0, r2demo(heldDemo - (auction.currentBidUsd as number))),
            updatedAt: now,
          }, { merge: true });
        }
        return null;
      }

      if (hasWinner) {
        const finalUsd = auction.currentBidUsd as number;
        const finalBs = currentRate ? Math.round(finalUsd * currentRate * 100) / 100 : null;
        const commissionUsd = Math.round(((finalUsd * platformFeePct) / 100) * 100) / 100;
        const sellerReceivesUsd =
          commissionMode === "platform_collects"
            ? Math.round((finalUsd - commissionUsd) * 100) / 100
            : finalUsd; // el vendedor cobra directo; la plataforma solo registra

        const orderRef = db.collection(COLLECTIONS.ORDERS).doc();

        // Con retención, el saldo del líder siempre cubre su puja cuando
        // el interruptor está encendido. El chequeo queda como defensa:
        // pujas de antes de la retención, o hechas con el interruptor
        // apagado, pueden no tener respaldo — esas nacen pendientes.
        const r2 = (x: number) => Math.round(x * 100) / 100;
        const saldoGanador = r2((winnerWalletSnap?.data()?.balanceUsd as number) ?? 0);
        const retenidoGanador = r2((winnerWalletSnap?.data()?.heldUsd as number) ?? 0);
        // La retención de ESTA subasta se libera al cerrar, gane o pague
        // como pague. Clampeada: nunca queda negativa.
        const retenidoTrasCierre = Math.max(0, r2(retenidoGanador - finalUsd));
        const pagaConSaldo = saldoGanador >= finalUsd;

        tx.update(auctionRef, {
          status: "sold",
          endedAt: now,
          winnerId: auction.currentBidderId,
          winnerName: auction.currentBidderName,
          finalPriceUsd: finalUsd,
          finalPriceBs: finalBs,
          frozenExchangeRate: currentRate,
          orderId: orderRef.id,
          updatedAt: now,
        });

        // Pagada con saldo: la plata ya está en manos de la plataforma
        // (entró por un depósito aprobado), así que al vendedor se le
        // liquida el precio menos la comisión, sin importar el modo
        // global de cobro. Todo queda asentado en el ledger.
        if (pagaConSaldo) {
          const saldoNuevo = r2(saldoGanador - finalUsd);
          tx.set(db.doc(`${COLLECTIONS.WALLETS}/${auction.currentBidderId}`), {
            userId: auction.currentBidderId,
            balanceUsd: saldoNuevo,
            heldUsd: retenidoTrasCierre,
            updatedAt: now,
          }, { merge: true });

          const wtxRef = db.collection(COLLECTIONS.WALLET_TXS).doc();
          tx.set(wtxRef, {
            id: wtxRef.id,
            userId: auction.currentBidderId,
            type: "auction_payment",
            amountUsd: -finalUsd,
            balanceAfterUsd: saldoNuevo,
            depositId: null,
            method: "wallet",
            reference: orderRef.id,
            note: `Pago de "${auction.title ?? auctionId}"`,
            by: "engine",
            createdAt: now,
          });
        }

        tx.set(orderRef, {
          id: orderRef.id,
          // Número corto y legible para que comprador y vendedor se
          // refieran a la orden ("pedido #K7X2P9") sin cantar el id largo.
          orderNumber: orderRef.id.slice(-6).toUpperCase(),
          auctionId,
          showId,
          productTitle: auction.title ?? "",
          productImageURL: auction.imageURL ?? auction.imageURLs?.[0] ?? null,

          buyerId: auction.currentBidderId,
          buyerName: auction.currentBidderName,
          buyerWhatsapp: null,
          sellerId: auction.sellerId,
          sellerName: auction.sellerName,
          sellerWhatsapp: sellerSnap?.data()?.whatsapp ?? null,

          bidAmountUsd: finalUsd,
          frozenExchangeRate: currentRate,
          bidAmountBs: finalBs,

          commissionMode: pagaConSaldo ? "platform_collects" : commissionMode,
          platformFeePct,
          commissionUsd,
          sellerReceivesUsd: pagaConSaldo
            ? Math.round((finalUsd - commissionUsd) * 100) / 100
            : sellerReceivesUsd,

          status: pagaConSaldo ? "payment_confirmed" : "pending_payment",
          paymentMethod: pagaConSaldo ? "wallet" : null,
          paymentReference: pagaConSaldo ? `billetera ${orderRef.id}` : null,
          paymentConfirmedAt: pagaConSaldo ? now : null,
          paymentConfirmedBy: pagaConSaldo ? "engine" : null,

          // Contabilidad de beta: si pagó la billetera, la plata la tiene
          // la PLATAFORMA y al vendedor se le debe su parte hasta que el
          // admin lo liquide a mano (markSellerPaid).
          payoutStatus: pagaConSaldo ? "pending" : null,
          payoutUsd: pagaConSaldo ? Math.round((finalUsd - commissionUsd) * 100) / 100 : null,
          whatsappMessageSent: false,

          ratingGiven: null,
          ratingComment: null,
          ratingAt: null,

          createdAt: now,
          updatedAt: now,
        });

        if (showId) {
          writeSystemMessage(
            tx, showId,
            `🏆 ¡${auction.currentBidderName} ganó "${auction.title}" por ${formatUsd(finalUsd)}!`,
            "auction_won", now,
            { winnerName: auction.currentBidderName ?? "", productTitle: auction.title ?? "", amountUsd: finalUsd },
          );
        }

        // Sin saldo que alcance: la orden nace pendiente, pero la
        // retención de esta subasta se libera igual — la subasta cerró y
        // esa plata ya no respalda nada.
        if (!pagaConSaldo && winnerWalletSnap?.exists) {
          tx.set(db.doc(`${COLLECTIONS.WALLETS}/${auction.currentBidderId}`), {
            userId: auction.currentBidderId,
            heldUsd: retenidoTrasCierre,
            updatedAt: now,
          }, { merge: true });
        }

        // Avanzar la cola del show antes de salir
        if (mode === "live" && showId) advanceShow({ tx, showId, nextSnap, ownerId: showOwnerId, now });

        return {
          winnerId: auction.currentBidderId as string,
          orderId: orderRef.id,
          title: (auction.title as string) ?? "",
          finalUsd,
        };
      }

      // ── sin ganador ──
      tx.update(auctionRef, { status: "unsold", endedAt: now, updatedAt: now });

      if (showId) {
        writeSystemMessage(tx, showId, `❌ "${auction.title}" quedó sin ganador.`, "system", now);
      }

      if (mode === "live" && showId) advanceShow({ tx, showId, nextSnap, ownerId: showOwnerId, now });

      return null;
    });
  } catch (err) {
    functions.logger.error("Error cerrando subasta", { auctionId, error: err });
    throw err;
  }

  // Post-commit: ahora sí, la notificación
  if (notify) {
    await sendAuctionWonNotification({ ...notify, auctionId });
  }
}

// --------------------------------------------------
// Activa la siguiente subasta del show, o termina el show
// --------------------------------------------------

function advanceShow(params: {
  tx: admin.firestore.Transaction;
  showId: string;
  nextSnap: admin.firestore.QuerySnapshot | null;
  ownerId: string | null;
  now: Timestamp;
}) {
  const { tx, showId, nextSnap, ownerId, now } = params;
  const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);

  // Solo puede subastarse lo que pertenece al dueño del show. Un artículo
  // ajeno en la cola (colado antes del candado de reglas) se cancela aquí
  // mismo: jamás se activa en un show que no es suyo.
  let next: admin.firestore.QueryDocumentSnapshot | null = null;
  for (const d of nextSnap?.docs ?? []) {
    if (ownerId && d.data().sellerId !== ownerId) {
      functions.logger.warn("Artículo ajeno en cola de show, cancelado", { auctionId: d.id, showId });
      tx.update(d.ref, { status: "cancelled", endedAt: now, updatedAt: now });
      continue;
    }
    next = d;
    break;
  }

  // Cola vacía: el show SIGUE EN VIVO sin subasta actual. En el modelo
  // "vende en vivo" el vendedor agrega el próximo artículo en el momento;
  // terminar el show es decisión suya (endShow).
  if (!next) {
    tx.update(showRef, {
      currentAuctionId: null,
      updatedAt: now,
    });
    return;
  }

  const nextData = next.data();
  const timerS = (nextData.timerSeconds as number) ?? DEFAULT_LIVE_TIMER_S;

  tx.update(next.ref, {
    status: "active",
    currentBidUsd: nextData.startingPriceUsd,
    startsAt: now,
    endsAt: Timestamp.fromMillis(now.toMillis() + timerS * 1000),
    updatedAt: now,
  });

  tx.update(showRef, {
    currentAuctionId: next.id,
    currentAuctionIndex: nextData.sortOrder ?? 0,
    updatedAt: now,
  });
}

// --------------------------------------------------

function writeSystemMessage(
  tx: admin.firestore.Transaction,
  showId: string,
  text: string,
  type: string,
  now: Timestamp,
  extra?: Record<string, any>,
) {
  const ref = db.collection(COLLECTIONS.SHOW_MESSAGES(showId)).doc();
  tx.set(ref, {
    id: ref.id,
    showId,
    authorId: "system",
    authorName: "Sistema",
    type,
    text,
    createdAt: now,
    ...(extra ?? {}),
  });
}

async function sendAuctionWonNotification(params: {
  winnerId: string;
  auctionId: string;
  orderId: string;
  title: string;
  finalUsd: number;
}) {
  try {
    // Respeta el interruptor "Cambios en tus órdenes" de Ajustes
    const fcmToken = await tokenParaAviso(params.winnerId, "ordenes");
    if (!fcmToken) return;

    await messaging.send({
      token: fcmToken,
      notification: {
        title: "🏆 ¡Ganaste la subasta!",
        body: `"${params.title}" es tuyo por ${formatUsd(params.finalUsd)}`,
      },
      data: {
        type: "auction_won",
        auctionId: params.auctionId,
        orderId: params.orderId,
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    });
  } catch (err) {
    functions.logger.warn("Error enviando FCM auction_won", err);
  }
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
