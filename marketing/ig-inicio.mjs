// Los 3 primeros posts de Instagram, como tríada de arranque:
//   1. Identidad / bienvenida   2. Cómo funciona   3. Qué puedes ganar
// Fuentes e imágenes embebidas (base64) para que Chrome headless las
// rasterice sin depender de la red.
import fs from "node:fs";

const FUENTES = fs.readFileSync(new URL("./_fuentes.css", import.meta.url), "utf8");
const SIM = "M11.06 2.32A2.4 2.4 0 0 1 12.75 1.6h6.9a2.4 2.4 0 0 1 2.4 2.4v6.9a2.4 2.4 0 0 1-.72 1.71l-8.1 8.1a2.7 2.7 0 0 1-3.82 0l-6.2-6.2a2.7 2.7 0 0 1 0-3.82zM17.3 4.6a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z";
const tag = (fill) => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" fill-rule="evenodd" clip-rule="evenodd" d="${SIM}"/></svg>`;

// Productos reales del catálogo (foto + título corto + precio de salida)
const PRODS = [
  ["photo-1606813907291-d86efa9b94db", "PlayStation 5", 10],
  ["photo-1592750475338-74b7b21085ab", "iPhone 13", 15],
  ["photo-1542291026-7eec264c27ff", "Nike Air Max", 20],
  ["photo-1524805444758-089113d48a6d", "Reloj acero", 35],
  ["photo-1505740420928-5e560c06d30e", "Audífonos", 10],
  ["photo-1473968512647-3e447244af8f", "Drone 4K", 25],
];

async function comoDataURI(id) {
  const r = await fetch(`https://images.unsplash.com/${id}?w=500&h=500&fit=crop&q=80`);
  const b = Buffer.from(await r.arrayBuffer());
  return `data:image/jpeg;base64,${b.toString("base64")}`;
}

const base = `
  ${FUENTES}
  :root{ --accent:#ff6a00; --accent-light:#ff7d21; --accent-strong:#dc5a00; --accent-deep:#ab4100; --soft:#ffe2ce; --tint:#fdeee4; --ink:#1c0f06; --ink-2:#5c4636; --line:#efe2d8; }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ font-family:'Archivo',-apple-system,Arial,sans-serif; color:var(--ink); }
  .display{ font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.01em; }
  .canvas{ width:1080px; height:1080px; overflow:hidden; position:relative; }
  .marca{ display:flex; align-items:center; gap:.5em; } .marca svg{ width:1em; height:1em; }
  .marca .nom{ font-family:'Anton',sans-serif; letter-spacing:.02em; }
`;
const page = (css, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${base}
  @page{ size:1080px 1080px; margin:0; } ${css}</style></head><body>${body}</body></html>`;

// ── 1. Identidad / bienvenida ──────────────────────────────
const post1 = page(`
  .canvas{ background:linear-gradient(150deg,#ff6a00 0%,#dc5a00 100%); color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:90px; }
  .wm{ position:absolute; right:-160px; bottom:-160px; width:640px; opacity:.16; }
  .sim{ width:150px; height:150px; margin-bottom:20px; }
  .nombre{ font-family:'Anton',sans-serif; font-size:118px; letter-spacing:.02em; line-height:1; }
  .tag{ font-size:30px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; margin-top:26px; opacity:.95; }
  .desc{ font-size:33px; line-height:1.45; font-weight:500; margin-top:34px; max-width:760px; opacity:.96; }
  .web{ position:absolute; bottom:70px; font-size:30px; font-weight:800; letter-spacing:.05em; }
`, `
  <div class="canvas">
    <div class="wm">${tag("var(--accent-light)")}</div>
    <div class="sim">${tag("#fff")}</div>
    <div class="nombre">VENDELOO</div>
    <div class="tag">Subastas en vivo · Venezuela</div>
    <div class="desc">Entra al vivo, puja en segundos y págalo cuando lo ganes. Todo desde tu teléfono.</div>
    <div class="web">vendeloo.io</div>
  </div>
`);

// ── 2. Cómo funciona ───────────────────────────────────────
const post2 = page(`
  .canvas{ background:var(--tint); color:var(--ink); display:flex; flex-direction:column; padding:80px 78px; }
  .top{ display:flex; align-items:center; justify-content:space-between; }
  .top .marca{ font-size:44px; color:var(--ink); } .top .marca .nom b{ color:var(--accent); font-weight:400; }
  .h1{ margin-top:44px; }
  .h1 .eyebrow{ font-size:24px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:16px; }
  .h1 h1{ font-size:92px; line-height:.95; }
  .pasos{ margin-top:52px; display:grid; gap:30px; }
  .paso{ display:flex; align-items:center; gap:30px; }
  .paso .n{ font-family:'Anton',sans-serif; font-size:96px; color:var(--accent); line-height:.8; width:90px; flex-shrink:0; }
  .paso .txt .k{ font-size:38px; font-weight:800; }
  .paso .txt .s{ font-size:26px; color:var(--ink-2); margin-top:4px; line-height:1.35; }
  .web{ margin-top:auto; text-align:right; font-size:30px; font-weight:800; color:var(--accent-strong); }
`, `
  <div class="canvas">
    <div class="top"><span class="marca">${tag("var(--accent)")}<span class="nom">VENDE<b>LOO</b></span></span></div>
    <div class="h1">
      <div class="eyebrow">Así de fácil</div>
      <h1 class="display">¿Cómo<br>funciona?</h1>
    </div>
    <div class="pasos">
      <div class="paso"><div class="n">1</div><div class="txt"><div class="k">Explora o entra a un vivo</div><div class="s">Explora las subastas activas, o entra a un show en directo.</div></div></div>
      <div class="paso"><div class="n">2</div><div class="txt"><div class="k">Puja en segundos</div><div class="s">Desde tu teléfono. Gana quien ofrece más.</div></div></div>
      <div class="paso"><div class="n">3</div><div class="txt"><div class="k">Págalo cuando lo ganes</div><div class="s">Precio en dólares, pago en bolívares.</div></div></div>
    </div>
    <div class="web">vendeloo.io</div>
  </div>
`);

// ── 3. Qué puedes ganar (grilla de productos reales) ───────
async function post3() {
  const cells = await Promise.all(PRODS.map(async ([id, nombre, precio]) => {
    const uri = await comoDataURI(id);
    return `<div class="cel"><img src="${uri}" alt=""/><div class="ov"><span class="p">$${precio}</span><span class="nm">${nombre}</span></div></div>`;
  }));
  return page(`
    .canvas{ background:var(--ink); color:#fff; display:flex; flex-direction:column; padding:70px 64px; }
    .top{ display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:30px; }
    .top .l .eyebrow{ font-size:23px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:12px; }
    .top .l h1{ font-size:78px; line-height:.92; }
    .top .l h1 .o{ color:var(--accent); }
    .top .marca{ font-size:34px; color:#fff; } .top .marca .nom b{ color:var(--accent); font-weight:400; }
    .grid{ flex:1; display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr; gap:16px; }
    .cel{ position:relative; border-radius:20px; overflow:hidden; background:#2a1a0e; }
    .cel img{ width:100%; height:100%; object-fit:cover; }
    .cel .ov{ position:absolute; left:0; right:0; bottom:0; padding:16px; display:flex; flex-direction:column; gap:2px; background:linear-gradient(transparent,rgba(0,0,0,.72)); }
    .cel .ov .p{ font-family:'Anton',sans-serif; font-size:34px; color:var(--accent-light); }
    .cel .ov .nm{ font-size:20px; font-weight:600; opacity:.95; }
    .foot{ margin-top:26px; display:flex; align-items:center; justify-content:space-between; }
    .foot .desde{ font-size:26px; font-weight:600; opacity:.85; }
    .foot .desde b{ color:var(--accent-light); }
    .foot .web{ font-size:30px; font-weight:800; color:var(--accent); }
  `, `
    <div class="canvas">
      <div class="top">
        <div class="l"><div class="eyebrow">Subastas activas hoy</div><h1 class="display">Esto puedes <span class="o">ganar</span></h1></div>
        <span class="marca">${tag("var(--accent)")}<span class="nom">VENDE<b>LOO</b></span></span>
      </div>
      <div class="grid">${cells.join("")}</div>
      <div class="foot"><span class="desde">Pujas <b>desde $1</b> · electrónica, moda, joyas y más</span><span class="web">vendeloo.io</span></div>
    </div>
  `);
}

fs.writeFileSync(new URL("./ig-1-bienvenida.html", import.meta.url), post1);
fs.writeFileSync(new URL("./ig-2-como-funciona.html", import.meta.url), post2);
fs.writeFileSync(new URL("./ig-3-que-ganar.html", import.meta.url), await post3());
console.log("IG generados: 1-bienvenida, 2-como-funciona, 3-que-ganar");
