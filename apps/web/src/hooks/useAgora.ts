"use client";
import { useEffect, useRef, useState } from "react";

const AGORA_APP_ID = "2cd32d3fd3554834954d580d57c870b9";
const AGORA_TOKEN = "007eJxTYJjIxbuoaOHZiTZxC/+lLqh74X31W4dA1sPdF1qZJ3S11igoMBglpxgbpRinpRibmppYGJtYmpqkmFoYpJiaJ1uYGyRZnpcWymoIZGRgSAphZWSAQBCfnaE4I7/cwMCQgQEAxiEfSA==";

export function useAgora(channelName: string, role: "host" | "audience") {
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const join = async (localVideoRef?: HTMLDivElement | null) => {
    if (!channelName) return;
    setLoading(true);
    setError(null);
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.setLogLevel(4);
      const client = AgoraRTC.createClient({ mode:"live", codec:"vp8" });
      clientRef.current = client;
      await client.setClientRole(role);
      await client.join(AGORA_APP_ID, channelName, AGORA_TOKEN, null);

      if (role === "host") {
        const [micTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          { encoderConfig:"speech_low_quality" },
          { encoderConfig:{ width:640, height:480, frameRate:24, bitrateMin:400, bitrateMax:1000 } }
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
      setError(e.message ?? "Error conectando");
    } finally {
      setLoading(false);
    }
  };

  const leave = async () => {
    if (localTrackRef.current) { localTrackRef.current.forEach((t: any) => { t.stop(); t.close(); }); localTrackRef.current = null; }
    if (clientRef.current) { await clientRef.current.leave(); clientRef.current = null; }
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
