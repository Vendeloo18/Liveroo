// =============================================================
// Zustand Store — Estado de subasta en vivo
// =============================================================

import { create } from "zustand";
import { type Show, type ShowProduct, type ChatMessage } from "@subastas-ve/shared";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "@subastas-ve/shared";

interface AuctionState {
  show: Show | null;
  products: ShowProduct[];
  currentProduct: ShowProduct | null;
  messages: ChatMessage[];
  secondsRemaining: number;
  isSubscribed: boolean;
  bidStatus: "idle" | "pending" | "accepted" | "rejected";
  bidError: string | null;

  // Actions
  subscribeToShow: (showId: string) => () => void;
  submitBid: (params: {
    showId: string;
    productId: string;
    bidderId: string;
    bidderName: string;
    amountUsd: number;
  }) => Promise<void>;
  sendChatMessage: (params: {
    showId: string;
    authorId: string;
    authorName: string;
    text: string;
  }) => Promise<void>;
  clearBidStatus: () => void;
  _tickTimer: () => void;
}

export const useAuctionStore = create<AuctionState>((set, get) => ({
  show: null,
  products: [],
  currentProduct: null,
  messages: [],
  secondsRemaining: 0,
  isSubscribed: false,
  bidStatus: "idle",
  bidError: null,

  subscribeToShow: (showId: string) => {
    const unsubs: Array<() => void> = [];

    // Show
    const showUnsub = onSnapshot(doc(db, COLLECTIONS.SHOWS, showId), (snap) => {
      if (snap.exists()) {
        const show = snap.data() as Show;
        set({ show });

        // Actualizar currentProduct cuando cambia currentAuctionId
        const { products } = get();
        const current = products.find((p) => p.id === show.currentAuctionId) ?? null;
        if (current) set({ currentProduct: current });
      }
    });
    unsubs.push(showUnsub);

    // Productos (ordenados)
    const productsUnsub = onSnapshot(
      query(
        collection(db, COLLECTIONS.SHOW_PRODUCTS(showId)),
        orderBy("sortOrder", "asc")
      ),
      (snap) => {
        const products = snap.docs.map((d) => d.data() as ShowProduct);
        const { show } = get();
        const current = products.find((p) => p.id === show?.currentAuctionId) ?? null;
        set({ products, currentProduct: current });
      }
    );
    unsubs.push(productsUnsub);

    // Mensajes de chat (últimos 100)
    const messagesUnsub = onSnapshot(
      query(
        collection(db, COLLECTIONS.SHOW_MESSAGES(showId)),
        orderBy("createdAt", "desc"),
        limit(100)
      ),
      (snap) => {
        const messages = snap.docs
          .map((d) => d.data() as ChatMessage)
          .reverse(); // más nuevos al final
        set({ messages });
      }
    );
    unsubs.push(messagesUnsub);

    set({ isSubscribed: true });

    return () => {
      unsubs.forEach((u) => u());
      set({ isSubscribed: false, show: null, products: [], messages: [], currentProduct: null });
    };
  },

  // El cliente escribe en /pendingBids; la Cloud Function valida
  submitBid: async ({ showId, productId, bidderId, bidderName, amountUsd }) => {
    set({ bidStatus: "pending", bidError: null });

    try {
      const pendingBidRef = await addDoc(collection(db, COLLECTIONS.PENDING_BIDS), {
        showId,
        productId,
        bidderId,
        bidderName,
        amountUsd,
        submittedAt: serverTimestamp(),
        status: "pending",
      });

      // Escuchar el resultado de la puja pendiente
      const unsub = onSnapshot(pendingBidRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === "processed") {
          set({ bidStatus: "accepted" });
          unsub();
          setTimeout(() => set({ bidStatus: "idle" }), 3000);
        } else if (data.status === "rejected") {
          const reasonMap: Record<string, string> = {
            too_low: "Tu oferta es menor al mínimo requerido",
            auction_closed: "La venta ya cerró",
            own_bid: "Tu oferta ya va de primera",
            race_condition: "Error temporal, intenta de nuevo",
          };
          set({
            bidStatus: "rejected",
            bidError: reasonMap[data.rejectedReason] ?? "Oferta rechazada",
          });
          unsub();
          setTimeout(() => set({ bidStatus: "idle", bidError: null }), 5000);
        }
      });
    } catch (err) {
      set({ bidStatus: "rejected", bidError: "Error enviando la oferta" });
      setTimeout(() => set({ bidStatus: "idle", bidError: null }), 5000);
    }
  },

  sendChatMessage: async ({ showId, authorId, authorName, text }) => {
    if (!text.trim()) return;
    await addDoc(collection(db, COLLECTIONS.SHOW_MESSAGES(showId)), {
      showId,
      authorId,
      authorName,
      type: "chat",
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  },

  clearBidStatus: () => set({ bidStatus: "idle", bidError: null }),

  _tickTimer: () => {
    const { currentProduct } = get();
    if (!currentProduct?.auctionEndsAt) {
      set({ secondsRemaining: 0 });
      return;
    }
    const endsMs = (currentProduct.auctionEndsAt as any).toMillis?.() ?? 0;
    const diff = Math.max(0, Math.floor((endsMs - Date.now()) / 1000));
    set({ secondsRemaining: diff });
  },
}));
