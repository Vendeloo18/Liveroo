// Espejo de packages/shared/src/constants/collections.ts
// Duplicado aquí para evitar dependencias de bundling en functions

export const COLLECTIONS = {
  USERS: "users",
  PUBLIC_PROFILES: "publicProfiles",
  SHOWS: "shows",
  AUCTIONS: "auctions",
  ORDERS: "orders",
  RATINGS: "ratings",
  PENDING_BIDS: "pendingBids",
  EXCHANGE_RATES: "exchangeRates",
  CONFIG: "config",
  WALLETS: "wallets",
  WALLET_TXS: "walletTransactions",
  DEPOSITS: "deposits",
  DEPOSIT_REFERENCE_CLAIMS: "depositReferenceClaims",
  SELLER_PAYOUTS: "sellerPayouts",

  AUCTION_BIDS: (auctionId: string) => `auctions/${auctionId}/bids`,
  SHOW_MESSAGES: (showId: string) => `shows/${showId}/messages`,
} as const;

export const CONFIG_DOCS = {
  COMMISSION: "commission",
  // Interruptor de la billetera: si biddingRequiresBalance es true, pujar
  // exige saldo que cubra la puja. Nace apagado para no bloquear a nadie
  // hasta que las cuentas de recarga estén configuradas.
  WALLET: "wallet",
  // Cuentas de cobro de la plataforma (pago móvil, Zelle…). Las llena el
  // admin desde el panel; la pantalla de recarga las muestra tal cual.
  PAYMENT_ACCOUNTS: "paymentAccounts",
} as const;

export const EXCHANGE_RATE_DOCS = {
  CURRENT: "current",
} as const;

// --------------------------------------------------
// Modelo unificado de subastas
// --------------------------------------------------
// Una subasta es siempre un documento en /auctions.
//   mode="live"       → pertenece a un show (showId != null), timer corto,
//                       la activa el motor cuando le llega el turno.
//   mode="standalone" → subasta suelta tipo eBay, nace activa, dura días.
// Las dos comparten el mismo motor de pujas y el mismo cierre.

export type AuctionMode = "live" | "standalone";

export type AuctionStatus =
  | "waiting"   // en cola dentro de un show, aún no le toca
  | "active"    // aceptando pujas
  | "sold"      // cerrada con ganador
  | "unsold"    // cerrada sin pujas
  | "skipped"   // el vendedor la saltó en vivo
  | "cancelled";

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
  | "not_found"
  | "show_not_live"
  | "insufficient_funds"
  | "es_muestra"
  | "race_condition";

// --------------------------------------------------
// Anti-sniping
// --------------------------------------------------
// Si entra una puja faltando poco para el cierre, se extiende el timer
// para que nadie gane disparando en el último segundo.
// En vivo el ritmo es de segundos; en subastas sueltas, de minutos.

// En vivo se extiende a 10s, no a 30: con 30 una puja a falta de 7
// segundos revivía la subasta casi medio minuto y el vendedor se quedaba
// esperando en cámara. 10s alcanza para que otro responda sin frenar el
// ritmo del show.
export const ANTI_SNIPE = {
  live: { thresholdS: 10, extendToS: 10 },
  standalone: { thresholdS: 120, extendToS: 120 },
} as const;

// Timer por defecto si una subasta de show no define timerSeconds
export const DEFAULT_LIVE_TIMER_S = 30;
