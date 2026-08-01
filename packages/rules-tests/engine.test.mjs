// =============================================================
// Pruebas del motor de subastas contra los emuladores
// =============================================================
// Levanta Firestore + Functions de verdad y dispara pujas
// SIMULTÁNEAS para comprobar que no se pisan entre sí.
//
//   pnpm --filter @vendeloo/rules-tests test:engine
//
// Reglas desactivadas a propósito (FIRESTORE_EMULATOR_HOST + admin):
// aquí no se prueba quién puede escribir —eso es firestore.test.mjs—
// sino qué hace el motor cuando le llegan pujas al mismo tiempo.
// =============================================================

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const PROYECTO = process.env.GCLOUD_PROJECT ?? "demo-vendeloo";

admin.initializeApp({ projectId: PROYECTO });
const db = admin.firestore();

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

/** Espera a que todas las pujas pendientes salgan de "pending". */
async function esperarVeredictos(ids, timeoutMs = 25_000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    const docs = await Promise.all(ids.map(id => db.doc(`pendingBids/${id}`).get()));
    const estados = docs.map(d => d.data()?.status);
    if (estados.every(s => s && s !== "pending")) return estados;
    await esperar(400);
  }
  const docs = await Promise.all(ids.map(id => db.doc(`pendingBids/${id}`).get()));
  const estados = docs.map(d => d.data()?.status);
  throw new Error(`Timeout: quedaron pujas sin veredicto → ${JSON.stringify(estados)}`);
}

async function esperarSubasta(auctionId, cumple, timeoutMs = 20_000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    const snap = await db.doc(`auctions/${auctionId}`).get();
    const data = snap.data();
    if (data && cumple(data)) return data;
    await esperar(200);
  }
  throw new Error(`Timeout esperando auctions/${auctionId}`);
}

async function limpiar() {
  for (const col of ["auctions", "pendingBids", "users", "shows", "orders", "config", "exchangeRates"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map(async d => {
      for (const sub of ["bids", "messages"]) {
        const ss = await d.ref.collection(sub).get();
        await Promise.all(ss.docs.map(x => x.ref.delete()));
      }
      await d.ref.delete();
    }));
  }
}

/** Crea N compradores y una subasta suelta activa. */
async function montarEscenario({ postores, startingPrice = 20, minIncrement = 1 }) {
  const lote = db.batch();

  lote.set(db.doc("exchangeRates/current"), { usdToBs: 100, source: "test" });
  lote.set(db.doc("config/commission"), { mode: "seller_collects", platformFeePct: 10 });
  lote.set(db.doc("config/wallet"), { biddingRequiresBalance: false });
  lote.set(db.doc("users/vendedor"), {
    uid: "vendedor", displayName: "VendedorVE", role: "seller", sellerStatus: "approved",
  });
  for (let i = 0; i < postores; i++) {
    lote.set(db.doc(`users/postor${i}`), {
      uid: `postor${i}`, displayName: `Postor ${i}`, role: "buyer", sellerStatus: "none",
    });
  }

  lote.set(db.doc("auctions/sub"), {
    id: "sub", title: "Tenis de prueba", mode: "standalone", showId: null,
    sellerId: "vendedor", sellerName: "VendedorVE",
    startingPriceUsd: startingPrice, currentBidUsd: startingPrice, minIncrementUsd: minIncrement,
    status: "active", bidsCount: 0, currentBidderId: null, currentBidderName: null,
    winnerId: null, orderId: null,
    endsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 3600_000),
    createdAt: admin.firestore.Timestamp.now(),
  });

  await lote.commit();
}

/** Dispara pujas en paralelo real (un solo commit por puja, sin await entre ellas). */
async function pujarEnParalelo(montos) {
  const refs = montos.map(() => db.collection("pendingBids").doc());
  await Promise.all(refs.map((ref, i) =>
    ref.set({
      auctionId: "sub",
      bidderId: `postor${i}`,
      amountUsd: montos[i],
      status: "pending",
      submittedAt: admin.firestore.Timestamp.now(),
    })
  ));
  return refs.map(r => r.id);
}

before(async () => { await limpiar(); });
after(async () => { await admin.app().delete(); });

// =============================================================

describe("Pujas simultáneas", () => {

  test("cinco pujas idénticas al mismo tiempo: gana una, las otras cuatro quedan rechazadas", async () => {
    await limpiar();
    await montarEscenario({ postores: 5 });

    const ids = await pujarEnParalelo([25, 25, 25, 25, 25]);
    const estados = await esperarVeredictos(ids);

    const aceptadas = estados.filter(s => s === "processed").length;
    const rechazadas = estados.filter(s => s === "rejected").length;

    assert.equal(aceptadas, 1, `debería aceptarse exactamente una, se aceptaron ${aceptadas}`);
    assert.equal(rechazadas, 4, `deberían rechazarse cuatro, se rechazaron ${rechazadas}`);

    // Ninguna puede quedarse en "pending": el comprador se queda esperando para siempre
    assert.ok(!estados.includes("pending"), "quedó una puja sin veredicto");
  });

  test("el estado de la subasta queda consistente con las pujas aceptadas", async () => {
    const sub = (await db.doc("auctions/sub").get()).data();
    const bids = await db.collection("auctions/sub/bids").get();

    assert.equal(sub.currentBidUsd, 25, "el precio debe ser el de la puja ganadora");
    assert.equal(sub.bidsCount, 1, `bidsCount debe ser 1, es ${sub.bidsCount}`);
    assert.equal(bids.size, 1, `debe haber una sola puja registrada, hay ${bids.size}`);
    assert.ok(sub.currentBidderId, "debe quedar un líder");
    assert.equal(bids.docs[0].data().bidderId, sub.currentBidderId,
      "el líder y la puja registrada deben ser la misma persona");
  });

  test("pujas escalonadas a la vez: el precio final es la más alta y nada se pierde", async () => {
    await limpiar();
    await montarEscenario({ postores: 5 });

    const ids = await pujarEnParalelo([21, 22, 23, 24, 25]);
    const estados = await esperarVeredictos(ids);

    assert.ok(!estados.includes("pending"), "quedó una puja sin veredicto");

    const sub = (await db.doc("auctions/sub").get()).data();
    const bids = await db.collection("auctions/sub/bids").get();
    const aceptadas = estados.filter(s => s === "processed").length;

    // Cada aceptada deja exactamente una fila y suma uno al contador
    assert.equal(bids.size, aceptadas, `bids=${bids.size} vs aceptadas=${aceptadas}`);
    assert.equal(sub.bidsCount, aceptadas, `bidsCount=${sub.bidsCount} vs aceptadas=${aceptadas}`);

    // El precio mostrado es el de la puja más alta que sobrevivió
    const maxAceptada = Math.max(...bids.docs.map(d => d.data().amountUsd));
    assert.equal(sub.currentBidUsd, maxAceptada,
      `el precio (${sub.currentBidUsd}) debe ser la puja más alta aceptada (${maxAceptada})`);

    // Toda aceptada respetó el incremento mínimo sobre la anterior
    const ordenadas = bids.docs.map(d => d.data().amountUsd).sort((a, b) => a - b);
    for (let i = 1; i < ordenadas.length; i++) {
      assert.ok(ordenadas[i] >= ordenadas[i - 1] + 1,
        `dos pujas aceptadas violan el incremento mínimo: ${ordenadas[i - 1]} → ${ordenadas[i]}`);
    }
  });

  test("nadie puede superarse a sí mismo aunque dispare dos veces a la vez", async () => {
    await limpiar();
    await montarEscenario({ postores: 1 });

    const refs = [db.collection("pendingBids").doc(), db.collection("pendingBids").doc()];
    await Promise.all(refs.map(ref => ref.set({
      auctionId: "sub", bidderId: "postor0", amountUsd: 30,
      status: "pending", submittedAt: admin.firestore.Timestamp.now(),
    })));

    const estados = await esperarVeredictos(refs.map(r => r.id));
    const aceptadas = estados.filter(s => s === "processed").length;

    assert.equal(aceptadas, 1, `una sola debe pasar, pasaron ${aceptadas}`);
    const sub = (await db.doc("auctions/sub").get()).data();
    assert.equal(sub.bidsCount, 1);
    assert.equal(sub.currentBidUsd, 30);
  });

  test("una puja por debajo del mínimo se rechaza con motivo claro", async () => {
    await limpiar();
    await montarEscenario({ postores: 1, startingPrice: 20, minIncrement: 5 });

    const ref = db.collection("pendingBids").doc();
    await ref.set({
      auctionId: "sub", bidderId: "postor0", amountUsd: 19,
      status: "pending", submittedAt: admin.firestore.Timestamp.now(),
    });

    await esperarVeredictos([ref.id]);
    const d = (await ref.get()).data();

    assert.equal(d.status, "rejected");
    assert.equal(d.rejectedReason, "too_low");
  });

  test("una puja sobre una subasta ya cerrada se rechaza", async () => {
    await limpiar();
    await montarEscenario({ postores: 1 });
    await db.doc("auctions/sub").update({ status: "sold" });

    const ref = db.collection("pendingBids").doc();
    await ref.set({
      auctionId: "sub", bidderId: "postor0", amountUsd: 50,
      status: "pending", submittedAt: admin.firestore.Timestamp.now(),
    });

    await esperarVeredictos([ref.id]);
    const d = (await ref.get()).data();

    assert.equal(d.status, "rejected");
    assert.equal(d.rejectedReason, "auction_closed");
  });

  test("el vendedor no puede pujar en su propia subasta", async () => {
    await limpiar();
    await montarEscenario({ postores: 1 });

    const ref = db.collection("pendingBids").doc();
    await ref.set({
      auctionId: "sub", bidderId: "vendedor", amountUsd: 50,
      status: "pending", submittedAt: admin.firestore.Timestamp.now(),
    });

    await esperarVeredictos([ref.id]);
    const d = (await ref.get()).data();

    assert.equal(d.status, "rejected");
    assert.equal(d.rejectedReason, "own_bid");
  });
});

describe("Anti-sniping", () => {
  test("una puja en los últimos segundos estira el cierre", async () => {
    await limpiar();
    await montarEscenario({ postores: 1 });

    // Faltan 5s: por debajo del umbral de 120s de las subastas sueltas
    const finOriginal = admin.firestore.Timestamp.fromMillis(Date.now() + 5000);
    await db.doc("auctions/sub").update({ endsAt: finOriginal });

    const ref = db.collection("pendingBids").doc();
    await ref.set({
      auctionId: "sub", bidderId: "postor0", amountUsd: 25,
      status: "pending", submittedAt: admin.firestore.Timestamp.now(),
    });

    await esperarVeredictos([ref.id]);
    const sub = (await db.doc("auctions/sub").get()).data();

    assert.equal((await ref.get()).data().status, "processed");
    assert.ok(
      sub.endsAt.toMillis() > finOriginal.toMillis(),
      "el cierre debió estirarse para que no gane quien dispara en el último segundo"
    );
  });
});

describe("Cierre exacto con Cloud Tasks", () => {
  test("una subasta sin pujas se cierra segundos después de endsAt", async () => {
    await limpiar();
    await montarEscenario({ postores: 0 });

    const endsAtMs = Date.now() + 1_500;
    await db.doc("auctions/sub").update({
      endsAt: admin.firestore.Timestamp.fromMillis(endsAtMs),
    });

    const cerrada = await esperarSubasta("sub", (a) => a.status !== "active");
    assert.equal(cerrada.status, "unsold");
    assert.ok(Date.now() >= endsAtMs, "no puede cerrar antes del endsAt");
    assert.ok(Date.now() - endsAtMs < 6_000, "el cierre exacto se retrasó más de 6s");
  });

  test("una tarea vieja no cierra una subasta cuyo reloj fue extendido", async () => {
    await limpiar();
    await montarEscenario({ postores: 0 });

    const primerFin = Date.now() + 2_000;
    await db.doc("auctions/sub").update({
      endsAt: admin.firestore.Timestamp.fromMillis(primerFin),
    });
    await esperar(500);

    const finExtendido = Date.now() + 4_500;
    await db.doc("auctions/sub").update({
      endsAt: admin.firestore.Timestamp.fromMillis(finExtendido),
    });

    await esperar(Math.max(0, primerFin + 1_500 - Date.now()));
    const todaviaActiva = (await db.doc("auctions/sub").get()).data();
    assert.equal(todaviaActiva.status, "active", "la tarea vieja cerró antes del reloj nuevo");

    const cerrada = await esperarSubasta("sub", (a) => a.status !== "active");
    assert.equal(cerrada.status, "unsold");
    assert.ok(Date.now() >= finExtendido, "la tarea nueva cerró antes de tiempo");
  });
});
