// =============================================================
// Retirar y cancelar una venta
// =============================================================
// Dos operaciones con la misma función y reglas muy distintas:
//   · el vendedor RETIRA solo si nadie ofertó
//   · el admin CANCELA con motivo, y eso libera la retención del líder
// Lo que se prueba de verdad es que el dinero retenido vuelva a estar
// disponible, porque ese era el agujero: sin cancelar, el saldo del que
// iba ganando quedaba secuestrado hasta el endsAt (hasta 7 días).
//
//   pnpm --filter @vendeloo/rules-tests test:cancelar
// =============================================================

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, connectAuthEmulator, signInWithCustomToken } from "firebase/auth";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const PROYECTO = process.env.GCLOUD_PROJECT ?? "demo-vendeloo";

admin.initializeApp({ projectId: PROYECTO });
const db = admin.firestore();

const cliente = initializeApp({ apiKey: "fake", projectId: PROYECTO }, "cancelar-test");
const auth = getAuth(cliente);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const fns = getFunctions(cliente, "us-central1");
connectFunctionsEmulator(fns, "127.0.0.1", 5001);

const VENDEDOR = "cancel_vendedor";
const COMPRADOR = "cancel_comprador";
const ADMIN = "cancel_admin";

async function entrarComo(uid) {
  const token = await admin.auth().createCustomToken(uid);
  await signInWithCustomToken(auth, token);
}

const cancelar = (payload) => httpsCallable(fns, "cancelAuction")(payload);

async function sembrarSubasta(id, extra = {}) {
  await db.doc(`auctions/${id}`).set({
    id, title: "Artículo de prueba", sellerId: VENDEDOR, sellerName: "Vendedor",
    mode: "standalone", showId: null, status: "active",
    startingPriceUsd: 10, currentBidUsd: 10, minIncrementUsd: 1,
    bidsCount: 0, currentBidderId: null, winnerId: null, orderId: null,
    endsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 86400_000),
    ...extra,
  });
}

before(async () => {
  for (const [uid, datos] of [
    [VENDEDOR, { role: "seller", sellerStatus: "approved", displayName: "Vendedor" }],
    [COMPRADOR, { role: "buyer", sellerStatus: "none", displayName: "Comprador" }],
    [ADMIN, { role: "admin", sellerStatus: "approved", displayName: "Admin" }],
  ]) {
    await db.doc(`users/${uid}`).set({ uid, ...datos });
  }
});

after(async () => { await auth.signOut().catch(() => {}); });

describe("Retirar (vendedor, sin ofertas)", () => {
  test("el vendedor retira su publicación si nadie ofertó", async () => {
    await sembrarSubasta("cancel_a1");
    await entrarComo(VENDEDOR);
    const r = await cancelar({ auctionId: "cancel_a1" });
    assert.equal(r.data.modo, "retirada");
    const d = (await db.doc("auctions/cancel_a1").get()).data();
    assert.equal(d.status, "cancelled");
  });

  test("con ofertas NO puede retirarla: una oferta es un compromiso", async () => {
    await sembrarSubasta("cancel_a2", { bidsCount: 1, currentBidderId: COMPRADOR, currentBidUsd: 15 });
    await entrarComo(VENDEDOR);
    await assert.rejects(() => cancelar({ auctionId: "cancel_a2" }), /oferta|compromiso/i);
    const d = (await db.doc("auctions/cancel_a2").get()).data();
    assert.equal(d.status, "active", "la subasta debe seguir viva");
  });

  test("un tercero no puede tocar la publicación de otro", async () => {
    await sembrarSubasta("cancel_a3");
    await entrarComo(COMPRADOR);
    await assert.rejects(() => cancelar({ auctionId: "cancel_a3" }), /tu publicación|permission/i);
  });
});

describe("Cancelar (admin) libera el dinero retenido", () => {
  test("el admin cancela con motivo y el saldo del líder vuelve a estar disponible", async () => {
    await db.doc(`wallets/${COMPRADOR}`).set({ userId: COMPRADOR, balanceUsd: 50, heldUsd: 20 });
    await sembrarSubasta("cancel_a4", { bidsCount: 1, currentBidderId: COMPRADOR, currentBidUsd: 20 });

    await entrarComo(ADMIN);
    const r = await cancelar({ auctionId: "cancel_a4", reason: "Artículo no permitido" });
    assert.equal(r.data.modo, "cancelada");
    assert.equal(r.data.liberadoUsd, 20);

    const w = (await db.doc(`wallets/${COMPRADOR}`).get()).data();
    assert.equal(w.heldUsd, 0, "la retención debe quedar liberada");
    assert.equal(w.balanceUsd, 50, "el saldo no se toca: no es un cobro");

    const d = (await db.doc("auctions/cancel_a4").get()).data();
    assert.equal(d.status, "cancelled");
    assert.equal(d.cancelledReason, "Artículo no permitido");
  });

  test("el admin no puede cancelar sin motivo", async () => {
    await sembrarSubasta("cancel_a5");
    await entrarComo(ADMIN);
    await assert.rejects(() => cancelar({ auctionId: "cancel_a5" }), /motivo/i);
  });

  test("una subasta ya cerrada no se cancela dos veces", async () => {
    await sembrarSubasta("cancel_a6", { status: "sold" });
    await entrarComo(ADMIN);
    await assert.rejects(() => cancelar({ auctionId: "cancel_a6", reason: "prueba" }), /ya está/i);
  });
});
