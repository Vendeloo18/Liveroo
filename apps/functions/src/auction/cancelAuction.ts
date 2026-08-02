// =============================================================
// CLOUD FUNCTION: cancelAuction (callable)
// =============================================================
// Dos operaciones distintas detrás de un mismo nombre, porque la
// diferencia no está en el botón sino en QUIÉN y CON CUÁNTAS OFERTAS:
//
//   RETIRAR  — el vendedor baja su propia publicación, y solo mientras
//              NADIE haya ofertado. Sin ofertas no hay nada que romper:
//              es el arreglo del precio mal escrito o la foto cambiada.
//
//   CANCELAR — solo un administrador, con motivo obligatorio. Es la
//              válvula de emergencia (artículo ilegal, subasta trabada,
//              vendedor que desapareció). Libera la retención de quien
//              iba ganando en la MISMA transacción: si no, esa plata
//              queda secuestrada hasta el endsAt, que puede ser a 7 días.
//
// Lo que NUNCA se permite: que el vendedor cancele una subasta que ya
// tiene ofertas. Eso es un precio de reserva encubierto — "no llegó a lo
// que yo quería, me arrepiento" — y es exactamente el fraude que hace
// que la gente desconfíe de las subastas por internet.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const cancelAuction = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    const { auctionId, reason } = (data ?? {}) as { auctionId?: string; reason?: string };
    if (!auctionId || typeof auctionId !== "string" || auctionId.includes("/")) {
      throw new functions.https.HttpsError("invalid-argument", "auctionId es requerido");
    }

    const callerId = context.auth.uid;
    const auctionRef = db.doc(`${COLLECTIONS.AUCTIONS}/${auctionId}`);
    const motivo = (reason ?? "").trim().slice(0, 300);

    const resultado = await db.runTransaction(async (tx) => {
      // ── lecturas ──
      const [auctionSnap, userSnap] = await Promise.all([
        tx.get(auctionRef),
        tx.get(db.doc(`${COLLECTIONS.USERS}/${callerId}`)),
      ]);
      if (!auctionSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Esa subasta no existe");
      }
      const a = auctionSnap.data()!;
      const esAdmin = userSnap.data()?.role === "admin";
      const esDueno = a.sellerId === callerId;
      const ofertas = (a.bidsCount as number) ?? 0;
      const liderId = a.currentBidderId as string | undefined;

      if (!["active", "waiting", "draft"].includes(a.status)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Esta subasta ya está '${a.status}': no hay nada que cancelar`
        );
      }

      let modo: "retirada" | "cancelada";
      if (esAdmin) {
        if (!motivo || motivo.length < 3) {
          throw new functions.https.HttpsError("invalid-argument", "Un administrador debe dejar el motivo de la cancelación");
        }
        modo = "cancelada";
      } else if (esDueno) {
        if (ofertas > 0 || liderId) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Ya hay ofertas: no puedes retirarla. Una oferta es un compromiso, también para ti. Si hay un problema real, escríbenos."
          );
        }
        modo = "retirada";
      } else {
        throw new functions.https.HttpsError("permission-denied", "No es tu publicación");
      }

      // La retención del líder solo existe si alguien iba ganando. Se lee
      // dentro de la transacción para que un cierre simultáneo no se cruce.
      const walletRef = liderId ? db.doc(`${COLLECTIONS.WALLETS}/${liderId}`) : null;
      const walletSnap = walletRef ? await tx.get(walletRef) : null;

      // El show puede estar apuntando a esta subasta como la actual.
      const showId = a.showId as string | undefined;
      const showSnap = showId ? await tx.get(db.doc(`${COLLECTIONS.SHOWS}/${showId}`)) : null;

      const now = Timestamp.now();

      // ── escrituras ──
      tx.update(auctionRef, {
        status: "cancelled",
        endedAt: now,
        cancelledBy: callerId,
        cancelledReason: motivo || null,
        updatedAt: now,
      });

      // Liberar lo retenido: esta subasta ya no respalda nada. Clampeado a
      // cero, nunca negativo.
      let liberado = 0;
      if (liderId && walletRef && walletSnap?.exists) {
        const retenido = r2((walletSnap.data()?.heldUsd as number) ?? 0);
        liberado = Math.min(retenido, r2((a.currentBidUsd as number) ?? 0));
        tx.set(walletRef, {
          userId: liderId,
          heldUsd: Math.max(0, r2(retenido - liberado)),
          updatedAt: now,
        }, { merge: true });
      }

      // Si era la subasta en pantalla del show, dejarlo sin actual: el
      // vendedor presenta la siguiente cuando quiera.
      if (showSnap?.exists && showSnap.data()?.currentAuctionId === auctionId) {
        tx.update(showSnap.ref, { currentAuctionId: null, updatedAt: now });
      }

      // Aviso en el chat del show, para que nadie se quede esperando.
      if (showId && modo === "cancelada") {
        const msgRef = db.collection(COLLECTIONS.SHOW_MESSAGES(showId)).doc();
        tx.set(msgRef, {
          id: msgRef.id,
          showId,
          authorId: "system",
          authorName: "Sistema",
          type: "system",
          text: `"${a.title ?? "Un artículo"}" fue cancelado.`,
          createdAt: now,
        });
      }

      return { modo, liberadoUsd: liberado, liderId: liderId ?? null };
    });

    functions.logger.info("Subasta cancelada", { auctionId, por: callerId, ...resultado });
    return { success: true, ...resultado };
  });
