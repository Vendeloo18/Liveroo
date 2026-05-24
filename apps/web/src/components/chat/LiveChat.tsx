"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@subastas-ve/shared";

interface LiveChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

const TYPE_STYLES: Record<string, string> = {
  chat: "text-gray-200",
  system: "text-gray-400 italic text-xs",
  bid_placed: "text-amber-400 font-semibold",
  auction_won: "text-green-400 font-bold",
};

export function LiveChat({ messages, onSend, disabled = false }: LiveChatProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await onSend(input.trim());
      setInput("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800 text-xs text-gray-400 font-medium uppercase tracking-wide">
        Chat en vivo
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={TYPE_STYLES[msg.type] ?? "text-gray-200"}>
            {msg.type === "chat" && (
              <span className="font-semibold text-indigo-400 mr-1">
                {msg.authorName}:
              </span>
            )}
            <span className="text-sm break-words">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 bg-gray-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={disabled || sending}
          maxLength={300}
          placeholder="Escribe un mensaje…"
          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || sending || !input.trim()}
          className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg font-medium disabled:opacity-40 hover:bg-indigo-500"
        >
          →
        </button>
      </div>
    </div>
  );
}
