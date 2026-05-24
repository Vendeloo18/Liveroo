export declare const COLLECTIONS: {
    readonly USERS: "users";
    readonly SHOWS: "shows";
    readonly ORDERS: "orders";
    readonly RATINGS: "ratings";
    readonly PENDING_BIDS: "pendingBids";
    readonly EXCHANGE_RATES: "exchangeRates";
    readonly CONFIG: "config";
    readonly SHOW_PRODUCTS: (showId: string) => string;
    readonly SHOW_MESSAGES: (showId: string) => string;
    readonly PRODUCT_BIDS: (showId: string, productId: string) => string;
};
export declare const CONFIG_DOCS: {
    readonly COMMISSION: "commission";
};
export declare const EXCHANGE_RATE_DOCS: {
    readonly CURRENT: "current";
};
export type AuctionStatus = "waiting" | "active" | "sold" | "unsold" | "skipped";
export type ShowStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type CommissionMode = "platform_collects" | "seller_collects";
export type OrderStatus = "pending_payment" | "payment_confirmed" | "shipped" | "delivered" | "cancelled" | "disputed";
export type BidRejectedReason = "too_low" | "auction_closed" | "own_bid" | "race_condition";
//# sourceMappingURL=constants.d.ts.map