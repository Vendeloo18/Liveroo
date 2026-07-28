// =============================================================
// Traduce las subastas legadas de InstaCompras al esquema unificado.
// Simulacro por defecto; --apply escribe.
// =============================================================
//   prodName    → title            currentBid → currentBidUsd
//   startPrice  → startingPriceUsd endsAt(ms) → Timestamp
//   recentBids  "nombre:monto|..." → subcolección /bids + bidsCount
//   sellerChannel "live_<uid>"     → sellerId real (por prefijo)
//   sellerChannel "ic_<n>" / sellerIdx → legacy_ic_<n>
//
// Quedan como "unsold": están vencidas desde abril y su ganador se
// guardó como apodo ("carlos.VE"), sin UID, así que no hay a quién
// adjudicarle una orden. Se conserva quién iba ganando, como historia.
// =============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, deleteField, Timestamp } from "firebase/firestore";

const APPLY = process.argv.includes("--apply");
const app = initializeApp({
  projectId: "instacompras-fe791",
  apiKey: "unused",
  authDomain: "instacompras-fe791.firebaseapp.com",
});
const db = getFirestore(app);

// Nombres rescatados de las órdenes IC del respaldo
const NOMBRE_LEGADO = { "0": "MarisolShop", "16": "GadgetPro", "46": "PAW3R" };

const usuarios = (await getDocs(collection(db, "users"))).docs;
const resolverUid = (prefijo) => usuarios.find((u) => u.id.startsWith(prefijo));

const esLegado = (x) => x.prodName !== undefined || x.currentBid !== undefined;

const aTimestamp = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return Timestamp.fromMillis(v);
  if (typeof v?.toMillis === "function") return v;
  return null;
};

// "carlos.VE:19|luisa_mpn:14" → [{nombre,monto}, ...] del más alto al más bajo
const parsearPujas = (s) =>
  (s ?? "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.lastIndexOf(":");
      const nombre = p.slice(0, i).trim();
      const monto = parseFloat(p.slice(i + 1));
      return nombre && isFinite(monto) ? { nombre, monto } : null;
    })
    .filter(Boolean);

console.log(APPLY ? "═══ APLICANDO ═══\n" : "═══ SIMULACRO (usar --apply) ═══\n");

const auctions = await getDocs(collection(db, "auctions"));
let migradas = 0, pujasCreadas = 0;

for (const d of auctions.docs) {
  const x = d.data();
  if (!esLegado(x)) continue;

  // ── vendedor ──
  let sellerId = null, sellerName = null;
  const canal = x.sellerChannel ?? "";
  if (canal.startsWith("live_")) {
    const u = resolverUid(canal.slice(5));
    if (u) { sellerId = u.id; sellerName = u.data().displayName ?? "Vendedor"; }
  }
  if (!sellerId) {
    const idx = canal.startsWith("ic_") ? canal.slice(3) : x.sellerIdx != null ? String(x.sellerIdx) : null;
    if (idx != null) {
      sellerId = `legacy_ic_${idx}`;
      sellerName = NOMBRE_LEGADO[idx] ?? `Vendedor ${idx}`;
    } else {
      sellerId = "legacy_ic";
      sellerName = "InstaCompras";
    }
  }

  const pujas = parsearPujas(x.recentBids);
  const startPrice = typeof x.startPrice === "number" ? x.startPrice : 0;
  const currentBid = typeof x.currentBid === "number" ? x.currentBid : startPrice;
  const endsAt = aTimestamp(x.endsAt);

  const nuevo = {
    mode: "standalone",
    showId: null,
    title: x.prodName ?? "(sin título)",
    sellerId,
    sellerName,
    startingPriceUsd: startPrice > 0 ? startPrice : currentBid,
    currentBidUsd: currentBid,
    minIncrementUsd: 1,
    // Vencidas y sin UID de ganador: nada que adjudicar.
    status: "unsold",
    endsAt,
    endedAt: endsAt,
    createdAt: aTimestamp(x.createdAt) ?? endsAt,
    currentBidderId: null,
    currentBidderName: x.currentWinner || null,
    bidsCount: pujas.length,
    winnerId: null,
    orderId: null,
    sortOrder: null,
    legacySource: "instacompras",
    updatedAt: Timestamp.now(),
    // fuera el esquema viejo
    prodName: deleteField(), currentBid: deleteField(), startPrice: deleteField(),
    recentBids: deleteField(), currentWinner: deleteField(), sellerChannel: deleteField(),
    sellerIdx: deleteField(), prodIdx: deleteField(), lastBidAt: deleteField(),
  };

  migradas++;
  console.log(`  ${d.id.slice(0, 30).padEnd(32)} "${(x.prodName ?? "").slice(0, 24)}" $${currentBid} · ${pujas.length} pujas · ${sellerName}`);

  if (APPLY) {
    await updateDoc(doc(db, "auctions", d.id), nuevo);
    // Historia de pujas, de la más vieja a la más nueva
    const base = endsAt?.toMillis() ?? Date.now();
    for (let i = pujas.length - 1; i >= 0; i--) {
      const p = pujas[i];
      await setDoc(doc(db, "auctions", d.id, "bids", `legacy_${pujas.length - 1 - i}`), {
        auctionId: d.id,
        showId: null,
        bidderId: null,
        bidderName: p.nombre,
        amountUsd: p.monto,
        placedAt: Timestamp.fromMillis(base - (i + 1) * 60000),
        legacySource: "instacompras",
      });
      pujasCreadas++;
    }
  } else {
    pujasCreadas += pujas.length;
  }
}

console.log(`\n  → ${migradas} subastas migradas, ${pujasCreadas} pujas históricas`);
console.log(APPLY ? "\nMigración aplicada." : "\nNada modificado — correr con --apply.");
process.exit(0);
