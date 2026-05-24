// =============================================================
// SUBASTAS VE — Modelo de datos principal (Firestore)
// =============================================================

import { Timestamp } from "firebase/firestore";

// --------------------------------------------------
// Usuarios y roles
// --------------------------------------------------

export type UserRole = "buyer" | "seller" | "admin";

export type SellerStatus = "pending" | "approved" | "suspended";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  whatsapp?: string;
  role: UserRole;
  // Solo para vendedores
  sellerStatus?: SellerStatus;
  sellerApprovedAt?: Timestamp;
  sellerApprovedBy?: string; // admin uid
  // Reputación
  ratingAvg: number;       // 0-5
  ratingCount: number;
  totalSales: number;
  totalPurchases: number;
  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --------------------------------------------------
// Tasa de cambio (colección: /exchangeRates)
// El admin actualiza el documento "current"
// --------------------------------------------------

export interface ExchangeRate {
  id: string;
  usdToBs: number;         // cuántos Bs por 1 USD
  updatedAt: Timestamp;
  updatedBy: string;       // admin uid
}

// --------------------------------------------------
// Configuración de comisión (colección: /config)
// Documento: "commission"
// --------------------------------------------------

export type CommissionMode =
  | "platform_collects"    // (a) plataforma cobra todo y reparte al vendedor
  | "seller_collects";     // (b) vendedor cobra directo, plataforma registra comisión

export interface CommissionConfig {
  mode: CommissionMode;
  platformFeePct: number;  // ej. 10 = 10%
  updatedAt: Timestamp;
  updatedBy: string;
}

// --------------------------------------------------
// Shows / Transmisiones en vivo
// Colección: /shows
// --------------------------------------------------

export type ShowStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "ended"
  | "cancelled";

export interface Show {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerPhotoURL?: string;
  title: string;
  description?: string;
  coverImageURL?: string;
  scheduledAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  status: ShowStatus;
  // Agora
  agoraChannelName: string;  // uid del show = channel name
  agoraToken?: string;       // generado al iniciar (TTL corto)
  // Estadísticas en vivo
  viewerCount: number;
  peakViewerCount: number;
  // Subasta actual
  currentAuctionId?: string;
  currentAuctionIndex: number; // 0-based, qué producto se está subastando
  totalProducts: number;
  // Notificaciones
  notifiedScheduled: boolean; // FCM "show por empezar" enviado
  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --------------------------------------------------
// Productos de un show
// Colección: /shows/{showId}/products
// --------------------------------------------------

export type AuctionStatus =
  | "waiting"    // no ha comenzado
  | "active"     // subastando ahora
  | "sold"       // vendido
  | "unsold"     // sin puja ganadora
  | "skipped";   // el vendedor lo saltó

export interface ShowProduct {
  id: string;
  showId: string;
  sellerId: string;
  // Detalle
  title: string;
  description?: string;
  imageURLs: string[];     // hasta 5 fotos, primera = principal
  // Subasta
  startingPriceUsd: number;
  minIncrementUsd: number;
  timerSeconds: number;    // ej. 30
  auctionStatus: AuctionStatus;
  sortOrder: number;       // orden dentro del show
  // Estado en vivo (actualizado por Cloud Function)
  currentBidUsd: number;
  currentBidderId?: string;
  currentBidderName?: string;
  auctionStartedAt?: Timestamp;
  auctionEndsAt?: Timestamp;   // deadline actual del temporizador
  auctionEndedAt?: Timestamp;
  // Snapshot de ganador
  winnerUid?: string;
  winnerName?: string;
  finalBidUsd?: number;
  // Tasa congelada al cerrar
  frozenExchangeRate?: number; // Bs por USD al momento de cierre
  finalBidBs?: number;         // finalBidUsd * frozenExchangeRate
  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --------------------------------------------------
// Pujas
// Colección: /shows/{showId}/products/{productId}/bids
// SOLO SE ESCRIBEN DESDE CLOUD FUNCTIONS
// El cliente hace un doc en /pendingBids para disparar la Function
// --------------------------------------------------

export interface Bid {
  id: string;
  showId: string;
  productId: string;
  bidderId: string;
  bidderName: string;
  amountUsd: number;
  placedAt: Timestamp;
  // La Function marca si fue aceptada o rechazada
  accepted: boolean;
  rejectedReason?: "too_low" | "auction_closed" | "own_bid" | "race_condition";
}

// --------------------------------------------------
// Pujas pendientes (cola del cliente → Cloud Function)
// Colección: /pendingBids
// El cliente escribe aquí; la Function valida y mueve a /bids
// --------------------------------------------------

export interface PendingBid {
  id: string;
  showId: string;
  productId: string;
  bidderId: string;
  bidderName: string;
  amountUsd: number;
  submittedAt: Timestamp;
  status: "pending" | "processed" | "rejected";
  processedAt?: Timestamp;
  rejectedReason?: Bid["rejectedReason"];
}

// --------------------------------------------------
// Mensajes de chat en vivo
// Colección: /shows/{showId}/messages
// --------------------------------------------------

export type MessageType = "chat" | "system" | "bid_placed" | "auction_won";

export interface ChatMessage {
  id: string;
  showId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  type: MessageType;
  text: string;
  createdAt: Timestamp;
}

// --------------------------------------------------
// Órdenes
// Colección: /orders
// --------------------------------------------------

export type OrderStatus =
  | "pending_payment"   // esperando confirmación de pago
  | "payment_confirmed" // pago confirmado por vendedor/admin
  | "shipped"
  | "delivered"
  | "cancelled"
  | "disputed";

export interface Order {
  id: string;
  // Referencias
  showId: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  buyerWhatsapp?: string;
  sellerId: string;
  sellerName: string;
  sellerWhatsapp?: string;
  // Montos
  bidAmountUsd: number;
  frozenExchangeRate: number;    // Bs/USD al momento de cierre
  bidAmountBs: number;           // bidAmountUsd * frozenExchangeRate
  // Comisión (snapshot de config al momento de cierre)
  commissionMode: CommissionMode;
  platformFeePct: number;
  commissionUsd: number;         // bidAmountUsd * platformFeePct / 100
  sellerReceivesUsd: number;     // bidAmountUsd - commissionUsd (mode a) o bidAmountUsd (mode b)
  // Pago
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;     // número de confirmación, hash, etc.
  paymentConfirmedAt?: Timestamp;
  paymentConfirmedBy?: string;   // uid de quien confirmó (vendedor o admin)
  // WhatsApp
  whatsappMessageSent: boolean;
  // Calificación
  ratingGiven?: number;          // 1-5 del comprador al vendedor
  ratingComment?: string;
  ratingAt?: Timestamp;
  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --------------------------------------------------
// Métodos de pago disponibles en Venezuela
// --------------------------------------------------

export type PaymentMethod =
  | "pago_movil"
  | "transferencia_bancaria"
  | "zelle"
  | "binance_pay"
  | "efectivo_usd"
  | "efectivo_bs"
  | "otro";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pago_movil: "Pago Móvil",
  transferencia_bancaria: "Transferencia Bancaria",
  zelle: "Zelle",
  binance_pay: "Binance Pay",
  efectivo_usd: "Efectivo USD",
  efectivo_bs: "Efectivo Bs",
  otro: "Otro",
};

// --------------------------------------------------
// Notificaciones FCM (para referencia de topics/data)
// --------------------------------------------------

export type NotificationType =
  | "show_starting_soon"   // 5 min antes
  | "outbid"               // te superaron
  | "auction_won"          // ganaste
  | "order_confirmed";     // pago confirmado

export interface FcmPayload {
  type: NotificationType;
  showId?: string;
  productId?: string;
  orderId?: string;
  bidAmountUsd?: number;
}

// --------------------------------------------------
// Ratings / Reputación
// Colección: /ratings
// --------------------------------------------------

export interface Rating {
  id: string;
  orderId: string;
  fromUid: string;   // comprador
  toUid: string;     // vendedor
  score: number;     // 1-5
  comment?: string;
  createdAt: Timestamp;
}
