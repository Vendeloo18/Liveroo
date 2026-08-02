// Espejo de packages/shared/src/constants/loyalty.ts
// Duplicado aquí para evitar dependencias de bundling en functions.
// Si cambias uno, cambia el otro: el cliente pinta el catálogo con su
// copia y el servidor cobra con esta.

import { db } from "../firebase";
import { COLLECTIONS, CONFIG_DOCS } from "../constants";

export interface PremioCatalogo {
  id: string;
  nombre: string;
  detalle: string;
  loos: number;
  loosVendedor?: number | null;
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
  premios: [
    { id: "llavero", nombre: "Llavero Vendeloo", detalle: "Metal esmaltado con el símbolo", loos: 150, loosVendedor: null, activo: true },
    { id: "gorra", nombre: "Gorra Vendeloo", detalle: "Naranja, logo bordado al frente", loos: 400, loosVendedor: 200, activo: true },
    { id: "taza", nombre: "Taza Vendeloo", detalle: "Cerámica blanca, 11 oz", loos: 300, loosVendedor: null, activo: false },
    { id: "camisa", nombre: "Camisa Vendeloo", detalle: "Algodón, estampado al frente", loos: 600, loosVendedor: null, activo: false },
  ],
};

export const MAX_CANJES_PENDIENTES = 3;

export function costoPremio(premio: PremioCatalogo, esVendedor: boolean): number {
  return esVendedor && premio.loosVendedor != null && premio.loosVendedor > 0
    ? premio.loosVendedor
    : premio.loos;
}

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

export function loosPorOrden(montoUsd: number, loosPorUsd: number): number {
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) return 0;
  return Math.floor(montoUsd * loosPorUsd);
}

/** Lee config/loyalty. Si no existe o viene rota, manda el default: el
 *  programa nunca se cae por una configuración a medias. */
export async function leerReglas(): Promise<ReglasLoyalty> {
  try {
    const snap = await db.doc(`${COLLECTIONS.CONFIG}/${CONFIG_DOCS.LOYALTY}`).get();
    return reglasConDefault(snap.exists ? (snap.data() as Partial<ReglasLoyalty>) : null);
  } catch {
    return LOYALTY_DEFAULT;
  }
}
