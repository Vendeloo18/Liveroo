// =============================================================
// Prueba de capacidad del motor — solo emuladores
// =============================================================
// Objetivo por defecto: 100 subastas y 2.000 compradores pujando a la vez.
// No mide la red de Google ni Agora; demuestra que el motor conserva sus
// invariantes bajo contención y deja cada intento con un veredicto.

import assert from "node:assert/strict";
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const projectId = process.env.GCLOUD_PROJECT ?? "demo-vendeloo";
const auctionCount = Number(process.env.VENDELOO_SCALE_AUCTIONS ?? 100);
const bidsPerAuction = Number(process.env.VENDELOO_SCALE_BIDS_PER_AUCTION ?? 20);
const timeoutMs = Number(process.env.VENDELOO_SCALE_TIMEOUT_MS ?? 240_000);
const totalBids = auctionCount * bidsPerAuction;
const runId = `scale_${Date.now().toString(36)}`;

assert.ok(Number.isInteger(auctionCount) && auctionCount > 0 && auctionCount <= 200);
assert.ok(Number.isInteger(bidsPerAuction) && bidsPerAuction > 0 && bidsPerAuction <= 100);
assert.ok(projectId.startsWith("demo-"), "Esta prueba se niega a correr fuera de un proyecto demo");

admin.initializeApp({ projectId });
const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

async function commitInChunks(writes, chunkSize = 400) {
  for (let start = 0; start < writes.length; start += chunkSize) {
    const batch = db.batch();
    for (const write of writes.slice(start, start + chunkSize)) write(batch);
    await batch.commit();
  }
}

async function getAllInChunks(refs, chunkSize = 400) {
  const docs = [];
  for (let start = 0; start < refs.length; start += chunkSize) {
    docs.push(...await db.getAll(...refs.slice(start, start + chunkSize)));
  }
  return docs;
}

const auctionIds = Array.from({ length: auctionCount }, (_, i) => `${runId}_a${i}`);
const pendingRefs = [];

console.log(`\nEscenario: ${auctionCount} subastas · ${bidsPerAuction} pujas c/u · ${totalBids} compradores`);
console.log("Preparando subastas...");

await db.doc("config/wallet").set({ biddingRequiresBalance: false });
await commitInChunks(auctionIds.map((auctionId, i) => (batch) => {
  batch.set(db.doc(`auctions/${auctionId}`), {
    id: auctionId,
    title: `Subasta de carga ${i + 1}`,
    mode: "standalone",
    showId: null,
    sellerId: `seller_${i}`,
    sellerName: `Vendedor ${i + 1}`,
    startingPriceUsd: 10,
    currentBidUsd: 10,
    minIncrementUsd: 1,
    status: "active",
    bidsCount: 0,
    currentBidderId: null,
    currentBidderName: null,
    endsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 3_600_000),
    createdAt: now,
    updatedAt: now,
    scaleRunId: runId,
  });
}));

const pendingWrites = [];
for (let auctionIndex = 0; auctionIndex < auctionCount; auctionIndex++) {
  for (let bidIndex = 0; bidIndex < bidsPerAuction; bidIndex++) {
    const ref = db.doc(`pendingBids/${runId}_a${auctionIndex}_b${bidIndex}`);
    pendingRefs.push(ref);
    pendingWrites.push((batch) => batch.set(ref, {
      auctionId: auctionIds[auctionIndex],
      bidderId: `${runId}_buyer_${auctionIndex}_${bidIndex}`,
      amountUsd: 11,
      status: "pending",
      submittedAt: now,
      scaleRunId: runId,
    }));
  }
}

console.log("Disparando todas las pujas...");
const startedAt = Date.now();
const commits = [];
for (let start = 0; start < pendingWrites.length; start += 400) {
  const batch = db.batch();
  for (const write of pendingWrites.slice(start, start + 400)) write(batch);
  commits.push(batch.commit());
}
await Promise.all(commits);

let finalDocs = [];
let processed = 0;
let rejected = 0;
const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
  finalDocs = await getAllInChunks(pendingRefs);
  processed = finalDocs.filter((doc) => doc.data()?.status === "processed").length;
  rejected = finalDocs.filter((doc) => doc.data()?.status === "rejected").length;
  const decided = processed + rejected;
  process.stdout.write(`\rVeredictos: ${decided}/${totalBids}`);
  if (decided === totalBids) break;
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
console.log();

const elapsedMs = Date.now() - startedAt;
const pending = totalBids - processed - rejected;
assert.equal(pending, 0, `quedaron ${pending} pujas sin veredicto`);
assert.equal(processed, auctionCount, "debe ganar exactamente una puja por subasta");
assert.equal(rejected, totalBids - auctionCount);

const auctions = await getAllInChunks(auctionIds.map((id) => db.doc(`auctions/${id}`)));
for (const auction of auctions) {
  const data = auction.data();
  assert.equal(data.status, "active");
  assert.equal(data.currentBidUsd, 11);
  assert.equal(data.bidsCount, 1);
  assert.ok(data.currentBidderId);
  const accepted = await auction.ref.collection("bids").get();
  assert.equal(accepted.size, 1);
  assert.equal(accepted.docs[0].data().bidderId, data.currentBidderId);
}

const rate = Math.round((totalBids / elapsedMs) * 1_000);
console.log(`✓ ${totalBids} pujas decididas en ${(elapsedMs / 1_000).toFixed(1)}s (${rate}/s)`);
console.log(`✓ ${processed} aceptadas · ${rejected} rechazadas · 0 pendientes`);
console.log(`✓ ${auctionCount}/${auctionCount} subastas consistentes`);

await admin.app().delete();
