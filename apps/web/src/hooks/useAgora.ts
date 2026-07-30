"use client";
// =============================================================
// Conexión de video en vivo (Agora RTC)
// =============================================================
// El token lo firma el servidor, por show. Antes vivía escrito a mano acá:
//
//   const AGORA_TOKEN = "007eJxTYJgXf6lyQr/ykZOtL/SsjD8UPv39TlCgYuIG…"
//
// en un repo público. Tres problemas: cualquiera que lo leyera podía
// entrar a transmitir, el token estaba atado al canal show_1779682948388
// —así que el video fallaba en todos los demás shows— y al vencer había
// que desplegar la web de nuevo para renovarlo.
//
// Ahora generateAgoraToken decide el rol según quién pide: el vendedor del
// show puede publicar, cualquier otro solo mirar. El App Certificate se
// queda en Secret Manager y nunca llega al navegador.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

interface Credenciales {
  token: string;
  appId: string;
  uid: number;
  channelName: string;
  expiresAt: number;
}

export function useAgora(showId: string, role: "host" | "audience") {
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);
  const renovarRef = useRef<(() => void) | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pedirCredenciales = async (): Promise<Credenciales> => {
    const r = await httpsCallable<
      { showId: string; role: "publisher" | "subscriber" },
      Credenciales
    >(functions, "generateAgoraToken")({
      showId,
      role: role === "host" ? "publisher" : "subscriber",
    });
    return r.data;
  };

  const join = async (localVideoRef?: HTMLDivElement | null) => {
    if (!showId) return;
    setLoading(true);
    setError(null);
    try {
      const cred = await pedirCredenciales();

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.setLogLevel(4);
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      clientRef.current = client;
      await client.setClientRole(role);

      // El uid lo fija el servidor: el token está firmado para ese uid y no
      // sirve para otro, así que no se puede pasar a un tercero.
      await client.join(cred.appId, cred.channelName, cred.token, cred.uid);

      // Un show puede durar más que el token. Agora avisa 30s antes de que
      // venza; si nadie escucha, el video se corta en medio de la subasta.
      const renovar = async () => {
        try {
          const nueva = await pedirCredenciales();
          await client.renewToken(nueva.token);
        } catch (e) {
          console.error("No se pudo renovar el token de Agora:", e);
        }
      };
      client.on("token-privilege-will-expire", renovar);
      renovarRef.current = renovar;

      if (role === "host") {
        const [micTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          { encoderConfig: "speech_low_quality" },
          { encoderConfig: { width: 640, height: 480, frameRate: 24, bitrateMin: 400, bitrateMax: 1000 } }
        );
        localTrackRef.current = [micTrack, cameraTrack];
        if (localVideoRef) cameraTrack.play(localVideoRef);
        await client.publish([micTrack, cameraTrack]);
      }

      client.on("user-published", async (user: any, mediaType: string) => {
        await client.subscribe(user, mediaType as any);
        if (mediaType === "video") setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
      });
      client.on("user-unpublished", (user: any) => setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid)));
      client.on("user-left", (user: any) => setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid)));

      setJoined(true);
    } catch (e: any) {
      console.error("AGORA ERROR:", e.code, e.name, e.message);
      // Los errores del callable llegan como "functions/algo"; traducirlos
      // porque el usuario no puede hacer nada con un código de Agora.
      const codigo = String(e?.code ?? "");
      setError(
        codigo.includes("failed-precondition")
          ? "El video en vivo todavía no está configurado en este proyecto."
          : codigo.includes("permission-denied")
          ? "Solo el vendedor del show puede transmitir."
          : codigo.includes("unauthenticated")
          ? "Tienes que entrar a tu cuenta para ver el vivo."
          : e?.message ?? "No se pudo conectar al vivo."
      );
    } finally {
      setLoading(false);
    }
  };

  const leave = async () => {
    if (localTrackRef.current) {
      localTrackRef.current.forEach((t: any) => { t.stop(); t.close(); });
      localTrackRef.current = null;
    }
    if (clientRef.current) {
      if (renovarRef.current) clientRef.current.off("token-privilege-will-expire", renovarRef.current);
      await clientRef.current.leave();
      clientRef.current = null;
    }
    renovarRef.current = null;
    setJoined(false);
    setRemoteUsers([]);
  };

  const toggleMic = async () => {
    if (!localTrackRef.current) return;
    await localTrackRef.current[0].setEnabled(!localTrackRef.current[0].enabled);
  };

  const toggleCamera = async () => {
    if (!localTrackRef.current) return;
    await localTrackRef.current[1].setEnabled(!localTrackRef.current[1].enabled);
  };

  useEffect(() => { return () => { leave(); }; }, []);

  return { join, leave, toggleMic, toggleCamera, joined, loading, error, remoteUsers };
}
