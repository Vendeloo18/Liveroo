// Motivos con los que onPendingBidCreated rechaza una puja, traducidos
// a algo que el usuario entienda. Vive en shared porque los usan tanto
// la vista de subasta suelta como la del show en vivo.

export const MOTIVO_RECHAZO: Record<string, string> = {
  too_low: "Alguien pujó más rápido. Sube tu oferta.",
  auction_closed: "La venta ya cerró.",
  own_bid: "Ya vas ganando esta venta.",
  show_not_live: "El show no está transmitiendo.",
  insufficient_funds: "Saldo insuficiente. Recarga tu billetera para usar PUJALOO.",
  es_muestra: "Esta es una venta de muestra, solo para explorar. No acepta ofertas.",
  not_found: "No encontramos esta venta.",
  race_condition: "No pudimos procesar la oferta. Intenta de nuevo.",
};
