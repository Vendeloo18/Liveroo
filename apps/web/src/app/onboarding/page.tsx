"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";

// Las fotos son ilustrativas y se ven como tales: no llevan precio ni
// insignia de "en vivo" inventados. Antes mostraban montos y estados
// falsos que parecían subastas reales de la plataforma.
const PASOS = [
  {
    titulo: "Subastas en vivo,\nhechas en Venezuela",
    texto: "Vendedores verificados salen en vivo a subastar. También hay subastas sueltas que duran días.",
    fotos: [
      "photo-1542291026-7eec264c27ff",
      "photo-1523275335684-37898b6baf30",
      "photo-1505740420928-5e560c06d30e",
      "photo-1596462502278-27bfdc403348",
    ],
  },
  {
    titulo: "Pujar es gratis\ny no requiere saldo",
    texto: "Cada subasta tiene un cierre. Si alguien puja faltando poco, el reloj se estira para que nadie gane disparando en el último segundo.",
    fotos: [
      "photo-1606813907291-d86efa9b94db",
      "photo-1598550476439-6847785fcea6",
      "photo-1473968512647-3e447244af8f",
      "photo-1517836357463-d25dfeac3438",
    ],
  },
  {
    titulo: "Ganas, y coordinas\ncon el vendedor",
    texto: "Se crea tu orden con el monto congelado en bolívares y coordinas el pago y la entrega por WhatsApp. Después lo calificas.",
    fotos: [
      "photo-1522338242992-e1a54906a8da",
      "photo-1558002038-1055907df827",
      "photo-1570222094114-d054a817e56b",
      "photo-1615526675159-e248c3021d3f",
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [i, setI] = useState(0);

  const terminar = async () => {
    if (profile) {
      await updateDoc(doc(db, "users", profile.uid), { onboardingDone: true }).catch(() => undefined);
    }
    router.push("/");
  };

  const paso = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  return (
    <div className="lv-app" style={{ paddingBottom: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 16px 0" }}>
        {!ultimo && (
          <button className="lv-dim" style={{ fontSize: "0.82rem", fontWeight: 700 }} onClick={terminar}>
            Saltar
          </button>
        )}
      </div>

      {/* Mosaico */}
      <div className="lv-pad" style={{ paddingTop: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {paso.fotos.map((f, n) => (
            <div
              key={f}
              style={{
                aspectRatio: n % 3 === 0 ? "1 / 1.25" : "1 / 1",
                borderRadius: 14, overflow: "hidden", background: "var(--surface-2)",
                animation: "lv-shimmer 0s", // sin efecto: solo reserva el espacio
              }}
            >
              <img
                src={`https://images.unsplash.com/${f}?w=500&q=80`}
                alt=""
                aria-hidden="true"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Texto */}
      <div className="lv-pad" style={{ paddingTop: 26 }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1.12, whiteSpace: "pre-line" }}>
          {paso.titulo}
        </h1>
        <p className="lv-muted" style={{ fontSize: "0.92rem", lineHeight: 1.55, marginTop: 12 }}>
          {paso.texto}
        </p>
      </div>

      {/* Progreso y avance */}
      <div className="lv-pad" style={{ paddingTop: 22, paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {PASOS.map((_, n) => (
            <span
              key={n}
              style={{
                height: 3, flex: n === i ? 2.4 : 1, borderRadius: 2,
                background: n <= i ? "var(--accent)" : "var(--surface-3)",
                transition: "flex 0.25s, background 0.25s",
              }}
            />
          ))}
        </div>

        <button
          className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg"
          onClick={() => ultimo ? terminar() : setI(n => n + 1)}
        >
          {ultimo ? "Ver subastas" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
