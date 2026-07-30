// =============================================================
// La billetera, de punta a punta
// =============================================================
//   VENDELOO_TEST_PASSWORD=... node packages/rules-tests/billetera.mjs
//
// El dinero es lo único del producto que no admite "casi": aquí se
// recorre el ciclo completo contra el proyecto real y con el SDK de
// cliente — declarar un depósito, aprobarlo (admin), créditos manuales,
// el interruptor "pujar exige saldo", la puja rechazada por saldo, la
// aceptada, y el cierre que debita y hace nacer la orden YA PAGADA.
//
// La retención es el corazón: mientras tu puja va ganando, ese monto
// queda apartado (heldUsd) y NO respalda otra puja — un mismo saldo no
// puede quedar ganando dos subastas. Si te superan, se libera en la
// misma transacción de la puja rival; si ganas, el cierre debita y
// libera junto.
//
// También lo que NO se puede: escribir el saldo a mano, editar un
// depósito, aprobárselo uno mismo, ajustar sin nota, dejar saldo
// negativo, o descontarle a alguien plata que respalda pujas activas.
// Al final, la auditoría: la suma del ledger es el saldo.
//
// Deja el interruptor APAGADO al salir (pujar libre), que es el estado
// de lanzamiento. Dura ~3 min por el reloj real de la subasta.
// =============================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, collection,
  serverTimestamp, Timestamp, onSnapshot, query, where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import fs from "node:fs";

const env = Object.fromEntries(fs.readFileSync(new URL("../../apps/web/.env.local", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
const CONFIG = { apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: env.NEXT_PUBLIC_FIREBASE_APP_ID };

const CLAVE = process.env.VENDELOO_TEST_PASSWORD;
if (!CLAVE) { console.error("Falta VENDELOO_TEST_PASSWORD. La clave no va en el repo."); process.exit(2); }
const DOMINIO = process.env.VENDELOO_TEST_DOMAIN ?? "vendeloo.io";

const S_ = {};
for (const [rol, mail] of [["admin", "admin@" + DOMINIO], ["vendedor", "vendedor@" + DOMINIO], ["comprador", "comprador@" + DOMINIO]]) {
  const a = initializeApp(CONFIG, rol);
  const { user } = await signInWithEmailAndPassword(getAuth(a), mail, CLAVE);
  S_[rol] = { uid: user.uid, db: getFirestore(a), fns: getFunctions(a, "us-central1") };
}

let n = 0, bad = 0;
const ok = (t, d = "") => { n++; console.log(`  ✓ ${t}${d ? "  — " + d : ""}`); };
const mal = (t, d) => { n++; bad++; console.log(`  ✗ ${t}\n      ${d}`); };
const titulo = (t) => console.log(`\n── ${t} ──`);
const usd = (v) => "$" + Number(v).toFixed(2);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function esperar(s, ruta, cumple, ms = 30000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { off(); rej(new Error(`timeout esperando ${ruta}`)); }, ms);
    const off = onSnapshot(doc(s.db, ruta), (snap) => {
      const d = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (d && cumple(d)) { clearTimeout(t); off(); res(d); }
    }, (e) => { clearTimeout(t); rej(e); });
  });
}

async function pujar(s, auctionId, amountUsd) {
  const ref = await addDoc(collection(s.db, "pendingBids"), {
    auctionId, bidderId: s.uid, amountUsd, status: "pending", createdAt: serverTimestamp(),
  });
  const v = await esperar(s, `pendingBids/${ref.id}`, (d) => d.status !== "pending");
  return { ...v, aceptada: v.status === "processed" };
}

const billeteraDe = async (s, uid) => {
  const d = (await getDoc(doc(s.db, "wallets", uid))).data() ?? {};
  return {
    saldo: Math.round((d.balanceUsd ?? 0) * 100) / 100,
    retenido: Math.round((d.heldUsd ?? 0) * 100) / 100,
  };
};
const saldoDe = async (s, uid) => (await billeteraDe(s, uid)).saldo;

const saldoInicial = await saldoDe(S_.comprador, S_.comprador.uid);
console.log(`\n(saldo inicial del comprador: ${usd(saldoInicial)})`);

// ═══════════════════════════════════════════════════════════════
titulo("1. Nadie escribe plata a mano");
try {
  await setDoc(doc(S_.comprador.db, "wallets", S_.comprador.uid), { balanceUsd: 9999 });
  mal("el saldo no se escribe desde el cliente", "lo dejó");
} catch { ok("el saldo no se escribe desde el cliente", "permission-denied"); }

try {
  await addDoc(collection(S_.comprador.db, "walletTransactions"), {
    userId: S_.comprador.uid, type: "deposit", amountUsd: 9999, createdAt: serverTimestamp(),
  });
  mal("el ledger no se escribe desde el cliente", "lo dejó");
} catch { ok("el ledger no se escribe desde el cliente", "permission-denied"); }

try {
  await addDoc(collection(S_.comprador.db, "deposits"), {
    userId: S_.comprador.uid, userName: "x", amountUsd: 50, method: "zelle",
    reference: "REF-1234", status: "approved", createdAt: serverTimestamp(),
  });
  mal("un depósito no puede nacer aprobado", "lo dejó");
} catch { ok("un depósito no puede nacer aprobado", "permission-denied"); }

// ═══════════════════════════════════════════════════════════════
titulo("2. Declarar un depósito y aprobarlo");
let depId = null;
try {
  const ref = await addDoc(collection(S_.comprador.db, "deposits"), {
    userId: S_.comprador.uid, userName: "Comprador Prueba", amountUsd: 20,
    method: "pago_movil", reference: "0009876543", status: "pending", createdAt: serverTimestamp(),
  });
  depId = ref.id;
  ok("solicitud creada", `${usd(20)} · ref 0009876543`);
} catch (e) { mal("solicitud creada", e.message); }

if (depId) {
  try {
    await updateDoc(doc(S_.comprador.db, "deposits", depId), { amountUsd: 900 });
    mal("la solicitud no se puede editar", "lo dejó");
  } catch { ok("la solicitud no se puede editar", "permission-denied"); }

  try {
    await httpsCallable(S_.comprador.fns, "manageDeposit")({ depositId: depId, action: "approve" });
    mal("nadie se aprueba su propio depósito", "lo dejó");
  } catch (e) {
    /permission-denied/.test(e.code) ? ok("nadie se aprueba su propio depósito", "permission-denied")
      : mal("nadie se aprueba su propio depósito", e.code);
  }

  try {
    const r = await httpsCallable(S_.admin.fns, "manageDeposit")({ depositId: depId, action: "approve" });
    const saldo = await saldoDe(S_.comprador, S_.comprador.uid);
    saldo === Math.round((saldoInicial + 20) * 100) / 100
      ? ok("admin aprueba y acredita", `saldo ${usd(saldo)}`)
      : mal("admin aprueba y acredita", `saldo=${saldo}, esperaba ${saldoInicial + 20}`);
  } catch (e) { mal("admin aprueba y acredita", e.message); }

  try {
    await httpsCallable(S_.admin.fns, "manageDeposit")({ depositId: depId, action: "approve" });
    mal("aprobar dos veces no acredita dos veces", "lo dejó");
  } catch (e) {
    /failed-precondition/.test(e.code) ? ok("aprobar dos veces no acredita dos veces", "failed-precondition")
      : mal("aprobar dos veces no acredita dos veces", e.code);
  }
}

// ═══════════════════════════════════════════════════════════════
titulo("3. Créditos manuales del admin");
try {
  await httpsCallable(S_.comprador.fns, "adjustWallet")({ userId: S_.comprador.uid, amountUsd: 100, note: "yo mismo" });
  mal("un usuario no se acredita solo", "lo dejó");
} catch (e) {
  /permission-denied/.test(e.code) ? ok("un usuario no se acredita solo", "permission-denied")
    : mal("un usuario no se acredita solo", e.code);
}

try {
  await httpsCallable(S_.admin.fns, "adjustWallet")({ userId: S_.comprador.uid, amountUsd: 5 });
  mal("ajuste sin nota rechazado", "lo dejó");
} catch (e) {
  /invalid-argument/.test(e.code) ? ok("ajuste sin nota rechazado", "la nota es obligatoria")
    : mal("ajuste sin nota rechazado", e.code);
}

try {
  await httpsCallable(S_.admin.fns, "adjustWallet")({ userId: S_.comprador.uid, amountUsd: 5, note: "Bono de prueba" });
  const saldo = await saldoDe(S_.comprador, S_.comprador.uid);
  ok("admin acredita con nota", `+${usd(5)} → saldo ${usd(saldo)}`);
} catch (e) { mal("admin acredita con nota", e.message); }

try {
  await httpsCallable(S_.admin.fns, "adjustWallet")({ userId: S_.comprador.uid, amountUsd: -99999, note: "imposible" });
  mal("no se puede dejar saldo negativo", "lo dejó");
} catch (e) {
  /failed-precondition/.test(e.code) ? ok("no se puede dejar saldo negativo", "failed-precondition")
    : mal("no se puede dejar saldo negativo", e.code);
}

// ═══════════════════════════════════════════════════════════════
titulo("4. El interruptor «pujar exige saldo»");
try {
  await setDoc(doc(S_.comprador.db, "config", "wallet"), { biddingRequiresBalance: true });
  mal("el interruptor no lo toca un usuario", "lo dejó");
} catch { ok("el interruptor no lo toca un usuario", "permission-denied"); }

try {
  await setDoc(doc(S_.admin.db, "config", "wallet"), { biddingRequiresBalance: true, updatedAt: serverTimestamp() }, { merge: true });
  ok("admin lo enciende desde el panel", "biddingRequiresBalance: true");
} catch (e) { mal("admin lo enciende desde el panel", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("5. Retención: un saldo no gana dos subastas");
const S = await saldoDe(S_.comprador, S_.comprador.uid);

const crearSubasta = async (id) => {
  await setDoc(doc(S_.vendedor.db, "auctions", id), {
    mode: "standalone", showId: null,
    title: "Prueba de retención — " + id, description: "", category: "Electronica",
    imageURL: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    imageURLs: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"],
    sellerId: S_.vendedor.uid, sellerName: "Tienda Prueba",
    startingPriceUsd: 10, currentBidUsd: 10, minIncrementUsd: 2,
    status: "active",
    // 150s: fuera del umbral de anti-sniping (120s), reloj predecible
    endsAt: Timestamp.fromMillis(Date.now() + 150_000),
    bidsCount: 0, currentBidderId: null, currentBidderName: null,
    winnerId: null, orderId: null, sortOrder: null, isDemo: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
};

const A = "test_ret_a_" + Date.now().toString(36);
const B = "test_ret_b_" + Date.now().toString(36);
await crearSubasta(A); await crearSubasta(B);
ok("dos subastas activas", "saldo del comprador " + usd(S));

const PUJA_A = 12;
try {
  const v = await pujar(S_.comprador, A, PUJA_A);
  const w = await billeteraDe(S_.comprador, S_.comprador.uid);
  v.aceptada && w.retenido === PUJA_A
    ? ok("puja líder retiene su monto", usd(PUJA_A) + " apartados · disponible " + usd(w.saldo - w.retenido))
    : mal("puja líder retiene su monto", "aceptada=" + v.aceptada + " retenido=" + w.retenido);
} catch (e) { mal("puja líder retiene su monto", e.message); }

// EL ARREGLO: la segunda puja mira lo disponible, no el saldo total
try {
  const grande = Math.round((S - PUJA_A + 1) * 100) / 100; // cabe en el saldo, NO en lo disponible
  const v = await pujar(S_.comprador, B, grande);
  v.status === "rejected" && v.rejectedReason === "insufficient_funds"
    ? ok("el mismo saldo NO respalda dos pujas", usd(grande) + " > disponible → insufficient_funds")
    : mal("el mismo saldo NO respalda dos pujas", "status=" + v.status + " motivo=" + v.rejectedReason);
} catch (e) { mal("el mismo saldo NO respalda dos pujas", e.message); }

const PUJA_B = Math.round((S - PUJA_A) * 100) / 100; // exactamente lo disponible
try {
  const v = await pujar(S_.comprador, B, PUJA_B);
  const w = await billeteraDe(S_.comprador, S_.comprador.uid);
  v.aceptada && w.retenido === S
    ? ok("hasta lo disponible sí se puede", usd(PUJA_B) + " · todo el saldo respaldando (" + usd(S) + ")")
    : mal("hasta lo disponible sí se puede", "retenido=" + w.retenido + ", esperaba " + S);
} catch (e) { mal("hasta lo disponible sí se puede", e.message); }

// Superado → liberación inmediata, en la transacción de la puja rival
try {
  await httpsCallable(S_.admin.fns, "adjustWallet")({ userId: S_.admin.uid, amountUsd: 50, note: "Fondos de prueba para superar" });
  const v = await pujar(S_.admin, A, 14);
  const w = await billeteraDe(S_.comprador, S_.comprador.uid);
  v.aceptada && w.retenido === PUJA_B
    ? ok("superado = liberado al instante", "la retención bajó a " + usd(w.retenido) + " (solo la puja que sigue viva)")
    : mal("superado = liberado al instante", "retenido=" + w.retenido + ", esperaba " + PUJA_B);
} catch (e) { mal("superado = liberado al instante", e.message); }

// Un débito manual no puede comerse plata retenida
try {
  await httpsCallable(S_.admin.fns, "adjustWallet")({ userId: S_.comprador.uid, amountUsd: -(PUJA_A + 1), note: "no debería" });
  mal("débito manual respeta la retención", "lo dejó");
} catch (e) {
  /failed-precondition/.test(e.code) ? ok("débito manual respeta la retención", "máximo a descontar = saldo − retenido")
    : mal("débito manual respeta la retención", e.code);
}

// ═══════════════════════════════════════════════════════════════
titulo("6. El cierre debita, libera y la orden nace pagada");
try {
  const a = (await getDoc(doc(S_.comprador.db, "auctions", B))).data();
  const falta = a.endsAt.toMillis() - Date.now() + 2000;
  if (falta > 0) { console.log("     esperando " + Math.ceil(falta / 1000) + "s a que venzan…"); await dormir(falta); }
  await httpsCallable(S_.comprador.fns, "closeAuctionNow")({ auctionId: B });
  await httpsCallable(S_.admin.fns, "closeAuctionNow")({ auctionId: A });

  const cerradaB = await esperar(S_.comprador, "auctions/" + B, (d) => d.status !== "active", 60000);
  if (cerradaB.status !== "sold" || !cerradaB.orderId) {
    mal("subasta B cerrada", "status=" + cerradaB.status);
  } else {
    const o = (await getDoc(doc(S_.comprador.db, "orders", cerradaB.orderId))).data();
    o.status === "payment_confirmed" && o.paymentMethod === "wallet"
      ? ok("la orden nace PAGADA con la billetera", "payment_confirmed · " + usd(o.bidAmountUsd))
      : mal("la orden nace PAGADA con la billetera", "status=" + o.status + " método=" + o.paymentMethod);

    const w = await billeteraDe(S_.comprador, S_.comprador.uid);
    w.saldo === PUJA_A && w.retenido === 0
      ? ok("débito y liberación al cierre", usd(S) + " − " + usd(PUJA_B) + " = " + usd(w.saldo) + " · retenido 0")
      : mal("débito y liberación al cierre", "saldo=" + w.saldo + " retenido=" + w.retenido + ", esperaba saldo " + PUJA_A);

    o.sellerReceivesUsd === Math.round((o.bidAmountUsd - o.commissionUsd) * 100) / 100
      ? ok("al vendedor se le liquida precio − comisión", usd(o.sellerReceivesUsd) + " (la plata la tiene la plataforma)")
      : mal("al vendedor se le liquida precio − comisión", "recibe=" + o.sellerReceivesUsd);
  }

  // La retención del admin (ganó A a 14) también se libera al cerrar
  await esperar(S_.admin, "auctions/" + A, (d) => d.status !== "active", 60000);
  const wa = await billeteraDe(S_.admin, S_.admin.uid);
  wa.retenido === 0
    ? ok("la retención del otro ganador también se libera", "admin: saldo " + usd(wa.saldo) + " · retenido 0")
    : mal("la retención del otro ganador también se libera", "retenido=" + wa.retenido);
} catch (e) { mal("cierre con billetera", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("7. Auditoría del ledger");
try {
  const txs = await getDocs(query(collection(S_.comprador.db, "walletTransactions"), where("userId", "==", S_.comprador.uid)));
  const suma = Math.round(txs.docs.reduce((acc, d) => acc + (d.data().amountUsd ?? 0), 0) * 100) / 100;
  const saldo = await saldoDe(S_.comprador, S_.comprador.uid);
  suma === saldo
    ? ok("la suma del ledger ES el saldo", `${txs.size} movimientos → ${usd(suma)}`)
    : mal("la suma del ledger ES el saldo", `suma=${suma} vs saldo=${saldo}`);
} catch (e) { mal("auditoría del ledger", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("8. Se apaga el interruptor (estado de lanzamiento)");
try {
  await setDoc(doc(S_.admin.db, "config", "wallet"), { biddingRequiresBalance: false, updatedAt: serverTimestamp() }, { merge: true });
  const cfg = (await getDoc(doc(S_.admin.db, "config", "wallet"))).data();
  cfg?.biddingRequiresBalance === false
    ? ok("interruptor apagado", "pujar vuelve a ser libre (estado de lanzamiento)")
    : mal("interruptor apagado", JSON.stringify(cfg));
} catch (e) { mal("interruptor apagado", e.message); }

console.log(`\n${"═".repeat(60)}\n  ${n - bad}/${n} pasos bien${bad ? ` · ${bad} FALLARON` : ""}\n${"═".repeat(60)}`);
process.exit(bad ? 1 : 0);
