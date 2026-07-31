// Genera las piezas de marca (posts, story, flyer) con la base de Vendeloo.
// Cada pieza es un HTML autocontenido (fuentes embebidas) que luego Chrome
// rasteriza a PNG (redes) o imprime a PDF (flyer).
import fs from "node:fs";

const FUENTES = fs.readFileSync(new URL("./_fuentes.css", import.meta.url), "utf8");

const SIM = "M11.06 2.32A2.4 2.4 0 0 1 12.75 1.6h6.9a2.4 2.4 0 0 1 2.4 2.4v6.9a2.4 2.4 0 0 1-.72 1.71l-8.1 8.1a2.7 2.7 0 0 1-3.82 0l-6.2-6.2a2.7 2.7 0 0 1 0-3.82zM17.3 4.6a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z";
const tag = (fill, extra = "") => `<svg viewBox="0 0 24 24" ${extra} xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" fill-rule="evenodd" clip-rule="evenodd" d="${SIM}"/></svg>`;

const base = `
  ${FUENTES}
  :root{
    --accent:#ff6a00; --accent-light:#ff7d21; --accent-strong:#dc5a00; --accent-deep:#ab4100;
    --soft:#ffe2ce; --tint:#fdeee4; --ink:#1c0f06; --ink-2:#5c4636; --line:#efe2d8;
  }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ font-family:'Archivo',-apple-system,'Helvetica Neue',Arial,sans-serif; color:var(--ink); }
  .display{ font-family:'Anton','Arial Black',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.01em; }
  .canvas{ overflow:hidden; position:relative; }
  .marca{ display:flex; align-items:center; gap:.55em; }
  .marca svg{ width:1em; height:1em; }
  .marca .nom{ font-family:'Anton',sans-serif; letter-spacing:.02em; }
`;

function pagina(css, body, { w, h } = {}) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${base}
  ${w ? `@page{ size:${w}px ${h}px; margin:0; } .canvas{ width:${w}px; height:${h}px; }` : ""}
  ${css}</style></head><body>${body}</body></html>`;
}

// ══════════════════════════════════════════════════════════════
// 1. POST CUADRADO — Lanzamiento (1080×1080)
// ══════════════════════════════════════════════════════════════
const postLanzamiento = pagina(`
  .canvas{ background:linear-gradient(150deg,#ff6a00 0%,#dc5a00 100%); color:#fff;
    display:flex; flex-direction:column; justify-content:space-between; padding:82px 80px; }
  .wm{ position:absolute; right:-140px; top:-120px; width:820px; opacity:.5; }
  .top{ position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; }
  .top .marca{ font-size:52px; }
  .top .eyebrow{ font-size:22px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; opacity:.92; }
  .mid{ position:relative; z-index:1; }
  .mid h1{ font-size:128px; line-height:.92; letter-spacing:.005em; }
  .mid p{ font-size:33px; line-height:1.4; font-weight:500; margin-top:30px; max-width:820px; opacity:.96; }
  .bot{ position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; }
  .bot .cta{ background:#fff; color:var(--accent-strong); font-weight:900; font-size:30px; padding:20px 40px; border-radius:999px; }
  .bot .web{ font-size:30px; font-weight:800; letter-spacing:.04em; }
`, `
  <div class="canvas">
    <div class="wm">${tag("var(--accent-light)")}</div>
    <div class="top">
      <span class="marca" style="color:#fff">${tag("#fff")}<span class="nom">VENDELOO</span></span>
      <span class="eyebrow">Venezuela</span>
    </div>
    <div class="mid">
      <h1 class="display">Entra<br>al vivo.<br>Puja.&nbsp;Gana.</h1>
      <p>Subastas en vivo. Puja en segundos y págalo cuando lo ganes. Todo desde tu teléfono.</p>
    </div>
    <div class="bot">
      <span class="cta">Entra ya →</span>
      <span class="web">vendeloo.io</span>
    </div>
  </div>
`, { w: 1080, h: 1080 });

// ══════════════════════════════════════════════════════════════
// 2. POST CUADRADO — Reclutamiento de vendedores (1080×1080)
// ══════════════════════════════════════════════════════════════
const postVendedores = pagina(`
  .canvas{ background:var(--tint); color:var(--ink);
    display:flex; flex-direction:column; justify-content:space-between; padding:76px 78px; }
  .wm{ position:absolute; right:-180px; bottom:-160px; width:640px; opacity:.14; }
  .top .marca{ font-size:46px; color:var(--ink); }
  .top .marca .nom b{ color:var(--accent); font-weight:400; }
  .h1{ position:relative; z-index:1; }
  .h1 .eyebrow{ font-size:24px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:22px; }
  .h1 h1{ font-size:96px; line-height:.96; color:var(--ink); }
  .h1 h1 .o{ color:var(--accent); }
  .lista{ position:relative; z-index:1; display:grid; gap:22px; margin-top:20px; }
  .item{ display:flex; align-items:center; gap:20px; }
  .item .ic{ width:58px; height:58px; border-radius:16px; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .item .ic svg{ width:30px; height:30px; }
  .item .t{ font-size:31px; font-weight:650; line-height:1.3; }
  .item .t b{ color:var(--accent-deep); }
  .bot{ position:relative; z-index:1; background:var(--ink); color:#fff; border-radius:26px; padding:32px 40px; display:flex; align-items:center; justify-content:space-between; }
  .bot .l .lz{ font-family:'Anton',sans-serif; font-size:40px; text-transform:uppercase; line-height:1; }
  .bot .l .s{ font-size:24px; opacity:.85; margin-top:8px; }
  .bot .web{ font-size:30px; font-weight:800; color:var(--accent); }
`, `
  <div class="canvas">
    <div class="wm">${tag("var(--accent)")}</div>
    <div class="top"><span class="marca">${tag("var(--accent)")}<span class="nom">VENDE<b>LOO</b></span></span></div>
    <div class="h1">
      <div class="eyebrow">Para vendedores</div>
      <h1 class="display">¿Tienes algo<br>que <span class="o">vender?</span></h1>
    </div>
    <div class="lista">
      <div class="item"><span class="ic">${tag("#fff")}</span><div class="t">Llega a compradores de <b>toda Venezuela</b></div></div>
      <div class="item"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></span><div class="t">Vende <b>en vivo por video</b> o publica cuando quieras</div></div>
      <div class="item"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></span><div class="t">Cuenta <b>verificada</b> y tu reputación crece con cada venta</div></div>
    </div>
    <div class="bot">
      <div class="l"><div class="lz">Regístrate hoy</div><div class="s">Un administrador aprueba tu tienda</div></div>
      <span class="web">vendeloo.io</span>
    </div>
  </div>
`, { w: 1080, h: 1080 });

// ══════════════════════════════════════════════════════════════
// 3. STORY vertical (1080×1920)
// ══════════════════════════════════════════════════════════════
const story = pagina(`
  .canvas{ background:linear-gradient(160deg,#ff6a00 0%,#ab4100 100%); color:#fff;
    display:flex; flex-direction:column; justify-content:space-between; padding:150px 90px 130px; }
  .wm{ position:absolute; left:50%; top:44%; transform:translate(-50%,-50%); width:1160px; opacity:.4; }
  .top{ position:relative; z-index:1; text-align:center; }
  .top .marca{ font-size:70px; color:#fff; justify-content:center; }
  .mid{ position:relative; z-index:1; text-align:center; }
  .mid .eyebrow{ font-size:30px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; opacity:.9; margin-bottom:34px; }
  .mid h1{ font-size:160px; line-height:.9; }
  .mid p{ font-size:40px; line-height:1.45; font-weight:500; margin-top:44px; opacity:.96; }
  .bot{ position:relative; z-index:1; text-align:center; }
  .bot .cta{ display:inline-block; background:#fff; color:var(--accent-strong); font-weight:900; font-size:42px; padding:30px 66px; border-radius:999px; }
  .bot .web{ display:block; font-size:36px; font-weight:800; letter-spacing:.06em; margin-top:34px; opacity:.95; }
`, `
  <div class="canvas">
    <div class="wm">${tag("var(--accent-light)")}</div>
    <div class="top"><span class="marca">${tag("#fff")}<span class="nom">VENDELOO</span></span></div>
    <div class="mid">
      <div class="eyebrow">Subastas en vivo · Venezuela</div>
      <h1 class="display">Entra<br>al vivo.</h1>
      <p>Puja en segundos.<br>Págalo cuando lo ganes.</p>
    </div>
    <div class="bot"><span class="cta">Descúbrelo →</span><span class="web">vendeloo.io</span></div>
  </div>
`, { w: 1080, h: 1920 });

fs.writeFileSync(new URL("./post-lanzamiento.html", import.meta.url), postLanzamiento);
fs.writeFileSync(new URL("./post-vendedores.html", import.meta.url), postVendedores);
fs.writeFileSync(new URL("./story-teaser.html", import.meta.url), story);
console.log("HTML generado: post-lanzamiento, post-vendedores, story-teaser");
