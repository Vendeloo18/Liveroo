"use client";
import { useRouter } from "next/navigation";

// Marco común de las páginas legales (Términos, Privacidad): topbar nativo
// con botón atrás, fecha de actualización y el cuerpo en secciones. Usa el
// sistema lv-* para que se sienta parte de la app.
export function LegalDoc({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="lv-app" style={{ paddingBottom: 56 }}>
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">{titulo}</h1>
      </header>
      <div className="lv-pad" style={{ paddingTop: 14 }}>
        <p className="lv-dim" style={{ fontSize: "0.74rem", marginBottom: 20 }}>Última actualización: {actualizado}</p>
        {children}
      </div>
    </div>
  );
}

// Sección numerada del documento.
export function Sec({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 8, letterSpacing: "-0.01em" }}>{n}. {titulo}</h2>
      <div style={{ fontSize: "0.88rem", lineHeight: 1.62, color: "var(--ink-2)" }}>{children}</div>
    </section>
  );
}
