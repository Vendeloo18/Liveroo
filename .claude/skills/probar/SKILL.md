---
name: probar
description: Cómo correr las suites de prueba de Vendeloo contra los emuladores de Firebase en esta máquina, con las rarezas del entorno que hacen fallar o colgarse los tests sin motivo aparente. Úsala ante cualquier pedido de correr pruebas, antes de desplegar cambios de firestore.rules o apps/functions/, y cuando un test falle y haya que distinguir una regresión real de un problema de entorno.
---

# Correr las pruebas de Vendeloo

Las suites viven en `packages/rules-tests/` y corren contra los emuladores de Firebase, no contra producción. El proyecto que usan es `demo-vendeloo` (proyecto de demostración, sin credenciales).

## Cobertura esperada

| Suite | Comando | Debe dar |
|---|---|---|
| Reglas de Firestore | `pnpm test` | **99 pasan** |
| Motor de subastas | `pnpm test:engine` | **10 pasan** (Pujas simultáneas · Anti-sniping · Cierre con Cloud Tasks) |
| Retirar y cancelar | `pnpm test:cancelar` | **6 pasan** |
| Bono de bienvenida | `pnpm test:welcome-bonus` | **1 pasa** |
| Escala | `pnpm test:scale:smoke` | carga sintética, tarda |

Si un número no coincide, es una regresión real. Si **todo** falla, casi siempre es entorno — seguí leyendo.

## Preparar el entorno (hace falta cada vez)

Dos binarios están instalados pero **fuera del PATH**:

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$HOME/.npm-global/bin:$PATH" && export JAVA_HOME="/opt/homebrew/opt/openjdk"
```

- **Java** lo necesita el emulador de Firestore. Está en `/opt/homebrew/opt/openjdk` (instalado con brew, *keg-only*, por eso no se enlaza solo).
- **firebase-tools** está en `~/.npm-global/bin`.

## El puerto 8080 está ocupado

`gvproxy` (una VM de contenedores del usuario) escucha en el **8080**, que es el puerto por defecto del emulador de Firestore. **No lo mates** — no es nuestro.

La solución es correr con una configuración temporal en otro puerto. Creala en la **raíz del repo** para que las rutas relativas a `firestore.rules` y `storage.rules` sigan resolviendo:

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "functions": [{ "source": "apps/functions", "codebase": "default", "predeploy": [], "ignore": ["node_modules", ".git", "src", "*.log"] }],
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8085 },
    "storage": { "port": 9199 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  },
  "storage": { "rules": "storage.rules" }
}
```

Y pasala con `--config`:

```bash
cd packages/rules-tests && firebase emulators:exec --only firestore --project demo-vendeloo --config ../../firebase.emulator-test.json "node --test firestore.test.mjs"
```

**Borrá el archivo temporal al terminar** — y no antes: si lo borrás mientras un comando en segundo plano todavía lo necesita, el siguiente comando de la cadena falla sin decir por qué.

## Las tres trampas que cuestan horas

### 1. El test del bono se cuelga en silencio

`packages/rules-tests/welcome-bonus.test.mjs:36` fija el puerto **8080 a mano** con `connectFirestoreEmulator(db, "127.0.0.1", 8080)`. El SDK **cliente** de Firebase —a diferencia del admin— **ignora `FIRESTORE_EMULATOR_HOST`**, así que no le sirve que `emulators:exec` lo exporte.

Resultado: se conecta a `gvproxy`, reintenta escrituras para siempre y **no emite una sola línea de salida**. Se quedó 38 minutos colgado antes de que se notara.

Para correrlo, apuntá esa línea al puerto que estés usando (8085) y **revertí el cambio después**. El arreglo de fondo sería leer el puerto del entorno con 8080 de respaldo, pero eso es un cambio a la suite y hay que acordarlo.

### 2. El motor falla entero en la primera corrida

`engine.test.mjs` espera veredictos con timeouts de 20-25 segundos. Con el emulador de functions **en frío** —recién arrancado, y más si `tsc` acaba de compilar— esos timeouts saltan y da **10 de 10 fallando, 0 pasando**.

**Ese patrón —todo falla, nada pasa— es entorno, no regresión.** Volvé a correrlo: la segunda vez pasa. Una regresión real hace fallar *algunas*, no todas.

### 3. `timeout` no existe en macOS

`timeout 600 <comando>` devuelve `command not found` (código 127) y el comando **no llega a correr**. Si envolvés una prueba en `timeout` vas a ver una salida vacía y creer que falló silenciosamente. En macOS sería `gtimeout` (coreutils), pero es más simple no usarlo.

## Antes de dar un fallo por real

- [ ] ¿Java y firebase-tools están en el PATH de *este* comando?
- [ ] ¿Los puertos 9099, 5001, 8085 están libres? (`lsof -nP -iTCP:<puerto> -sTCP:LISTEN`)
- [ ] ¿Quedó algún emulador colgado de una corrida anterior? Buscalo con `ps -eo pid,etime,command | grep -i "firebase emulators"` y bajalo — esos sí son nuestros.
- [ ] ¿Es la primera corrida del motor desde que compilaste?
- [ ] ¿Falla *todo* o fallan *algunas*?

## Compilar las functions

`test:engine` no compila; `test:cancelar` y `test:welcome-bonus` sí. Si tocaste TypeScript de functions y vas a correr el motor:

```bash
pnpm --filter functions build
```

El emulador carga `apps/functions/lib/`, no `src/`.
