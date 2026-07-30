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
export { generateAgoraToken } from "./shows/agoraToken";

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
} from "./admin/adminFunctions";

// Datos de demostración (herramienta de pre-lanzamiento, solo admin)
export { manageDemoAuctions } from "./admin/demoData";

// Billetera (depósitos aprobados por admin, ajustes manuales con ledger)
export { manageDeposit, adjustWallet } from "./admin/wallet";

// Tasa oficial del BCV, cada 4 horas y a pedido del panel
export { syncBcvRate, syncBcvRateNow } from "./admin/syncBcvRate";
