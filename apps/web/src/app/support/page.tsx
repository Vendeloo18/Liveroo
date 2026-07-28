"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Las respuestas describen lo que la plataforma hace HOY. Si mañana se
// implementa custodia de fondos o pagos dentro de la app, se actualizan
// aquí — prometer algo que el motor no hace es lo peor que puede pasar.
const FAQS = [
  {
    q: "¿Cómo funciona una subasta?",
    a: "Cada subasta tiene una fecha de cierre. Pujas antes de que termine y el mayor postor gana. Si alguien puja faltando poco, el cierre se estira automáticamente para que nadie gane disparando en el último segundo.",
  },
  {
    q: "¿Qué pasa cuando gano?",
    a: "Se crea tu orden con el precio final y el monto en bolívares a la tasa del momento del cierre. Ese monto queda congelado aunque la tasa cambie después.",
  },
  {
    q: "¿Cómo pago?",
    a: "Coordinas el pago y la entrega directamente con el vendedor por WhatsApp, desde el botón que aparece en tu orden. Liveroo no retiene tu dinero ni cobra por dentro de la app.",
  },
  {
    q: "¿Liveroo protege mi pago?",
    a: "No hay custodia de fondos: el pago va directo de comprador a vendedor. Lo que sí hace Liveroo es dejar registro de la orden, del monto y de con quién la hiciste, y mostrar públicamente la reputación de cada vendedor.",
  },
  {
    q: "¿Por qué me rechazaron una puja?",
    a: "Casi siempre porque alguien pujó unas décimas antes y tu monto quedó por debajo del nuevo mínimo. También se rechaza si la subasta ya cerró o si ya ibas ganando. El motivo exacto te sale en pantalla al momento.",
  },
  {
    q: "¿Cómo me convierto en vendedor?",
    a: "Desde Vender pides tu cuenta y un administrador la revisa. Es lo que evita que cualquiera publique subastas en la plataforma.",
  },
  {
    q: "¿Quién ve mis datos?",
    a: "Tu correo y tu teléfono no son públicos. Solo los ve el vendedor con quien cierras una compra. Lo que sí es público es tu nombre, tu foto y tu reputación.",
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/account")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Ayuda</h1>
      </header>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>
        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          {FAQS.map((f, i) => (
            <div key={f.q} style={{ borderBottom: i === FAQS.length - 1 ? "none" : "1px solid var(--line)" }}>
              <button
                onClick={() => setAbierta(a => a === i ? null : i)}
                aria-expanded={abierta === i}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 0", textAlign: "left" }}
              >
                <span style={{ fontSize: "0.87rem", fontWeight: 650, lineHeight: 1.35 }}>{f.q}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.3" strokeLinecap="round"
                     style={{ flexShrink: 0, transform: abierta === i ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {abierta === i && (
                <p className="lv-muted" style={{ fontSize: "0.83rem", lineHeight: 1.6, paddingBottom: 16, paddingRight: 20 }}>
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </section>

        <section className="lv-panel">
          <div style={{ fontSize: "0.92rem", fontWeight: 750, marginBottom: 4 }}>¿No encontraste tu respuesta?</div>
          <p className="lv-dim" style={{ fontSize: "0.8rem", lineHeight: 1.5, marginBottom: 13 }}>
            Escríbenos y te respondemos por el mismo correo con el que entraste.
          </p>
          <a
            href="mailto:soporte@liveroo.app?subject=Ayuda%20con%20Liveroo"
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
