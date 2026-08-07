---
name: dinero
description: Modelo, invariantes y reglas del circuito de dinero de Vendeloo — billetera, saldo retenido, ledger, depósitos, comisión y liquidación a vendedores. Úsala antes de leer o modificar apps/functions/src/admin/wallet.ts, apps/functions/src/wallet/, las colecciones wallets, walletTransactions, deposits, depositReferenceClaims, sellerPayouts o sus reglas de Firestore, y al trabajar en la automatización de recargas y pagos (el frente prioritario del plan a diciembre de 2026). Incluye por qué el README del repositorio no sirve como referencia aquí.
---

# El circuito de dinero de Vendeloo

## Primero: el README miente

`README.md` describe el proyecto anterior, "SubastasVE": un modelo donde el ganador le paga directo al vendedor por fuera (`seller_collects`), sin billetera. **No razones el flujo de dinero desde ahí.** Las fuentes reales son:

- `apps/functions/src/admin/wallet.ts` — depósitos, ajustes y liquidación
- `apps/functions/src/wallet/welcomeBonus.ts` — bono de bienvenida
- `apps/functions/src/auction/` — cobro al cerrar una subasta
- `firestore.rules` — quién puede escribir qué
- `apps/functions/src/constants.ts` — `COLLECTIONS` y `CONFIG_DOCS`

## El modelo real

El comprador **carga saldo una vez** y puja contra ese saldo. Vendeloo cobra **10% de comisión** sobre cada venta.

El ciclo completo:

1. **Pujar** aparta saldo (`heldUsd` en `/wallets`).
2. **Ser superado** lo libera, en la misma operación.
3. **Ganar** lo debita y genera la orden ya pagada.
4. La plata entra a **la plataforma**, no al vendedor. La orden queda con `payoutStatus: "pending"`.
5. El vendedor cobra aparte, vía `markSellerPaid`.

## Las colecciones y quién escribe

| Colección | Escribe |
|---|---|
| `wallets` | **Solo** Cloud Functions. Cerrada por reglas. |
| `walletTransactions` | **Solo** Cloud Functions. Cerrada por reglas. |
| `deposits` | El cliente **crea** su solicitud y nada más; una vez creada no puede tocarla. |
| `depositReferenceClaims` | Solo Functions. Exclusión mutua por referencia bancaria. |
| `sellerPayouts` | Solo Functions. Registro de auditoría de cada liquidación. |

Nombres exactos en `COLLECTIONS` (`apps/functions/src/constants.ts`): `WALLETS`, `WALLET_TXS`, `DEPOSITS`, `DEPOSIT_REFERENCE_CLAIMS`, `SELLER_PAYOUTS`.

## Invariantes que no se rompen

1. **El ledger es la fuente de verdad.** El `balanceUsd` de `/wallets` tiene que poder reconstruirse sumando los `/walletTransactions` de ese usuario. Todo movimiento de plata escribe su asiento **en la misma transacción** que mueve el saldo. No existe "acreditado pero sin asentar".

2. **Nada de estados intermedios.** Aprobar un depósito acredita el saldo y escribe el ledger en **una** `runTransaction`. Nunca "aprobado pero sin acreditar".

3. **Idempotencia por estado.** Antes de actuar se comprueba el estado actual (`if (dep.status !== "pending") throw`). Aprobar dos veces no acredita dos veces.

4. **Lo retenido respalda pujas vivas.** Un débito manual no puede dejar `balanceUsd` por debajo de `heldUsd`, o el cierre no podría cobrar lo que la retención prometió.

5. **Todo movimiento manual lleva nota obligatoria.** Un ajuste de plata sin explicación es exactamente lo que un ledger existe para impedir.

## Patrones de seguridad ya resueltos

No los reinventes ni los quites al extender:

**Doble acreditación de la misma referencia.** El clásico "mando dos solicitudes con el mismo comprobante". Se resuelve con un documento de exclusión de ID determinístico: `sha256(metodo:referenciaNormalizada)` en `depositReferenceClaims`. Dos aprobaciones concurrentes chocan sobre *ese* documento: una confirma y la otra reintenta, ve el claim y se rechaza. Va acompañado de una consulta por referencia+método+`approved` dentro de la misma transacción.

**Liquidar lo que no se cobró.** `markSellerPaid` exige `paymentMethod === "wallet"` **y** `paymentConfirmedBy === "engine"` **y** `payoutStatus === "pending"`. Sin la marca del motor, una orden con `paymentMethod` escrito por el vendedor cobraba real.

**Regalar la comisión.** El monto a liquidar sale de `payoutUsd`, **nunca** de `sellerReceivesUsd`: en modo `seller_collects` ese campo es el precio completo y liquidaba el 100%.

**Órdenes repetidas en un lote.** `markSellerPaid` rechaza `orderIds` con duplicados y exige que todas sean del mismo vendedor (máx. 50).

## El interruptor de la billetera

`CONFIG_DOCS.WALLET` (`config/wallet`) tiene `biddingRequiresBalance`. Si está en `true`, pujar exige saldo que cubra la puja. **Nace apagado** para no bloquear a nadie hasta que las cuentas de recarga estén configuradas. Antes de razonar sobre "por qué me dejó pujar sin saldo", comprobá este documento.

Las cuentas de cobro de la plataforma (Pago Móvil, Zelle, Binance) viven en `CONFIG_DOCS.PAYMENT_ACCOUNTS` y las llena el admin desde el panel.

## Estado actual: todo es manual

Este es **el techo del negocio** y el frente número uno del plan a diciembre de 2026.

- `manageDeposit` — un admin aprueba o rechaza cada solicitud de recarga, a mano.
- `markSellerPaid` — un admin le paga al vendedor por fuera (Pago Móvil, Zelle) y lo deja asentado, a mano.

Ambas son `https.onCall` con guarda `esAdmin`. Funciona para veinte usuarios y no más.

**Lo que hay que construir** (septiembre de 2026): recarga automática con confirmación de Pago Móvil, Zelle y USDT, y liquidación automática al vendedor. La meta declarada es que Vendeloo pueda recibir un usuario nuevo a las tres de la mañana, cobrarle, dejarlo pujar y pagarle a su vendedor sin que ningún humano intervenga.

Se sostienen **tres vías de pago en paralelo** a propósito, para que ninguna sea punto único de falla.

## Antes de tocar código de dinero

- [ ] ¿El movimiento de saldo y su asiento en el ledger van en la misma transacción?
- [ ] ¿Ejecutarlo dos veces produce el mismo resultado que una?
- [ ] ¿Puede dejar el saldo por debajo de lo retenido?
- [ ] ¿La colección sigue cerrada a escritura desde el cliente en `firestore.rules`?
- [ ] ¿Hay tests de reglas que cubran el cambio? (`packages/rules-tests/`, la suite de reglas cubre que la billetera esté cerrada y que nadie se recargue a mano)

Después de tocar reglas o functions, desplegá siguiendo la skill `desplegar` — el circuito de dinero es servidor, no web.
