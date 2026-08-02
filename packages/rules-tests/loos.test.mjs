// =============================================================
// LOOS de punta a punta, contra el emulador
// =============================================================
// Lo que se prueba aquí es lo único que puede salir caro: que entregar
// una orden acredite a ambas partes UNA vez, que reprocesar el mismo
// evento no regale puntos, y que canjear descuente de verdad.
//
//   pnpm --filter @vendeloo/rules-tests test:loos
// =============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { cert, initializeApp as initAdmin, deleteApp as deleteAdmin } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const PROJECT = "demo-vendeloo";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Los triggers son asíncronos: hay que darles unos segundos. */
async function esperarDoc(adminDb, ruta, intentos = 40) {
  for (let i = 0; i < intentos; i += 1) {
    const snap = await adminDb.doc(ruta).get();
    if (snap.exists) return snap.data();
    await esperar(250);
  }
  throw new Error(`El documento ${ruta} nunca apareció`);
}

const perfilBase = (uid, extra = {}) => ({
  uid,
  email: `${uid}@vendeloo.test`,
  displayName: uid,
  role: "buyer",
  sellerStatus: "none",
  ratingAvg: 0,
  ratingCount: 0,
  totalSales: 0,
  totalPurchases: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

test("entregar una orden acredita a las dos partes una sola vez, y el canje descuenta", async () => {
  const adminApp = initAdmin({ projectId: PROJECT }, `loos-${Date.now()}`);
  const adminDb = getAdminFirestore(adminApp);

  const app = initializeApp({
    projectId: PROJECT,
    apiKey: "demo-key",
    appId: "demo-app",
    authDomain: `${PROJECT}.firebaseapp.com`,
  }, `cliente-loos-${Date.now()}`);

  try {
    const auth = getAuth(app);
    const clientDb = getFirestore(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);

    // El comprador tiene que ser un usuario de Auth real: el canje es un
    // callable y necesita su sesión.
    const cred = await createUserWithEmailAndPassword(
      auth, `loos-${Date.now()}@vendeloo.test`, "Prueba123!",
    );
    const buyerId = cred.user.uid;
    const sellerId = `seller_loos_${Date.now()}`;
    const orderId = `orden_loos_${Date.now()}`;

    await adminDb.doc(`users/${buyerId}`).set(perfilBase(buyerId, { whatsapp: "+584140000001" }));
    await adminDb.doc(`users/${sellerId}`).set(perfilBase(sellerId, {
      role: "seller", sellerStatus: "approved", whatsapp: "+584140000002",
    }));

    // La orden nace enviada y pasa a entregada: ese salto es el que
    // dispara onOrderDelivered.
    await adminDb.doc(`orders/${orderId}`).set({
      id: orderId, buyerId, sellerId,
      buyerName: "Comprador", sellerName: "Vendedor",
      bidAmountUsd: 200, status: "shipped",
      createdAt: new Date(), updatedAt: new Date(),
    });
    await adminDb.doc(`orders/${orderId}`).update({ status: "delivered", updatedAt: new Date() });

    const movComprador = await esperarDoc(adminDb, `loosTxs/order_${orderId}_buyer`);
    await esperarDoc(adminDb, `loosTxs/order_${orderId}_seller`);
    await esperarDoc(adminDb, `loosTxs/firstpurchase_${buyerId}`);
    await esperarDoc(adminDb, `loosTxs/firstsale_${sellerId}`);

    assert.equal(movComprador.amount, 200, "1 LOO por dólar al comprador");
    assert.equal(movComprador.type, "order_buyer");

    // $200 + bono de primera compra (50) = 250; el vendedor, +100 de bono.
    const comprador = (await adminDb.doc(`users/${buyerId}`).get()).data();
    const vendedor = (await adminDb.doc(`users/${sellerId}`).get()).data();
    assert.equal(comprador.loos, 250);
    assert.equal(comprador.loosLifetime, 250);
    assert.equal(vendedor.loos, 300);

    // ── Reproceso: el trigger es at-least-once ────────────────
    // Volver a pasar la orden por 'delivered' vuelve a disparar la
    // Function. Los IDs determinísticos deben absorberlo sin sumar nada.
    await adminDb.doc(`orders/${orderId}`).update({ status: "shipped", updatedAt: new Date() });
    await adminDb.doc(`orders/${orderId}`).update({ status: "delivered", updatedAt: new Date() });
    await esperar(3000);

    const compradorOtraVez = (await adminDb.doc(`users/${buyerId}`).get()).data();
    assert.equal(compradorOtraVez.loos, 250, "reprocesar la entrega NO regala puntos");

    // ── Canje ─────────────────────────────────────────────────
    const functions = getFunctions(app, "us-central1");
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    const canjear = httpsCallable(functions, "redeemPrize");

    const r = await canjear({ prizeId: "llavero" });
    assert.equal(r.data.loosCost, 150);
    assert.equal(r.data.loos, 100, "descuenta del saldo, no del acumulado");

    const trasCanje = (await adminDb.doc(`users/${buyerId}`).get()).data();
    assert.equal(trasCanje.loos, 100);
    assert.equal(trasCanje.loosLifetime, 250, "lo ganado de por vida no baja al canjear");

    const canje = (await getDoc(doc(clientDb, "redemptions", r.data.redemptionId))).data();
    assert.equal(canje.status, "pending");
    assert.equal(canje.prizeId, "llavero");

    // Sin saldo suficiente, el segundo canje se cae
    await assert.rejects(canjear({ prizeId: "llavero" }), /faltan/i);
    // Y un premio apagado no se puede pedir aunque sobren puntos
    await assert.rejects(canjear({ prizeId: "camisa" }), /disponible/i);
  } finally {
    await deleteApp(app);
    await deleteAdmin(adminApp);
  }
});
