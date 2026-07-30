// =============================================================
// El show en vivo, de punta a punta
// =============================================================
//   VENDELOO_TEST_PASSWORD=... node packages/rules-tests/show-en-vivo.mjs
//
// Recorre el ciclo completo del corazón del producto contra el proyecto
// real: crear show con cola de productos → startShow activa el primero →
// pujas con timer de segundos → anti-sniping en vivo (una puja en los
// últimos 10s corre el reloj a 30s) → el barrido cierra sola la vencida,
// crea la orden y AVANZA la cola → skipAuction salta la que no tiene
// pujas → endShow cancela lo que quedó en cola y deja que la activa se
// cierre con dignidad.
//
// Dura unos 3-4 minutos de reloj: los timers de un show en vivo son de
// verdad y el barrido rápido corre cada 5s solo mientras hay show live.
// Escribe datos reales (show, subastas, órdenes) con isDemo:true.
// =============================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, collection, updateDoc,
  serverTimestamp, Timestamp, onSnapshot, query, where, orderBy,
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

const S = {};
for (const [rol, mail] of [["vendedor", "vendedor@" + DOMINIO], ["comprador", "comprador@" + DOMINIO], ["admin", "admin@" + DOMINIO]]) {
  const a = initializeApp(CONFIG, rol);
  const { user } = await signInWithEmailAndPassword(getAuth(a), mail, CLAVE);
  S[rol] = { uid: user.uid, db: getFirestore(a), fns: getFunctions(a, "us-central1") };
}

let n = 0, bad = 0;
const ok = (t, d = "") => { n++; console.log(`  ✓ ${t}${d ? "  — " + d : ""}`); };
const mal = (t, d) => { n++; bad++; console.log(`  ✗ ${t}\n      ${d}`); };
const titulo = (t) => console.log(`\n── ${t} ──`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function esperar(s, ruta, cumple, ms = 90000) {
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
  const v = await esperar(s, `pendingBids/${ref.id}`, (d) => d.status !== "pending", 30000);
  return { ...v, aceptada: v.status === "processed" };
}

// ═══════════════════════════════════════════════════════════════
titulo("1. El vendedor arma el show");
const SHOW = `test_show_${Date.now().toString(36)}`;
const TIMER = 25; // >10s del umbral de anti-sniping, corto para la prueba
await setDoc(doc(S.vendedor.db, "shows", SHOW), {
  sellerId: S.vendedor.uid, sellerName: "Tienda Prueba",
  title: "Show de prueba de punta a punta", description: "",
  status: "scheduled", agoraChannelName: `show_${Date.now()}`,
  scheduledAt: Timestamp.fromMillis(Date.now() + 3600_000),
  viewerCount: 0, currentAuctionId: null,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});
ok("show creado", SHOW);

// Cuatro destinos distintos: vendida por timer, saltada, vendida tras
// endShow, y cancelada por endShow.
const A = [];
for (let i = 0; i < 4; i++) {
  const id = `${SHOW}_p${i}`;
  await setDoc(doc(S.vendedor.db, "auctions", id), {
    mode: "live", showId: SHOW,
    title: `Producto ${i + 1} del show`, description: "", category: "Electronica",
    imageURL: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    imageURLs: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"],
    sellerId: S.vendedor.uid, sellerName: "Tienda Prueba",
    startingPriceUsd: 5 + i, currentBidUsd: 5 + i, minIncrementUsd: 1,
    status: "waiting", sortOrder: i, timerSeconds: TIMER,
    endsAt: null, bidsCount: 0, currentBidderId: null, currentBidderName: null,
    winnerId: null, orderId: null, isDemo: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  A.push(id);
}
ok("cola armada", `4 productos en waiting, timer ${TIMER}s`);

// ═══════════════════════════════════════════════════════════════
titulo("2. Antes de arrancar");
try {
  const v = await pujar(S.comprador, A[0], 6);
  v.status === "rejected" && ["auction_closed", "show_not_live"].includes(v.rejectedReason)
    ? ok("no se puede pujar en cola", `rejectedReason: ${v.rejectedReason}`)
    : mal("no se puede pujar en cola", `status=${v.status} motivo=${v.rejectedReason}`);
} catch (e) { mal("no se puede pujar en cola", e.message); }

try {
  await addDoc(collection(S.comprador.db, "shows", SHOW, "messages"), {
    showId: SHOW, authorId: S.comprador.uid, authorName: "Comprador Prueba",
    type: "chat", text: "hola", createdAt: serverTimestamp(),
  });
  mal("chat cerrado antes del vivo", "dejó escribir");
} catch { ok("chat cerrado antes del vivo", "permission-denied"); }

try {
  await httpsCallable(S.comprador.fns, "startShow")({ showId: SHOW });
  mal("solo el dueño arranca el show", "lo dejó");
} catch (e) {
  /permission-denied/.test(e.code) ? ok("solo el dueño arranca el show", "permission-denied")
    : mal("solo el dueño arranca el show", e.code);
}

// ═══════════════════════════════════════════════════════════════
titulo("3. startShow");
await httpsCallable(S.vendedor.fns, "startShow")({ showId: SHOW });
const showLive = await esperar(S.comprador, `shows/${SHOW}`, (d) => d.status === "live", 20000);
showLive.currentAuctionId === A[0]
  ? ok("show en vivo", `currentAuctionId = ${A[0]}`)
  : mal("show en vivo", `currentAuctionId=${showLive.currentAuctionId}`);

const a0 = await esperar(S.comprador, `auctions/${A[0]}`, (d) => d.status === "active", 15000);
const restante0 = Math.round((a0.endsAt.toMillis() - Date.now()) / 1000);
restante0 > 0 && restante0 <= TIMER + 3
  ? ok("primer producto activo", `cierra en ${restante0}s`)
  : mal("primer producto activo", `restante=${restante0}s`);

try {
  await addDoc(collection(S.comprador.db, "shows", SHOW, "messages"), {
    showId: SHOW, authorId: S.comprador.uid, authorName: "Comprador Prueba",
    type: "chat", text: "¡Empezó! 🔥", createdAt: serverTimestamp(),
  });
  ok("chat abierto en vivo");
} catch (e) { mal("chat abierto en vivo", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("4. Pujas con el reloj corriendo");
try {
  const v = await pujar(S.comprador, A[0], 6);
  v.aceptada ? ok("puja en vivo aceptada", "$6.00") : mal("puja en vivo aceptada", v.rejectedReason);
} catch (e) { mal("puja en vivo aceptada", e.message); }

// Anti-sniping: esperar a que falten <10s y pujar de nuevo
{
  const a = (await getDoc(doc(S.admin.db, "auctions", A[0]))).data();
  const falta = a.endsAt.toMillis() - Date.now();
  if (falta > 9000) { console.log(`     esperando ${Math.round((falta - 8000) / 1000)}s para entrar en la ventana de sniping…`); await dormir(falta - 8000); }
  try {
    const antes = (await getDoc(doc(S.admin.db, "auctions", A[0]))).data().endsAt.toMillis();
    const v = await pujar(S.admin, A[0], 7);
    const despues = (await getDoc(doc(S.admin.db, "auctions", A[0]))).data().endsAt.toMillis();
    const ext = Math.round((despues - Date.now()) / 1000);
    v.aceptada && despues > antes && ext >= 20
      ? ok("anti-sniping en vivo", `puja a ${Math.round((antes - Date.now()) / 1000) + Math.round((despues - antes) / 1000)}s del final → el reloj saltó a ${ext}s`)
      : mal("anti-sniping en vivo", `aceptada=${v.aceptada} antes=${antes} después=${despues}`);
  } catch (e) { mal("anti-sniping en vivo", e.message); }
}

// ═══════════════════════════════════════════════════════════════
titulo("5. El barrido cierra y avanza la cola solo");
// Nadie llama a nada: el motor tiene que cerrar la vencida, crear la
// orden, anunciar en el chat y activar el siguiente producto.
let ordenA0 = null;
try {
  const cerrada = await esperar(S.comprador, `auctions/${A[0]}`, (d) => d.status !== "active", 100000);
  cerrada.status === "sold" && cerrada.winnerId === S.admin.uid && cerrada.orderId
    ? ok("vencida cerrada por el barrido", `sold · ganó admin · orden ${cerrada.orderId}`)
    : mal("vencida cerrada por el barrido", `status=${cerrada.status} winner=${cerrada.winnerId}`);
  ordenA0 = cerrada.orderId;
} catch (e) { mal("vencida cerrada por el barrido", e.message); }

try {
  const show = await esperar(S.comprador, `shows/${SHOW}`, (d) => d.currentAuctionId === A[1], 30000);
  const a1 = (await getDoc(doc(S.comprador.db, "auctions", A[1]))).data();
  a1.status === "active"
    ? ok("la cola avanzó sola", `ahora al frente: ${A[1]}`)
    : mal("la cola avanzó sola", `A1 status=${a1.status}`);
} catch (e) { mal("la cola avanzó sola", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("6. skipAuction");
try {
  await httpsCallable(S.comprador.fns, "skipAuction")({ showId: SHOW, auctionId: A[1] });
  mal("solo el dueño salta", "lo dejó");
} catch (e) { /permission-denied/.test(e.code) ? ok("solo el dueño salta", "permission-denied") : mal("solo el dueño salta", e.code); }

try {
  await httpsCallable(S.vendedor.fns, "skipAuction")({ showId: SHOW, auctionId: A[1] });
  const a1 = await esperar(S.comprador, `auctions/${A[1]}`, (d) => d.status === "skipped", 15000);
  ok("producto sin pujas saltado", "skipped");
} catch (e) { mal("producto sin pujas saltado", e.message); }

try {
  const a2 = await esperar(S.comprador, `auctions/${A[2]}`, (d) => d.status === "active", 15000);
  ok("el siguiente entró al frente", A[2]);
} catch (e) { mal("el siguiente entró al frente", e.message); }

// Con una puja encima ya no se puede saltar
try {
  const v = await pujar(S.comprador, A[2], 8);
  if (!v.aceptada) mal("puja en el tercero", v.rejectedReason);
  await httpsCallable(S.vendedor.fns, "skipAuction")({ showId: SHOW, auctionId: A[2] });
  mal("con pujas no se salta", "lo dejó");
} catch (e) {
  /failed-precondition/.test(e.code) ? ok("con pujas no se salta", "failed-precondition")
    : mal("con pujas no se salta", e.code ?? e.message);
}

// ═══════════════════════════════════════════════════════════════
titulo("7. endShow");
// La activa (A2, con puja del comprador) debe quedar viva para cerrarse
// sola; la que estaba en cola (A3) se cancela.
try {
  const r = await httpsCallable(S.vendedor.fns, "endShow")({ showId: SHOW });
  r.data.cancelled === 1 ? ok("show terminado", "1 cancelada (la que quedó en cola)")
    : mal("show terminado", `cancelled=${r.data.cancelled}`);
} catch (e) { mal("show terminado", e.message); }

try {
  const a3 = (await getDoc(doc(S.comprador.db, "auctions", A[3]))).data();
  a3.status === "cancelled" ? ok("la de la cola quedó cancelada") : mal("la de la cola quedó cancelada", a3.status);
} catch (e) { mal("la de la cola quedó cancelada", e.message); }

try {
  const a2 = (await getDoc(doc(S.comprador.db, "auctions", A[2]))).data();
  if (a2.status !== "active") { mal("la activa sobrevive al endShow", `status=${a2.status}`); }
  else {
    ok("la activa sobrevive al endShow", "sigue active con la puja del comprador");
    // Ya sin show live el barrido de 5s se apaga; el cierre inmediato es
    // el camino del cliente para no esperar el tick del minuto.
    const falta = a2.endsAt.toMillis() - Date.now();
    if (falta > 0) { console.log(`     esperando ${Math.ceil(falta / 1000)}s a que venza…`); await dormir(falta + 1500); }
    await httpsCallable(S.comprador.fns, "closeAuctionNow")({ auctionId: A[2] });
    const cerrada = await esperar(S.comprador, `auctions/${A[2]}`, (d) => d.status !== "active", 30000);
    cerrada.status === "sold" && cerrada.winnerId === S.comprador.uid
      ? ok("la activa se vendió después del endShow", `orden ${cerrada.orderId}`)
      : mal("la activa se vendió después del endShow", `status=${cerrada.status}`);
  }
} catch (e) { mal("la activa sobrevive al endShow", e.message); }

// ═══════════════════════════════════════════════════════════════
titulo("8. El rastro del show");
try {
  const msgs = await getDocs(query(
    collection(S.comprador.db, "shows", SHOW, "messages"), orderBy("createdAt", "asc")));
  const textos = msgs.docs.map((d) => d.data());
  const gano = textos.some((m) => m.type === "auction_won" && /🏆/.test(m.text));
  const salto = textos.some((m) => m.type === "system" && /⏭/.test(m.text));
  const chat = textos.some((m) => m.type === "chat");
  gano && salto && chat
    ? ok("el chat cuenta la historia", `${msgs.size} mensajes: chat + 🏆 ganador + ⏭ salto`)
    : mal("el chat cuenta la historia", `won=${gano} skip=${salto} chat=${chat}`);
} catch (e) { mal("el chat cuenta la historia", e.message); }

try {
  const show = (await getDoc(doc(S.comprador.db, "shows", SHOW))).data();
  show.status === "ended" && show.endedAt && show.currentAuctionId === null
    ? ok("show cerrado y limpio", "ended · sin subasta al frente")
    : mal("show cerrado y limpio", `status=${show.status}`);
} catch (e) { mal("show cerrado y limpio", e.message); }

if (ordenA0) {
  try {
    const o = (await getDoc(doc(S.admin.db, "orders", ordenA0))).data();
    o.status === "pending_payment" && o.buyerId === S.admin.uid && o.showId === SHOW
      ? ok("orden del show correcta", `$${o.bidAmountUsd} · showId enlazado`)
      : mal("orden del show correcta", JSON.stringify({ status: o.status, buyer: o.buyerId }));
  } catch (e) { mal("orden del show correcta", e.message); }
}

console.log(`\n${"═".repeat(60)}\n  ${n - bad}/${n} pasos bien${bad ? ` · ${bad} FALLARON` : ""}\n  show ${SHOW}\n${"═".repeat(60)}`);
process.exit(bad ? 1 : 0);
