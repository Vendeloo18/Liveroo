// Respaldo completo de Firestore -> JSON local. SOLO LECTURA.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { writeFileSync, mkdirSync } from "node:fs";

const app = initializeApp({
  projectId: "instacompras-fe791",
  apiKey: "unused-read-only",
  authDomain: "instacompras-fe791.firebaseapp.com",
});
const db = getFirestore(app);

// Colecciones raíz + subcolecciones conocidas
const ROOT = ["auctions", "shows", "orders", "users", "ratings", "pendingBids",
              "walletTransactions", "deposits", "config", "exchangeRates"];
const SUB = {
  auctions: ["bids"],
  shows: ["products", "messages"],
};
const SUBSUB = { "shows/products": ["bids"] };

const ser = (v) => {
  if (v === null || v === undefined) return v;
  if (typeof v?.toMillis === "function") return { __ts: v.toMillis(), __iso: new Date(v.toMillis()).toISOString() };
  if (Array.isArray(v)) return v.map(ser);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)]));
  return v;
};

const dump = {};
let total = 0;

for (const c of ROOT) {
  const snap = await getDocs(collection(db, c));
  dump[c] = {};
  for (const d of snap.docs) {
    total++;
    const entry = { __data: ser(d.data()) };
    for (const sub of SUB[c] ?? []) {
      const ss = await getDocs(collection(db, c, d.id, sub));
      if (ss.size) {
        entry[sub] = {};
        for (const sd of ss.docs) {
          total++;
          const se = { __data: ser(sd.data()) };
          for (const s2 of SUBSUB[`${c}/${sub}`] ?? []) {
            const s2s = await getDocs(collection(db, c, d.id, sub, sd.id, s2));
            if (s2s.size) {
              se[s2] = Object.fromEntries(s2s.docs.map((x) => { total++; return [x.id, ser(x.data())]; }));
            }
          }
          entry[sub][sd.id] = se;
        }
      }
    }
    dump[c][d.id] = entry;
  }
  console.log(`${c.padEnd(20)} ${snap.size} docs`);
}

mkdirSync(process.argv[2], { recursive: true });
const out = `${process.argv[2]}/firestore-backup.json`;
writeFileSync(out, JSON.stringify({ project: "instacompras-fe791", exportedAt: new Date().toISOString(), collections: dump }, null, 2));
console.log(`\n${total} documentos -> ${out}`);
process.exit(0);
