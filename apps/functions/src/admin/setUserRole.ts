// =============================================================
// CLOUD FUNCTION: setUserRole (callable, solo admin)
// =============================================================
// Dar o quitar la marca de administrador. Antes esto solo se podía
// hacer entrando a la consola de Firebase y editando el documento a
// mano — algo que ni se puede desde el teléfono ni conviene pedirle a
// nadie que haga con el resto de la base de datos abierta al lado.
//
// Las reglas de Firestore NO dejan tocar `role` desde el cliente (a
// propósito: sería escalada de privilegios), así que la única vía es
// esta función, que valida del lado del servidor quién la llama.
//
// Dos candados que importan:
//   · Nadie puede cambiarse el rol a sí mismo. Evita que alguien se
//     quite el admin por error y deje la consola sin dueño, y evita
//     que una sesión robada se auto-promocione en silencio.
//   · Siempre queda al menos un administrador. Quitar el último deja
//     la plataforma sin quien apruebe recargas ni liquide vendedores.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

export const setUserRole = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    const { userId, makeAdmin } = (data ?? {}) as { userId?: string; makeAdmin?: boolean };
    if (!userId || typeof userId !== "string" || userId.includes("/")) {
      throw new functions.https.HttpsError("invalid-argument", "userId es requerido");
    }
    if (typeof makeAdmin !== "boolean") {
      throw new functions.https.HttpsError("invalid-argument", "makeAdmin debe ser true o false");
    }

    const callerId = context.auth.uid;
    if (callerId === userId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes cambiar tu propio rol. Pídeselo a otro administrador."
      );
    }

    const callerSnap = await db.doc(`${COLLECTIONS.USERS}/${callerId}`).get();
    if (callerSnap.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const targetRef = db.doc(`${COLLECTIONS.USERS}/${userId}`);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Esa persona todavía no tiene cuenta en la app. Que entre primero y vuelve a intentar."
      );
    }
    const objetivo = targetSnap.data()!;

    // Quitar el último admin dejaría la consola sin dueño.
    if (!makeAdmin && objetivo.role === "admin") {
      const admins = await db
        .collection(COLLECTIONS.USERS)
        .where("role", "==", "admin")
        .limit(2)
        .get();
      if (admins.size <= 1) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Es el único administrador que queda: nombra a otro antes de quitarle el acceso."
        );
      }
    }

    // Al quitar admin se vuelve al rol que corresponda por su actividad:
    // un vendedor aprobado sigue siendo vendedor; el resto, comprador.
    const nuevoRol = makeAdmin
      ? "admin"
      : objetivo.sellerStatus === "approved" ? "seller" : "buyer";

    await targetRef.update({ role: nuevoRol, updatedAt: Timestamp.now() });

    functions.logger.info("Rol cambiado", {
      userId, nuevoRol, por: callerId, correo: objetivo.email ?? null,
    });
    return { success: true, role: nuevoRol };
  });
