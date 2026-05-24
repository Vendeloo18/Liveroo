"use client";

import { useEffect, useRef } from "react";
import type { IRemoteVideoTrack, ICameraVideoTrack } from "agora-rtc-sdk-ng";

interface LiveVideoPlayerProps {
  videoTrack: IRemoteVideoTrack | ICameraVideoTrack | null;
  mirrored?: boolean;  // true para preview local del broadcaster
  className?: string;
}

export function LiveVideoPlayer({ videoTrack, mirrored = false, className = "" }: LiveVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => {
      videoTrack.stop();
    };
  }, [videoTrack]);

  return (
    <div
      ref={containerRef}
      className={`bg-gray-900 overflow-hidden ${className} ${mirrored ? "scale-x-[-1]" : ""}`}
      style={{ aspectRatio: "16/9" }}
    >
      {!videoTrack && (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          <div className="text-center">
            <div className="text-4xl mb-2">📡</div>
            <p>Conectando transmisión…</p>
          </div>
        </div>
      )}
    </div>
  );
}
