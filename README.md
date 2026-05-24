# SubastasVE — Marketplace de Subastas en Vivo

Marketplace de subastas en vivo estilo Whatnot, adaptado al mercado venezolano.
Monorepo con Next.js (web PWA), Expo (móvil), y Firebase (backend).

---

## Arquitectura del Monorepo

```
subastas-ve/
├── apps/
│   ├── web/              # Next.js 14 + App Router (PWA)
│   ├── mobile/           # Expo + React Native (próxima fase)
│   └── functions/        # Firebase Cloud Functions
├── packages/
│   ├── shared/           # Tipos, utils, constantes (compartido)
│   └── ui/               # Componentes UI compartidos (futuro)
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
└── turbo.json
```

---

## Requisitos Previos

```bash
node --version   # >= 18.0.0
pnpm --version   # >= 9.0.0 (instalar: npm i -g pnpm)
```

```bash
# Firebase CLI
npm install -g firebase-tools
firebase login

# Verificar
firebase --version  # >= 13.0.0
```

---

## 1. Instalación del Monorepo

```bash
# Clonar / crear el proyecto
cd subastas-ve

# Instalar todas las dependencias (web + functions + shared)
pnpm install

# Verificar que Turbo funciona
pnpm build --filter=@subastas-ve/shared
```

---

## 2. Configuración de Firebase

### 2.1 Crear el proyecto

```bash
# Crear proyecto en Firebase Console:
# https://console.firebase.google.com → Agregar proyecto → "subastas-ve-dev"

# Inicializar localmente (seleccionar: Firestore, Functions, Hosting, Storage, Emulators)
firebase init

# Asociar proyecto
firebase use --add subastas-ve-dev
```

### 2.2 Habilitar servicios en Firebase Console

```
Authentication → Sign-in method → Email/Password: HABILITAR
Firestore Database → Crear base de datos → Modo producción
Storage → Comenzar → Modo producción
Cloud Messaging → (automático)
```

### 2.3 Obtener credenciales web

```
Firebase Console → Configuración del proyecto → Tus apps → Web → Registrar app
Copiar firebaseConfig
```

### 2.4 Variables de entorno

```bash
cp apps/web/.env.local.example apps/web/.env.local
# Editar apps/web/.env.local con tus credenciales de Firebase y Agora
```

---

## 3. Emuladores de Firebase (Desarrollo Local)

```bash
# Iniciar todos los emuladores
firebase emulators:start

# UI de emuladores disponible en:
# http://localhost:4000

# Puertos:
# Auth:      localhost:9099
# Firestore: localhost:8080
# Functions: localhost:5001
# Storage:   localhost:9199
# Hosting:   localhost:5000
```

---

## 4. Cloud Functions

```bash
cd apps/functions

# Instalar dependencias
pnpm install

# Compilar TypeScript
pnpm build

# Modo watch (desarrollo)
pnpm dev

# Deployar a Firebase
pnpm deploy

# Deployar solo una función específica
firebase deploy --only functions:onPendingBidCreated
firebase deploy --only functions:closeExpiredAuctions
```

### Funciones desplegadas

| Función | Tipo | Descripción |
|---|---|---|
| `onPendingBidCreated` | Firestore trigger | Valida puja con transacción atómica |
| `closeExpiredAuctions` | Pub/Sub (cada 10s) | Cierra subastas expiradas |
| `startShow` | HTTPS Callable | Vendedor inicia su show |
| `endShow` | HTTPS Callable | Termina el show |
| `skipProduct` | HTTPS Callable | Salta al siguiente producto |
| `notifyShowStartingSoon` | Pub/Sub (cada 1min) | FCM "show por empezar" |
| `onRatingCreated` | Firestore trigger | Recalcula rating del vendedor |
| `onOrderDelivered` | Firestore trigger | FCM al comprador al entregar |
| `approveSeller` | HTTPS Callable | Admin aprueba vendedor |
| `suspendSeller` | HTTPS Callable | Admin suspende vendedor |
| `updateExchangeRate` | HTTPS Callable | Admin actualiza tasa Bs/USD |
| `updateCommissionConfig` | HTTPS Callable | Admin configura comisión |
| `generateAgoraToken` | HTTPS Callable | Token de Agora para transmisión |

---

## 5. Desplegar Reglas de Firestore y Storage

```bash
# Solo reglas de Firestore
firebase deploy --only firestore:rules

# Indexes de Firestore (requerido para queries compuestas)
firebase deploy --only firestore:indexes

# Reglas de Storage
firebase deploy --only storage

# Todo junto
firebase deploy --only firestore,storage
```

---

## 6. Web (Next.js PWA)

```bash
# Desde la raíz del monorepo:
pnpm dev:web

# O directamente:
cd apps/web
pnpm dev

# La app corre en: http://localhost:3000
```

```bash
# Build de producción
pnpm build --filter=web

# Iniciar build de producción localmente
cd apps/web && pnpm start
```

### Deploy a Firebase Hosting

```bash
cd apps/web
pnpm build
firebase deploy --only hosting
```

---

## 7. Datos Iniciales en Firestore

Ejecutar este script una sola vez para crear la configuración base:

```bash
# Crear archivo: scripts/seed.ts
# Luego: npx ts-node scripts/seed.ts
```

```typescript
// scripts/seed.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Usar Service Account de Firebase Console → Configuración → Cuentas de servicio
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function seed() {
  // 1. Tasa de cambio inicial
  await db.doc("exchangeRates/current").set({
    id: "current",
    usdToBs: 36.50,          // ← actualizar con tasa real
    updatedAt: Timestamp.now(),
    updatedBy: "system",
  });

  // 2. Configuración de comisión (modo b por defecto: vendedor cobra directo)
  await db.doc("config/commission").set({
    mode: "seller_collects",  // (b) vendedor cobra, plataforma registra
    platformFeePct: 10,       // 10% de comisión
    updatedAt: Timestamp.now(),
    updatedBy: "system",
  });

  // 3. Crear usuario admin (después de que se registre en Auth)
  // Reemplazar UID con el UID real del admin
  const ADMIN_UID = "REEMPLAZAR_CON_UID_REAL";
  await db.doc(`users/${ADMIN_UID}`).update({
    role: "admin",
    updatedAt: Timestamp.now(),
  });

  console.log("✅ Seed completado");
}

seed().catch(console.error);
```

---

## 8. Configuración de Agora

```bash
# 1. Crear cuenta en https://console.agora.io
# 2. Crear proyecto → obtener App ID
# 3. Habilitar: App Certificate (para tokens en producción)
# 4. Instalar token builder en functions:
cd apps/functions
npm install agora-access-token

# 5. Agregar secrets a Cloud Functions:
firebase functions:secrets:set AGORA_APP_ID
firebase functions:secrets:set AGORA_APP_CERTIFICATE

# 6. Descomentar el código de token en adminFunctions.ts
```

---

## 9. Configuración de FCM (Push Notifications)

```bash
# 1. Firebase Console → Cloud Messaging → Configuración web
# 2. Generar par de claves VAPID
# 3. Copiar la clave pública a NEXT_PUBLIC_FIREBASE_VAPID_KEY en .env.local

# 4. Para Android/iOS (Expo): configurar en app.json
#    "android": { "googleServicesFile": "./google-services.json" }
#    "ios": { "googleServicesFile": "./GoogleService-Info.plist" }
```

---

## 10. Configuración de Sentry

```bash
# Instalar CLI de Sentry
npm install -g @sentry/cli

# Inicializar en web
cd apps/web
npx @sentry/wizard@latest -i nextjs

# Agregar DSN a .env.local:
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## Flujo Crítico: Ciclo de Vida de una Puja

```
Cliente (browser/app)
    │
    │  1. Usuario ingresa monto → click "PUJAR"
    │
    ▼
/pendingBids/{id}   ← Cliente escribe aquí (Firestore)
    │
    │  2. onPendingBidCreated se dispara (Cloud Function)
    │
    ▼
Cloud Function (transacción atómica)
    │
    ├─ Leer show (¿está live?)
    ├─ Leer producto (¿auctionStatus === "active"?)
    ├─ Verificar auctionEndsAt > now
    ├─ Verificar monto >= currentBid + minIncrement
    ├─ Verificar bidderId !== currentBidderId
    │
    ├─ [RECHAZADA] → pendingBid.status = "rejected"
    │                Cliente recibe motivo, muestra error
    │
    └─ [ACEPTADA] → Actualizar producto.currentBid (atomic)
                    Extender timer si quedan < 10s
                    Crear doc en /bids
                    Crear mensaje en /messages
                    pendingBid.status = "processed"
                    FCM al pujador anterior ("te superaron")
                    │
                    Cliente escucha cambios en tiempo real
                    (onSnapshot) y actualiza UI
```

```
closeExpiredAuctions (cada 10 segundos)
    │
    ├─ Query: products donde auctionStatus=active AND auctionEndsAt <= now
    │
    └─ Por cada subasta expirada (transacción):
        ├─ Re-verificar que sigue activa y expirada (idempotencia)
        ├─ [CON GANADOR] → Congelar tasa de cambio
        │                  Calcular Bs = USD × tasa
        │                  Crear Orden en /orders
        │                  Actualizar producto: auctionStatus=sold
        │                  FCM al ganador
        │
        ├─ [SIN GANADOR] → auctionStatus=unsold
        │
        └─ Avanzar al siguiente producto
           └─ Si no hay más → show.status = "ended"
```

---

## Modelo de Comisión

### Modo (b) — Vendedor cobra directo (DEFAULT)
```
Ganador paga $100 al vendedor directamente (Zelle, Pago Móvil, etc.)
Vendedor paga comisión de $10 (10%) a la plataforma aparte
Orden registra: commissionUsd=10, sellerReceivesUsd=100
```

### Modo (a) — Plataforma cobra todo
```
Ganador paga $100 a la plataforma
Plataforma reparte $90 al vendedor
Orden registra: commissionUsd=10, sellerReceivesUsd=90
```

Cambiar el modo:
```typescript
// Llamar desde el admin panel o directamente:
const updateCommissionConfig = httpsCallable(functions, "updateCommissionConfig");
await updateCommissionConfig({
  mode: "platform_collects",  // o "seller_collects"
  platformFeePct: 10,
});
```

---

## Estructura de Datos Firestore

```
/users/{uid}                    # Perfiles de usuarios
/exchangeRates/current          # Tasa de cambio activa
/config/commission              # Modo y % de comisión

/shows/{showId}                 # Shows programados y en vivo
  /products/{productId}         # Productos del show
    /bids/{bidId}               # Historial de pujas (solo Functions escribe)
  /messages/{messageId}         # Chat en vivo

/pendingBids/{pendingBidId}     # Cola de pujas del cliente → Function

/orders/{orderId}               # Órdenes generadas al cerrar subastas
/ratings/{ratingId}             # Calificaciones comprador → vendedor
```

---

## Seguridad: Qué puede y no puede hacer el cliente

| Operación | Cliente | Cloud Function |
|---|---|---|
| Crear puja directamente en `/bids` | ❌ PROHIBIDO | ✅ Único que puede |
| Crear puja en `/pendingBids` | ✅ Solo con su UID | — |
| Cerrar subasta | ❌ PROHIBIDO | ✅ Automático |
| Cambiar `auctionStatus` | ❌ PROHIBIDO | ✅ Único que puede |
| Crear órdenes | ❌ PROHIBIDO | ✅ Al cerrar subasta |
| Leer shows, productos, chat | ✅ Público | — |
| Enviar mensajes de chat | ✅ Si autenticado y show live | — |
| Actualizar su perfil | ✅ Campos no críticos | — |
| Cambiar su `role` | ❌ PROHIBIDO | ✅ Solo admin |

---

## Próximos Pasos (Fase 2: Móvil)

```bash
# Crear app Expo (ya tendrá acceso a packages/shared sin reescribir nada)
cd apps/mobile
npx create-expo-app . --template blank-typescript

# Los hooks de Firestore, tipos, utilidades de moneda y timer
# son exactamente los mismos que usa la web.
# Solo cambian los componentes de UI (React Native vs React DOM)
# y el SDK de Agora (agora-react-native-rtm en lugar de agora-rtc-sdk-ng).
```

---

## Scripts útiles

```bash
# Monorepo raíz
pnpm dev              # Todos los proyectos en paralelo
pnpm dev:web          # Solo web
pnpm build            # Build de todo
pnpm type-check       # Type check de todo

# Firestore
firebase firestore:delete --all-collections   # Limpiar dev DB

# Emuladores con datos de prueba
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```
