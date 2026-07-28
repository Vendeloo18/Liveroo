// =============================================================
// Limpieza de datos heredados. Simulacro por defecto; --apply borra.
// =============================================================
// 1. Shows de prueba (sellerId "unknown") + sus subcolecciones
// 2. Órdenes legadas de InstaCompras (esquema viejo: campo "num" IC-*)
// 3. bidsCount inventado en subastas que nunca tuvieron una puja
//
// Todo lo que borra está en backups/2026-07-27/firestore-backup.json
// =============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";

const APPLY = process.argv.includes("--apply");
const app = initializeApp({
  projectId: "instacompras-fe791",
  apiKey: "unused",
  authDomain: "instacompras-fe791.firebaseapp.com",
});
const db = getFirestore(app);

console.log(APPLY ? "═══ APLICANDO ═══\n" : "═══ SIMULACRO (usar --apply) ═══\n");

// ── 1. Shows de prueba ────────────────────────────────────────

console.log("── Shows de prueba (sellerId \"unknown\") ──");
const shows = await getDocs(collection(db, "shows"));
const basura = shows.docs.filter((d) => d.data().sellerId === "unknown");

for (const s of basura) {
  const x = s.data();
  const subs = [];
  for (const sub of ["products", "messages"]) {
    const ss = await getDocs(collection(db, "shows", s.id, sub));
    if (ss.size) subs.push(`${sub}:${ss.size}`);
    if (APPLY) for (const sd of ss.docs) await deleteDoc(doc(db, "shows", s.id, sub, sd.id));
  }
  console.log(`  ${s.id.slice(0, 14).padEnd(16)} "${x.title}" status=${x.status} ${subs.join(" ") || "(sin subcolecciones)"}`);
  if (APPLY) await deleteDoc(doc(db, "shows", s.id));
}
console.log(`  → ${basura.length} shows`);

// ── 2. Órdenes legadas de InstaCompras ────────────────────────
// Se reconocen por el esquema viejo: tienen "num" (IC-xxxxx) y "amt"
// en vez de bidAmountUsd. Respaldadas antes de borrar.

console.log("\n── Órdenes legadas ──");
const orders = await getDocs(collection(db, "orders"));
const legadas = orders.docs.filter((d) => {
  const o = d.data();
  return typeof o.num === "string" && o.num.startsWith("IC-") && o.bidAmountUsd === undefined;
});

for (const o of legadas) {
  const x = o.data();
  console.log(`  ${x.num.padEnd(12)} ${(x.prod ?? "").slice(0, 24).padEnd(26)} $${x.amt}  ${x.buyerName}`);
  if (APPLY) await deleteDoc(doc(db, "orders", o.id));
}
console.log(`  → ${legadas.length} órdenes`);

// ── 3. Contadores de pujas inventados ─────────────────────────
// Una subasta sin currentBidderId y sin subcolección bids nunca
// recibió una puja: su bidsCount es decoración.

console.log("\n── bidsCount sin pujas reales ──");
const auctions = await getDocs(collection(db, "auctions"));
let corregidas = 0;

for (const a of auctions.docs) {
  const x = a.data();
  if ((x.bidsCount ?? 0) === 0) continue;
  if (x.currentBidderId) continue; // tiene líder: el contador es legítimo

  const bids = await getDocs(collection(db, "auctions", a.id, "bids"));
  if (bids.size > 0) continue; // hay pujas de verdad

  corregidas++;
  console.log(`  ${(x.title ?? "").slice(0, 40).padEnd(42)} ${x.bidsCount} → 0`);
  if (APPLY) await updateDoc(doc(db, "auctions", a.id), { bidsCount: 0, updatedAt: new Date() });
}
console.log(`  → ${corregidas} subastas`);

console.log(`\n${APPLY ? "Limpieza aplicada." : "Nada modificado — correr con --apply."}`);
process.exit(0);
