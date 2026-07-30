// =============================================================
// SUBASTAS VE — Cloud Functions index
// =============================================================

import * as admin from "firebase-admin";
admin.initializeApp();

// Auction engine
export { onPendingBidCreated } from "./auction/onPendingBidCreated";
export { closeExpiredAuctions, closeAuctionNow } from "./auction/closeExpiredAuctions";

// Show controls
export { startShow, endShow, skipAuction } from "./shows/showControls";

// Users
export { syncPublicProfile } from "./users/syncPublicProfile";

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

// Datos de demostración (herramienta de pre-lanzamiento, solo admin)
export { manageDemoAuctions } from "./admin/demoData";
