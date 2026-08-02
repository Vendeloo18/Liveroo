// =============================================================
// LOOS — puntos de fidelidad
// =============================================================
// Una sola regla: 1 LOO por cada dólar que muevas en Vendeloo, compres
// o vendas. Se acreditan cuando la orden queda ENTREGADA, no al pujar:
// así nadie acumula con compras que nunca completa, y de paso empuja a
// cerrar el ciclo (que es justo donde nace la calificación).
//
// Los LOOS no son plata. No se recargan, no se retiran y no pagan
// órdenes: solo se cambian por mercancía de la marca. Por eso viven
// aparte de /wallets y tienen su propio ledger (/loosTxs).
//
// Estos valores son el DEFAULT. El admin los sobrescribe desde el panel
// en config/loyalty y no hay que tocar código para mover un precio.
// =============================================================

export interface PremioCatalogo {
  id: string;
  nombre: string;
  detalle: string;
  loos: number;
  /** Precio especial para vendedores aprobados. El vendedor sale en
   *  cámara todas las noches: su gorra es la mejor pieza de marca que
   *  tenemos y conviene que le salga barata. */
  loosVendedor?: number | null;
  /** Un premio inactivo se muestra como "Pronto" en vez de esconderse:
   *  ver lo que viene es lo que hace que valga la pena acumular. */
  activo: boolean;
}

export interface ReglasLoyalty {
  loosPorUsd: number;
  bonos: {
    primeraCompra: number;
    primeraVenta: number;
    primerShow: number;
    calificar: number;
  };
  premios: PremioCatalogo[];
}

export const LOYALTY_DEFAULT: ReglasLoyalty = {
  loosPorUsd: 1,
  bonos: {
    primeraCompra: 50,
    primeraVenta: 100,
    primerShow: 100,
    calificar: 10,
  },
  // Arrancamos con lo más barato de producir. Taza y camisa se encienden
  // desde el panel cuando la mercancía exista de verdad — prometer un
  // premio que no está hecho es la forma más rápida de quemar el programa.
  premios: [
    {
      id: "llavero",
      nombre: "Llavero Vendeloo",
      detalle: "Metal esmaltado con el símbolo",
      loos: 150,
      loosVendedor: null,
      activo: true,
    },
    {
      id: "gorra",
      nombre: "Gorra Vendeloo",
      detalle: "Naranja, logo bordado al frente",
      loos: 400,
      loosVendedor: 200,
      activo: true,
    },
    {
      id: "taza",
      nombre: "Taza Vendeloo",
      detalle: "Cerámica blanca, 11 oz",
      loos: 300,
      loosVendedor: null,
      activo: false,
    },
    {
      id: "camisa",
      nombre: "Camisa Vendeloo",
      detalle: "Algodón, estampado al frente",
      loos: 600,
      loosVendedor: null,
      activo: false,
    },
  ],
};

/** Máximo de canjes sin entregar por persona. Sin tope, un usuario con
 *  muchos LOOS puede dejar una cola de encargos que nadie va a despachar. */
export const MAX_CANJES_PENDIENTES = 3;

export type EstadoCanje = "pending" | "delivered" | "cancelled";

export type TipoLoosTx =
  | "order_buyer"
  | "order_seller"
  | "first_purchase"
  | "first_sale"
  | "first_show"
  | "rating"
  | "redeem"
  | "redeem_refund"
  | "admin";

/** Lo que cuesta un premio para este usuario. */
export function costoPremio(premio: PremioCatalogo, esVendedor: boolean): number {
  return esVendedor && premio.loosVendedor != null && premio.loosVendedor > 0
    ? premio.loosVendedor
    : premio.loos;
}

/** Mezcla lo que haya en config/loyalty sobre el default. Un campo que
 *  el admin no tocó sigue valiendo lo de aquí. */
export function reglasConDefault(cfg: Partial<ReglasLoyalty> | null | undefined): ReglasLoyalty {
  const premios = Array.isArray(cfg?.premios) && cfg!.premios!.length
    ? LOYALTY_DEFAULT.premios.map((base) => {
        const guardado = cfg!.premios!.find((p) => p?.id === base.id);
        return guardado ? { ...base, ...guardado } : base;
      })
    : LOYALTY_DEFAULT.premios;

  return {
    loosPorUsd: Number.isFinite(cfg?.loosPorUsd) ? Number(cfg!.loosPorUsd) : LOYALTY_DEFAULT.loosPorUsd,
    bonos: { ...LOYALTY_DEFAULT.bonos, ...(cfg?.bonos ?? {}) },
    premios,
  };
}

/** LOOS que deja una orden de este monto. Se trunca: nadie gana medio LOO. */
export function loosPorOrden(montoUsd: number, loosPorUsd: number): number {
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) return 0;
  return Math.floor(montoUsd * loosPorUsd);
}
