// =============================================================
// generateAgoraToken: quién puede transmitir y quién solo mirar
// =============================================================
//   VENDELOO_TEST_PASSWORD=... node packages/rules-tests/agora-token.mjs
//
// El token de Agora es lo único que separa "mirar el vivo" de
// "transmitir en el canal de otro vendedor", así que lo que se prueba es
// el orden de los rechazos: sin sesión, show que no existe, y un tercero
// pidiendo permiso de publicar en un show ajeno.
//
// Mientras AGORA_APP_CERTIFICATE tenga un valor de relleno, las
// peticiones legítimas terminan en failed-precondition. Eso también se
// comprueba: es la diferencia entre "no está configurado" y un token
// inválido que el cliente tomaría por bueno.
// =============================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import fs from "node:fs";

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
await setDoc(doc(S.vendedor.db,"shows",SHOW),{
  sellerId:S.vendedor.uid, sellerName:"Tienda Prueba", title:"Show de prueba",
  status:"scheduled", agoraChannelName:`show_${Date.now()}`,
  scheduledAt:Timestamp.fromMillis(Date.now()+3600_000), viewerCount:0,
  createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
});
ok("show de prueba creado", SHOW);

const pedir=(s,role,showId=SHOW)=>httpsCallable(s.fns,"generateAgoraToken")({showId,role});

// Sin certificado real, todo lo válido debe decir "no configurado"
try { await pedir(S.vendedor,"publisher"); mal("dueño → publisher","devolvió token con certificado de relleno"); }
catch(e){ /failed-precondition/.test(e.code) && /no está configurado/.test(e.message)
  ? ok("sin certificado responde claro","failed-precondition, no un token inválido")
  : mal("sin certificado responde claro", e.code+" "+e.message); }

// Las validaciones de permiso corren ANTES de necesitar el certificado?
// No: el orden es certificado → show → permiso. Se comprueba que un
// tercero pidiendo publisher no reciba nunca un token.
try { await pedir(S.comprador,"publisher"); mal("tercero → publisher","lo dejó"); }
catch(e){ /permission-denied/.test(e.code)
  ? ok("tercero pidiendo publisher","permission-denied, el mensaje correcto")
  : mal("tercero pidiendo publisher", e.code+" ← debería ser permission-denied"); }

// El tercero como espectador es legítimo: debe llegar hasta el certificado
try { await pedir(S.comprador,"subscriber"); mal("tercero → subscriber","devolvió token con relleno"); }
catch(e){ /failed-precondition/.test(e.code) && /no está configurado/.test(e.message)
  ? ok("tercero como espectador pasa los permisos","llega al certificado")
  : mal("tercero como espectador pasa los permisos", e.code+" "+e.message); }

try { await pedir(S.comprador,"subscriber","no_existe"); mal("show inexistente","lo dejó"); }
catch(e){ /not-found/.test(e.code)
  ? ok("show inexistente rechazado","not-found")
  : mal("show inexistente rechazado", e.code+" ← debería ser not-found"); }

// Sin sesión
const anon=initializeApp(CONFIG,"anon");
try { await httpsCallable(getFunctions(anon,"us-central1"),"generateAgoraToken")({showId:SHOW,role:"subscriber"});
  mal("sin sesión","lo dejó"); }
catch(e){ /unauthenticated/.test(e.code) ? ok("sin sesión rechazado","unauthenticated") : mal("sin sesión", e.code); }

await deleteDoc(doc(S.vendedor.db,"shows",SHOW)).catch(()=>{});
console.log(`\n  ${n-bad}/${n} bien`);
process.exit(bad?1:0);
