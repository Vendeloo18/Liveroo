"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
  updateDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { formatUsd } from "@subastas-ve/shared";

interface Usuario {
  id: string; displayName?: string; email?: string; role?: string;
  sellerStatus?: string; shopName?: string; sellerCat?: string;
  whatsapp?: string; city?: string; avatar?: string;
}

type Pestana = "vendedores" | "pagos" | "ordenes" | "config" | "resumen";

const ESTADO_ORDEN: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: "Por pagar", clase: "lv-badge--live" },
  payment_confirmed: { texto: "Pagada", clase: "lv-badge--accent" },
  shipped: { texto: "Enviada", clase: "lv-badge--soft" },
  delivered: { texto: "Entregada", clase: "lv-badge--soft" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--soft" },
};

const METODO_NOMBRE: Record<string, string> = {
  pago_movil: "Pago móvil", zelle: "Zelle", binance: "Binance",
  efectivo: "Efectivo", wallet: "Billetera",
};

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuthStore();
  const [tab, setTab] = useState<Pestana>("vendedores");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tasa, setTasa] = useState<{ usdToBs?: number; updatedAt?: any } | null>(null);
  const [comision, setComision] = useState<{ mode?: string; platformFeePct?: number } | null>(null);
  const [activas, setActivas] = useState(0);
  const [demo, setDemo] = useState(0);
  const [ordenes, setOrdenes] = useState(0);

  // Pagos
  const [depositos, setDepositos] = useState<any[]>([]);
  const [walletCfg, setWalletCfg] = useState<{ biddingRequiresBalance?: boolean } | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null);
  const [saldoSel, setSaldoSel] = useState<{ total: number; retenido: number } | null>(null);
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteNota, setAjusteNota] = useState("");
  const [pmBanco, setPmBanco] = useState("");
  const [pmTel, setPmTel] = useState("");
  const [pmCi, setPmCi] = useState("");
  const [zCorreo, setZCorreo] = useState("");
  const [zTitular, setZTitular] = useState("");
  const [ctaNota, setCtaNota] = useState("");

  // Órdenes
  const [ordenesLista, setOrdenesLista] = useState<any[]>([]);
  const [filtroOrden, setFiltroOrden] = useState<string>("todas");
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null);

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

    const u5 = onSnapshot(query(collection(db, "auctions"), where("isDemo", "==", true)),
      s => setDemo(s.size), () => setDemo(0));

    const u6 = onSnapshot(
      query(collection(db, "deposits"), where("status", "==", "pending"), orderBy("createdAt", "asc")),
      s => setDepositos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setDepositos([]));

    const u7 = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)),
      s => setOrdenesLista(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setOrdenesLista([]));

    const u8 = onSnapshot(doc(db, "config", "wallet"),
      s => setWalletCfg(s.exists() ? (s.data() as any) : null), () => undefined);

    const u9 = onSnapshot(doc(db, "config", "paymentAccounts"), s => {
      const d = s.data() as any;
      if (!d) return;
      setPmBanco(d.pagoMovil?.banco ?? ""); setPmTel(d.pagoMovil?.telefono ?? ""); setPmCi(d.pagoMovil?.cedula ?? "");
      setZCorreo(d.zelle?.correo ?? ""); setZTitular(d.zelle?.titular ?? "");
      setCtaNota(d.nota ?? "");
    }, () => undefined);

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, [esAdmin]);

  useEffect(() => {
    if (!esAdmin) return;
    getDoc(doc(db, "config", "commission")).catch(() => undefined);
    // El conteo de órdenes se lee aparte: las reglas obligan a filtrar,
    // y el admin sí puede leerlas todas.
    const u = onSnapshot(collection(db, "orders"), s => setOrdenes(s.size), () => setOrdenes(0));
    return () => u();
  }, [esAdmin]);

  // Saldo del usuario elegido en «Billeteras»
  useEffect(() => {
    if (!usuarioSel) { setSaldoSel(null); return; }
    return onSnapshot(doc(db, "wallets", usuarioSel.id),
      s => {
        const d = s.data() as any;
        setSaldoSel({ total: d?.balanceUsd ?? 0, retenido: d?.heldUsd ?? 0 });
      }, () => setSaldoSel({ total: 0, retenido: 0 }));
  }, [usuarioSel?.id]);

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

  // Sembrar y purgar pasan por una Function con permiso de admin: las
  // reglas ya no dejan escribir subastas desde fuera, que es lo correcto.
  const demoAccion = (accion: "seed" | "purge") => {
    if (accion === "purge" && !confirm(`¿Borrar las ${demo} subastas de demostración? Las reales no se tocan.`)) return;
    correr(
      `demo_${accion}`,
      () => httpsCallable(functions, "manageDemoAuctions")({ action: accion }),
      accion === "seed" ? "Catálogo de demostración sembrado" : "Demostración purgada"
    );
  };

  const decidirDeposito = (d: any, action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") {
      const r = prompt(`¿Por qué se rechaza la recarga de ${d.userName} (${formatUsd(d.amountUsd)}, ref ${d.reference})? El usuario lo va a ver:`);
      if (r === null) return;
      reason = r;
    } else if (!confirm(`¿Acreditar ${formatUsd(d.amountUsd)} a ${d.userName}? Verificaste la referencia ${d.reference}.`)) {
      return;
    }
    correr(`dep_${d.id}`,
      () => httpsCallable(functions, "manageDeposit")({ depositId: d.id, action, reason }),
      action === "approve" ? `${formatUsd(d.amountUsd)} acreditados a ${d.userName}` : "Solicitud rechazada");
  };

  const ajustarSaldo = (signo: 1 | -1) => {
    if (!usuarioSel) return;
    const v = parseFloat(ajusteMonto);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "Pon un monto mayor que cero" }); return; }
    if (ajusteNota.trim().length < 3) { setAviso({ tipo: "bad", texto: "La nota es obligatoria: queda en el historial del usuario" }); return; }
    const verbo = signo > 0 ? "Acreditar" : "Descontar";
    if (!confirm(`¿${verbo} ${formatUsd(v)} a ${usuarioSel.displayName ?? usuarioSel.email}?`)) return;
    correr("ajuste",
      () => httpsCallable(functions, "adjustWallet")({ userId: usuarioSel.id, amountUsd: signo * v, note: ajusteNota.trim() }),
      `Saldo de ${usuarioSel.displayName ?? usuarioSel.email} actualizado`);
    setAjusteMonto(""); setAjusteNota("");
  };

  const guardarCuentas = () => correr("cuentas", async () => {
    await setDoc(doc(db, "config", "paymentAccounts"), {
      pagoMovil: pmTel.trim() ? { banco: pmBanco.trim(), telefono: pmTel.trim(), cedula: pmCi.trim() } : null,
      zelle: zCorreo.trim() ? { correo: zCorreo.trim(), titular: zTitular.trim() } : null,
      nota: ctaNota.trim() || null,
      updatedAt: serverTimestamp(),
    });
  }, "Cuentas de recarga guardadas");

  const toggleSaldoObligatorio = () => {
    const activo = walletCfg?.biddingRequiresBalance === true;
    if (!activo && depositos.length === 0 && !pmTel && !zCorreo) {
      if (!confirm("Nadie puede recargar todavía (no hay cuentas configuradas). Si activas esto, nadie sin saldo podrá pujar. ¿Seguro?")) return;
    }
    correr("wallet_toggle", async () => {
      await setDoc(doc(db, "config", "wallet"), { biddingRequiresBalance: !activo, updatedAt: serverTimestamp() }, { merge: true });
    }, !activo ? "Ahora pujar exige saldo en la billetera" : "Pujar vuelve a ser libre, sin saldo");
  };

  const moverOrden = (o: any, cambios: Record<string, any>, pregunta: string, exito: string) => {
    if (!confirm(pregunta)) return;
    correr(`ord_${o.id}`,
      () => updateDoc(doc(db, "orders", o.id), { ...cambios, updatedAt: serverTimestamp() }),
      exito);
  };

  const traerBcv = () => correr("bcv",
    () => httpsCallable(functions, "syncBcvRateNow")({}),
    "Tasa actualizada desde el BCV");

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
           ["pagos", `Pagos${depositos.length > 0 ? ` (${depositos.length})` : ""}`],
           ["ordenes", `Órdenes${ordenesLista.filter(o => o.status === "pending_payment").length > 0 ? ` (${ordenesLista.filter(o => o.status === "pending_payment").length})` : ""}`],
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

      {/* ══ Pagos ══ */}
      {tab === "pagos" && (
        <div className="lv-pad" style={{ display: "grid", gap: 14 }}>

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Recargas por aprobar · {depositos.length}</div>
            {depositos.length === 0
              ? <p className="lv-dim" style={{ fontSize: "0.8rem" }}>No hay solicitudes pendientes.</p>
              : depositos.map(d => (
                  <div key={d.id} className="lv-row" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.87rem", fontWeight: 750 }}>{formatUsd(d.amountUsd)} · {d.userName ?? d.userId}</div>
                      <div className="lv-dim" style={{ fontSize: "0.73rem", lineHeight: 1.5 }}>
                        {METODO_NOMBRE[d.method] ?? d.method} · ref <strong>{d.reference}</strong>
                        {d.createdAt?.toDate ? ` · ${d.createdAt.toDate().toLocaleString("es-VE")}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `dep_${d.id}`}
                        onClick={() => decidirDeposito(d, "approve")}>
                        {ocupado === `dep_${d.id}` ? "…" : "Acreditar"}
                      </button>
                      <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `dep_${d.id}`}
                        onClick={() => decidirDeposito(d, "reject")}>Rechazar</button>
                    </div>
                  </div>
                ))}
          </section>

          <section className="lv-panel">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 750 }}>Pujar exige saldo</div>
                <div className="lv-dim" style={{ fontSize: "0.74rem", lineHeight: 1.45, marginTop: 3 }}>
                  {walletCfg?.biddingRequiresBalance
                    ? "Activo: cada puja se respalda con saldo DISPONIBLE. Mientras vas ganando queda retenido; si te superan se libera; al ganar, paga la orden solo."
                    : "Apagado: pujar es libre y el ganador coordina el pago después. El saldo, si existe, igual paga automático al ganar."}
                </div>
              </div>
              <button
                className={`lv-btn lv-btn--sm ${walletCfg?.biddingRequiresBalance ? "lv-btn--accent" : "lv-btn--outline"}`}
                disabled={ocupado === "wallet_toggle"}
                onClick={toggleSaldoObligatorio}
              >
                {walletCfg?.biddingRequiresBalance ? "Activado" : "Apagado"}
              </button>
            </div>
          </section>

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 8 }}>Billeteras · agregar créditos</div>
            <input className="lv-input" placeholder="Busca por nombre o correo…" value={buscaUsuario}
              onChange={e => { setBuscaUsuario(e.target.value); setUsuarioSel(null); }}/>
            {buscaUsuario.trim().length >= 2 && !usuarioSel && (
              <div style={{ marginTop: 8 }}>
                {usuarios
                  .filter(u => (`${u.displayName ?? ""} ${u.email ?? ""}`).toLowerCase().includes(buscaUsuario.trim().toLowerCase()))
                  .slice(0, 6)
                  .map(u => (
                    <button key={u.id} className="lv-row" style={{ width: "100%", textAlign: "left" }} onClick={() => setUsuarioSel(u)}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{u.displayName ?? "Sin nombre"}</div>
                        <div className="lv-dim" style={{ fontSize: "0.72rem" }}>{u.email}</div>
                      </div>
                      <span className="lv-dim" style={{ fontSize: "0.75rem", flexShrink: 0 }}>elegir →</span>
                    </button>
                  ))}
              </div>
            )}
            {usuarioSel && (
              <div style={{ marginTop: 10 }}>
                <div className="lv-row" style={{ borderBottom: "none" }}>
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 750 }}>{usuarioSel.displayName ?? usuarioSel.email}</div>
                    <div className="lv-dim" style={{ fontSize: "0.73rem" }}>{usuarioSel.email}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="lv-eyebrow">Saldo</div>
                    <div className="lv-price">{saldoSel === null ? "…" : formatUsd(saldoSel.total)}</div>
                    {saldoSel !== null && saldoSel.retenido > 0 && (
                      <div className="lv-dim" style={{ fontSize: "0.7rem" }}>
                        {formatUsd(saldoSel.retenido)} retenidos · disp. {formatUsd(saldoSel.total - saldoSel.retenido)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="aj-monto">Monto (USD)</label>
                  <input id="aj-monto" className="lv-input" type="number" inputMode="decimal" min="0" step="0.01"
                    value={ajusteMonto} onChange={e => setAjusteMonto(e.target.value)} placeholder="Ej: 10"/>
                </div>
                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="aj-nota">Nota (el usuario la ve en sus movimientos)</label>
                  <input id="aj-nota" className="lv-input" value={ajusteNota} onChange={e => setAjusteNota(e.target.value)}
                    placeholder="Ej: bono de bienvenida" maxLength={120}/>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="lv-btn lv-btn--accent lv-btn--sm" style={{ flex: 1 }}
                    disabled={ocupado === "ajuste"} onClick={() => ajustarSaldo(1)}>+ Acreditar</button>
                  <button className="lv-btn lv-btn--outline lv-btn--sm" style={{ flex: 1 }}
                    disabled={ocupado === "ajuste"} onClick={() => ajustarSaldo(-1)}>− Descontar</button>
                </div>
              </div>
            )}
          </section>

          <section className="lv-panel">
            <div className="lv-eyebrow" style={{ marginBottom: 4 }}>Cuentas de recarga</div>
            <p className="lv-dim" style={{ fontSize: "0.75rem", lineHeight: 1.5, marginBottom: 10 }}>
              Esto es lo que ve el usuario al recargar. Un método sin datos no se ofrece.
            </p>
            <div className="lv-field">
              <span className="lv-field__label">Pago móvil</span>
              <div style={{ display: "grid", gap: 8 }}>
                <input className="lv-input" placeholder="Banco (ej: Banesco)" value={pmBanco} onChange={e => setPmBanco(e.target.value)}/>
                <input className="lv-input" placeholder="Teléfono (ej: 0414-1234567)" value={pmTel} onChange={e => setPmTel(e.target.value)}/>
                <input className="lv-input" placeholder="Cédula o RIF" value={pmCi} onChange={e => setPmCi(e.target.value)}/>
              </div>
            </div>
            <div className="lv-field">
              <span className="lv-field__label">Zelle</span>
              <div style={{ display: "grid", gap: 8 }}>
                <input className="lv-input" placeholder="Correo" value={zCorreo} onChange={e => setZCorreo(e.target.value)}/>
                <input className="lv-input" placeholder="Titular" value={zTitular} onChange={e => setZTitular(e.target.value)}/>
              </div>
            </div>
            <div className="lv-field">
              <label className="lv-field__label" htmlFor="cta-nota">Nota para el que recarga (opcional)</label>
              <input id="cta-nota" className="lv-input" value={ctaNota} onChange={e => setCtaNota(e.target.value)}
                placeholder="Ej: pon tu nombre de usuario en el concepto" maxLength={200}/>
            </div>
            <button className="lv-btn lv-btn--primary lv-btn--block" disabled={ocupado === "cuentas"} onClick={guardarCuentas}>
              {ocupado === "cuentas" ? "Guardando…" : "Guardar cuentas"}
            </button>
          </section>
        </div>
      )}

      {/* ══ Órdenes ══ */}
      {tab === "ordenes" && (
        <div className="lv-pad" style={{ display: "grid", gap: 14 }}>
          <div className="lv-chips" style={{ padding: 0 }}>
            {([["todas", "Todas"], ["pending_payment", "Por pagar"], ["payment_confirmed", "Pagadas"],
               ["shipped", "Enviadas"], ["delivered", "Entregadas"], ["cancelled", "Canceladas"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setFiltroOrden(v)}
                className={`lv-chip${filtroOrden === v ? " lv-chip--active" : ""}`}>
                {label}
              </button>
            ))}
          </div>

          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            {ordenesLista.filter(o => filtroOrden === "todas" || o.status === filtroOrden).length === 0 && (
              <p className="lv-dim" style={{ fontSize: "0.8rem", padding: "12px 0" }}>Nada por aquí.</p>
            )}
            {ordenesLista.filter(o => filtroOrden === "todas" || o.status === filtroOrden).map(o => {
              const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: "lv-badge--soft" };
              const abierta = ordenAbierta === o.id;
              return (
                <div key={o.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <button style={{ width: "100%", textAlign: "left", padding: "11px 0", display: "flex", alignItems: "center", gap: 10 }}
                    onClick={() => setOrdenAbierta(abierta ? null : o.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.86rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.productTitle ?? o.auctionId}
                      </div>
                      <div className="lv-dim" style={{ fontSize: "0.72rem" }}>
                        {o.buyerName} → {o.sellerName} · {formatUsd(o.bidAmountUsd ?? 0)}
                        {o.paymentMethod === "wallet" ? " · pagó con billetera" : ""}
                      </div>
                    </div>
                    <span className={`lv-badge ${e.clase}`} style={{ flexShrink: 0 }}>{e.texto}</span>
                  </button>

                  {abierta && (
                    <div style={{ paddingBottom: 13 }}>
                      <div className="lv-dim" style={{ fontSize: "0.76rem", lineHeight: 1.7 }}>
                        <div>Monto: <strong>{formatUsd(o.bidAmountUsd ?? 0)}</strong>{o.bidAmountBs ? ` · Bs ${o.bidAmountBs}` : ""} · comisión {formatUsd(o.commissionUsd ?? 0)} · recibe vendedor <strong>{formatUsd(o.sellerReceivesUsd ?? 0)}</strong></div>
                        <div>Pago: {o.paymentMethod ? `${METODO_NOMBRE[o.paymentMethod] ?? o.paymentMethod}${o.paymentReference ? ` · ref ${o.paymentReference}` : ""}` : "sin registrar"}</div>
                        <div>
                          Comprador: {o.buyerName}{o.buyerWhatsapp && <> · <a href={`https://wa.me/${String(o.buyerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{o.buyerWhatsapp}</a></>}
                          {" · "}Vendedor: {o.sellerName}{o.sellerWhatsapp && <> · <a href={`https://wa.me/${String(o.sellerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{o.sellerWhatsapp}</a></>}
                        </div>
                        <div>Creada: {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("es-VE") : "—"} · id {o.id}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {o.status === "pending_payment" && (
                          <>
                            <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ord_${o.id}`}
                              onClick={() => moverOrden(o,
                                { status: "payment_confirmed", paymentConfirmedAt: serverTimestamp(), paymentConfirmedBy: profile!.uid },
                                `¿Confirmar el pago de ${o.buyerName} por ${formatUsd(o.bidAmountUsd ?? 0)}?`,
                                "Pago confirmado")}>Confirmar pago</button>
                            <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `ord_${o.id}`}
                              onClick={() => moverOrden(o, { status: "cancelled" },
                                "¿Cancelar esta orden? Política vigente: SIN reembolsos — cancelar no devuelve saldo ni pagos. Un ajuste manual en Pagos queda para casos excepcionales.",
                                "Orden cancelada")}>Cancelar</button>
                          </>
                        )}
                        {o.status === "payment_confirmed" && (
                          <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ord_${o.id}`}
                            onClick={() => moverOrden(o, { status: "shipped", shippedAt: serverTimestamp() },
                              "¿Marcar como enviada?", "Orden marcada como enviada")}>Marcar enviada</button>
                        )}
                        {o.status === "shipped" && (
                          <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ord_${o.id}`}
                            onClick={() => moverOrden(o, { status: "delivered", deliveredAt: serverTimestamp() },
                              "¿Marcar como entregada? Normalmente lo confirma el comprador; usa esto solo para destrabar.",
                              "Orden marcada como entregada")}>Marcar entregada</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
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
            <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 8 }} disabled={ocupado === "bcv"} onClick={traerBcv}>
              {ocupado === "bcv" ? "Consultando…" : "Actualizar del BCV ahora"}
            </button>
            <p className="lv-dim" style={{ fontSize: "0.73rem", lineHeight: 1.5, marginTop: 10 }}>
              La tasa oficial se sincroniza sola cada 4 horas (fuente: ve.dolarapi.com,
              espejo del BCV). Fijarla a mano vale hasta la próxima sincronización.
            </p>
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
            <div className="lv-eyebrow" style={{ marginBottom: 6 }}>Datos de demostración</div>
            <p className="lv-dim" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginBottom: 12 }}>
              Catálogo de prueba con vendedores ficticios, para que la app no se vea
              vacía mientras llegan vendedores reales. Cero pujas inventadas y cierres
              escalonados. Ahora hay <strong>{demo}</strong> marcadas como demo.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="lv-btn lv-btn--accent lv-btn--sm"
                style={{ flex: 1 }}
                disabled={ocupado === "demo_seed"}
                onClick={() => demoAccion("seed")}
              >
                {ocupado === "demo_seed" ? "Sembrando…" : "Sembrar 16"}
              </button>
              <button
                className="lv-btn lv-btn--outline lv-btn--sm"
                style={{ flex: 1 }}
                disabled={ocupado === "demo_purge" || demo === 0}
                onClick={() => demoAccion("purge")}
              >
                {ocupado === "demo_purge" ? "Borrando…" : "Purgar demo"}
              </button>
            </div>
          </section>

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
