"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@subastas-ve/shared";

// =============================================================
// Ayuda — preguntas frecuentes
// =============================================================
// Las respuestas describen lo que la plataforma hace HOY. Prometer algo
// que el motor no hace es lo peor que puede pasar aquí: la gente lo lee
// justo cuando está a punto de poner dinero.
//
// Está agrupado por MOMENTO de la persona (empezar, saldo, ofertar,
// ganar, vender, seguridad), no por tema técnico: quien abre esta
// pantalla tiene una duda concreta, no ganas de estudiar la app.
// =============================================================

interface Pregunta { q: string; a: React.ReactNode }
interface Grupo { titulo: string; preguntas: Pregunta[] }

const GRUPOS: Grupo[] = [
  {
    titulo: "Para empezar",
    preguntas: [
      {
        q: `¿Qué es ${BRAND.name}?`,
        a: `Un lugar para comprar y vender por ofertas, hecho en Venezuela. Hay dos formas: las ventas EN VIVO, donde el vendedor muestra el producto por video y tú ofertas en el momento; y las ventas POR DÍAS, que duran horas o días y puedes seguir con calma. En ambas, el que ofrece más al cerrar se lleva el producto.`,
      },
      {
        q: "¿Tengo que crear cuenta para mirar?",
        a: "No. Puedes explorar todo sin cuenta. Necesitas cuenta para ofertar, para ver las transmisiones en vivo y para vender.",
      },
      {
        q: "¿Qué significan MÍRALO EN VIVO, PUJALOO y GANALOO?",
        a: "Son los tres pasos: MÍRALO EN VIVO es ver lo que hay, PUJALOO es hacer tu oferta (deslizando el botón), y GANALOO es coordinar la entrega cuando ganas.",
      },
      {
        q: "¿Cuánto cuesta usar la app?",
        a: "Para el comprador, nada: pagas solo lo que ofertaste. Al vendedor se le cobra una comisión sobre lo que vende, que ve antes de publicar.",
      },
    ],
  },
  {
    titulo: "Saldo y recargas",
    preguntas: [
      {
        q: "¿Por qué necesito saldo para ofertar?",
        a: "Porque una oferta es un compromiso de compra. Al tener el saldo cargado, el vendedor sabe que quien ofrece puede pagar — y tú sabes que compites contra gente seria, no contra ofertas de mentira.",
      },
      {
        q: "¿Cómo recargo mi saldo?",
        a: "Entra a tu Billetera y toca «Recargar saldo». Ahí aparecen las cuentas donde puedes pagar (pago móvil, Zelle). Haces el pago por tu banco, vuelves a la app y reportas el monto, el método y el número de referencia. Nosotros verificamos que llegó y te acreditamos el saldo.",
      },
      {
        q: "¿Cuánto tarda en acreditarse?",
        a: "Lo revisamos a mano, así que depende de la hora. Normalmente es rápido. Mientras esté pendiente lo ves en tu Billetera; cuando se acredite, el saldo aparece disponible.",
      },
      {
        q: "¿Qué pasa si me equivoco en la referencia?",
        a: "La rechazamos y te decimos por qué, para que la reportes bien. Ningún pago se pierde por escribir mal la referencia: escríbenos y lo revisamos con tu comprobante.",
      },
      {
        q: "¿Puedo retirar mi saldo?",
        a: "No. El saldo sirve para comprar dentro de la app: no se retira ni se devuelve. Recarga solo lo que pienses usar.",
      },
      {
        q: "¿Por qué aparece saldo «retenido»?",
        a: "Cuando vas ganando una oferta, ese monto se aparta para respaldarla. No te lo cobramos: sigue siendo tuyo. Si alguien te supera, se libera al instante y lo puedes usar en otra cosa. Si ganas, ese monto es justamente lo que pagas.",
      },
      {
        q: "Tengo saldo pero dice que no me alcanza",
        a: "Es porque parte de tu saldo está retenido respaldando otra oferta donde vas ganando. Lo que puedes comprometer es tu saldo menos lo retenido. En cuanto esa otra venta cierre o te superen, se libera.",
      },
    ],
  },
  {
    titulo: "Ofertar",
    preguntas: [
      {
        q: "¿Cómo hago una oferta?",
        a: "Deslizas el botón hacia la derecha. Es a propósito: así nadie oferta sin querer con un toque accidental. Puedes escribir el monto o usar los botones rápidos (+$1, +$5…).",
      },
      {
        q: "¿Puedo arrepentirme de una oferta?",
        a: "No. Una oferta es un compromiso: si ganas, la compra es tuya. Por eso te pedimos deslizar en vez de tocar.",
      },
      {
        q: "¿Qué pasa si alguien oferta justo al final?",
        a: "El cierre se extiende unos segundos. Así nadie gana por aparecer en el último instante, y tú siempre tienes chance de responder.",
      },
      {
        q: "Alguien me superó, ¿cómo me entero?",
        a: "Te avisamos en la app y verás el aviso rojo con el botón para volver a ofertar de un toque. Tu saldo retenido se libera en ese mismo momento.",
      },
      {
        q: "¿Puedo ofertar en mi propia venta?",
        a: "No. Tampoco puedes ofertar dos veces seguidas si ya vas ganando: no tendría sentido competir contigo mismo.",
      },
      {
        q: "Mi oferta fue rechazada, ¿por qué?",
        a: "Las razones más comunes: alguien ofertó más rápido y tu monto ya no alcanza el mínimo; no tienes saldo disponible suficiente; o la venta cerró mientras deslizabas. El mensaje te dice cuál fue.",
      },
    ],
  },
  {
    titulo: "Cuando ganas",
    preguntas: [
      {
        q: "Gané, ¿y ahora qué?",
        a: "Se crea tu orden con un número (por ejemplo #K7X2P9) y el precio final, con el monto en bolívares a la tasa del momento del cierre. Ese monto queda congelado aunque la tasa cambie después. Desde la orden coordinas la entrega con el vendedor por WhatsApp.",
      },
      {
        q: "¿Ya pagué o tengo que pagar aparte?",
        a: "Si tenías saldo, la compra se paga sola con tu saldo y la orden nace pagada: no le envíes dinero al vendedor, solo coordina la entrega. Si no tenías saldo, la orden queda pendiente y coordinas el pago directamente con el vendedor.",
      },
      {
        q: "¿Quién me entrega el producto?",
        a: `El vendedor. ${BRAND.name} conecta a las dos partes y registra la orden, pero no guarda ni transporta los productos. Por eso coordinan la entrega entre ustedes.`,
      },
      {
        q: "¿Cuándo veo el WhatsApp del vendedor?",
        a: "En cuanto ganas. En la orden aparece el botón para escribirle directo, con el mensaje ya armado.",
      },
      {
        q: "El vendedor no responde",
        a: "Escríbenos con el número de tu orden. Mediamos en lo que podamos y, si hace falta, tomamos medidas con esa cuenta.",
      },
      {
        q: "¿Puedo devolver algo?",
        a: "No hay devoluciones ni reembolsos. Por eso vale la pena mirar bien las fotos, leer la descripción y preguntarle al vendedor antes de ofertar.",
      },
      {
        q: "¿Cómo califico al vendedor?",
        a: "Cuando marcas la orden como recibida, se habilita la calificación. Es una sola por orden y es pública: es lo que ayuda al resto a saber con quién está tratando.",
      },
    ],
  },
  {
    titulo: "Vender",
    preguntas: [
      {
        q: "¿Cómo me hago vendedor?",
        a: "Entra a Vender y llena la solicitud con el nombre de tu tienda, tu cédula, tu WhatsApp y tu ciudad. Un administrador la revisa. Es lo que evita que cualquiera publique.",
      },
      {
        q: "¿Por qué me piden WhatsApp obligatorio?",
        a: "Porque es por donde te escribe quien gane. Sin número, tu comprador se queda sin forma de coordinar la entrega, así que no se puede publicar sin él.",
      },
      {
        q: "¿Cuál es la diferencia entre vender en vivo y vender un artículo?",
        a: "En vivo: sales por video y vas presentando productos uno por uno, con ofertas de minutos. Un artículo: publicas una sola venta que dura horas o días y no requiere que estés presente.",
      },
      {
        q: "¿Puedo retirar una publicación?",
        a: "Sí, siempre que nadie haya ofertado todavía — ahí es solo corregir un error. Si ya hay ofertas, no: una oferta es un compromiso también para ti. Si hay un problema real, escríbenos.",
      },
      {
        q: "¿Cuándo y cómo cobro?",
        a: "Depende de cómo pagó el comprador. Si pagó con su saldo, el dinero lo cobramos nosotros y te liquidamos tu parte por fuera; lo ves marcado en Mis ventas. Si pagó directo, cobras tú y coordinas con él.",
      },
      {
        q: "¿Qué comisión me cobran?",
        a: "Un porcentaje de cada venta, que ves reflejado en la orden. En la orden aparece el desglose: precio final, comisión y lo que te queda.",
      },
      {
        q: "¿Puedo terminar mi transmisión en cualquier momento?",
        a: "Sí, salvo si hay un artículo con ofertas en curso: ahí hay que esperar a que cierre (son segundos). Sería injusto cortarle la venta a quien va ganando.",
      },
    ],
  },
  {
    titulo: "Cuenta y seguridad",
    preguntas: [
      {
        q: "Olvidé mi contraseña",
        a: "En la pantalla de inicio de sesión, escribe tu correo y toca «Olvidé mi contraseña». Te llega un enlace para cambiarla. Revisa también el correo no deseado.",
      },
      {
        q: "¿Quién ve mis datos?",
        a: "Tu correo, tu teléfono y tu cédula no son públicos. Lo público es tu nombre, tu foto y tu reputación. La única excepción: al cerrar una compra, comprador y vendedor ven el WhatsApp del otro para poder coordinar.",
      },
      {
        q: "¿Puedo cambiar mi nombre o mi foto?",
        a: "Sí, desde Cuenta → tu perfil. Tu historial y tu reputación se mantienen.",
      },
      {
        q: "¿Cómo cierro mi cuenta?",
        a: "Escríbenos y la cerramos. Si tienes saldo o ventas en curso, primero hay que resolverlas.",
      },
      {
        q: "Vi algo sospechoso o un producto que no debería estar",
        a: "Avísanos con el enlace de la publicación. Podemos bajarla y suspender la cuenta que la publicó.",
      },
      {
        q: "No me llegan los avisos",
        a: "Revisa Ajustes → avisos en este dispositivo. En iPhone, hay que agregar la app a la pantalla de inicio para que funcionen. Si los bloqueaste en el navegador, hay que reactivarlos desde la configuración del navegador.",
      },
    ],
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const q = busca.trim().toLowerCase();
  const grupos = q
    ? GRUPOS.map(g => ({
        ...g,
        preguntas: g.preguntas.filter(p =>
          p.q.toLowerCase().includes(q) || (typeof p.a === "string" && p.a.toLowerCase().includes(q))),
      })).filter(g => g.preguntas.length > 0)
    : GRUPOS;
  const total = grupos.reduce((n, g) => n + g.preguntas.length, 0);

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/account")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Ayuda</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>
        <input
          className="lv-input"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Busca tu duda: saldo, ganar, vender…"
          aria-label="Buscar en la ayuda"
        />

        {q && total === 0 && (
          <div className="lv-empty">
            <div className="lv-empty__title">Nada sobre «{busca}»</div>
            <div className="lv-empty__text">Escríbenos y te respondemos directo.</div>
          </div>
        )}

        {grupos.map(g => (
          <section key={g.titulo}>
            <div className="lv-eyebrow" style={{ padding: "4px 2px 8px" }}>{g.titulo}</div>
            <div className="lv-panel" style={{ padding: "2px 16px" }}>
              {g.preguntas.map((p, i) => {
                const clave = `${g.titulo}-${p.q}`;
                const open = abierta === clave;
                return (
                  <div key={p.q} style={{ borderBottom: i === g.preguntas.length - 1 ? "none" : "1px solid var(--line)" }}>
                    <button
                      onClick={() => setAbierta(a => a === clave ? null : clave)}
                      aria-expanded={open}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 0", textAlign: "left" }}
                    >
                      <span style={{ fontSize: "0.87rem", fontWeight: 650, lineHeight: 1.35 }}>{p.q}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.3" strokeLinecap="round"
                           style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                    {open && (
                      <p className="lv-muted" style={{ fontSize: "0.83rem", lineHeight: 1.65, paddingBottom: 16, paddingRight: 16 }}>
                        {p.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="lv-panel">
          <div style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: 4 }}>¿No encontraste tu respuesta?</div>
          <p className="lv-dim" style={{ fontSize: "0.8rem", lineHeight: 1.5, marginBottom: 13 }}>
            Escríbenos con el número de tu orden si es sobre una compra, y te respondemos.
          </p>
          <a
            href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent("Ayuda con " + BRAND.name)}`}
            className="lv-btn lv-btn--primary lv-btn--block"
            style={{ textDecoration: "none" }}
          >
            Escribir a soporte
          </a>
        </section>
      </div>
    </div>
  );
}
