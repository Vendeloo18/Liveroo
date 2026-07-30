// =============================================================
// CLOUD FUNCTIONS: tasa oficial del BCV, sola
// =============================================================
// syncBcvRate corre cada 4 horas y escribe exchangeRates/current con la
// tasa oficial. syncBcvRateNow es la misma lógica como callable, para el
// botón "Actualizar del BCV ahora" del panel.
//
// Fuentes en orden (la primera que responda con un número sano gana):
//   1. ve.dolarapi.com — JSON limpio de la tasa oficial
//   2. pydolarve.org  — monitor "bcv"
//
// El BCV no publica una API propia; estos servicios espejan su valor
// oficial. Si ambos fallan, NO se toca nada: queda la última tasa buena
// y el error va al log. El admin siempre puede fijarla a mano con
// updateExchangeRate — el sync la pisará en la próxima corrida, que es
// la idea ("que siempre la tenga").
//
// Salvavidas: un salto de más del 40 % contra la tasa vigente no se
// escribe solo — huele a dato roto, no a devaluación de 4 horas. Queda
// en el log como error y la decisión pasa a un humano.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS, EXCHANGE_RATE_DOCS } from "../constants";

const r2 = (x: number) => Math.round(x * 100) / 100;

async function conTimeout(url: string, ms = 10000): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const FUENTES: { nombre: string; traer: () => Promise<number> }[] = [
  {
    nombre: "ve.dolarapi.com",
    traer: async () => (await conTimeout("https://ve.dolarapi.com/v1/dolares/oficial")).promedio,
  },
  {
    nombre: "pydolarve.org",
    traer: async () => (await conTimeout("https://pydolarve.org/api/v1/dollar?monitor=bcv")).price,
  },
];

interface Resultado {
  ok: boolean;
  usdToBs?: number;
  fuente?: string;
  motivo?: string;
}

async function sincronizar(): Promise<Resultado> {
  let nueva: number | null = null;
  let fuente = "";

  for (const f of FUENTES) {
    try {
      const v = Number(await f.traer());
      if (isFinite(v) && v > 0) { nueva = r2(v); fuente = f.nombre; break; }
      functions.logger.warn(`Fuente ${f.nombre} devolvió un valor raro`, { v });
    } catch (err) {
      functions.logger.warn(`Fuente ${f.nombre} falló`, { err: String(err) });
    }
  }

  if (nueva === null) {
    functions.logger.error("Ninguna fuente de tasa BCV respondió; se conserva la vigente");
    return { ok: false, motivo: "sin_fuentes" };
  }

  const ref = db.doc(`${COLLECTIONS.EXCHANGE_RATES}/${EXCHANGE_RATE_DOCS.CURRENT}`);
  const actual = (await ref.get()).data()?.usdToBs as number | undefined;

  if (actual && Math.abs(nueva - actual) / actual > 0.4) {
    functions.logger.error("Salto de tasa sospechoso: no se escribe solo", { actual, nueva, fuente });
    return { ok: false, motivo: "salto_sospechoso", usdToBs: nueva, fuente };
  }

  await ref.set({
    id: EXCHANGE_RATE_DOCS.CURRENT,
    usdToBs: nueva,
    updatedAt: Timestamp.now(),
    updatedBy: "syncBcvRate",
    source: fuente,
  });

  functions.logger.info("Tasa BCV sincronizada", { usdToBs: nueva, fuente });
  return { ok: true, usdToBs: nueva, fuente };
}

export const syncBcvRate = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 60 })
  .pubsub.schedule("every 4 hours")
  .onRun(async () => {
    await sincronizar();
    return null;
  });

export const syncBcvRateNow = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    const user = await db.doc(`${COLLECTIONS.USERS}/${context.auth.uid}`).get();
    if (user.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const r = await sincronizar();
    if (!r.ok && r.motivo === "sin_fuentes") {
      throw new functions.https.HttpsError("unavailable", "Ninguna fuente del BCV respondió. Fija la tasa a mano.");
    }
    if (!r.ok && r.motivo === "salto_sospechoso") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `La fuente reporta ${r.usdToBs} y difiere demasiado de la vigente. Verifícala y fíjala a mano si es real.`
      );
    }
    return r;
  });
