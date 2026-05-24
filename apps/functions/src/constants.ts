// Espejo de packages/shared/src/constants/collections.ts
// Duplicado aquí para evitar dependencias de bundling en functions

export const COLLECTIONS = {
  USERS: "users",
  SHOWS: "shows",
  ORDERS: "orders",
  RATINGS: "ratings",
  PENDING_BIDS: "pendingBids",
  EXCHANGE_RATES: "exchangeRates",
  CONFIG: "config",

  SHOW_PRODUCTS: (showId: string) => `shows/${showId}/products`,
  SHOW_MESSAGES: (showId: string) => `shows/${showId}/messages`,
  PRODUCT_BIDS: (showId: string, productId: string) =>
    `shows/${showId}/products/${productId}/bids`,
} as const;

export const CONFIG_DOCS = {
  COMMISSION: "commission",
} as const;

export const EXCHANGE_RATE_DOCS = {
  CURRENT: "current",
} as const;

// Tipos (duplicados de shared para functions)
export type AuctionStatus = "waiting" | "active" | "sold" | "unsold" | "skipped";
export type ShowStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type CommissionMode = "platform_collects" | "seller_collects";
export type OrderStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "disputed";

export type BidRejectedReason =
  | "too_low"
  | "auction_closed"
  | "own_bid"
  | "race_condition";
