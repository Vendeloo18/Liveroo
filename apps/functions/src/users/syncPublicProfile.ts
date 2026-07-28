// =============================================================
// CLOUD FUNCTION: syncPublicProfile
// =============================================================
// /users guarda datos privados: email, teléfono, cédula, token FCM.
// Antes esa colección era de lectura pública, así que cualquiera
// podía bajarse los correos y teléfonos de todos los usuarios.
//
// Ahora /users es solo del dueño, y esta función copia a
// /publicProfiles nada más que lo que la web necesita mostrar:
// nombre, foto, tienda, reputación. Si mañana se agrega un campo
// sensible a /users, no se filtra solo por existir.
// =============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// Timestamp/FieldValue desde el subpath modular: el namespace
// admin.firestore.* no sobrevive al envoltorio del emulador.
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

// Lista blanca: solo esto sale a la calle.
const PUBLIC_FIELDS = [
  "uid",
  "displayName",
  "username",
  "avatar",
  "shopName",
  "sellerCat",
  "city",
  "role",
  "sellerStatus",
  "ratingAvg",
  "ratingCount",
  "totalSales",
] as const;

export function buildPublicProfile(
  userId: string,
  user: admin.firestore.DocumentData
): admin.firestore.DocumentData {
  const out: admin.firestore.DocumentData = { uid: userId };
  for (const field of PUBLIC_FIELDS) {
    if (user[field] !== undefined) out[field] = user[field];
  }
  return out;
}

export const syncPublicProfile = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30, memory: "128MB" })
  .firestore.document("users/{userId}")
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const publicRef = db.doc(`${COLLECTIONS.PUBLIC_PROFILES}/${userId}`);

    // Usuario borrado → se va también su perfil público
    if (!change.after.exists) {
      await publicRef.delete().catch(() => undefined);
      return;
    }

    const after = change.after.data()!;
    const before = change.before.exists ? change.before.data()! : {};

    // Si no cambió nada público, no escribimos: evita un bucle de
    // triggers y ahorra escrituras.
    const changed = PUBLIC_FIELDS.some((f) => before[f] !== after[f]);
    if (change.before.exists && !changed) return;

    await publicRef.set(
      {
        ...buildPublicProfile(userId, after),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  });
