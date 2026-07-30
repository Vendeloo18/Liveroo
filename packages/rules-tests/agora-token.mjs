// =============================================================
// generateAgoraToken: quién puede transmitir y quién solo mirar
// =============================================================
//   VENDELOO_TEST_PASSWORD=... node packages/rules-tests/agora-token.mjs
//
// El token de Agora es lo único que separa "mirar el vivo" de
// "transmitir en el canal de otro vendedor", así que primero se prueban
// los rechazos: sin sesión, show que no existe, y un tercero pidiendo
// permiso de publicar en un show ajeno. Esos no dependen de que Agora
// esté configurado, y por diseño corren ANTES del certificado.
//
// Después, según el estado del proyecto:
// · Con AGORA_APP_CERTIFICATE real: las peticiones legítimas devuelven un
//   token, y se valida su forma — prefijo 007, el canal del show adentro
//   (se decodifica el zlib), vencimiento en el futuro y uids por persona.
// · Con el certificado de relleno: las legítimas terminan en
//   failed-precondition con un mensaje claro. Eso también es un resultado
//   correcto: es la diferencia entre "no está configurado" y un token
//   inválido que el cliente tomaría por bueno.
// =============================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import fs from "node:fs";
import zlib from "node:zlib";

const env = Object.fromEntries(fs.readFileSync(new URL("../../apps/web/.env.local", import.meta.url),"utf8")
  .split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const CONFIG = { apiKey:env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain:env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket:env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId:env.NEXT_PUBLIC_FIREBASE_APP_ID };

const CLAVE = process.env.VENDELOO_TEST_PASSWORD;
if (!CLAVE) { console.error("Falta VENDELOO_TEST_PASSWORD. La clave no va en el repo."); process.exit(2); }
const DOMINIO = process.env.VENDELOO_TEST_DOMAIN ?? "vendeloo.io";

const S={};
for (const [rol,mail] of [["vendedor","vendedor@"+DOMINIO],["comprador","comprador@"+DOMINIO]]) {
  const a=initializeApp(CONFIG,rol);
  const {user}=await signInWithEmailAndPassword(getAuth(a),mail,CLAVE);
  S[rol]={uid:user.uid, db:getFirestore(a), fns:getFunctions(a,"us-central1")};
}

let n=0,bad=0;
const ok=(t,d="")=>{n++;console.log(`  ✓ ${t}${d?"  — "+d:""}`)};
const mal=(t,d)=>{n++;bad++;console.log(`  ✗ ${t}\n      ${d}`)};

const SHOW = `test_show_${Date.now().toString(36)}`;
const CANAL = `show_${Date.now()}`;
await setDoc(doc(S.vendedor.db,"shows",SHOW),{
  sellerId:S.vendedor.uid, sellerName:"Tienda Prueba", title:"Show de prueba",
  status:"scheduled", agoraChannelName:CANAL,
  scheduledAt:Timestamp.fromMillis(Date.now()+3600_000), viewerCount:0,
  createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
});
ok("show de prueba creado", SHOW);

const pedir=(s,role,showId=SHOW)=>httpsCallable(s.fns,"generateAgoraToken")({showId,role});

// ── Los rechazos, que no dependen del certificado ──────────────────

try { await pedir(S.comprador,"publisher"); mal("tercero → publisher","lo dejó"); }
catch(e){ /permission-denied/.test(e.code)
  ? ok("tercero pidiendo publisher","permission-denied, el mensaje correcto")
  : mal("tercero pidiendo publisher", e.code+" ← debería ser permission-denied"); }

try { await pedir(S.comprador,"subscriber","no_existe"); mal("show inexistente","lo dejó"); }
catch(e){ /not-found/.test(e.code)
  ? ok("show inexistente rechazado","not-found")
  : mal("show inexistente rechazado", e.code+" ← debería ser not-found"); }

const anon=initializeApp(CONFIG,"anon");
try { await httpsCallable(getFunctions(anon,"us-central1"),"generateAgoraToken")({showId:SHOW,role:"subscriber"});
  mal("sin sesión","lo dejó"); }
catch(e){ /unauthenticated/.test(e.code) ? ok("sin sesión rechazado","unauthenticated") : mal("sin sesión", e.code); }

// ── Las peticiones legítimas, según el estado del proyecto ─────────

/** Un token AccessToken2 debe traer el canal del show adentro. */
const bienFormado = (d) => {
  try {
    const crudo = zlib.inflateSync(Buffer.from(d.token.slice(3),"base64")).toString("latin1");
    return d.token.startsWith("007")
      && /^[0-9a-f]{32}$/i.test(d.appId)
      && d.channelName === CANAL
      && crudo.includes(CANAL)
      && d.expiresAt > Date.now();
  } catch { return false; }
};

let dueno = null;
try { dueno = (await pedir(S.vendedor,"publisher")).data; }
catch(e){
  /failed-precondition/.test(e.code) && /no está configurado/.test(e.message)
    ? ok("Agora sin configurar responde claro","failed-precondition, no un token inválido")
    : mal("dueño → publisher", e.code+" "+e.message);
}

if (dueno) {
  bienFormado(dueno)
    ? ok("dueño → publisher: token bien formado", `canal ${dueno.channelName} · vence ${new Date(dueno.expiresAt).toISOString().slice(11,16)}Z`)
    : mal("dueño → publisher: token bien formado", JSON.stringify({...dueno, token: dueno.token.slice(0,20)+"…"}));

  try {
    const sub = (await pedir(S.comprador,"subscriber")).data;
    bienFormado(sub) && sub.uid !== dueno.uid
      ? ok("espectador: token bien formado", "uid propio, distinto al del vendedor")
      : mal("espectador: token bien formado", `uid ${sub.uid} vs ${dueno.uid}`);
  } catch(e){ mal("espectador → subscriber", e.code+" "+e.message); }
} else {
  // Modo sin configurar: el espectador legítimo también llega al certificado
  try { await pedir(S.comprador,"subscriber"); mal("tercero → subscriber","devolvió token con relleno"); }
  catch(e){ /failed-precondition/.test(e.code)
    ? ok("espectador legítimo pasa los permisos","llega al certificado")
    : mal("espectador legítimo pasa los permisos", e.code+" "+e.message); }
}

await deleteDoc(doc(S.vendedor.db,"shows",SHOW)).catch(()=>{});
console.log(`\n  ${n-bad}/${n} bien`);
process.exit(bad?1:0);
