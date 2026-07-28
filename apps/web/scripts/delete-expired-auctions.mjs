// Borra las subastas de /auctions con status="active" cuyo endsAt ya venció.
// Requiere respaldo previo (scripts/backup.mjs). Usar --apply para ejecutar.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

const APPLY = process.argv.includes("--apply");
const app = initializeApp({
  projectId: "instacompras-fe791",
  apiKey: "unused",
  authDomain: "instacompras-fe791.firebaseapp.com",
});
const db = getFirestore(app);

const now = Date.now();
const snap = await getDocs(collection(db, "auctions"));
const targets = snap.docs.filter((d) => {
  const x = d.data();
  return x.status === "active" && x.endsAt?.toMillis?.() < now;
});

console.log(`${APPLY ? "BORRANDO" : "SIMULACRO (usar --apply para borrar)"} — ${targets.length} subastas vencidas\n`);
for (const d of targets) {
  const x = d.data();
  console.log(`  ${d.id.padEnd(22)} ${(x.title ?? "").slice(0, 40)}`);
  if (APPLY) await deleteDoc(doc(db, "auctions", d.id));
}
console.log(`\n${APPLY ? `${targets.length} borradas.` : "Nada modificado."}`);
process.exit(0);
