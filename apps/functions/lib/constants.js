"use strict";
// Espejo de packages/shared/src/constants/collections.ts
// Duplicado aquí para evitar dependencias de bundling en functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCHANGE_RATE_DOCS = exports.CONFIG_DOCS = exports.COLLECTIONS = void 0;
exports.COLLECTIONS = {
    USERS: "users",
    SHOWS: "shows",
    ORDERS: "orders",
    RATINGS: "ratings",
    PENDING_BIDS: "pendingBids",
    EXCHANGE_RATES: "exchangeRates",
    CONFIG: "config",
    SHOW_PRODUCTS: (showId) => `shows/${showId}/products`,
    SHOW_MESSAGES: (showId) => `shows/${showId}/messages`,
    PRODUCT_BIDS: (showId, productId) => `shows/${showId}/products/${productId}/bids`,
};
exports.CONFIG_DOCS = {
    COMMISSION: "commission",
};
exports.EXCHANGE_RATE_DOCS = {
    CURRENT: "current",
};
//# sourceMappingURL=constants.js.map