// =============================================================
// Migración al modelo unificado. Simulacro por defecto; --apply escribe.
// =============================================================
// 1. Siembra /config/commission (el motor lo necesita para calcular)
// 2. Normaliza /users a un solo esquema (name→displayName, type→role)
// 3. Genera /publicProfiles (lo que la web puede mostrar sin filtrar PII)
// 4. Pone mode/showId/winnerId/orderId a las subastas existentes
//
// No borra nada. Conserva los campos viejos por si algo quedó
// leyéndolos; se limpian en una pasada posterior.
// =============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";

const APPLY = process.argv.includes("--apply");
const app = initializeApp({
  projectId: "instacompras-fe791",
  apiKey: "unused",
  authDomain: "instacompras-fe791.firebaseapp.com",
});
const db = getFirestore(app);

const log = [];
const note = (s) => { log.push(s); console.log(s); };

// Campos que salen a /publicProfiles. Debe coincidir con
// PUBLIC_FIELDS en functions/src/users/syncPublicProfile.ts
const PUBLIC_FIELDS = [
  "uid", "displayName", "username", "avatar", "shopName", "sellerCat",
  "city", "role", "sellerStatus", "ratingAvg", "ratingCount", "totalSales",
];

console.log(APPLY ? "═══ APLICANDO ═══\n" : "═══ SIMULACRO (usar --apply) ═══\n");

// ── 1. Configuración de comisión ──────────────────────────────
// La tasa de cambio NO se siembra aquí: es un dato de negocio que
// tiene que poner el admin con updateExchangeRate.

const commissionSnap = await getDocs(collection(db, "config"));
if (commissionSnap.docs.some((d) => d.id === "commission")) {
  note("config/commission: ya existe, no se toca");
} else {
  note("config/commission: CREAR → seller_collects, 10%");
  if (APPLY) {
    await setDoc(doc(db, "config", "commission"), {
      mode: "seller_collects",
      platformFeePct: 10,
      updatedAt: new Date(),
      updatedBy: "migration",
    });
  }
}

// ── 2. Normalizar /users ──────────────────────────────────────

note("\n── /users ──");
const users = await getDocs(collection(db, "users"));
let normalizados = 0;

for (const d of users.docs) {
  const u = d.data();
  const cambios = {};

  const displayName = u.displayName || u.name || u.username || (u.email ?? "").split("@")[0];
  if (displayName && u.displayName !== displayName) cambios.displayName = displayName;

  // type:"seller" del cliente viejo ≠ permiso para vender.
  // El rol se respeta si ya existe; si no, todo el mundo entra como comprador.
  if (!u.role) cambios.role = "buyer";

  // Nadie queda aprobado por accidente: eso lo hace el admin.
  if (!u.sellerStatus) cambios.sellerStatus = "none";

  if (!u.shopName && u.shop) cambios.shopName = u.shop;
  if (!u.uid) cambios.uid = d.id;

  if (Object.keys(cambios).length) {
    normalizados++;
    note(`  ${d.id.slice(0, 14).padEnd(16)} ${JSON.stringify(cambios)}`);
    if (APPLY) await updateDoc(doc(db, "users", d.id), { ...cambios, updatedAt: new Date() });
  }
}
note(`  → ${normalizados}/${users.size} normalizados`);

// ── 3. Generar /publicProfiles ────────────────────────────────

note("\n── /publicProfiles ──");
let perfiles = 0;

for (const d of users.docs) {
  const u = { ...d.data() };
  // Aplicamos en memoria lo que acabamos de normalizar, para que el
  // perfil público salga correcto aunque corramos en simulacro.
  u.displayName = u.displayName || u.name || u.username || (u.email ?? "").split("@")[0];
  u.role = u.role || "buyer";
  u.sellerStatus = u.sellerStatus || "none";
  u.shopName = u.shopName || u.shop;

  const perfil = { uid: d.id };
  for (const f of PUBLIC_FIELDS) if (u[f] !== undefined) perfil[f] = u[f];

  perfiles++;
  if (APPLY) await setDoc(doc(db, "publicProfiles", d.id), { ...perfil, updatedAt: new Date() }, { merge: true });
}
note(`  → ${perfiles} perfiles públicos (sin email, teléfono ni cédula)`);

// ── 4. Subastas al modelo unificado ───────────────────────────

note("\n── /auctions ──");
const auctions = await getDocs(collection(db, "auctions"));
let tocadas = 0;

for (const d of auctions.docs) {
  const a = d.data();
  const cambios = {};

  if (!a.mode) cambios.mode = "standalone";
  if (a.showId === undefined) cambios.showId = null;
  if (a.winnerId === undefined) cambios.winnerId = null;
  if (a.orderId === undefined) cambios.orderId = null;
  if (a.currentBidderId === undefined) cambios.currentBidderId = null;
  if (typeof a.bidsCount !== "number") cambios.bidsCount = 0;
  if (a.sortOrder === undefined) cambios.sortOrder = null;

  if (Object.keys(cambios).length) {
    tocadas++;
    if (APPLY) await updateDoc(doc(db, "auctions", d.id), { ...cambios, updatedAt: new Date() });
  }
}
note(`  → ${tocadas}/${auctions.size} subastas actualizadas a mode/showId/winnerId`);

note(`\n${APPLY ? "Migración aplicada." : "Nada modificado — correr con --apply."}`);
process.exit(0);
