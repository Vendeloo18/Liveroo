// =============================================================
// Reacciones del show: entrada validada y limpieza automática
// =============================================================
// El cliente no escribe directamente en /reactions. Esta callable valida
// show, emoji y frecuencia; el job programado elimina las reacciones viejas
// para que una animación efímera no se convierta en almacenamiento eterno.

import * as functions from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

const EMOJIS = new Set(["❤️", "🔥", "😂", "👏"]);
const COOLDOWN_MS = 400;
const REACTION_TTL_MS = 60 * 60_000;
const CLEANUP_BATCH = 400;
const CLEANUP_MAX_BATCHES = 5;

export const sendReaction = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 15 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    return processReaction(data, context.auth.uid);
  });

// Ruta v2: una instancia atiende muchas reacciones concurrentes. La v1 se
// conserva mientras los clientes ya instalados actualizan su service worker.
export const sendReactionV2 = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    minInstances: 1,
    maxInstances: 20,
    concurrency: 80,
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    return processReaction(request.data, request.auth.uid);
  },
);

async function processReaction(data: unknown, uid: string) {
  const { showId, emoji } = (data ?? {}) as { showId?: string; emoji?: string };
  if (!showId || showId.length > 160 || showId.includes("/") || !emoji || !EMOJIS.has(emoji)) {
    throw new functions.https.HttpsError("invalid-argument", "Show o reacción inválida");
  }

  const showRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}`);
  const rateRef = db.doc(`${COLLECTIONS.SHOWS}/${showId}/reactionRateLimits/${uid}`);
  const reactionRef = db.collection(`${COLLECTIONS.SHOWS}/${showId}/reactions`).doc();

  await db.runTransaction(async (tx) => {
    const [showSnap, rateSnap] = await Promise.all([
      tx.get(showRef),
      tx.get(rateRef),
    ]);

    if (!showSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Show no encontrado");
    }
    if (showSnap.data()!.status !== "live") {
      throw new functions.https.HttpsError("failed-precondition", "El show no está en vivo");
    }

    const now = Timestamp.now();
    const lastAt = rateSnap.data()?.lastAt as Timestamp | undefined;
    if (lastAt && now.toMillis() - lastAt.toMillis() < COOLDOWN_MS) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Espera un instante antes de reaccionar otra vez"
      );
    }

    tx.set(rateRef, { userId: uid, lastAt: now }, { merge: true });
    tx.set(reactionRef, {
      authorId: uid,
      emoji,
      createdAt: now,
    });
  });

  return { success: true };
}

export const cleanupOldReactions = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 15 minutes")
  .onRun(async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - REACTION_TTL_MS);
    let deleted = 0;

    for (let i = 0; i < CLEANUP_MAX_BATCHES; i++) {
      const old = await db
        .collectionGroup("reactions")
        .where("createdAt", "<", cutoff)
        .limit(CLEANUP_BATCH)
        .get();

      if (old.empty) break;
      const batch = db.batch();
      old.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += old.size;
      if (old.size < CLEANUP_BATCH) break;
    }

    if (deleted > 0) {
      functions.logger.info("Reacciones antiguas eliminadas", { deleted });
    }
    return null;
  });
