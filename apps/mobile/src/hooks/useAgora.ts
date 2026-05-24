// =============================================================
// Hook: useAgora (React Native / Expo)
// Misma interfaz que apps/web/src/hooks/useAgora.ts
// La lógica de negocio es idéntica; solo cambia el SDK
// =============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createAgoraRtcEngine,
  ClientRoleType,
  ChannelProfileType,
  IRtcEngine,
  VideoCanvas,
} from "react-native-agora";

export type AgoraRole = "broadcaster" | "audience";

interface UseAgoraParams {
  appId: string;
  channelName: string;
  token: string | null;
  role: AgoraRole;
  enabled: boolean;
}

export function useAgora({ appId, channelName, token, role, enabled }: UseAgoraParams) {
  const engineRef = useRef<IRtcEngine | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [localUid, setLocalUid] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !channelName || !appId) return;

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;

    engine.initialize({ appId });

    if (role === "broadcaster") {
      engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      engine.enableVideo();
      engine.startPreview();
    } else {
      engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
      engine.setClientRole(ClientRoleType.ClientRoleAudience);
    }

    engine.addListener("onJoinChannelSuccess", (connection, elapsed) => {
      setIsJoined(true);
      setLocalUid(connection.localUid ?? 0);
    });

    engine.addListener("onUserJoined", (connection, remoteUidJoined) => {
      setRemoteUid(remoteUidJoined);
    });

    engine.addListener("onUserOffline", () => {
      setRemoteUid(null);
    });

    engine.addListener("onError", (err) => {
      setError(`Agora error: ${err}`);
    });

    engine.joinChannel(token ?? "", channelName, 0, {
      clientRoleType:
        role === "broadcaster"
          ? ClientRoleType.ClientRoleBroadcaster
          : ClientRoleType.ClientRoleAudience,
    });

    return () => {
      engine.leaveChannel();
      engine.release();
      engineRef.current = null;
      setIsJoined(false);
      setRemoteUid(null);
    };
  }, [enabled, channelName, appId, token, role]);

  const toggleMic = useCallback(async () => {
    engineRef.current?.muteLocalAudioStream(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    engineRef.current?.muteLocalVideoStream(false);
  }, []);

  const leaveChannel = useCallback(async () => {
    engineRef.current?.leaveChannel();
    setIsJoined(false);
  }, []);

  return {
    isConnected: isJoined,
    localUid,
    remoteUid,
    engine: engineRef.current,
    error,
    toggleMic,
    toggleCamera,
    leaveChannel,
  };
}

// NOTA: Los hooks de Firestore (useAuction), utilidades de moneda
// y tipos son 100% compartidos con la web desde @subastas-ve/shared.
// Solo este hook de Agora y los componentes de UI son específicos de móvil.
