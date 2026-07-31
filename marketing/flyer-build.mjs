import fs from "node:fs";
const FUENTES = fs.readFileSync(new URL("./_fuentes.css", import.meta.url), "utf8");
const SIM = "M11.06 2.32A2.4 2.4 0 0 1 12.75 1.6h6.9a2.4 2.4 0 0 1 2.4 2.4v6.9a2.4 2.4 0 0 1-.72 1.71l-8.1 8.1a2.7 2.7 0 0 1-3.82 0l-6.2-6.2a2.7 2.7 0 0 1 0-3.82zM17.3 4.6a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z";
const tag = (fill) => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" fill-rule="evenodd" clip-rule="evenodd" d="${SIM}"/></svg>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Vende en Vendeloo</title><style>
${FUENTES}
:root{ --accent:#ff6a00; --accent-strong:#dc5a00; --accent-deep:#ab4100; --soft:#ffe2ce; --tint:#fdeee4; --ink:#1c0f06; --ink-2:#5c4636; --line:#efe2d8; }
*{ margin:0; padding:0; box-sizing:border-box; }
html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
@page{ size:A4; margin:0; }
body{ font-family:'Archivo',-apple-system,Arial,sans-serif; color:var(--ink); }
.display{ font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.01em; }
.page{ width:210mm; min-height:297mm; padding:16mm 18mm 18mm; display:flex; flex-direction:column; position:relative; overflow:hidden; }
.membrete{ display:flex; align-items:center; justify-content:space-between; padding-bottom:11px; border-bottom:2.5px solid var(--accent); }
.marca{ display:flex; align-items:center; gap:10px; } .marca svg{ width:30px; height:30px; }
.marca .n{ font-family:'Anton',sans-serif; font-size:23pt; letter-spacing:.02em; } .marca .n b{ color:var(--accent); font-weight:400; }
.web{ font-size:8.5pt; font-weight:700; color:var(--accent-strong); letter-spacing:.06em; text-transform:uppercase; }
.hero{ margin-top:30px; }
.hero .eyebrow{ font-size:8.5pt; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--accent); margin-bottom:12px; }
.hero h1{ font-size:46pt; line-height:.95; } .hero h1 .o{ color:var(--accent); }
.hero p{ margin-top:16px; font-size:12.5pt; line-height:1.5; color:var(--ink-2); font-weight:500; max-width:150mm; }
.sec{ margin-top:26px; } .sec h2{ font-size:9pt; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.sec h2::after{ content:""; flex:1; height:1px; background:var(--line); }
.benes{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.bene{ background:var(--tint); border:1px solid var(--line); border-radius:14px; padding:15px 16px; display:flex; gap:13px; align-items:flex-start; }
.bene .ic{ width:38px; height:38px; border-radius:11px; background:var(--accent); flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.bene .ic svg{ width:20px; height:20px; }
.bene .k{ font-size:11pt; font-weight:800; color:var(--ink); margin-bottom:3px; }
.bene .t{ font-size:9.5pt; line-height:1.45; color:var(--ink-2); }
.pasos{ display:flex; gap:12px; }
.paso{ flex:1; text-align:center; padding:6px 8px; }
.paso .num{ font-family:'Anton',sans-serif; font-size:30pt; color:var(--accent); line-height:1; }
.paso .t{ font-size:9.5pt; line-height:1.45; color:var(--ink); margin-top:8px; }
.paso .t b{ color:var(--accent-deep); }
.cierre{ margin-top:auto; background:var(--ink); color:#fff; border-radius:16px; padding:22px 26px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
.cierre .lz{ font-family:'Anton',sans-serif; font-size:19pt; text-transform:uppercase; line-height:1.05; }
.cierre .lz .o{ color:var(--accent); }
.cierre .d{ text-align:right; font-size:10pt; line-height:1.7; } .cierre .d b{ color:var(--accent); }
.pie{ padding-top:12px; margin-top:14px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:7.8pt; color:var(--ink-2); }
.pie .n{ font-weight:800; color:var(--accent-strong); text-transform:uppercase; letter-spacing:.08em; }
</style></head><body>
<section class="page">
  <header class="membrete">
    <div class="marca">${tag("#ff6a00")}<span class="n">VENDE<b>LOO</b></span></div>
    <span class="web">vendeloo.io</span>
  </header>

  <div class="hero">
    <div class="eyebrow">Para vendedores</div>
    <h1 class="display">Vende <span class="o">en&nbsp;vivo.</span><br>Llega a toda Venezuela.</h1>
    <p>Vendeloo es el mercado de subastas en vivo hecho para Venezuela. Sube tus productos, deja que la gente puje y gana quien ofrece más. Sin vidrieras, sin regateo eterno: el remate en tiempo real, desde tu teléfono.</p>
  </div>

  <div class="sec">
    <h2>Por qué vender con nosotros</h2>
    <div class="benes">
      <div class="bene"><span class="ic">${tag("#fff")}</span><div><div class="k">Compradores de todo el país</div><div class="t">Tu producto lo ve gente de toda Venezuela en un mismo lugar, no solo tu zona.</div></div></div>
      <div class="bene"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></span><div><div class="k">En vivo o cuando quieras</div><div class="t">Haz un show por video y remata en directo, o publica una subasta y déjala correr.</div></div></div>
      <div class="bene"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></span><div><div class="k">Cuenta verificada</div><div class="t">Cada vendedor pasa por revisión. Eso protege tu nombre y da confianza al comprador.</div></div></div>
      <div class="bene"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z"/></svg></span><div><div class="k">Tu reputación crece</div><div class="t">Cada venta y cada calificación real construyen tu perfil. Sin estrellas de adorno.</div></div></div>
    </div>
  </div>

  <div class="sec">
    <h2>Cómo empezar</h2>
    <div class="pasos">
      <div class="paso"><div class="num">1</div><div class="t">Entra a <b>vendeloo.io</b> y pide tu cuenta de vendedor con el nombre de tu tienda.</div></div>
      <div class="paso"><div class="num">2</div><div class="t">Un administrador la <b>revisa y aprueba</b> —normalmente el mismo día.</div></div>
      <div class="paso"><div class="num">3</div><div class="t">Publica tu primer producto con fotos y <b>empieza a recibir pujas</b>.</div></div>
    </div>
  </div>

  <div class="cierre">
    <div class="lz">Empieza a vender<br><span class="o">esta semana.</span></div>
    <div class="d">
      <div><b>Web</b>&nbsp;&nbsp;vendeloo.io</div>
      <div><b>Correo</b>&nbsp;&nbsp;info@vendeloo.io</div>
    </div>
  </div>

  <footer class="pie">
    <span><span class="n">Vendeloo</span> · Subastas en vivo de Venezuela</span>
    <span>info@vendeloo.io · vendeloo.io</span>
  </footer>
</section>
</body></html>`;

fs.writeFileSync(new URL("./flyer-vendedores.html", import.meta.url), html);
console.log("flyer-vendedores.html generado");
