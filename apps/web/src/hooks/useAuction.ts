// =============================================================
// Hook: useAuction
// Gestiona el ciclo de vida de la suscripción al show
// y el timer de la subasta activa
// =============================================================

"use client";

import { useEffect, useRef } from "react";
import { useAuctionStore } from "../store/auctionStore";

export function useAuction(showId: string) {
  const store = useAuctionStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribeToShow(showId);
    return unsubscribe;
  }, [showId]);

  // Timer local (tick cada segundo)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      store._tickTimer();
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    show: store.show,
    products: store.products,
    currentProduct: store.currentProduct,
    messages: store.messages,
    secondsRemaining: store.secondsRemaining,
    bidStatus: store.bidStatus,
    bidError: store.bidError,
    submitBid: store.submitBid,
    sendChatMessage: store.sendChatMessage,
    clearBidStatus: store.clearBidStatus,
  };
}
