"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";

interface Usuario {
  id: string; displayName?: string; email?: string; role?: string;
  sellerStatus?: string; shopName?: string; sellerCat?: string;
  whatsapp?: string; city?: string; avatar?: string;
}

type Pestana = "vendedores" | "config" | "resumen";

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuthStore();
  const [tab, setTab] = useState<Pestana>("vendedores");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tasa, setTasa] = useState<{ usdToBs?: number; updatedAt?: any } | null>(null);
  const [comision, setComision] = useState<{ mode?: string; platformFeePct?: number } | null>(null);
  const [activas, setActivas] = useState(0);
  const [ordenes, setOrdenes] = useState(0);

  const [tasaInput, setTasaInput] = useState("");
  const [pctInput, setPctInput] = useState("");
  const [modoInput, setModoInput] = useState<"seller_collects" | "platform_collects">("seller_collects");

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  const esAdmin = profile?.role === "admin";

  // ── Carga de datos (solo si es admin: si no, las reglas deniegan) ──
  useEffect(() => {
    if (!esAdmin) return;

    const u1 = onSnapshot(collection(db, "users"),
      s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario))),
      e => setAviso({ tipo: "bad", texto: `No se pudieron leer los usuarios: ${e.code}` }));

    const u2 = onSnapshot(doc(db, "exchangeRates", "current"),
      s => { const d = s.data(); setTasa(d ?? null); if (d?.usdToBs) setTasaInput(String(d.usdToBs)); });

    const u3 = onSnapshot(doc(db, "config", "commission"),
      s => {
        const d = s.data();
        setComision(d ?? null);
        if (d?.platformFeePct != null) setPctInput(String(d.platformFeePct));
        if (d?.mode) setModoInput(d.mode);
      });

    const u4 = onSnapshot(query(collection(db, "auctions"), where("status", "==", "active")),
      s => setActivas(s.size));

    return () => { u1(); u2(); u3(); u4(); };
  }, [esAdmin]);

  useEffect(() => {
    if (!esAdmin) return;
    getDoc(doc(db, "config", "commission")).catch(() => undefined);
    // El conteo de órdenes se lee aparte: las reglas obligan a filtrar,
    // y el admin sí puede leerlas todas.
    const u = onSnapshot(collection(db, "orders"), s => setOrdenes(s.size), () => setOrdenes(0));
    return () => u();
  }, [esAdmin]);

  // ── Acciones ──
  const correr = async (clave: string, fn: () => Promise<any>, exito: string) => {
    setOcupado(clave);
    setAviso(null);
    try {
      await fn();
      setAviso({ tipo: "ok", texto: exito });
    } catch (e: any) {
      setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo completar la acción" });
    } finally {
      setOcupado(null);
      setTimeout(() => setAviso(null), 5000);
    }
  };

  const aprobar = (u: Usuario) => correr(
    `ap_${u.id}`,
    () => httpsCallable(functions, "approveSeller")({ sellerUid: u.id }),
    `${u.displayName ?? u.id} ya puede vender`
  );

  const suspender = (u: Usuario) => {
    if (!confirm(`¿Suspender a ${u.displayName ?? u.id}? No podrá publicar más subastas.`)) return;
    correr(`sp_${u.id}`, () => httpsCallable(functions, "suspendSeller")({ sellerUid: u.id }),
      `${u.displayName ?? u.id} quedó suspendido`);
  };

  const guardarTasa = () => {
    const v = parseFloat(tasaInput);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "La tasa debe ser un número mayor que cero" }); return; }
    correr("tasa", () => httpsCallable(functions, "updateExchangeRate")({ usdToBs: v }),
      `Tasa actualizada a Bs ${v.toFixed(2)} por dólar`);
  };

  const guardarComision = () => {
    const p = parseFloat(pctInput);
    if (!isFinite(p) || p < 0 || p > 100) { setAviso({ tipo: "bad", texto: "El porcentaje debe estar entre 0 y 100" }); return; }
    correr("comision", () => httpsCallable(functions, "updateCommissionConfig")({ mode: modoInput, platformFeePct: p }),
      "Configuración de comisión guardada");
  };

  // ── Puertas ──
  if (authLoading) {
    return <div className="lv-app"><div className="lv-empty"><div className="lv-empty__text">Cargando…</div></div></div>;
  }

  if (!profile) {
    return (
      <div className="lv-app">
        <div className="lv-empty">
          <div className="lv-empty__title">Necesitas iniciar sesión</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 14 }} onClick={() => router.push("/login")}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  if (!esAdmin) {
    return (
      <div className="lv-app">
        <header className="lv-topbar">
          <button className="lv-icon-btn" onClick={() => router.push("/")} aria-label="Atrás">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 className="lv-topbar__title">Administración</h1>
        </header>
        <div className="lv-empty">
          <div className="lv-empty__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div className="lv-empty__title">Esta sección es solo para administradores</div>
          <div className="lv-empty__text">Tu cuenta no tiene ese permiso.</div>
        </div>
      </div>
    );
  }

  // ── Segmentación de vendedores ──
  const pendientes = usuarios.filter(u => u.sellerStatus === "pending");
  const aprobados = usuarios.filter(u => u.sellerStatus === "approved");
  const suspendidos = usuarios.filter(u => u.sellerStatus === "suspended");
  // Pusieron nombre de tienda pero nunca pidieron formalmente
  const interesados = usuarios.filter(u =>
    (u.sellerStatus == null || u.sellerStatus === "none") && !!u.shopName?.trim()
  );

  const FilaVendedor = ({ u, acciones }: { u: Usuario; acciones: React.ReactNode }) => (
    <div className="lv-row">
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {u.avatar
          ? <img className="lv-avatar" src={u.avatar} alt=""/>
          : <span className="lv-avatar">{(u.displayName ?? u.email ?? "?")[0].toUpperCase()}</span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.86rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.displayName ?? "Sin nombre"}
          </div>
          <div className="lv-dim" style={{ fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.shopName ? `${u.shopName} · ` : ""}{u.email}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{acciones}</div>
    </div>
  );

  return (
    <div className="lv-app">
      <header className="lv-topbar">
        <button className="lv-icon-btn" onClick={() => router.push("/")} aria-label="Atrás">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="lv-topbar__title">Administración</h1>
      </header>

      <div className="lv-chips">
        {([["vendedores", `Vendedores${pendientes.length + interesados.length > 0 ? ` (${pendientes.length + interesados.length})` : ""}`],
           ["config", "Tasa y comisión"],
           ["resumen", "Resumen"]] as [Pestana, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className={`lv-chip${tab === v ? " lv-chip--active" : ""}`}>{label}</button>
        ))}
      </div>

      {aviso && (
        <div className="lv-pad" style={{ paddingBottom: 12 }}>
          <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>
        </div>
      )}

      {/* ══ Vendedores ══ */}
      {tab === "vendedores" && (
        <div className="lv-pad" style={{ display: "grid", gap: 14 }}>

          {!tasa?.usdToBs && (
            <div className="lv-note lv-note--warn">
              <div>
                <strong>Falta la tasa de cambio.</strong> Sin ella, las órdenes que genere el motor
                quedan sin monto en bolívares. Configúrala en la pestaña «Tasa y comisión».
              </div>
            </div>
          )}

          {pendientes.length > 0 && (
            <section className="lv-panel">
              <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Solicitudes pendientes</div>
              {pendientes.map(u => (
                <FilaVendedor key={u.id} u={u} acciones={
                  <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>
                    {ocupado === `ap_${u.id}` ? "…" : "Aprobar"}
                  </button>
                }/>
              ))}
            </section>
          )}

          {interesados.length > 0 && (
            <section className="lv-panel">
              <div className="lv-eyebrow" style={{ marginBottom: 4 }}>Con tienda, sin aprobar</div>
              <p className="lv-dim" style={{ fontSize: "0.75rem", lineHeight: 1.5, marginBottom: 8 }}>
                Pusieron nombre de tienda cuando cualquiera podía autoproclamarse vendedor.
                Hoy necesitan tu aprobación para publicar.
              </p>
              {interesados.map(u => (
                <FilaVendedor key={u.id} u={u} acciones={
                  <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>
                    {ocupado === `ap_${u.id}` ? "…" : "Aprobar"}
                  </button>
                }/>
              ))}
            </section>
          )}

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Vendedores activos · {aprobados.length}</div>
            {aprobados.length === 0
              ? <p className="lv-dim" style={{ fontSize: "0.8rem" }}>Todavía ninguno.</p>
              : aprobados.map(u => (
                  <FilaVendedor key={u.id} u={u} acciones={
                    <>
                      <button className="lv-btn lv-btn--soft lv-btn--sm" onClick={() => router.push(`/seller/${u.id}`)}>Ver</button>
                      {u.role !== "admin" && (
                        <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `sp_${u.id}`} onClick={() => suspender(u)}>
                          {ocupado === `sp_${u.id}` ? "…" : "Suspender"}
                        </button>
                      )}
                    </>
                  }/>
                ))}
          </section>

          {suspendidos.length > 0 && (
            <section className="lv-panel">
              <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Suspendidos · {suspendidos.length}</div>
              {suspendidos.map(u => (
                <FilaVendedor key={u.id} u={u} acciones={
                  <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>
                    {ocupado === `ap_${u.id}` ? "…" : "Reactivar"}
                  </button>
                }/>
              ))}
            </section>
          )}
        </div>
      )}

      {/* ══ Tasa y comisión ══ */}
      {tab === "config" && (
        <div className="lv-pad" style={{ display: "grid", gap: 14 }}>

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 10 }}>Tasa de cambio</div>
            <p className="lv-dim" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginBottom: 14 }}>
              Al cerrar una subasta, el motor congela esta tasa en la orden. El comprador
              paga ese monto en bolívares aunque la tasa cambie después.
            </p>

            <div className="lv-field">
              <label className="lv-field__label" htmlFor="tasa">Bolívares por dólar</label>
              <input
                id="tasa" className="lv-input" type="number" inputMode="decimal" step="0.01" min="0"
                value={tasaInput} onChange={e => setTasaInput(e.target.value)} placeholder="Ej: 41.50"
              />
              <div className="lv-field__hint">
                {tasa?.usdToBs
                  ? `Actual: Bs ${tasa.usdToBs} · actualizada ${tasa.updatedAt?.toDate?.()?.toLocaleString("es-VE") ?? "—"}`
                  : "Nunca se ha configurado."}
              </div>
            </div>

            <button className="lv-btn lv-btn--primary lv-btn--block" disabled={ocupado === "tasa"} onClick={guardarTasa}>
              {ocupado === "tasa" ? "Guardando…" : "Guardar tasa"}
            </button>
          </section>

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 10 }}>Comisión de la plataforma</div>

            <div className="lv-field">
              <span className="lv-field__label">Quién cobra</span>
              <div style={{ display: "grid", gap: 8 }}>
                {([
                  ["seller_collects", "El vendedor cobra directo", "El ganador le paga al vendedor. La plataforma registra la orden y le cobra la comisión aparte."],
                  ["platform_collects", "La plataforma cobra todo", "El ganador le paga a la plataforma, que luego le gira al vendedor lo que queda."],
                ] as const).map(([v, titulo, desc]) => (
                  <button
                    key={v}
                    onClick={() => setModoInput(v)}
                    className="lv-panel lv-panel--flat"
                    style={{
                      textAlign: "left",
                      boxShadow: modoInput === v ? "inset 0 0 0 2px var(--ink)" : "none",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: 3 }}>{titulo}</div>
                    <div className="lv-dim" style={{ fontSize: "0.74rem", lineHeight: 1.45 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lv-field">
              <label className="lv-field__label" htmlFor="pct">Porcentaje de comisión</label>
              <input
                id="pct" className="lv-input" type="number" inputMode="decimal" step="0.5" min="0" max="100"
                value={pctInput} onChange={e => setPctInput(e.target.value)} placeholder="10"
              />
              <div className="lv-field__hint">
                {comision ? `Actual: ${comision.platformFeePct}% · ${comision.mode === "platform_collects" ? "plataforma cobra" : "vendedor cobra"}` : "Sin configurar."}
                {pctInput && isFinite(parseFloat(pctInput)) && (
                  <> · En una venta de $100 la plataforma se queda ${(parseFloat(pctInput)).toFixed(2)}</>
                )}
              </div>
            </div>

            <button className="lv-btn lv-btn--primary lv-btn--block" disabled={ocupado === "comision"} onClick={guardarComision}>
              {ocupado === "comision" ? "Guardando…" : "Guardar comisión"}
            </button>
          </section>
        </div>
      )}

      {/* ══ Resumen ══ */}
      {tab === "resumen" && (
        <div className="lv-pad" style={{ display: "grid", gap: 14 }}>
          <div className="lv-grid">
            {[
              ["Usuarios", usuarios.length],
              ["Vendedores", aprobados.length],
              ["Subastas activas", activas],
              ["Órdenes", ordenes],
            ].map(([label, valor]) => (
              <div key={String(label)} className="lv-panel">
                <div className="lv-eyebrow">{label}</div>
                <div className="lv-price lv-price--xl" style={{ marginTop: 4 }}>{valor}</div>
              </div>
            ))}
          </div>

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Configuración vigente</div>
            <div className="lv-row">
              <span className="lv-muted" style={{ fontSize: "0.84rem" }}>Tasa</span>
              <strong>{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "Sin configurar"}</strong>
            </div>
            <div className="lv-row">
              <span className="lv-muted" style={{ fontSize: "0.84rem" }}>Comisión</span>
              <strong>{comision?.platformFeePct != null ? `${comision.platformFeePct}%` : "—"}</strong>
            </div>
            <div className="lv-row">
              <span className="lv-muted" style={{ fontSize: "0.84rem" }}>Cobra</span>
              <strong>{comision?.mode === "platform_collects" ? "La plataforma" : "El vendedor"}</strong>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
