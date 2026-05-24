"use client";

import { useState, useEffect } from "react";
import {
  formatUsd,
  formatBs,
  calcMinNextBid,
  isValidBidAmount,
  formatTimer,
  isUrgent,
  buildWhatsappLink,
  buildWhatsappMessage,
  type ShowProduct,
  type Order,
} from "@subastas-ve/shared";
import { useAuthStore } from "../../store/authStore";
import { useAuctionStore } from "../../store/auctionStore";

interface BidPanelProps {
  product: ShowProduct;
  exchangeRate: number;
  showId: string;
  showTitle: string;
  secondsRemaining: number;
}

export function BidPanel({
  product,
  exchangeRate,
  showId,
  showTitle,
  secondsRemaining,
}: BidPanelProps) {
  const { profile } = useAuthStore();
  const { submitBid, bidStatus, bidError } = useAuctionStore();
  const [bidInput, setBidInput] = useState("");

  const minNextBid = calcMinNextBid(product.currentBidUsd, product.minIncrementUsd);
  const urgent = isUrgent(secondsRemaining);
  const isMyBid = product.currentBidderId === profile?.uid;
  const isClosed = product.auctionStatus !== "active";

  useEffect(() => {
    setBidInput(minNextBid.toFixed(2));
  }, [product.currentBidUsd]);

  const handleBid = async () => {
    if (!profile) return;
    const amount = parseFloat(bidInput);
    const validation = isValidBidAmount(amount, product.currentBidUsd, product.minIncrementUsd);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }
    await submitBid({
      showId,
      productId: product.id,
      bidderId: profile.uid,
      bidderName: profile.displayName,
      amountUsd: amount,
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col gap-4">
      {/* Producto */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 leading-tight">{product.title}</h2>
        {product.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
      </div>

      {/* Temporizador */}
      <div
        className={`flex items-center justify-center rounded-xl py-3 text-3xl font-mono font-extrabold transition-colors ${
          isClosed
            ? "bg-gray-100 text-gray-400"
            : urgent
            ? "bg-red-50 text-red-600 animate-pulse"
            : "bg-amber-50 text-amber-600"
        }`}
      >
        {isClosed ? "CERRADA" : formatTimer(secondsRemaining)}
      </div>

      {/* Puja actual */}
      <div className="text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Puja actual</p>
        <p className="text-3xl font-extrabold text-gray-900">
          {formatUsd(product.currentBidUsd)}
        </p>
        <p className="text-sm text-gray-400">
          ≈ {formatBs(product.currentBidUsd * exchangeRate)}
        </p>
        {product.currentBidderName && (
          <p className="text-xs mt-1 font-medium text-indigo-600">
            {isMyBid ? "🏆 Vas ganando tú" : `Líder: ${product.currentBidderName}`}
          </p>
        )}
      </div>

      {/* Input de puja */}
      {!isClosed && !isMyBid && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500 font-medium">
            Mínimo: {formatUsd(minNextBid)}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                $
              </span>
              <input
                type="number"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                step={product.minIncrementUsd}
                min={minNextBid}
                disabled={bidStatus === "pending"}
                className="w-full pl-7 pr-3 py-3 border-2 border-gray-200 rounded-xl text-lg font-bold focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
                placeholder={minNextBid.toFixed(2)}
              />
            </div>
            <button
              onClick={handleBid}
              disabled={bidStatus === "pending" || isClosed}
              className={`px-5 py-3 rounded-xl font-bold text-white text-sm transition-all ${
                bidStatus === "pending"
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
              }`}
            >
              {bidStatus === "pending" ? "⏳" : "PUJAR"}
            </button>
          </div>

          {/* Botones rápidos */}
          <div className="flex gap-2">
            {[1, 5, 10].map((inc) => (
              <button
                key={inc}
                onClick={() =>
                  setBidInput((parseFloat(bidInput || "0") + inc).toFixed(2))
                }
                className="flex-1 py-1.5 text-xs font-semibold border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
              >
                +${inc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedback de puja */}
      {bidStatus === "accepted" && (
        <div className="bg-green-50 text-green-700 text-sm font-medium text-center rounded-lg py-2">
          ✅ ¡Puja registrada!
        </div>
      )}
      {bidStatus === "rejected" && bidError && (
        <div className="bg-red-50 text-red-600 text-sm font-medium text-center rounded-lg py-2">
          ❌ {bidError}
        </div>
      )}
      {isMyBid && !isClosed && (
        <div className="bg-green-50 text-green-700 text-sm font-medium text-center rounded-lg py-2">
          🏆 Eres el mayor postor. ¡No te dejes superar!
        </div>
      )}

      {/* Info en Bs */}
      {parseFloat(bidInput) > 0 && (
        <p className="text-center text-xs text-gray-400">
          {formatUsd(parseFloat(bidInput) || 0)} ≈{" "}
          {formatBs((parseFloat(bidInput) || 0) * exchangeRate)}
          <span className="block text-gray-300">Tasa: {exchangeRate} Bs/USD</span>
        </p>
      )}
    </div>
  );
}
