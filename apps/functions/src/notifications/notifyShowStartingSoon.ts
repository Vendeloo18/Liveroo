// =============================================================
// CLOUD FUNCTION: notifyShowStartingSoon
// Corre cada minuto y notifica vía FCM a compradores que
// siguen a un vendedor cuyo show empieza en ~5 minutos.
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp } from "firebase-admin/firestore";
import { db, messaging } from "../firebase";
import { COLLECTIONS } from "../constants";

export const notifyShowStartingSoon = functions
  .region("us-central1")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    const now = Timestamp.now();
    const fiveMinutesFromNow = Timestamp.fromMillis(
      now.toMillis() + 5 * 60 * 1000
    );
    const sixMinutesFromNow = Timestamp.fromMillis(
      now.toMillis() + 6 * 60 * 1000
    );

    // Shows que empiezan entre 5 y 6 minutos desde ahora y aún no notificaron
    const showsSnap = await db
      .collection(COLLECTIONS.SHOWS)
      .where("status", "==", "scheduled")
      .where("scheduledAt", ">=", fiveMinutesFromNow)
      .where("scheduledAt", "<=", sixMinutesFromNow)
      .where("notifiedScheduled", "==", false)
      .get();

    if (showsSnap.empty) return;

    for (const showDoc of showsSnap.docs) {
      const show = showDoc.data();

      try {
        // Topic: todos los suscriptores del vendedor
        // Los clientes se suscriben al topic `seller_{sellerId}` al seguir al vendedor
        await messaging.send({
          topic: `seller_${show.sellerId}`,
          notification: {
            title: `📡 ${show.sellerName} empieza en 5 minutos`,
            body: show.title,
          },
          data: {
            type: "show_starting_soon",
            showId: showDoc.id,
          },
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        });

        // Marcar como notificado
        await showDoc.ref.update({ notifiedScheduled: true });

        functions.logger.info("FCM show_starting_soon enviado", {
          showId: showDoc.id,
          sellerId: show.sellerId,
        });
      } catch (err) {
        functions.logger.error("Error enviando FCM show_starting_soon", {
          showId: showDoc.id,
          error: err,
        });
      }
    }
  });
