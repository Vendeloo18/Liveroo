// =============================================================
// SUBASTAS VE — Cloud Functions index
// =============================================================

import * as admin from "firebase-admin";
admin.initializeApp();

// Auction engine
export { onPendingBidCreated } from "./auction/onPendingBidCreated";
export { closeExpiredAuctions } from "./auction/closeExpiredAuctions";

// Show controls
export { startShow, endShow, skipProduct } from "./shows/showControls";

// Notifications
export { notifyShowStartingSoon } from "./notifications/notifyShowStartingSoon";

// Orders
export { onRatingCreated, onOrderDelivered } from "./orders/onOrderEvents";

// Admin
export {
  approveSeller,
  suspendSeller,
  updateExchangeRate,
  updateCommissionConfig,
  generateAgoraToken,
} from "./admin/adminFunctions";
