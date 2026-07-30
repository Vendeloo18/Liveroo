// =============================================================
// CLOUD FUNCTION: generateAgoraToken (callable)
// =============================================================
// El token de Agora es lo único que decide quién puede transmitir en un
// canal. Antes vivía escrito a mano en apps/web/src/hooks/useAgora.ts, en
// un repo público, y con eso venían tres problemas:
//
//   1. Cualquiera que leyera el repo podía entrar al canal a transmitir.
//   2. El token de prueba está atado a un canal —show_1779682948388— así
//      que funcionaba para ese show y fallaba en todos los demás.
//   3. Al vencer había que recompilar y desplegar la web para renovarlo.
//
// Ahora lo firma el servidor, por show, con el rol que corresponde: el
// vendedor del show recibe permiso de publicar; cualquier otro, solo de
// mirar. El App Certificate nunca sale de Secret Manager.
//
// El uid de Agora se deriva del uid de Firebase, no lo elige el cliente:
// un token queda atado a una persona y no se puede pasar a otra.
// =============================================================

import * as functions from "firebase-functions";
import * as crypto from "crypto";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

/** Cuánto vale un token. Agora avisa al cliente 30s antes de que venza. */
const VIGENCIA_S = 4 * 60 * 60;

/**
 * Agora quiere un entero sin signo de 32 bits; Firebase da una cadena.
 * Se deriva por hash para que sea estable —la misma persona reconectando
 * es el mismo uid, así el stream no se duplica en pantalla— y para que el
 * cliente no pueda pedir el uid de otro.
 *
 * Se evita el 0: en Agora significa "cualquier uid", y un token con 0 se
 * lo puede pasar cualquiera.
 */
function uidAgora(uidFirebase: string): number {
  const h = crypto.createHash("sha256").update(uidFirebase).digest();
  return (h.readUInt32BE(0) % 4294967294) + 1;
}

export const generateAgoraToken = functions
  .region("us-central1")
  .runWith({ secrets: ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { showId, role } = (data ?? {}) as {
      showId?: string;
      role?: "publisher" | "subscriber";
    };
    if (!showId) {
      throw new functions.https.HttpsError("invalid-argument", "showId es requerido");
    }

    const showSnap = await db.doc(`${COLLECTIONS.SHOWS}/${showId}`).get();
    if (!showSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Show no encontrado");
    }
    const show = showSnap.data()!;

    const canal = show.agoraChannelName as string | undefined;
    if (!canal) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "El show no tiene canal asignado"
      );
    }

    // El canal lo dice el show, no el cliente. Si viniera del cliente,
    // cualquiera podría pedir un token de publicador para el canal de otro
    // vendedor pasando el showId propio.
    const esDueno = show.sellerId === context.auth.uid;
    if (role === "publisher" && !esDueno) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo el vendedor del show puede transmitir"
      );
    }

    // El certificado se comprueba acá, DESPUÉS de los permisos, y no al
    // entrar. Con el orden invertido, un tercero pidiendo permiso de
    // publicar recibía "Agora no está configurado" en vez de "solo el
    // vendedor puede transmitir": el mensaje equivocado, y encima imposible
    // de distinguir al probarlo. Una petición que igual se va a rechazar no
    // tiene por qué depender de que Agora esté configurado.
    //
    // Se valida el formato —32 hexadecimales— y no solo la presencia, porque
    // runWith({secrets}) exige que el secret EXISTA para poder desplegar: si
    // faltara, fallaría el despliegue completo de functions. Así el secret
    // puede existir con un relleno mientras nadie configura Agora, y esto
    // responde "no configurado" en vez de firmar un token inválido que el
    // cliente tomaría por bueno.
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const valido = (v?: string) => !!v && /^[0-9a-f]{32}$/i.test(v.trim());
    if (!valido(appId) || !valido(appCertificate)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Agora no está configurado en este proyecto: falta AGORA_APP_ID o " +
          "AGORA_APP_CERTIFICATE en Secret Manager, o tienen un valor de relleno."
      );
    }

    const uid = uidAgora(context.auth.uid);
    const ahora = Math.floor(Date.now() / 1000);
    const vence = ahora + VIGENCIA_S;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId!.trim(),
      appCertificate!.trim(),
      canal,
      uid,
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      VIGENCIA_S,
      VIGENCIA_S
    );

    functions.logger.info("Token de Agora emitido", {
      showId, canal, uid, rol: role ?? "subscriber", para: context.auth.uid,
    });

    // Devuelve también appId y uid para que el cliente no tenga que
    // adivinarlos ni llevarlos escritos: un solo origen de verdad.
    return { token, appId: appId!.trim(), uid, channelName: canal, expiresAt: vence * 1000 };
  });
