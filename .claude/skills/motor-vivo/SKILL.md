---
name: motor-vivo
description: Cómo funciona el motor de subastas de Vendeloo y el ciclo de vida de un show en vivo — pujas atómicas, anti-sniping, cierre programado con Cloud Tasks, latido del transmisor y conteo de espectadores. Úsala antes de tocar apps/functions/src/auction/, apps/functions/src/shows/, el panel del vendedor en apps/web/src/app/seller/, o al depurar síntomas como "el vivo se cerró solo", "la subasta no cierra", "el contador de espectadores está mal" o "la puja no se registró".
---

# Motor de subastas y shows en vivo

## Cómo entra una puja

El cliente **nunca** escribe en `/auctions/{id}/bids` ni cambia el estado de la subasta. Solo puede crear un documento en `/pendingBids`.

```
cliente → crea /pendingBids/{id}  (status: "pending")
             ↓
      onPendingBidCreated  (trigger de Firestore)
             ↓
      runTransaction: valida, decide, escribe
             ↓
      /pendingBids/{id}.status = "accepted" | "rejected"
```

Todo el veredicto ocurre dentro de una transacción, por eso dos pujas simultáneas no se pisan. Las razones de rechazo están tipadas en `packages/shared/src/constants/bidRejection.ts` — usá esas, no strings sueltos.

Si el síntoma es "pujé y no pasó nada", mirá el `status` y el motivo en el documento de `/pendingBids`, no los logs.

## Anti-sniping

En `apps/functions/src/constants.ts`:

```ts
export const ANTI_SNIPE = {
  live:       { thresholdS: 10, extendToS: 10 },
  standalone: { thresholdS: 120, extendToS: 120 },
};
```

Una puja dentro del umbral extiende el cierre. **En vivo extiende 10 segundos, no 30**: con 30, una puja a falta de 7 segundos revivía la subasta casi medio minuto y el vendedor se quedaba esperando en cámara. El temporizador por defecto de un lote en vivo es `DEFAULT_LIVE_TIMER_S = 30`.

Este cambio está desplegado desde el 5 de agosto de 2026 y altera el ritmo de los shows — si alguien reporta que "las subastas cierran más rápido que antes", es esto y es intencional.

## Cómo cierra una subasta

Dos caminos que se complementan:

- **`scheduleAuctionCloseOnWrite` + `closeAuctionTask`** — Cloud Tasks programa el cierre al segundo exacto. Es el camino normal.
- **`closeExpiredAuctions`** — barrido cada minuto, como red de seguridad de lo que se haya escapado.

También existen `closeAuctionNow` y `cancelAuction` como acciones explícitas.

## El latido del transmisor

Con el modelo "vende en vivo", un show **no se termina solo al vaciarse la cola**: el vendedor sigue al aire sacando productos. La única señal fiable de que sigue ahí es el latido.

**Cliente** (`apps/web/src/app/seller/show/[showId]/page.tsx`):

- Escribe `hostSeenAt` cada **25 segundos** mientras transmite.
- Late además en `visibilitychange` **y** en `pagehide` — en los dos sentidos del cambio de pestaña. Esto importa: el botón "Invitar" abre el compartir nativo de iOS, que congela los timers de Safari. Sin el latido de salida, la cuenta atrás del servidor arrancaría desde el último tic, que pudo ser 24 segundos antes.

**Servidor** (`cerrarShowsZombis` en `apps/functions/src/auction/closeExpiredAuctions.ts`):

| Situación | Plazo |
|---|---|
| Recién al aire, todavía sin latir | `GRACIA_INICIO_MS` = 2 min |
| Latía y dejó de latir | `LATIDO_MUERTO_MS` = **5 min** |
| Nunca latió (show viejo o cliente sin actualizar) | `SIN_LATIDO_JAMAS_MS` = 10 min |

Antes esto miraba `updatedAt` con 45 minutos de plazo: quien cerraba la app dejaba el vivo encendido casi una hora con la cámara muerta.

**Los 5 minutos no son negociables hacia abajo.** Con 90 segundos, tardar dos minutos eligiendo contactos en WhatsApp le mataba el vivo al vendedor.

> ⚠️ Hay un comentario desactualizado en el cliente (`seller/show/[showId]/page.tsx`, cerca de `LATIDO_MS`) que dice que el servidor corta "a los 90s". Son 5 minutos. No te guíes por ese comentario.

## El barrido no corta con plata encima

Si el show abandonado tiene una subasta actual **activa y con pujador**, `cerrarShowsZombis` **pospone** esa ronda: hay compradores pujando en ese segundo y cerrar el show los sacaría a la calle en mitad de una puja. Espera a que esa subasta cierre sola y genere su orden; el barrido siguiente ya puede terminarlo.

Al terminar un show abandonado: la subasta activa se deja cerrar sola, y solo se cancela lo que quedó **en cola** (`status: "waiting"`), igual que hace `endShow`.

## Espectadores

Cada espectador refresca **su propio** documento en `/shows/{showId}/viewers/{uid}` con `seenAt`, cada 25 segundos. El **vendedor** cuenta las presencias frescas (menos de `PRESENCIA_FRESCA_MS` = 60s) y escribe el total en `viewerCount`.

Se cura solo: un navegador que muere sin avisar se pone viejo y deja de contar. Antes cada espectador sumaba y restaba de a uno, y bastaba una pestaña cerrada de golpe para dejar el número inflado para siempre.

Las reglas lo respaldan: solo el dueño del show lee `/viewers`, cada quien solo escribe su propio documento, y solo el vendedor puede tocar `viewerCount`.

## Controles del show

`startShow`, `presentAuction`, `endShow`, `skipAuction` en `apps/functions/src/shows/showControls.ts`. El token de video se emite con `generateAgoraTokenV2`.

## Ojo al desplegar

Estos cambios son **de servidor y de cliente a la vez**: el latido lo escribe la web y lo lee el barrido. Desplegar una mitad sola rompe el vivo en producción. Seguí la skill `desplegar` — y comprobá antes que no haya nadie transmitiendo.

Para probar el motor, la skill `probar`: la primera corrida de `test:engine` falla siempre por arranque en frío.
