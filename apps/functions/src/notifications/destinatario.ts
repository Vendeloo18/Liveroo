// =============================================================
// A quién se le puede mandar un aviso, y si quiere recibirlo
// =============================================================
// Antes cada función hacía esto:
//
//   const fcmToken = userSnap.data()?.fcmToken;
//   if (!fcmToken) return;
//
// Es decir: si había token, se mandaba. Los interruptores de Ajustes
// escribían notifPrefs en /users y nadie los leía nunca, así que apagar
// "te superaron en una puja" no apagaba nada. La pantalla prometía un
// control que no existía.
//
// Esto centraliza las dos preguntas —¿tiene dónde recibir? ¿lo pidió?—
// en un solo lugar, para que la próxima notificación que se agregue no
// se olvide de la segunda.
// =============================================================

import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

/** Las claves son las mismas que usa apps/web/src/app/settings/page.tsx */
export type ClaveAviso = "pujas" | "ordenes" | "shows" | "promo";

/**
 * Devuelve el token FCM si la persona puede y quiere recibir este aviso;
 * null si no tiene token, o si apagó esta categoría.
 *
 * Ausencia de preferencia = sí, salvo promo. Quien nunca entró a Ajustes
 * recibe los avisos de servicio (te superaron, tu pedido), que son los
 * que hacen falta para no perder una subasta; las promociones son
 * opt-in explícito.
 */
export async function tokenParaAviso(
  uid: string,
  clave: ClaveAviso
): Promise<string | null> {
  const snap = await db.doc(`${COLLECTIONS.USERS}/${uid}`).get();
  const datos = snap.data();
  if (!datos) return null;

  const token = datos.fcmToken as string | undefined;
  if (!token) return null;

  const prefs = datos.notifPrefs as Record<string, boolean> | undefined;
  const predeterminado = clave !== "promo";
  const quiere = prefs?.[clave] ?? predeterminado;

  return quiere ? token : null;
}
