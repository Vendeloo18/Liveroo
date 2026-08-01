// =============================================================
// Cierre exacto y escalable de subastas
// =============================================================
// Cada vez que una subasta se activa o cambia su endsAt, un trigger v2
// agenda una Cloud Task para ese instante. El barrido de cada minuto sigue
// existiendo como red de seguridad, pero ya no es el reloj principal.

import * as crypto from "crypto";
import { getApp } from "firebase-admin/app";
import { getFunctions } from "firebase-admin/functions";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { COLLECTIONS } from "../constants";
import { db } from "../firebase";
import { closeAuctionById } from "./closeExpiredAuctions";

const REGION = "us-central1";
const TASK_FUNCTION = `locations/${REGION}/functions/closeAuctionTask`;
const DELIVERY_MARGIN_MS = 750;
const EMULATOR_MAX_WAIT_MS = 10_000;

interface CloseAuctionTaskData {
  auctionId: string;
  expectedEndsAtMs: number;
}

function taskId(auctionId: string, endsAtMs: number): string {
  return crypto
    .createHash("sha256")
    .update(`${auctionId}:${endsAtMs}`)
    .digest("hex");
}

function isAlreadyScheduled(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === "functions/task-already-exists"
    || /already.?exists|ALREADY_EXISTS/i.test(e.message ?? "");
}

function isEmulatorRuntime(): boolean {
  const projectId = getApp().options.projectId;
  return !!process.env.FIRESTORE_EMULATOR_HOST
    || process.env.FUNCTIONS_EMULATOR === "true"
    || (typeof projectId === "string" && projectId.startsWith("demo-"));
}

export async function scheduleAuctionClose(
  auctionId: string,
  endsAt: Timestamp,
): Promise<void> {
  const endsAtMs = endsAt.toMillis();
  const payload = { auctionId, expectedEndsAtMs: endsAtMs };

  // La combinación Firestore v2 + Task Queue no recibe el host del
  // emulador en algunas versiones de Firebase Tools. Para pruebas cortas
  // ejecutamos el mismo manejador al llegar el reloj; tareas largas se
  // omiten para no dejar una invocación local abierta durante horas.
  if (isEmulatorRuntime()) {
    const waitMs = Math.max(0, endsAtMs + DELIVERY_MARGIN_MS - Date.now());
    if (waitMs <= EMULATOR_MAX_WAIT_MS) {
      setTimeout(() => {
        executeCloseAuctionTask(payload).catch((error) => {
          logger.error("Cierre emulado falló", { auctionId, error });
        });
      }, waitMs);
    }
    return;
  }

  const queue = getFunctions().taskQueue<CloseAuctionTaskData>(TASK_FUNCTION);
  try {
    await queue.enqueue(
      payload,
      {
        id: taskId(auctionId, endsAtMs),
        // Un pequeño margen evita que diferencias de reloj entreguen la
        // tarea milisegundos antes del endsAt confirmado por Firestore.
        scheduleTime: new Date(endsAtMs + DELIVERY_MARGIN_MS),
        dispatchDeadlineSeconds: 30,
      },
    );
  } catch (err) {
    // Los triggers son at-least-once. El ID determinístico convierte las
    // entregas duplicadas en una sola tarea, sin tratarlo como un fallo.
    if (!isAlreadyScheduled(err)) throw err;
  }
}

export const scheduleAuctionCloseOnWrite = onDocumentWritten(
  {
    document: `${COLLECTIONS.AUCTIONS}/{auctionId}`,
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 20,
    concurrency: 20,
    retry: true,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || after.status !== "active") return;

    const endsAt = after.endsAt as Timestamp | undefined;
    if (!endsAt) {
      logger.warn("Subasta activa sin endsAt", { auctionId: event.params.auctionId });
      return;
    }

    const previousEndsAt = (before?.endsAt as Timestamp | undefined)?.toMillis();
    // También cubre la creación directa como activa de una subasta normal.
    const becameActive = !event.data?.before.exists || before?.status !== "active";
    if (!becameActive && previousEndsAt === endsAt.toMillis()) return;

    await scheduleAuctionClose(event.params.auctionId, endsAt);
    logger.info("Cierre de subasta agendado", {
      auctionId: event.params.auctionId,
      endsAt: endsAt.toDate().toISOString(),
    });
  },
);

export const closeAuctionTask = onTaskDispatched<CloseAuctionTaskData>(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 60,
    minInstances: 1,
    maxInstances: 20,
    concurrency: 20,
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 1,
      maxBackoffSeconds: 30,
      maxDoublings: 3,
    },
    rateLimits: {
      maxConcurrentDispatches: 200,
      maxDispatchesPerSecond: 100,
    },
  },
  async (request) => {
    await executeCloseAuctionTask(request.data);
  },
);

async function executeCloseAuctionTask(data: CloseAuctionTaskData | undefined): Promise<void> {
  const { auctionId, expectedEndsAtMs } = data ?? ({} as CloseAuctionTaskData);
  if (!auctionId || !Number.isFinite(expectedEndsAtMs)) {
    logger.warn("Tarea de cierre malformada", { data });
    return;
  }

  const snap = await db.doc(`${COLLECTIONS.AUCTIONS}/${auctionId}`).get();
  if (!snap.exists || snap.data()?.status !== "active") return;

  const currentEndsAt = snap.data()?.endsAt as Timestamp | undefined;
  if (!currentEndsAt) return;

  // Una puja extendió la subasta después de crear esta tarea. Aseguramos
  // que exista la tarea del nuevo endsAt y dejamos morir la vieja.
  if (currentEndsAt.toMillis() !== expectedEndsAtMs) {
    await scheduleAuctionClose(auctionId, currentEndsAt);
    return;
  }

  const closed = await closeAuctionById(auctionId);
  logger.info("Tarea de cierre ejecutada", { auctionId, closed });
}
