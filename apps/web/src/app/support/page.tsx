"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@subastas-ve/shared";

// Las respuestas describen lo que la plataforma hace HOY. Si mañana se
// implementa custodia de fondos o pagos dentro de la app, se actualizan
// aquí — prometer algo que el motor no hace es lo peor que puede pasar.
const FAQS = [
  {
    q: "¿Cómo funciona una venta por ofertas?",
    a: "Cada venta tiene una fecha de cierre. Toca SUBELOO antes de que termine y la oferta más alta se lleva el producto. Si alguien mejora el precio faltando poco, el cierre se extiende para que todos tengan oportunidad.",
  },
  {
    q: "¿Qué pasa cuando gano?",
    a: "Se crea tu orden con el precio final y el monto en bolívares a la tasa del momento del cierre. Ese monto queda congelado aunque la tasa cambie después.",
  },
  {
    q: "¿Cómo tengo saldo para usar SUBELOO?",
    a: `SUBELOO requiere saldo en tu billetera para respaldar tus ofertas. Durante esta etapa el equipo de ${BRAND.name} activa tu saldo a mano cuando confirmas tu pago: escríbenos por soporte para coordinarlo.`,
  },
  {
    q: "¿Cómo pago cuando gano?",
    a: "Si tienes saldo, el pago se descuenta de tu billetera en el momento en que ganas y tu orden queda pagada al instante. Luego coordinas la entrega con el vendedor por WhatsApp, desde el botón de tu orden.",
  },
  {
    q: "¿Cómo funciona mi saldo mientras pujo?",
    a: "Mientras tu oferta va ganando, ese monto queda apartado y no lo puedes usar en otra venta. Si alguien te supera, se libera al instante y vuelve a estar disponible. Así nunca comprometes más de lo que tienes.",
  },
  {
    q: "¿Puedo cancelar una oferta o pedir reembolso?",
    a: "No. Cada oferta es un compromiso de compra: si quedas primero, la orden es tuya. Las recargas de saldo tampoco son reembolsables. Usa SUBELOO solo por lo que de verdad quieres llevar.",
  },
  {
    q: "¿Por qué rechazaron mi oferta?",
    a: "Puede ser porque alguien pujó unas décimas antes y tu monto quedó bajo el nuevo mínimo, porque la venta ya cerró, porque ya ibas ganando, o porque no te alcanza el saldo disponible. El motivo exacto aparece en pantalla.",
  },
  {
    q: "¿Cómo me convierto en vendedor?",
    a: "Desde Vender solicitas tu cuenta y un administrador la revisa. Es lo que evita que cualquiera publique ventas en la plataforma.",
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
          <div style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: 4 }}>¿No encontraste tu respuesta?</div>
          <p className="lv-dim" style={{ fontSize: "0.8rem", lineHeight: 1.5, marginBottom: 13 }}>
            Escríbenos y te respondemos por el mismo correo con el que entraste.
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
