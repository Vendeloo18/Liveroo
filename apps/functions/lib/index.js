"use strict";
// =============================================================
// SUBASTAS VE — Cloud Functions index
// =============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAgoraToken = exports.updateCommissionConfig = exports.updateExchangeRate = exports.suspendSeller = exports.approveSeller = exports.onOrderDelivered = exports.onRatingCreated = exports.notifyShowStartingSoon = exports.skipProduct = exports.endShow = exports.startShow = exports.closeExpiredAuctions = exports.onPendingBidCreated = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Auction engine
var onPendingBidCreated_1 = require("./auction/onPendingBidCreated");
Object.defineProperty(exports, "onPendingBidCreated", { enumerable: true, get: function () { return onPendingBidCreated_1.onPendingBidCreated; } });
var closeExpiredAuctions_1 = require("./auction/closeExpiredAuctions");
Object.defineProperty(exports, "closeExpiredAuctions", { enumerable: true, get: function () { return closeExpiredAuctions_1.closeExpiredAuctions; } });
// Show controls
var showControls_1 = require("./shows/showControls");
Object.defineProperty(exports, "startShow", { enumerable: true, get: function () { return showControls_1.startShow; } });
Object.defineProperty(exports, "endShow", { enumerable: true, get: function () { return showControls_1.endShow; } });
Object.defineProperty(exports, "skipProduct", { enumerable: true, get: function () { return showControls_1.skipProduct; } });
// Notifications
var notifyShowStartingSoon_1 = require("./notifications/notifyShowStartingSoon");
Object.defineProperty(exports, "notifyShowStartingSoon", { enumerable: true, get: function () { return notifyShowStartingSoon_1.notifyShowStartingSoon; } });
// Orders
var onOrderEvents_1 = require("./orders/onOrderEvents");
Object.defineProperty(exports, "onRatingCreated", { enumerable: true, get: function () { return onOrderEvents_1.onRatingCreated; } });
Object.defineProperty(exports, "onOrderDelivered", { enumerable: true, get: function () { return onOrderEvents_1.onOrderDelivered; } });
// Admin
var adminFunctions_1 = require("./admin/adminFunctions");
Object.defineProperty(exports, "approveSeller", { enumerable: true, get: function () { return adminFunctions_1.approveSeller; } });
Object.defineProperty(exports, "suspendSeller", { enumerable: true, get: function () { return adminFunctions_1.suspendSeller; } });
Object.defineProperty(exports, "updateExchangeRate", { enumerable: true, get: function () { return adminFunctions_1.updateExchangeRate; } });
Object.defineProperty(exports, "updateCommissionConfig", { enumerable: true, get: function () { return adminFunctions_1.updateCommissionConfig; } });
Object.defineProperty(exports, "generateAgoraToken", { enumerable: true, get: function () { return adminFunctions_1.generateAgoraToken; } });
//# sourceMappingURL=index.js.map