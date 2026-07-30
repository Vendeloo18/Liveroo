// =============================================================
// Flujo completo de compra, de punta a punta
// =============================================================
//   VENDELOO_TEST_PASSWORD=... node packages/rules-tests/flujo-compra.mjs
//
// ESCRIBE DATOS DE VERDAD en el proyecto al que apunten las variables de
// apps/web/.env.local. Todo lo que crea lleva isDemo:true, así que se
// limpia con "Purgar demo" en /admin, pero las órdenes y calificaciones
// que genera quedan. No correrlo con usuarios reales adentro.
//
// Necesita tres cuentas ya creadas (ver 01-cuentas en el historial del
// proyecto): admin@, vendedor@ y comprador@ del dominio de prueba. La
// clave sale de VENDELOO_TEST_PASSWORD: no se guarda en el repo, que es
// público.
//
// Va con el SDK de cliente a propósito: cada paso pasa por las reglas de
// Firestore y por el motor real. Un script con privilegio de dueño las
// saltaría y no probaría nada de lo que le va a pasar a un usuario.
//
// Una app de Firebase por rol. Con una sola, cada signIn tumbaba la
// anterior, los listeners quedaban leyendo con el uid equivocado y dos
// personas no podían pujar a la vez. Tres apps = tres sesiones
// simultáneas, que es lo que pasa de verdad.
//
// Los nombres de campo son los que escribe el motor, verificados en el
// código: puja aceptada = status "processed"; rechazada = status
// "rejected" + rejectedReason; la tasa vive en exchangeRates/current.
// =============================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, addDoc, collection, updateDoc,
  serverTimestamp, Timestamp, onSnapshot,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../../apps/web/.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const CONFIG = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const CLAVE = process.env.VENDELOO_TEST_PASSWORD;
if (!CLAVE) {
  console.error("Falta VENDELOO_TEST_PASSWORD. La clave no va en el repo.");
  process.exit(2);
}
const DOMINIO = process.env.VENDELOO_TEST_DOMAIN ?? "vendeloo.io";
const CUENTAS = {
  admin: [`admin@${DOMINIO}`, CLAVE],
  vendedor: [`vendedor@${DOMINIO}`, CLAVE],
  comprador: [`comprador@${DOMINIO}`, CLAVE],
};

let pasos = 0, fallos = 0;
const ok = (t, d = "") => { pasos++; console.log(`  ✓ ${t}${d ? "  — " + d : ""}`); };
const mal = (t, d) => { pasos++; fallos++; console.log(`  ✗ ${t}\n      ${d}`); };
const titulo = (t) => console.log(`\n── ${t} ──`);
const dinero = (n) => "$" + Number(n).toFixed(2);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera a que un doc cumpla una condición, mirando con la sesión dada. */
function esperar(s, ruta, cumple, ms = 30000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { off(); rej(new Error(`timeout esperando ${ruta}`)); }, ms);
    const off = onSnapshot(doc(s.db, ruta), (snap) => {
      const d = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (d && cumple(d)) { clearTimeout(t); off(); res(d); }
    }, (e) => { clearTimeout(t); rej(e); });
  });
}

/** Manda una puja y devuelve el veredicto del motor. */
async function pujar(s, auctionId, amountUsd) {
  const ref = await addDoc(collection(s.db, "pendingBids"), {
    auctionId, bidderId: s.uid, amountUsd, status: "pending", createdAt: serverTimestamp(),
  });
  const t0 = Date.now();
  const v = await esperar(s, `pendingBids/${ref.id}`, (d) => d.status !== "pending");
  return { ...v, ms: Date.now() - t0, aceptada: v.status === "processed" };
}

// ═══════════════════════════════════════════════════════════════
titulo("0. Tres sesiones simultáneas");
const S = {};
for (const [rol, [email, pass]] of Object.entries(CUENTAS)) {
  const a = initializeApp(CONFIG, rol);
  const { user } = await signInWithEmailAndPassword(getAuth(a), email, pass);
  S[rol] = { uid: user.uid, db: getFirestore(a), fns: getFunctions(a, "us-central1") };
  ok(`${rol} entra`, user.uid);
}

// ═══════════════════════════════════════════════════════════════
titulo("1. Admin: tasa Bs/USD y catálogo");
const TASA = 51.85;
try {
  await httpsCallable(S.admin.fns, "updateExchangeRate")({ usdToBs: TASA });
  const g = (await getDoc(doc(S.admin.db, "exchangeRates", "current"))).data()?.usdToBs;
  g === TASA ? ok("tasa fijada", `1 USD = ${g} Bs`)
             : mal("tasa fijada", `esperaba ${TASA}, quedó ${g}`);
} catch (e) { mal("tasa fijada", e.message); }

try {
  const r = await httpsCallable(S.admin.fns, "manageDemoAuctions")({ action: "seed" });
  ok("catálogo demo sembrado", `${r.data.creadas} subastas`);
} catch (e) { mal("catálogo demo sembrado", e.message); }

try {
  await httpsCallable(S.comprador.fns, "manageDemoAuctions")({ action: "seed" });
  mal("sembrar bloqueado a un comprador", "lo dejó pasar");
} catch (e) {
  /permission-denied|administrador/.test(e.message)
    ? ok("sembrar bloqueado a un comprador", "permission-denied")
    : mal("sembrar bloqueado a un comprador", e.message);
}

// ═══════════════════════════════════════════════════════════════
titulo("2. Vendedor publica");
const ID = `test_${Date.now().toString(36)}`;
const PARTIDA = 10, INCREMENTO = 2;
try {
  await setDoc(doc(S.vendedor.db, "auctions", ID), {
    mode: "standalone", showId: null,
    title: "Prueba de flujo completo — Audífonos",
    description: "Subasta creada por la prueba automatizada del flujo de compra.",
    category: "Electronica",
    imageURL: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    imageURLs: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"],
    sellerId: S.vendedor.uid, sellerName: "Tienda Prueba",
    startingPriceUsd: PARTIDA, currentBidUsd: PARTIDA, minIncrementUsd: INCREMENTO,
    status: "active",
    // 90 segundos: dentro del umbral de anti-sniping (120s en standalone),
    // para que cada puja corra el reloj y la subasta llegue a vencer sola.
    // Antes esto nacía a una hora y había que mover endsAt con privilegio de
    // dueño para poder probar el cierre; así no hace falta ninguno.
    endsAt: Timestamp.fromMillis(Date.now() + 90_000),
    bidsCount: 0, currentBidderId: null, currentBidderName: null,
    winnerId: null, orderId: null, sortOrder: null,
    isDemo: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  ok("subasta publicada", `${ID} desde ${dinero(PARTIDA)}`);
} catch (e) { mal("subasta publicada", e.message); process.exit(1); }

try {
  await updateDoc(doc(S.vendedor.db, "auctions", ID), { currentBidUsd: 999 });
  mal("vendedor no puede tocar el precio", "lo dejó escribir 999");
} catch { ok("vendedor no puede tocar el precio", "permission-denied"); }

// ═══════════════════════════════════════════════════════════════
titulo("3. Comprador puja");
const MONTO1 = PARTIDA + INCREMENTO;
try {
  const v = await pujar(S.comprador, ID, MONTO1);
  if (!v.aceptada) {
    mal("puja aceptada", `rechazada: ${v.rejectedReason ?? v.status}`);
  } else {
    const d = (await getDoc(doc(S.comprador.db, "auctions", ID))).data();
    d.currentBidUsd === MONTO1 && d.currentBidderId === S.comprador.uid && d.bidsCount === 1
      ? ok("puja aceptada", `${dinero(MONTO1)} en ${v.ms}ms · bidsCount=1 · líder correcto`)
      : mal("puja aceptada", `precio=${d.currentBidUsd} líder=${d.currentBidderId} pujas=${d.bidsCount}`);
  }
} catch (e) { mal("puja aceptada", e.message); }

// El líder repitiendo su propio monto: el motor mira own_bid antes que
// too_low, así que responde "ya vas ganando". Es lo correcto —nadie se puja
// a sí mismo— y es mejor mensaje que "muy baja".
try {
  const v = await pujar(S.comprador, ID, MONTO1);
  v.status === "rejected" && v.rejectedReason === "own_bid"
    ? ok("el líder no se puede pujar a sí mismo", `rejectedReason: ${v.rejectedReason}`)
    : mal("el líder no se puede pujar a sí mismo", `status=${v.status} motivo=${v.rejectedReason}`);
} catch (e) { mal("el líder no se puede pujar a sí mismo", e.message); }

// Un tercero por debajo del mínimo sí tiene que ser too_low
try {
  const v = await pujar(S.admin, ID, MONTO1);
  v.status === "rejected" && v.rejectedReason === "too_low"
    ? ok("puja por debajo del mínimo rechazada", `rejectedReason: ${v.rejectedReason}`)
    : mal("puja por debajo del mínimo rechazada", `status=${v.status} motivo=${v.rejectedReason}`);
} catch (e) { mal("puja por debajo del mínimo rechazada", e.message); }

try {
  const v = await pujar(S.vendedor, ID, 100);
  v.status === "rejected" && v.rejectedReason === "own_bid"
    ? ok("vendedor no puede pujar en lo suyo", `rejectedReason: ${v.rejectedReason}`)
    : mal("vendedor no puede pujar en lo suyo", `status=${v.status} motivo=${v.rejectedReason}`);
} catch (e) { mal("vendedor no puede pujar en lo suyo", e.message); }

try {
  const v = await pujar(S.comprador, "no_existe_esta_subasta", 50);
  v.status === "rejected" && v.rejectedReason === "not_found"
    ? ok("puja a una subasta inexistente", `rejectedReason: ${v.rejectedReason}`)
    : mal("puja a una subasta inexistente", `status=${v.status} motivo=${v.rejectedReason}`);
} catch (e) { mal("puja a una subasta inexistente", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("4. Dos pujas al mismo tiempo (que no se choquen)");
// Dos personas mandan el mismo monto sin esperar el veredicto del otro:
// exactamente una tiene que ganar, la otra se rechaza por baja, y el
// precio debe quedar consistente con quien ganó.
const MONTO2 = MONTO1 + INCREMENTO;
try {
  const [rC, rA] = await Promise.all([
    pujar(S.comprador, ID, MONTO2),
    pujar(S.admin, ID, MONTO2),
  ]);
  const aceptadas = [rC, rA].filter((r) => r.aceptada);
  const d = (await getDoc(doc(S.admin.db, "auctions", ID))).data();

  if (aceptadas.length !== 1) {
    mal("exactamente una gana", `aceptadas=${aceptadas.length} (comprador=${rC.status}, admin=${rA.status})`);
  } else {
    const ganador = rC.aceptada ? S.comprador.uid : S.admin.uid;
    d.currentBidUsd === MONTO2 && d.currentBidderId === ganador && d.bidsCount === 2
      ? ok("exactamente una gana", `${dinero(MONTO2)} · líder = el aceptado · bidsCount=2`)
      : mal("exactamente una gana", `precio=${d.currentBidUsd} líder=${d.currentBidderId} pujas=${d.bidsCount}`);
    // La perdedora sale por too_low, o por own_bid si la evaluaron cuando
    // todavía era la líder. Las dos son coherentes; lo que no se admite es
    // que quede en pending o que se acepte.
    const perdedora = rC.aceptada ? rA : rC;
    ["too_low", "own_bid"].includes(perdedora.rejectedReason)
      ? ok("la otra se rechaza con motivo claro", `rejectedReason: ${perdedora.rejectedReason}`)
      : mal("la otra se rechaza con motivo claro", `motivo: ${perdedora.rejectedReason}`);
  }
} catch (e) { mal("dos pujas al mismo tiempo", e.message); }

// Ronda de cinco a la vez, alternando postor: nunca debe haber dos con el
// mismo precio final ni un contador que se salte un número.
try {
  const antes = (await getDoc(doc(S.admin.db, "auctions", ID))).data();
  const montos = [0, 1, 2, 3, 4].map((i) => antes.currentBidUsd + INCREMENTO * (i + 1));
  const rs = await Promise.all(montos.map((m, i) =>
    pujar(i % 2 ? S.admin : S.comprador, ID, m).catch((e) => ({ status: "error", err: e.message }))
  ));
  const acept = rs.filter((r) => r.aceptada).length;
  const d = (await getDoc(doc(S.admin.db, "auctions", ID))).data();
  const esperado = (antes.bidsCount ?? 0) + acept;
  d.bidsCount === esperado && d.currentBidUsd === Math.max(...rs.filter(r => r.aceptada).map((_, i) => 0), d.currentBidUsd)
    ? ok("cinco pujas simultáneas", `${acept} aceptadas · bidsCount ${antes.bidsCount}→${d.bidsCount} · precio ${dinero(d.currentBidUsd)}`)
    : mal("cinco pujas simultáneas", `bidsCount=${d.bidsCount}, esperaba ${esperado}`);
} catch (e) { mal("cinco pujas simultáneas", e.message); }

// Una última puja solo del comprador, para que el ganador quede fijo.
// Si gana el admin, las pruebas negativas de más abajo no prueban nada:
// las reglas le dan override total sobre las órdenes —a propósito, para
// poder desatascar una venta— así que "el comprador no puede confirmar su
// propio pago" pasaría siempre.
titulo("4b. Ganador determinista");
try {
  let d = (await getDoc(doc(S.admin.db, "auctions", ID))).data();
  // Si ya va ganando no hay nada que hacer: pujar otra vez sería autopuja
  // y el motor la rechazaría, con razón.
  if (d.currentBidderId !== S.comprador.uid) {
    await pujar(S.comprador, ID, d.currentBidUsd + INCREMENTO);
    d = (await getDoc(doc(S.admin.db, "auctions", ID))).data();
  }
  d.currentBidderId === S.comprador.uid
    ? ok("el comprador queda líder", dinero(d.currentBidUsd))
    : mal("el comprador queda líder", `líder=${d.currentBidderId}`);
} catch (e) { mal("el comprador queda líder", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("5. Cierre y creación de la orden");
const antesCierre = (await getDoc(doc(S.admin.db, "auctions", ID))).data();
const GANADOR = antesCierre.currentBidderId;
const FINAL = antesCierre.currentBidUsd;
const ROL_GANADOR = GANADOR === S.comprador.uid ? "comprador" : "admin";
let idOrden = null;

// El anti-sniping tenía que haber corrido el reloj: la subasta nació a 90s
// y cada puja dentro del umbral lo lleva a +120s.
const venceEn = Math.round((antesCierre.endsAt.toMillis() - Date.now()) / 1000);
venceEn > 90
  ? ok("anti-sniping corrió el reloj", `vence en ${venceEn}s (nació a 90s)`)
  : mal("anti-sniping corrió el reloj", `vence en ${venceEn}s`);

// closeAuctionNow revalida que haya vencido de verdad: si no, devuelve
// closed:false y no toca nada. Bien —así nadie corta una subasta antes—,
// pero significa que hay que esperar el reloj real.
try {
  // Antes de que venza tiene que negarse
  const temprano = await httpsCallable(S.admin.fns, "closeAuctionNow")({ auctionId: ID });
  temprano.data.closed === false
    ? ok("no cierra una subasta que no venció", "closed: false")
    : mal("no cierra una subasta que no venció", `devolvió ${JSON.stringify(temprano.data)}`);

  const faltan = antesCierre.endsAt.toMillis() - Date.now() + 2000;
  if (faltan > 0) {
    console.log(`     esperando ${Math.round(faltan / 1000)}s a que venza el reloj real…`);
    await dormir(faltan);
  }

  // closeExpiredAuctions barre cada minuto, así que puede habérsela llevado
  // mientras esperábamos. Las dos vías son correctas; lo que importa es que
  // quede vendida con el ganador y la orden bien.
  const r = await httpsCallable(S.admin.fns, "closeAuctionNow")({ auctionId: ID });
  ok("cierre disparado", r.data.closed ? "por closeAuctionNow" : "ya la había cerrado el barrido");

  const c = await esperar(S.admin, `auctions/${ID}`, (d) => d.status !== "active");
  c.status === "sold" && c.winnerId === GANADOR && c.orderId
    ? ok("subasta cerrada", `sold · ganador correcto · orden ${c.orderId}`)
    : mal("subasta cerrada", `status=${c.status} ganador=${c.winnerId} orden=${c.orderId}`);
  idOrden = c.orderId;
} catch (e) { mal("subasta cerrada", e.message); }

if (idOrden) {
  const o = (await getDoc(doc(S[ROL_GANADOR].db, "orders", idOrden))).data();
  o.status === "pending_payment" && o.buyerId === GANADOR && o.sellerId === S.vendedor.uid
    ? ok("orden creada", `${o.status} · ${dinero(o.bidAmountUsd)} · comisión ${dinero(o.commissionUsd)}`)
    : mal("orden creada", JSON.stringify({ status: o.status, buyer: o.buyerId, seller: o.sellerId }));
  o.bidAmountUsd === FINAL
    ? ok("monto congelado al cierre", dinero(o.bidAmountUsd))
    : mal("monto congelado al cierre", `subasta ${FINAL} vs orden ${o.bidAmountUsd}`);
  const bs = o.bidAmountBs ?? o.amountBs ?? o.totalBs ?? null;
  if (bs !== null) {
    const esp = Math.round(FINAL * TASA * 100) / 100;
    Math.abs(bs - esp) < 0.02
      ? ok("bolívares congelados con la tasa", `${bs} Bs a ${TASA}`)
      : mal("bolívares congelados con la tasa", `esperaba ~${esp}, quedó ${bs}`);
  } else {
    ok("bolívares", "la orden no los guarda; se calculan al mostrar");
  }
  // El vendedor tiene que poder verla
  try {
    const v = await getDoc(doc(S.vendedor.db, "orders", idOrden));
    v.exists() ? ok("el vendedor ve la orden") : mal("el vendedor ve la orden", "no existe para él");
  } catch (e) { mal("el vendedor ve la orden", e.message); }
  // Un tercero no
  const TERCERO = ROL_GANADOR === "comprador" ? "admin" : "comprador";
  if (TERCERO === "comprador") {
    try {
      await getDoc(doc(S.comprador.db, "orders", idOrden));
      mal("un tercero no ve la orden", "la leyó");
    } catch { ok("un tercero no ve la orden", "permission-denied"); }
  }
}

// ═══════════════════════════════════════════════════════════════
titulo("6. Pago, despacho, entrega");
if (idOrden) {
  const G = S[ROL_GANADOR];

  try {
    await updateDoc(doc(G.db, "orders", idOrden), {
      buyerWhatsapp: "+584145551234", updatedAt: serverTimestamp(),
    });
    ok("comprador deja su WhatsApp");
  } catch (e) { mal("comprador deja su WhatsApp", e.message); }

  try {
    await updateDoc(doc(G.db, "orders", idOrden), { status: "payment_confirmed", updatedAt: serverTimestamp() });
    mal("comprador no confirma su propio pago", "lo dejó");
  } catch { ok("comprador no confirma su propio pago", "permission-denied"); }

  try {
    await updateDoc(doc(G.db, "orders", idOrden), {
      status: "delivered", deliveredAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    mal("no se puede saltar a entregado", "lo dejó");
  } catch { ok("no se puede saltar a entregado", "permission-denied"); }

  try {
    await updateDoc(doc(S.vendedor.db, "orders", idOrden), {
      status: "payment_confirmed", paymentMethod: "pago_movil",
      paymentReference: "0001234567", paymentConfirmedAt: serverTimestamp(),
      paymentConfirmedBy: S.vendedor.uid, updatedAt: serverTimestamp(),
    });
    ok("vendedor confirma el pago", "pago_movil · ref 0001234567");
  } catch (e) { mal("vendedor confirma el pago", e.message); }

  try {
    await updateDoc(doc(S.vendedor.db, "orders", idOrden), {
      status: "shipped", trackingCode: "ZOOM-987654",
      shippedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    ok("vendedor despacha", "guía ZOOM-987654");
  } catch (e) { mal("vendedor despacha", e.message); }

  try {
    await updateDoc(doc(S.vendedor.db, "orders", idOrden), {
      status: "delivered", deliveredAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    mal("vendedor no declara la entrega", "lo dejó");
  } catch { ok("vendedor no declara la entrega", "permission-denied"); }

  try {
    await updateDoc(doc(G.db, "orders", idOrden), {
      status: "delivered", deliveredAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    ok("comprador confirma la entrega", "delivered");
  } catch (e) { mal("comprador confirma la entrega", e.message); }
}

// ═══════════════════════════════════════════════════════════════
titulo("7. Calificación");
if (idOrden) {
  const G = S[ROL_GANADOR];
  const antes = (await getDoc(doc(S.admin.db, "users", S.vendedor.uid))).data();
  try {
    await addDoc(collection(G.db, "ratings"), {
      fromUid: GANADOR, toUid: S.vendedor.uid, orderId: idOrden,
      score: 5, comment: "Todo bien, llegó rápido.", createdAt: serverTimestamp(),
    });
    ok("comprador califica al vendedor", "5 estrellas");
  } catch (e) { mal("comprador califica al vendedor", e.message); }

  try {
    const d = await esperar(S.vendedor, `users/${S.vendedor.uid}`,
      (u) => (u.ratingCount ?? 0) > (antes?.ratingCount ?? 0));
    ok("promedio del vendedor actualizado", `${d.ratingAvg} de ${d.ratingCount} calificación(es)`);
  } catch (e) { mal("promedio del vendedor actualizado", e.message); }

  try {
    await addDoc(collection(G.db, "ratings"), {
      fromUid: GANADOR, toUid: GANADOR, orderId: idOrden, score: 5, createdAt: serverTimestamp(),
    });
    mal("no se puede calificar a uno mismo", "lo dejó");
  } catch { ok("no se puede calificar a uno mismo", "permission-denied"); }

  // El perfil público tiene que reflejarlo (lo sincroniza una Function)
  try {
    await dormir(3000);
    const p = (await getDoc(doc(S.comprador.db, "publicProfiles", S.vendedor.uid))).data();
    p ? ok("perfil público sincronizado", `${p.displayName ?? "?"} · ${p.ratingAvg ?? "sin"} ★`)
      : mal("perfil público sincronizado", "no existe");
  } catch (e) { mal("perfil público sincronizado", e.message); }
}

// ═══════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`  ${pasos - fallos}/${pasos} pasos bien` + (fallos ? ` · ${fallos} FALLARON` : ""));
console.log(`  subasta ${ID} · orden ${idOrden ?? "no se creó"} · ganó ${ROL_GANADOR}`);
console.log("═".repeat(60));
process.exit(fallos ? 1 : 0);
