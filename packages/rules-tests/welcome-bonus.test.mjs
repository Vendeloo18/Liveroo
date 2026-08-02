import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

test("el bono acredita $1 una sola vez por UID y el cliente no puede editarlo", async () => {
  const projectId = "demo-vendeloo";
  const app = initializeApp({
    projectId,
    apiKey: "demo-key",
    appId: "demo-app",
    authDomain: `${projectId}.firebaseapp.com`,
  });

  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);

    const credential = await createUserWithEmailAndPassword(
      auth,
      `bonus-${Date.now()}@vendeloo.test`,
      "Prueba123!"
    );
    const uid = credential.user.uid;
    await credential.user.getIdToken(true);

    await setDoc(doc(db, "users", uid), {
      uid,
      email: credential.user.email,
      displayName: "Prueba Bono",
      role: "buyer",
      sellerStatus: "none",
      ratingAvg: 0,
      ratingCount: 0,
      totalSales: 0,
      totalPurchases: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const functions = getFunctions(app, "us-central1");
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    const claim = httpsCallable(functions, "claimWelcomeBonus");

    const first = await claim({});
    assert.equal(first.data.status, "awarded");
    assert.equal(first.data.awardedUsd, 1);
    assert.equal(first.data.balanceUsd, 1);

    const second = await claim({});
    assert.equal(second.data.status, "already_claimed");
    assert.equal(second.data.awardedUsd, 0);
    assert.equal(second.data.balanceUsd, 1);

    const wallet = (await getDoc(doc(db, "wallets", uid))).data();
    assert.equal(wallet.balanceUsd, 1);

    const movement = (
      await getDoc(doc(db, "walletTransactions", `welcome_bonus_${uid}`))
    ).data();
    assert.equal(movement.type, "welcome_bonus");
    assert.equal(movement.promotional, true);
    assert.equal(movement.withdrawable, false);
    assert.equal(movement.amountUsd, 1);

    await assert.rejects(
      updateDoc(doc(db, "wallets", uid), { balanceUsd: 1000 })
    );
  } finally {
    await deleteApp(app);
  }
});
