"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { formatUsd } from "@subastas-ve/shared";

// La billetera todavía no tiene backend: no hay función que acredite un
// depósito ni que mueva saldo, y las reglas mantienen /wallets,
// /deposits y /walletTransactions cerrados a escritura desde el cliente.
//
// Antes esta pantalla ofrecía depositar a datos de pago de relleno
// ("zellepagos@liveroo.com", "0414-0000000", "TXxx...xxxx"). Cualquiera
// que enviara dinero ahí lo perdía, y la escritura fallaba igual. Hasta
// que exista el backend, esta pantalla explica el modelo real.

export default function WalletPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [saldo, setSaldo] = useState<{ balanceUsd?: number; frozenUsd?: number } | null>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    const u1 = onSnapshot(doc(db, "wallets", profile.uid),
      s => setSaldo(s.exists() ? (s.data() as any) : null), () => undefined);
    const u2 = onSnapshot(
      query(collection(db, "walletTransactions"), where("userId", "==", profile.uid), orderBy("createdAt", "desc"), limit(20)),
      s => setMovimientos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
    return () => { u1(); u2(); };
  }, [profile]);

  const Cabecera = () => (
    <header className="lv-topbar">
      <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <h1 className="lv-topbar__title">Billetera</h1>
    </header>
  );

  if (!profile) {
    return (
      <div className="lv-app">
        <Cabecera/>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para ver tu billetera</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-app">
      <Cabecera/>

      <div className="lv-pad" style={{ paddingTop: 18, display: "grid", gap: 14 }}>

        <section className="lv-panel">
          <div className="lv-eyebrow">Saldo</div>
          <div className="lv-price lv-price--xl" style={{ margin: "3px 0 4px" }}>
            {formatUsd(saldo?.balanceUsd ?? 0)}
          </div>
          {(saldo?.frozenUsd ?? 0) > 0 && (
            <div className="lv-dim" style={{ fontSize: "0.78rem" }}>
              {formatUsd(saldo!.frozenUsd!)} retenidos
            </div>
          )}
        </section>

        <div className="lv-note lv-note--warn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <strong>Los depósitos todavía no están habilitados.</strong> No hay forma de
            cargar saldo por ahora, y no necesitas hacerlo para pujar.
          </div>
        </div>

        <section className="lv-panel">
          <div style={{ fontSize: "0.92rem", fontWeight: 750, marginBottom: 6 }}>Entonces, ¿cómo pago?</div>
          <p className="lv-muted" style={{ fontSize: "0.83rem", lineHeight: 1.6 }}>
            Pujar es gratis y no requiere saldo. Cuando ganas una subasta se crea tu orden
            con el precio final y el monto congelado en bolívares, y coordinas el pago y la
            entrega directamente con el vendedor por WhatsApp.
          </p>
          <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 13 }} onClick={() => router.push("/support")}>
            Ver cómo funciona
          </button>
        </section>

        {movimientos.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Movimientos</div>
            {movimientos.map(m => (
              <div key={m.id} className="lv-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 650 }}>{m.concept ?? m.type ?? "Movimiento"}</div>
                  <div className="lv-dim" style={{ fontSize: "0.72rem", marginTop: 1 }}>
                    {m.createdAt?.toDate?.()?.toLocaleDateString("es-VE") ?? ""}
                  </div>
                </div>
                <strong style={{ color: (m.amountUsd ?? 0) < 0 ? "var(--live)" : "var(--ink)" }}>
                  {formatUsd(m.amountUsd ?? 0)}
                </strong>
              </div>
            ))}
          </section>
        )}

        <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" onClick={() => router.push("/auctions")}>
          Ver subastas
        </button>
      </div>
    </div>
  );
}
