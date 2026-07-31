// 3 posts de Instagram con más gancho:
//   A. Precio de salida bajo (spotlight PS5)   B. EN VIVO   C. La adrenalina del reloj
import fs from "node:fs";
const FUENTES = fs.readFileSync(new URL("./_fuentes.css", import.meta.url), "utf8");
const SIM = "M11.06 2.32A2.4 2.4 0 0 1 12.75 1.6h6.9a2.4 2.4 0 0 1 2.4 2.4v6.9a2.4 2.4 0 0 1-.72 1.71l-8.1 8.1a2.7 2.7 0 0 1-3.82 0l-6.2-6.2a2.7 2.7 0 0 1 0-3.82zM17.3 4.6a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z";
const tag = (fill) => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" fill-rule="evenodd" clip-rule="evenodd" d="${SIM}"/></svg>`;

async function img(id, w = 900, h = 1100) {
  const r = await fetch(`https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&q=80`);
  return `data:image/jpeg;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
}

const base = `
  ${FUENTES}
  :root{ --accent:#ff6a00; --accent-light:#ff7d21; --accent-strong:#dc5a00; --accent-deep:#ab4100; --soft:#ffe2ce; --tint:#fdeee4; --ink:#1c0f06; --ink-2:#5c4636; }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ font-family:'Archivo',-apple-system,Arial,sans-serif; }
  .display{ font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.01em; }
  .canvas{ width:1080px; height:1080px; overflow:hidden; position:relative; }
  .marca{ display:flex; align-items:center; gap:.5em; } .marca svg{ width:1em; height:1em; }
  .marca .nom{ font-family:'Anton',sans-serif; letter-spacing:.02em; }
`;
const page = (css, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${base}@page{size:1080px 1080px;margin:0} ${css}</style></head><body>${body}</body></html>`;

// ══ A. Precio de salida bajo — spotlight PS5 (split diagonal) ══
async function postA() {
  const ps5 = await img("photo-1606813907291-d86efa9b94db", 760, 1080);
  return page(`
    .canvas{ background:#140b05; color:#fff; display:flex; }
    .foto{ width:46%; height:100%; position:relative; }
    .foto img{ width:100%; height:100%; object-fit:cover; }
    .foto::after{ content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent 55%,#140b05 100%); }
    .txt{ flex:1; padding:80px 66px 74px 40px; display:flex; flex-direction:column; }
    .marca{ font-size:38px; color:#fff; } .marca .nom b{ color:var(--accent); font-weight:400; }
    .mid{ margin-top:auto; }
    .kicker{ font-size:27px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); }
    .prod{ font-size:44px; font-weight:800; margin-top:14px; }
    .desde{ font-size:26px; color:#c9b6a8; margin-top:40px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; }
    .precio{ font-family:'Anton',sans-serif; font-size:230px; line-height:.82; color:var(--accent); }
    .hook{ font-size:32px; line-height:1.35; font-weight:600; margin-top:26px; max-width:440px; }
    .bot{ margin-top:34px; display:flex; align-items:center; justify-content:space-between; }
    .cta{ background:var(--accent); color:#fff; font-weight:900; font-size:27px; padding:16px 32px; border-radius:999px; }
    .web{ font-size:26px; font-weight:800; color:var(--accent-light); }
  `, `
    <div class="canvas">
      <div class="foto"><img src="${ps5}" alt=""/></div>
      <div class="txt">
        <div class="marca">${tag("var(--accent)")}<span class="nom">VENDE<b>LOO</b></span></div>
        <div class="mid">
          <div class="kicker">Empieza bajo</div>
          <div class="prod">PlayStation&nbsp;5</div>
          <div class="desde">Precio de salida</div>
          <div class="precio">$10</div>
          <div class="hook">Las subastas arrancan bajo. ¿Hasta dónde estás dispuesto a llegar?</div>
          <div class="bot"><span class="cta">Puja ahora →</span><span class="web">vendeloo.io</span></div>
        </div>
      </div>
    </div>
  `);
}

// ══ B. EN VIVO — la energía del remate en directo ══
const postB = page(`
  .canvas{ background:radial-gradient(120% 90% at 50% 0%, #ff6a00 0%, #ab4100 60%, #3a1600 100%); color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:90px; }
  .wm{ position:absolute; left:-120px; top:-120px; width:560px; opacity:.14; }
  .marca{ position:absolute; top:64px; font-size:40px; color:#fff; }
  .vivo{ display:inline-flex; align-items:center; gap:18px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.35); border-radius:999px; padding:16px 34px; }
  .vivo .dot{ width:26px; height:26px; border-radius:50%; background:#fff; box-shadow:0 0 0 8px rgba(255,255,255,.25); }
  .vivo .t{ font-size:30px; font-weight:900; letter-spacing:.22em; }
  h1{ font-size:150px; line-height:.9; margin-top:40px; }
  .sub{ font-size:38px; line-height:1.4; font-weight:600; margin-top:36px; max-width:820px; }
  .sub b{ color:#ffd9bf; }
  .web{ position:absolute; bottom:70px; font-size:30px; font-weight:800; letter-spacing:.05em; }
`, `
  <div class="canvas">
    <div class="wm">${tag("var(--accent-light)")}</div>
    <span class="marca">${tag("#fff")}<span class="nom">VENDELOO</span></span>
    <span class="vivo"><span class="dot"></span><span class="t">EN VIVO</span></span>
    <h1 class="display">El remate<br>en directo.</h1>
    <div class="sub">El vendedor muestra. Tú <b>pujas en segundos</b>. Gana quien ofrece más antes de que baje el martillo.</div>
    <span class="web">vendeloo.io</span>
  </div>
`);

// ══ C. La adrenalina del reloj ══
async function postC() {
  const iph = await img("photo-1592750475338-74b7b21085ab", 1080, 620);
  return page(`
    .canvas{ background:#140b05; color:#fff; display:flex; flex-direction:column; }
    .foto{ height:46%; position:relative; }
    .foto img{ width:100%; height:100%; object-fit:cover; }
    .foto::after{ content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(20,11,5,.15) 40%,#140b05 100%); }
    .marca{ position:absolute; top:56px; left:60px; font-size:36px; color:#fff; z-index:2; }
    .marca .nom b{ color:var(--accent); font-weight:400; }
    .reloj{ position:absolute; top:52%; left:50%; transform:translate(-50%,-50%); z-index:2; display:flex; align-items:center; gap:14px; background:rgba(0,0,0,.5); border:2px solid var(--accent); border-radius:22px; padding:18px 30px; }
    .reloj svg{ width:44px; height:44px; }
    .reloj .t{ font-family:'Anton',sans-serif; font-size:60px; letter-spacing:.06em; color:#fff; }
    .body{ flex:1; padding:26px 62px 60px; display:flex; flex-direction:column; justify-content:center; }
    .kicker{ font-size:27px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); }
    h1{ font-size:96px; line-height:.9; margin-top:14px; }
    .sub{ font-size:32px; line-height:1.4; font-weight:500; color:#d8c6b8; margin-top:26px; max-width:840px; }
    .bot{ margin-top:40px; display:flex; align-items:center; justify-content:space-between; }
    .cta{ background:var(--accent); color:#fff; font-weight:900; font-size:28px; padding:17px 36px; border-radius:999px; }
    .web{ font-size:28px; font-weight:800; color:var(--accent-light); }
  `, `
    <div class="canvas">
      <div class="foto">
        <span class="marca">${tag("var(--accent)")}<span class="nom">VENDE<b>LOO</b></span></span>
        <img src="${iph}" alt=""/>
        <span class="reloj"><svg viewBox="0 0 24 24" fill="none" stroke="#ff6a00" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg><span class="t">00:03:21</span></span>
      </div>
      <div class="body">
        <div class="kicker">El reloj corre</div>
        <h1 class="display">El último<br>en pujar,<br><span style="color:var(--accent)">gana.</span></h1>
        <div class="sub">Y si alguien ofrece en el último segundo, el reloj se estira. Nadie gana con trampa.</div>
        <div class="bot"><span class="cta">Entra a pujar →</span><span class="web">vendeloo.io</span></div>
      </div>
    </div>
  `);
}

fs.writeFileSync(new URL("./ig-4-desde10.html", import.meta.url), await postA());
fs.writeFileSync(new URL("./ig-5-envivo.html", import.meta.url), postB);
fs.writeFileSync(new URL("./ig-6-reloj.html", import.meta.url), await postC());
console.log("IG generados: 4-desde10, 5-envivo, 6-reloj");
