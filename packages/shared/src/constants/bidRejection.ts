// Motivos con los que onPendingBidCreated rechaza una puja, traducidos
// a algo que el usuario entienda. Vive en shared porque los usan tanto
// la vista de subasta suelta como la del show en vivo.

export const MOTIVO_RECHAZO: Record<string, string> = {
  too_low: "Alguien pujó más rápido. Sube tu oferta.",
  auction_closed: "La subasta ya cerró.",
  own_bid: "Ya vas ganando esta subasta.",
  show_not_live: "El show no está transmitiendo.",
  not_found: "No encontramos esta subasta.",
  race_condition: "No pudimos procesar la puja. Intenta de nuevo.",
};
