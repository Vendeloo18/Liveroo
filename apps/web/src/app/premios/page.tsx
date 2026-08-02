"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import {
  costoPremio,
  reglasConDefault,
  type PremioCatalogo,
  type ReglasLoyalty,
} from "@subastas-ve/shared";

// =============================================================
// Premios — el catálogo de LOOS
// =============================================================
// Una sola regla que explicar: 1 LOO por cada dólar que muevas, compres
// o vendas, acreditado cuando la orden queda entregada. Los LOOS no son
// plata: no se recargan ni se retiran, solo se cambian por mercancía.
//
// Esta pantalla solo mira y pide. Descontar puntos y crear el canje lo
// hace la Function redeemPrize en una sola transacción — si el cliente
// pudiera escribir /redemptions, se llevaría el premio sin pagar.
// =============================================================

const ICONOS: Record<string, JSX.Element> = {
  llavero: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5"/><path d="M11.5 11.5L21 21M17 17l2-2M14 14l2-2"/></svg>,
  gorra: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15a9 9 0 0 1 18 0"/><path d="M3 15h18a2 2 0 0 1 2 2v1H1v-1a2 2 0 0 1 2-2z"/><path d="M12 6v9"/></svg>,
  taza: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/></svg>,
  camisa: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3l3 2 3-2 5 3-2 4-2-1v12H8V9L6 10 4 6z"/></svg>,
};

const ESTADO_CANJE: Record<string, { texto: string; clase: string }> = {
  pending: { texto: "Por entregar", clase: "lv-badge--soft" },
  delivered: { texto: "Entregado", clase: "lv-badge--accent" },
  cancelled: { texto: "Cancelado", clase: "lv-badge--live" },
};

const TIPO_MOVIMIENTO: Record<string, string> = {
  order_buyer: "Compra entregada",
  order_seller: "Venta entregada",
  first_purchase: "Bono: primera compra",
  first_sale: "Bono: primera venta",
  first_show: "Bono: primer show",
  rating: "Bono: calificaste",
  redeem: "Canje de premio",
  redeem_refund: "Canje cancelado",
  admin: "Ajuste del equipo",
};

export default function PremiosPage() {
  const { profile } = useAuthStore();
  const router = useRouter();

  const [loos, setLoos] = useState<{ saldo: number; total: number } | null>(null);
  const [cfg, setCfg] = useState<Partial<ReglasLoyalty> | null>(null);
  const [canjes, setCanjes] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  useEffect(() => {
    // El catálogo es público: se puede mirar sin sesión y eso es parte de
    // la gracia — ver la gorra es lo que da ganas de acumular.
    const u1 = onSnapshot(doc(db, "config", "loyalty"),
      s => setCfg(s.exists() ? (s.data() as Partial<ReglasLoyalty>) : null), () => setCfg(null));
    if (!profile) return () => { u1(); };

    const u2 = onSnapshot(doc(db, "users", profile.uid),
      s => { const d = s.data() as any; setLoos({ saldo: d?.loos ?? 0, total: d?.loosLifetime ?? 0 }); },
      () => setLoos({ saldo: 0, total: 0 }));
    const u3 = onSnapshot(
      query(collection(db, "redemptions"), where("userId", "==", profile.uid), orderBy("createdAt", "desc"), limit(10)),
      s => setCanjes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
    const u4 = onSnapshot(
      query(collection(db, "loosTxs"), where("userId", "==", profile.uid), orderBy("createdAt", "desc"), limit(20)),
      s => setMovimientos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
    return () => { u1(); u2(); u3(); u4(); };
  }, [profile]);

  const reglas = useMemo(() => reglasConDefault(cfg), [cfg]);
  const esVendedor = profile?.sellerStatus === "approved";
  const saldo = loos?.saldo ?? 0;

  const canjear = async (premio: PremioCatalogo, costo: number) => {
    if (!profile) { router.push("/login"); return; }
    if (!confirm(`¿Canjear ${costo} LOOS por ${premio.nombre}? Te contactamos por WhatsApp para coordinar la entrega.`)) return;
    setOcupado(premio.id);
    setAviso(null);
    try {
      await httpsCallable(functions, "redeemPrize")({ prizeId: premio.id });
      setAviso({ tipo: "ok", texto: `¡Listo! Te escribimos por WhatsApp para entregarte tu ${premio.nombre.toLowerCase()}.` });
    } catch (e: any) {
      setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo canjear" });
    } finally {
      setOcupado(null);
      setTimeout(() => setAviso(null), 7000);
    }
  };

  const Cabecera = () => (
    <header className="lv-topbar">
      <button className="lv-icon-btn" onClick={() => router.back()} aria-label="Atrás">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <h1 className="lv-topbar__title">Premios</h1>
    </header>
  );

  const activos = reglas.premios.filter(p => p.activo);
  const proximos = reglas.premios.filter(p => !p.activo);

  const Tarjeta = ({ p }: { p: PremioCatalogo }) => {
    const costo = costoPremio(p, esVendedor);
    const alcanza = saldo >= costo;
    const pct = costo > 0 ? Math.min(100, Math.round((saldo / costo) * 100)) : 0;
    const rebaja = esVendedor && p.loosVendedor != null && p.loosVendedor > 0 && p.loosVendedor < p.loos;

    return (
      <div className="lv-prize">
        <span className="lv-prize__ic">{ICONOS[p.id] ?? ICONOS.llavero}</span>
        <div className="lv-prize__n">{p.nombre}</div>
        <div className="lv-prize__d">{p.detalle}</div>
        <div className="lv-prize__c">
          {costo} LOOS
          {rebaja && <span className="lv-dim" style={{ fontWeight: 600, textDecoration: "line-through", marginLeft: 6, fontSize: "0.74rem" }}>{p.loos}</span>}
        </div>
        {profile && !alcanza && (
          <>
            <div className="lv-prize__bar"><span style={{ width: `${pct}%` }}/></div>
            <div className="lv-dim" style={{ fontSize: "0.71rem", marginTop: -4, marginBottom: 6 }}>
              Te faltan {costo - saldo}
            </div>
          </>
        )}
        <button
          className={`lv-btn lv-btn--sm lv-btn--block ${alcanza && profile ? "lv-btn--accent" : "lv-btn--soft"}`}
          style={{ marginTop: profile && !alcanza ? 0 : 10 }}
          disabled={ocupado === p.id || (!!profile && !alcanza)}
          onClick={() => canjear(p, costo)}
        >
          {ocupado === p.id ? "…" : !profile ? "Entrar para canjear" : alcanza ? "Canjear" : "Aún no"}
        </button>
      </div>
    );
  };

  return (
    <div className="lv-app">
      <Cabecera/>
      <div className="lv-pad" style={{ paddingTop: 16, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* Saldo */}
        <section className="lv-panel" style={{ textAlign: "center", padding: "22px 16px" }}>
          <div className="lv-eyebrow">Tus puntos</div>
          <div className="lv-loos" style={{ marginTop: 6 }}>
            <span className="lv-loos__n">{profile ? (loos === null ? "…" : saldo) : "—"}</span>
            <span className="lv-loos__u">LOOS</span>
          </div>
          {profile && loos !== null && loos.total > saldo && (
            <div className="lv-dim" style={{ fontSize: "0.76rem", marginTop: 5 }}>
              {loos.total} ganados de por vida
            </div>
          )}
          <p className="lv-dim" style={{ fontSize: "0.78rem", lineHeight: 1.55, marginTop: 10 }}>
            <strong>1 LOO por cada dólar</strong> que muevas en Vendeloo, compres o vendas.
            Se acreditan cuando la orden queda entregada.
          </p>
          {!profile && (
            <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" style={{ marginTop: 12 }} onClick={() => router.push("/login")}>
              Entrar para acumular
            </button>
          )}
        </section>

        {/* Cómo se ganan */}
        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Cómo ganar LOOS</div>
          {[
            [`Por cada $1 de una compra entregada`, `${reglas.loosPorUsd}`],
            [`Por cada $1 de una venta entregada`, `${reglas.loosPorUsd}`],
            ["Tu primera compra", `+${reglas.bonos.primeraCompra}`],
            ["Tu primera venta", `+${reglas.bonos.primeraVenta}`],
            ["Tu primer show en vivo", `+${reglas.bonos.primerShow}`],
            ["Calificar una orden", `+${reglas.bonos.calificar}`],
          ].map(([texto, valor]) => (
            <div key={texto} className="lv-row">
              <span style={{ fontSize: "0.84rem" }}>{texto}</span>
              <span className="lv-mono" style={{ fontWeight: 800, color: "var(--accent-strong)", flexShrink: 0 }}>{valor}</span>
            </div>
          ))}
        </section>

        {/* Catálogo */}
        <div>
          <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Cámbialos por</div>
          <div className="lv-prizes">
            {activos.map(p => <Tarjeta key={p.id} p={p}/>)}
          </div>
        </div>

        {proximos.length > 0 && (
          <div>
            <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Pronto</div>
            <div className="lv-prizes">
              {proximos.map(p => (
                <div key={p.id} className="lv-prize lv-prize--pronto">
                  <span className="lv-prize__ic">{ICONOS[p.id] ?? ICONOS.llavero}</span>
                  <div className="lv-prize__n">{p.nombre}</div>
                  <div className="lv-prize__d">{p.detalle}</div>
                  <div className="lv-prize__c" style={{ color: "var(--ink-3)" }}>{costoPremio(p, esVendedor)} LOOS</div>
                  <span className="lv-badge lv-badge--soft" style={{ marginTop: 8, alignSelf: "flex-start" }}>Pronto</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mis canjes */}
        {canjes.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Mis canjes</div>
            {canjes.map(c => {
              const e = ESTADO_CANJE[c.status] ?? { texto: c.status, clase: "lv-badge--soft" };
              return (
                <div key={c.id} className="lv-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{c.prizeName}</div>
                    <div className="lv-dim" style={{ fontSize: "0.72rem" }}>
                      {c.loosCost} LOOS
                      {c.createdAt?.toDate ? ` · ${c.createdAt.toDate().toLocaleDateString("es-VE")}` : ""}
                      {c.status === "cancelled" && c.note ? ` · ${c.note}` : ""}
                    </div>
                  </div>
                  <span className={`lv-badge ${e.clase}`} style={{ flexShrink: 0 }}>{e.texto}</span>
                </div>
              );
            })}
          </section>
        )}

        {/* Movimientos */}
        {profile && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Movimientos</div>
            {movimientos.length === 0
              ? <p className="lv-dim" style={{ fontSize: "0.8rem", padding: "6px 0 14px", lineHeight: 1.5 }}>
                  Todavía no tienes LOOS. Se acreditan solos cuando recibes tu primera compra
                  o cuando entregas tu primera venta.
                </p>
              : movimientos.map(m => (
                  <div key={m.id} className="lv-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{TIPO_MOVIMIENTO[m.type] ?? m.type}</div>
                      <div className="lv-dim" style={{ fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.note ?? ""}{m.createdAt?.toDate ? ` · ${m.createdAt.toDate().toLocaleDateString("es-VE")}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="lv-mono" style={{ fontWeight: 800, fontSize: "0.88rem", color: m.amount >= 0 ? "var(--accent-strong)" : "var(--ink)" }}>
                        {m.amount >= 0 ? "+" : ""}{m.amount}
                      </div>
                      <div className="lv-dim" style={{ fontSize: "0.7rem" }}>quedaron {m.balanceAfter ?? 0}</div>
                    </div>
                  </div>
                ))}
          </section>
        )}

        <p className="lv-dim" style={{ fontSize: "0.72rem", lineHeight: 1.55, textAlign: "center", padding: "0 8px 10px" }}>
          Los LOOS no son dinero: no se recargan, no se retiran y no pagan órdenes.
          Solo se cambian por mercancía de Vendeloo. La entrega la coordinamos por WhatsApp.
        </p>
      </div>
    </div>
  );
}
