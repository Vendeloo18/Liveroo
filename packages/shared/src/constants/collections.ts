// =============================================================
// Rutas de colecciones Firestore
// Usadas tanto en cliente como en Cloud Functions
// =============================================================

export const COLLECTIONS = {
  // Raíz
  USERS: "users",
  SHOWS: "shows",
  ORDERS: "orders",
  RATINGS: "ratings",
  PENDING_BIDS: "pendingBids",
  EXCHANGE_RATES: "exchangeRates",
  CONFIG: "config",

  // Sub-colecciones de shows
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
