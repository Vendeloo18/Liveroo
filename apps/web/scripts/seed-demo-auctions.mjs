// =============================================================
// Siembra subastas de demostración en el esquema unificado.
// Simulacro por defecto; --apply escribe.
// =============================================================
// El catálogo son los productos que ya habías curado (títulos, fotos
// y categorías reales), pero con datos honestos:
//   · bidsCount 0 — sin pujas inventadas
//   · sin currentBidderId — nadie va ganando
//   · endsAt en el futuro, escalonado, para ver cerrar unas antes que otras
//
// Los vendedores son los demo (seller001..008) que ya existen en /users.
// =============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, Timestamp } from "firebase/firestore";

const APPLY = process.argv.includes("--apply");
const app = initializeApp({
  projectId: "instacompras-fe791",
  apiKey: "unused",
  authDomain: "instacompras-fe791.firebaseapp.com",
});
const db = getFirestore(app);

// title, category, imageURL, precio inicial, incremento, vendedor, horas hasta el cierre
const CATALOGO = [
  ["Set de maquillaje profesional 24 piezas", "Moda y Ropa", "photo-1596462502278-27bfdc403348", 15, 1, "seller007", 6],
  ["Auriculares Bluetooth inalámbricos con cancelación de ruido", "Electronica", "photo-1505740420928-5e560c06d30e", 12, 1, "seller003", 10],
  ["PlayStation 5 Slim 1TB edición estándar", "Electronica", "photo-1606813907291-d86efa9b94db", 10, 5, "seller004", 24],
  ["Tenis Nike Air Max 270 talla 42", "Calzado", "photo-1542291026-7eec264c27ff", 20, 2, "seller001", 30],
  ["Cargador inalámbrico rápido 15W", "Electronica", "photo-1615526675159-e248c3021d3f", 6, 1, "seller003", 48],
  ["Smartwatch deportivo con monitor cardíaco", "Electronica", "photo-1523275335684-37898b6baf30", 18, 1, "seller003", 54],
  ["Kit pesas ajustables 20kg para casa", "Deportes", "photo-1517836357463-d25dfeac3438", 20, 2, "seller008", 72],
  ["Drone mini con cámara HD 1080p plegable", "Electronica", "photo-1473968512647-3e447244af8f", 25, 5, "seller005", 78],
  ["Silla gamer ergonómica con soporte lumbar", "Hogar", "photo-1598550476439-6847785fcea6", 25, 5, "seller005", 96],
  ["Plancha de cabello profesional cerámica", "Moda y Ropa", "photo-1522338242992-e1a54906a8da", 10, 1, "seller007", 100],
  ["Cámara de seguridad WiFi 360° visión nocturna", "Electronica", "photo-1558002038-1055907df827", 14, 1, "seller003", 120],
  ["Licuadora portátil USB para jugos y batidos", "Hogar", "photo-1570222094114-d054a817e56b", 8, 1, "seller006", 144],
];

console.log(APPLY ? "═══ APLICANDO ═══\n" : "═══ SIMULACRO (usar --apply) ═══\n");

// Nombres reales de los vendedores demo
const users = await getDocs(collection(db, "users"));
const nombreDe = Object.fromEntries(users.docs.map((d) => [d.id, d.data().displayName ?? d.id]));

const faltantes = [...new Set(CATALOGO.map((c) => c[5]))].filter((s) => !nombreDe[s]);
if (faltantes.length) {
  console.error(`Faltan vendedores en /users: ${faltantes.join(", ")}`);
  process.exit(1);
}

const ahora = Date.now();
let creadas = 0;

for (const [title, category, foto, precio, incremento, sellerId, horas] of CATALOGO) {
  const id = `demo_${creadas.toString().padStart(2, "0")}`;
  const endsAt = Timestamp.fromMillis(ahora + horas * 3600_000);

  const subasta = {
    mode: "standalone",
    showId: null,
    title,
    description: "",
    category,
    imageURL: `https://images.unsplash.com/${foto}?w=600&q=80`,
    imageURLs: [`https://images.unsplash.com/${foto}?w=600&q=80`],
    sellerId,
    sellerName: nombreDe[sellerId],
    startingPriceUsd: precio,
    currentBidUsd: precio,
    minIncrementUsd: incremento,
    status: "active",
    endsAt,
    bidsCount: 0,
    currentBidderId: null,
    currentBidderName: null,
    winnerId: null,
    orderId: null,
    sortOrder: null,
    isDemo: true,
    createdAt: Timestamp.fromMillis(ahora),
    updatedAt: Timestamp.fromMillis(ahora),
  };

  creadas++;
  const cierre = horas < 24 ? `${horas}h` : `${Math.round(horas / 24)}d`;
  console.log(`  ${id}  ${title.slice(0, 42).padEnd(44)} $${String(precio).padStart(3)} · cierra en ${cierre.padEnd(4)} · ${nombreDe[sellerId]}`);

  if (APPLY) await setDoc(doc(db, "auctions", id), subasta);
}

console.log(`\n  → ${creadas} subastas de demo, 0 pujas falsas`);
console.log(APPLY ? "\nSeed aplicado." : "\nNada modificado — correr con --apply.");
process.exit(0);
