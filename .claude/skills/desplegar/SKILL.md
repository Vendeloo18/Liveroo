---
name: desplegar
description: Despliega Vendeloo a producción en el orden correcto y comprueba qué hay realmente publicado. Úsala ante cualquier pedido de desplegar, publicar, subir a producción o sacar algo a la beta, y también antes de dar por terminado un cambio que toque firestore.rules, apps/functions/ o apps/web/. Cubre la verificación previa de shows en vivo, el orden obligatorio entre Firebase y Vercel, cómo interpretar el "No changes detected" del CLI, y cómo confirmar en producción que el cambio salió.
---

# Desplegar Vendeloo

## Lo que hay que entender antes de tocar nada

Vendeloo se despliega por **dos caminos independientes**:

| Mitad | Qué incluye | Cómo sale |
|---|---|---|
| **Firebase** | `firestore.rules`, `firestore.indexes.json`, `apps/functions/` | `firebase deploy` |
| **Web** | `apps/web/` | push a `main` → Vercel construye solo |

Producción corre lo que esté en `main`. Una rama sin fusionar **no está desplegada**, por terminada que esté.

**Las dos mitades pueden quedar descompasadas, y ya pasó.** El 5 de agosto de 2026 las functions llevaban 16 horas adelantadas a la web: un agente empujó la rama y desplegó functions sin desplegar la web. No hubo daño solo porque no hubo shows en vivo.

## Por qué el orden importa

Desplegar una mitad sola rompe el vivo, en cualquiera de los dos sentidos:

- **Web nueva + reglas viejas** → el panel del vendedor escribe `hostSeenAt` y presencias en `/shows/{id}/viewers`, y las reglas viejas las rechazan. El vendedor se come `Missing or insufficient permissions` en cámara.
- **Functions nuevas + web vieja** → el barrido de vivos abandonados busca el latido `hostSeenAt`, la web vieja no lo escribe, y a los 10 minutos (`SIN_LATIDO_JAMAS_MS`) da el show por muerto y lo termina.

Por eso: **desplegar con nadie transmitiendo, y las dos mitades seguidas.**

## Procedimiento

### 1. Ver qué cambió realmente

```bash
git diff --stat main...HEAD
```

Si **solo** hay archivos bajo `apps/web/`, es un despliegue de web: saltá al paso 4. Si aparece `firestore.rules`, `firestore.indexes.json` o `apps/functions/`, hay que hacer las dos mitades.

### 2. Comprobar que no haya nadie en vivo

Este paso no se salta cuando toca servidor. La API REST pública de Firestore sirve, porque las reglas dejan leer `shows` sin sesión:

```bash
KEY=$(grep -E "^NEXT_PUBLIC_FIREBASE_API_KEY" apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' \r'); curl -s -X POST "https://firestore.googleapis.com/v1/projects/vendeloo-73e28/databases/(default)/documents:runQuery?key=$KEY" -H "Content-Type: application/json" -d '{"structuredQuery":{"from":[{"collectionId":"shows"}],"where":{"fieldFilter":{"field":{"fieldPath":"status"},"op":"EQUAL","value":{"stringValue":"live"}}},"limit":10}}'
```

Respuesta con solo `[{"readTime":...}]` y ningún `document` = nadie transmitiendo, ventana limpia. Si aparece algún `document`, **esperá** y avisale al usuario cuántos shows hay activos.

### 3. Desplegar Firebase

El CLI vive en `~/.npm-global/bin` y suele estar fuera del PATH:

```bash
export PATH="$HOME/.npm-global/bin:$PATH" && firebase deploy --only firestore:rules,functions --project vendeloo-73e28
```

**Cómo leer la salida:**

- `✔ firestore: released rules` → las reglas salieron.
- `Skipped (No changes detected)` en las functions **no es un fallo**: significa que el bundle desplegado ya es idéntico al que se subió. Casi siempre quiere decir que alguien las desplegó antes. Si hace falta confirmarlo, comprobá que el `lib/` compilado tenga el código nuevo (`grep` de un símbolo que solo exista en la versión nueva) — si lo tiene y Firebase dice "sin cambios", producción también lo tiene.

Si el CLI no está autenticado, `firebase login` abre un OAuth interactivo. **Eso lo hace el usuario, no Claude.**

### 4. Desplegar la web

```bash
git checkout main && git merge --ff-only <rama> && git push origin main
```

El push dispara Vercel. Si el push falla con `Password authentication is not supported`, el usuario tiene que arreglar sus credenciales de GitHub (`gh auth login`); no es algo que Claude pueda resolver.

### 5. Confirmar en producción

No basta con que el push haya salido: hay que ver el cambio publicado. Vercel tarda entre uno y tres minutos.

Para un cambio de CSS, buscá en la hoja publicada un símbolo que solo exista en la versión nueva:

```bash
CSS=$(curl -s https://vendeloo.io/onboarding | grep -oE '/_next/static/css/[a-zA-Z0-9._-]+\.css' | head -1); curl -s "https://vendeloo.io$CSS" | grep -c "NOMBRE-DEL-SIMBOLO-NUEVO"
```

Para un cambio de markup, `curl -s https://vendeloo.io/<ruta> | grep` del texto o la clase nueva.

## Notas de entorno

- Proyecto Firebase: `vendeloo-73e28`. El alias `viejo` (`instacompras-fe791`) es el proyecto anterior — **no desplegar ahí nunca**.
- El repo es `github.com/Vendeloo18/Vendeloo` por HTTPS.
- Trabajo reciente suele vivir en ramas que solo existen en `origin`. Para ver el estado real usá `git for-each-ref --sort=-committerdate refs/heads refs/remotes`, no `git branch`.

## Qué no hacer

- No desplegar solo la mitad de servidor si la web no puede salir después (por ejemplo, con el push roto). El hueco no dura dos minutos: dura hasta que se arregle.
- No dar por desplegado algo porque el comando terminó sin error. Verificá en producción.
- No asumir que un `firebase deploy` sin cambios significa que falló.
