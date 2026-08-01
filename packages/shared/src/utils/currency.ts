// =============================================================
// Utilidades de moneda y cálculo de pujas
// Compartidas entre web y móvil
// =============================================================

/**
 * Formatea un monto en USD con 2 decimales
 * @example formatUsd(1500) → "$1,500.00"
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea un monto en Bolívares
 * @example formatBs(5250000) → "Bs. 5.250.000,00"
 */
export function formatBs(amount: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("VES", "Bs.");
}

/**
 * Convierte USD a Bs usando la tasa provista
 */
export function usdToBs(amountUsd: number, rate: number): number {
  return amountUsd * rate;
}

/**
 * Calcula el mínimo de la próxima puja.
 *
 * Sin pujas todavía, el mínimo es el precio de salida TAL CUAL — igual que
 * valida el motor (onPendingBidCreated). Antes el cliente exigía salida +
 * incremento y el "DESDE $10" de la tarjeta era imposible de pujar.
 */
export function calcMinNextBid(
  currentBidUsd: number,
  minIncrementUsd: number,
  hasBids: boolean = true
): number {
  return roundToTwoDecimals(hasBids ? currentBidUsd + minIncrementUsd : currentBidUsd);
}

/**
 * Valida que una puja sea aceptable (lado cliente, pre-validación)
 * La validación definitiva ocurre en Cloud Functions
 */
export function isValidBidAmount(
  proposedUsd: number,
  currentBidUsd: number,
  minIncrementUsd: number
): { valid: boolean; reason?: string } {
  if (proposedUsd <= 0) return { valid: false, reason: "El monto debe ser mayor a 0" };
  const minBid = calcMinNextBid(currentBidUsd, minIncrementUsd);
  if (proposedUsd < minBid) {
    return {
      valid: false,
      reason: `La puja mínima es ${formatUsd(minBid)}`,
    };
  }
  return { valid: true };
}

/**
 * Calcula la comisión de la plataforma
 */
export function calcCommission(
  bidAmountUsd: number,
  feePct: number
): {
  commissionUsd: number;
  sellerReceivesUsd: number;
} {
  const commissionUsd = roundToTwoDecimals((bidAmountUsd * feePct) / 100);
  return {
    commissionUsd,
    sellerReceivesUsd: roundToTwoDecimals(bidAmountUsd - commissionUsd),
  };
}

export function roundToTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Genera el mensaje pre-llenado para WhatsApp
 */
export function buildWhatsappMessage(params: {
  buyerName: string;
  productTitle: string;
  bidAmountUsd: number;
  bidAmountBs: number;
  frozenRate: number;
  orderId: string;
  showTitle: string;
}): string {
  const { buyerName, productTitle, bidAmountUsd, bidAmountBs, frozenRate, orderId, showTitle } =
    params;
  return (
    `¡Hola! Soy *${buyerName}* y gané la subasta de *${productTitle}* ` +
    `en el show *${showTitle}*.\n\n` +
    `📦 *Pedido:* #${orderId}\n` +
    `💵 *Monto USD:* ${formatUsd(bidAmountUsd)}\n` +
    `💴 *Monto Bs:* ${formatBs(bidAmountBs)}\n` +
    `💱 *Tasa:* ${frozenRate} Bs/USD\n\n` +
    `Quedo atento para coordinar el pago y la entrega.`
  );
}

/**
 * Genera el link de WhatsApp con mensaje pre-llenado
 */
export function buildWhatsappLink(
  phoneNumber: string,
  message: string
): string {
  const cleaned = phoneNumber.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}
