"use client";
import { useEffect, useState } from "react";
import {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
  updateDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { BRAND, SIMBOLO_PATH, formatUsd } from "@subastas-ve/shared";

interface Usuario {
  id: string; displayName?: string; email?: string; role?: string;
  sellerStatus?: string; shopName?: string; sellerCat?: string;
  whatsapp?: string; city?: string; avatar?: string;
}

type Seccion = "resumen" | "vendedores" | "pagos" | "ordenes" | "usuarios" | "ajustes";

const ESTADO_ORDEN: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: "Por pagar", clase: "adm-badge--live" },
  payment_confirmed: { texto: "Pagada", clase: "adm-badge--accent" },
  shipped: { texto: "Enviada", clase: "adm-badge--soft" },
  delivered: { texto: "Entregada", clase: "adm-badge--ok" },
  cancelled: { texto: "Cancelada", clase: "adm-badge--soft" },
};
const METODO_NOMBRE: Record<string, string> = {
  pago_movil: "Pago móvil", zelle: "Zelle", binance: "Binance", efectivo: "Efectivo", wallet: "Billetera",
};
const ROL_ETIQUETA: Record<string, string> = { admin: "Administrador", seller: "Vendedor", buyer: "Comprador" };
const VENDEDOR_ETIQUETA: Record<string, string> = {
  approved: "Aprobado", pending: "Pendiente", suspended: "Suspendido", none: "—",
};

function Tag({ size = 26, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/>
    </svg>
  );
}

const ICO: Record<Seccion, JSX.Element> = {
  resumen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  vendedores: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16"/></svg>,
  pagos: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  ordenes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>,
  usuarios: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  ajustes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

export default function AdminPage() {
  const { profile, loading: authLoading, signIn, signOut, error } = useAuthStore();
  const [seccion, setSeccion] = useState<Seccion>("resumen");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tasa, setTasa] = useState<{ usdToBs?: number; updatedAt?: any } | null>(null);
  const [comision, setComision] = useState<{ mode?: string; platformFeePct?: number } | null>(null);
  const [activas, setActivas] = useState(0);
  const [demo, setDemo] = useState(0);
  const [ordenes, setOrdenes] = useState(0);
  const [walletsTotal, setWalletsTotal] = useState<{ saldo: number; retenido: number; cuentas: number } | null>(null);

  // Pagos
  const [depositos, setDepositos] = useState<any[]>([]);
  const [walletCfg, setWalletCfg] = useState<{ biddingRequiresBalance?: boolean } | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null);
  const [saldoSel, setSaldoSel] = useState<{ total: number; retenido: number } | null>(null);
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteNota, setAjusteNota] = useState("");
  const [pmBanco, setPmBanco] = useState(""); const [pmTel, setPmTel] = useState(""); const [pmCi, setPmCi] = useState("");
  const [zCorreo, setZCorreo] = useState(""); const [zTitular, setZTitular] = useState("");
  const [ctaNota, setCtaNota] = useState("");

  // Órdenes
  const [ordenesLista, setOrdenesLista] = useState<any[]>([]);
  const [filtroOrden, setFiltroOrden] = useState<string>("todas");
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null);

  // Usuarios (buscador de la sección)
  const [buscaU, setBuscaU] = useState("");

  const [tasaInput, setTasaInput] = useState("");
  const [pctInput, setPctInput] = useState("");
  const [modoInput, setModoInput] = useState<"seller_collects" | "platform_collects">("seller_collects");

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  // Login del panel
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [entrando, setEntrando] = useState(false);

  const esAdmin = profile?.role === "admin";

  // ── Carga de datos (solo si es admin: si no, las reglas deniegan) ──
  useEffect(() => {
    if (!esAdmin) return;
    const u1 = onSnapshot(collection(db, "users"),
      s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario))),
      e => setAviso({ tipo: "bad", texto: `No se pudieron leer los usuarios: ${e.code}` }));
    const u2 = onSnapshot(doc(db, "exchangeRates", "current"),
      s => { const d = s.data(); setTasa(d ?? null); if (d?.usdToBs) setTasaInput(String(d.usdToBs)); });
    const u3 = onSnapshot(doc(db, "config", "commission"), s => {
      const d = s.data(); setComision(d ?? null);
      if (d?.platformFeePct != null) setPctInput(String(d.platformFeePct));
      if (d?.mode) setModoInput(d.mode);
    });
    const u4 = onSnapshot(query(collection(db, "auctions"), where("status", "==", "active")), s => setActivas(s.size));
    const u5 = onSnapshot(query(collection(db, "auctions"), where("isDemo", "==", true)), s => setDemo(s.size), () => setDemo(0));
    const u6 = onSnapshot(query(collection(db, "deposits"), where("status", "==", "pending"), orderBy("createdAt", "asc")),
      s => setDepositos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setDepositos([]));
    const u7 = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)),
      s => setOrdenesLista(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setOrdenesLista([]));
    const u8 = onSnapshot(doc(db, "config", "wallet"), s => setWalletCfg(s.exists() ? (s.data() as any) : null), () => undefined);
    const u9 = onSnapshot(doc(db, "config", "paymentAccounts"), s => {
      const d = s.data() as any; if (!d) return;
      setPmBanco(d.pagoMovil?.banco ?? ""); setPmTel(d.pagoMovil?.telefono ?? ""); setPmCi(d.pagoMovil?.cedula ?? "");
      setZCorreo(d.zelle?.correo ?? ""); setZTitular(d.zelle?.titular ?? ""); setCtaNota(d.nota ?? "");
    }, () => undefined);
    // Suma de saldos de todas las billeteras (el admin puede listarlas)
    const u10 = onSnapshot(collection(db, "wallets"), s => {
      let saldo = 0, retenido = 0;
      s.docs.forEach(d => { const w = d.data() as any; saldo += w.balanceUsd ?? 0; retenido += w.heldUsd ?? 0; });
      setWalletsTotal({ saldo: Math.round(saldo * 100) / 100, retenido: Math.round(retenido * 100) / 100, cuentas: s.size });
    }, () => setWalletsTotal(null));
    const uO = onSnapshot(collection(db, "orders"), s => setOrdenes(s.size), () => setOrdenes(0));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); uO(); };
  }, [esAdmin]);

  useEffect(() => {
    if (!usuarioSel) { setSaldoSel(null); return; }
    return onSnapshot(doc(db, "wallets", usuarioSel.id), s => {
      const d = s.data() as any;
      setSaldoSel({ total: d?.balanceUsd ?? 0, retenido: d?.heldUsd ?? 0 });
    }, () => setSaldoSel({ total: 0, retenido: 0 }));
  }, [usuarioSel?.id]);

  // ── Acciones ──
  const correr = async (clave: string, fn: () => Promise<any>, exito: string) => {
    setOcupado(clave); setAviso(null);
    try { await fn(); setAviso({ tipo: "ok", texto: exito }); }
    catch (e: any) { setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo completar la acción" }); }
    finally { setOcupado(null); setTimeout(() => setAviso(null), 5000); }
  };

  const aprobar = (u: Usuario) => correr(`ap_${u.id}`,
    () => httpsCallable(functions, "approveSeller")({ sellerUid: u.id }), `${u.displayName ?? u.id} ya puede vender`);
  const suspender = (u: Usuario) => {
    if (!confirm(`¿Suspender a ${u.displayName ?? u.id}? No podrá publicar más subastas.`)) return;
    correr(`sp_${u.id}`, () => httpsCallable(functions, "suspendSeller")({ sellerUid: u.id }), `${u.displayName ?? u.id} quedó suspendido`);
  };
  const demoAccion = (accion: "seed" | "purge") => {
    if (accion === "purge" && !confirm(`¿Borrar las ${demo} subastas de demostración? Las reales no se tocan.`)) return;
    correr(`demo_${accion}`, () => httpsCallable(functions, "manageDemoAuctions")({ action: accion }),
      accion === "seed" ? "Catálogo de demostración sembrado" : "Demostración purgada");
  };
  const decidirDeposito = (d: any, action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") {
      const r = prompt(`¿Por qué se rechaza la recarga de ${d.userName} (${formatUsd(d.amountUsd)}, ref ${d.reference})? El usuario lo va a ver:`);
      if (r === null) return; reason = r;
    } else if (!confirm(`¿Acreditar ${formatUsd(d.amountUsd)} a ${d.userName}? Verificaste la referencia ${d.reference}.`)) return;
    correr(`dep_${d.id}`, () => httpsCallable(functions, "manageDeposit")({ depositId: d.id, action, reason }),
      action === "approve" ? `${formatUsd(d.amountUsd)} acreditados a ${d.userName}` : "Solicitud rechazada");
  };
  const ajustarSaldo = (signo: 1 | -1) => {
    if (!usuarioSel) return;
    const v = parseFloat(ajusteMonto);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "Pon un monto mayor que cero" }); return; }
    if (ajusteNota.trim().length < 3) { setAviso({ tipo: "bad", texto: "La nota es obligatoria: queda en el historial del usuario" }); return; }
    const verbo = signo > 0 ? "Acreditar" : "Descontar";
    if (!confirm(`¿${verbo} ${formatUsd(v)} a ${usuarioSel.displayName ?? usuarioSel.email}?`)) return;
    correr("ajuste", () => httpsCallable(functions, "adjustWallet")({ userId: usuarioSel.id, amountUsd: signo * v, note: ajusteNota.trim() }),
      `Saldo de ${usuarioSel.displayName ?? usuarioSel.email} actualizado`);
    setAjusteMonto(""); setAjusteNota("");
  };
  const guardarCuentas = () => correr("cuentas", async () => {
    await setDoc(doc(db, "config", "paymentAccounts"), {
      pagoMovil: pmTel.trim() ? { banco: pmBanco.trim(), telefono: pmTel.trim(), cedula: pmCi.trim() } : null,
      zelle: zCorreo.trim() ? { correo: zCorreo.trim(), titular: zTitular.trim() } : null,
      nota: ctaNota.trim() || null, updatedAt: serverTimestamp(),
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
    correr(`ord_${o.id}`, () => updateDoc(doc(db, "orders", o.id), { ...cambios, updatedAt: serverTimestamp() }), exito);
  };
  const traerBcv = () => correr("bcv", () => httpsCallable(functions, "syncBcvRateNow")({}), "Tasa actualizada desde el BCV");
  const guardarTasa = () => {
    const v = parseFloat(tasaInput);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "La tasa debe ser un número mayor que cero" }); return; }
    correr("tasa", () => httpsCallable(functions, "updateExchangeRate")({ usdToBs: v }), `Tasa actualizada a Bs ${v.toFixed(2)} por dólar`);
  };
  const guardarComision = () => {
    const p = parseFloat(pctInput);
    if (!isFinite(p) || p < 0 || p > 100) { setAviso({ tipo: "bad", texto: "El porcentaje debe estar entre 0 y 100" }); return; }
    correr("comision", () => httpsCallable(functions, "updateCommissionConfig")({ mode: modoInput, platformFeePct: p }), "Configuración de comisión guardada");
  };

  const entrar = async () => {
    if (!loginEmail.trim() || !loginPass) return;
    setEntrando(true);
    try { await signIn(loginEmail.trim(), loginPass); } finally { setEntrando(false); }
  };

  // ══════════════ Puertas ══════════════
  if (authLoading) {
    return <div className="adm-login"><div className="adm-login__card" style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</div></div>;
  }

  if (!profile) {
    return (
      <div className="adm-login">
        <div className="adm-login__card">
          <div className="adm-login__brand"><Tag size={30} color="var(--accent)"/><span className="n">VENDELOO</span></div>
          <div className="adm-login__eyebrow">Panel de administración</div>
          <h1>Entra a controlar todo</h1>
          <p>Acceso solo para administradores. Aquí ves y gestionas usuarios, vendedores, pagos, órdenes y la configuración de la plataforma.</p>
          {error && <div className="adm-note adm-note--bad" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="adm-field">
            <label htmlFor="ale">Correo</label>
            <input id="ale" className="adm-input" type="email" autoComplete="username" value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="admin@vendeloo.io"/>
          </div>
          <div className="adm-field">
            <label htmlFor="alp">Contraseña</label>
            <input id="alp" className="adm-input" type="password" autoComplete="current-password" value={loginPass}
              onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="••••••••"/>
          </div>
          <button className="adm-btn adm-btn--accent adm-btn--block" disabled={entrando} onClick={entrar} style={{ marginTop: 4, padding: 12 }}>
            {entrando ? "Entrando…" : "Entrar al panel"}
          </button>
        </div>
      </div>
    );
  }

  if (!esAdmin) {
    return (
      <div className="adm-login">
        <div className="adm-login__card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Tag size={34} color="var(--accent)"/></div>
          <h1>Sin acceso</h1>
          <p style={{ marginBottom: 18 }}>Tu cuenta ({profile.email}) no es administradora. Si debería serlo, pide que te asignen el rol.</p>
          <button className="adm-btn adm-btn--outline adm-btn--block" onClick={() => signOut()}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  // ── Derivados ──
  const pendientes = usuarios.filter(u => u.sellerStatus === "pending");
  const interesados = usuarios.filter(u => (u.sellerStatus == null || u.sellerStatus === "none") && !!u.shopName?.trim());
  const aprobados = usuarios.filter(u => u.sellerStatus === "approved");
  const suspendidos = usuarios.filter(u => u.sellerStatus === "suspended");
  const porPagar = ordenesLista.filter(o => o.status === "pending_payment").length;
  const gmv = Math.round(ordenesLista.reduce((n, o) => n + (o.bidAmountUsd ?? 0), 0) * 100) / 100;
  const compradores = usuarios.filter(u => u.role !== "seller" && u.role !== "admin").length;

  const NAV: { id: Seccion; label: string; cuenta?: number }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "vendedores", label: "Vendedores", cuenta: pendientes.length + interesados.length },
    { id: "pagos", label: "Pagos", cuenta: depositos.length },
    { id: "ordenes", label: "Órdenes", cuenta: porPagar },
    { id: "usuarios", label: "Usuarios" },
    { id: "ajustes", label: "Ajustes" },
  ];

  const Ava = ({ u }: { u: Usuario }) => u.avatar
    ? <img className="adm-ava" src={u.avatar} alt=""/>
    : <span className="adm-ava">{(u.displayName ?? u.email ?? "?")[0].toUpperCase()}</span>;

  const usuariosFiltrados = usuarios
    .filter(u => { const t = buscaU.trim().toLowerCase(); return !t || `${u.displayName ?? ""} ${u.email ?? ""} ${u.shopName ?? ""}`.toLowerCase().includes(t); })
    .sort((a, b) => (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""));

  const titulos: Record<Seccion, { t: string; s: string }> = {
    resumen: { t: "Resumen", s: "Todo lo que pasa en Vendeloo, de un vistazo" },
    vendedores: { t: "Vendedores", s: "Aprueba, suspende y revisa a quién vende" },
    pagos: { t: "Pagos y billeteras", s: "Aprueba recargas, acredita saldo y define las cuentas de cobro" },
    ordenes: { t: "Órdenes", s: "Cada venta, su estado y con quién se hizo" },
    usuarios: { t: "Usuarios", s: `${usuarios.length} cuentas registradas` },
    ajustes: { t: "Ajustes", s: "Tasa, comisión y datos de demostración" },
  };

  return (
    <div className="adm">
      {/* ── Barra lateral ── */}
      <aside className="adm-side">
        <div className="adm-side__brand">
          <Tag size={26} color="var(--accent)"/>
          <div><div className="n">VENDELOO</div><div className="tag">Admin</div></div>
        </div>
        <nav className="adm-side__nav">
          {NAV.map(n => (
            <button key={n.id} className={`adm-nav-item${seccion === n.id ? " active" : ""}`} onClick={() => setSeccion(n.id)}>
              {ICO[n.id]}
              <span>{n.label}</span>
              {!!n.cuenta && n.cuenta > 0 && <span className="cuenta cuenta--alerta">{n.cuenta}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-side__foot">
          <div className="adm-side__me">Conectado como<br/><b>{profile.email}</b></div>
          <button className="adm-side__logout" onClick={() => { if (confirm("¿Cerrar sesión del panel?")) signOut(); }}>Cerrar sesión</button>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <main className="adm-main">
        <div className="adm-top">
          <div>
            <h1>{titulos[seccion].t}</h1>
            <div className="sub">{titulos[seccion].s}</div>
          </div>
          <div className="adm-top__stat">
            <div className="s"><div className="k">Tasa BCV</div><div className="v">{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "—"}</div></div>
            <div className="s"><div className="k">Pujar exige saldo</div><div className="v">{walletCfg?.biddingRequiresBalance ? "Sí" : "No"}</div></div>
          </div>
        </div>

        <div className="adm-body">
          {aviso && <div className={`adm-note adm-note--${aviso.tipo === "ok" ? "ok" : "bad"}`}>{aviso.texto}</div>}
          {!tasa?.usdToBs && seccion !== "ajustes" && (
            <div className="adm-note adm-note--warn">Falta la tasa de cambio. Sin ella, las órdenes nacen sin monto en bolívares. Configúrala en <b>Ajustes</b>.</div>
          )}

          {/* ═══ RESUMEN ═══ */}
          {seccion === "resumen" && (
            <>
              <div className="adm-metrics">
                <div className="adm-metric"><div className="k">Usuarios</div><div className="v">{usuarios.length}</div><div className="sub">{compradores} compradores · {aprobados.length} vendedores</div></div>
                <div className="adm-metric"><div className="k">Subastas activas</div><div className="v">{activas}</div><div className="sub">{demo} de demostración</div></div>
                <div className="adm-metric"><div className="k">Órdenes</div><div className="v">{ordenes}</div><div className="sub">{formatUsd(gmv)} transados (últimas 100)</div></div>
                <div className="adm-metric"><div className="k">En billeteras</div><div className="v">{walletsTotal ? formatUsd(walletsTotal.saldo) : "…"}</div><div className="sub">{walletsTotal ? `${formatUsd(walletsTotal.retenido)} retenidos` : ""}</div></div>
              </div>

              <div className="adm-metrics">
                <div className={`adm-metric${pendientes.length + interesados.length > 0 ? " adm-metric--alerta" : ""}`}>
                  <div className="k">Vendedores por aprobar</div><div className="v">{pendientes.length + interesados.length}</div>
                  <div className="sub"><button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSeccion("vendedores")} style={{ marginTop: 4 }}>Revisar →</button></div>
                </div>
                <div className={`adm-metric${depositos.length > 0 ? " adm-metric--alerta" : ""}`}>
                  <div className="k">Recargas por aprobar</div><div className="v">{depositos.length}</div>
                  <div className="sub"><button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSeccion("pagos")} style={{ marginTop: 4 }}>Ir a pagos →</button></div>
                </div>
                <div className={`adm-metric${porPagar > 0 ? " adm-metric--alerta" : ""}`}>
                  <div className="k">Órdenes por pagar</div><div className="v">{porPagar}</div>
                  <div className="sub"><button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSeccion("ordenes")} style={{ marginTop: 4 }}>Ver órdenes →</button></div>
                </div>
                <div className="adm-metric"><div className="k">Comisión</div><div className="v">{comision?.platformFeePct != null ? `${comision.platformFeePct}%` : "—"}</div><div className="sub">{comision?.mode === "platform_collects" ? "Cobra la plataforma" : "Cobra el vendedor"}</div></div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel__t">Estado de la plataforma</div>
                <div className="adm-row"><div className="adm-row__meta" style={{ fontSize: "0.86rem", color: "var(--ink)" }}>Tasa de cambio</div><strong>{tasa?.usdToBs ? `Bs ${tasa.usdToBs} / USD` : "Sin configurar"}</strong></div>
                <div className="adm-row"><div className="adm-row__meta" style={{ fontSize: "0.86rem", color: "var(--ink)" }}>Pujar exige saldo</div><span className={`adm-badge ${walletCfg?.biddingRequiresBalance ? "adm-badge--accent" : "adm-badge--soft"}`}>{walletCfg?.biddingRequiresBalance ? "Activado (beta)" : "Apagado"}</span></div>
                <div className="adm-row"><div className="adm-row__meta" style={{ fontSize: "0.86rem", color: "var(--ink)" }}>Cuentas de recarga</div><span className={`adm-badge ${pmTel || zCorreo ? "adm-badge--ok" : "adm-badge--warn"}`}>{pmTel || zCorreo ? "Configuradas" : "Sin configurar"}</span></div>
              </div>
            </>
          )}

          {/* ═══ VENDEDORES ═══ */}
          {seccion === "vendedores" && (
            <>
              {pendientes.length > 0 && (
                <div className="adm-panel">
                  <div className="adm-panel__t">Solicitudes pendientes · {pendientes.length}</div>
                  {pendientes.map(u => (
                    <div key={u.id} className="adm-row">
                      <div className="adm-row__main"><Ava u={u}/><div style={{ minWidth: 0 }}><div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div><div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{u.email}</div></div></div>
                      <div className="adm-row__act"><button className="adm-btn adm-btn--accent adm-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Aprobar"}</button></div>
                    </div>
                  ))}
                </div>
              )}
              {interesados.length > 0 && (
                <div className="adm-panel">
                  <div className="adm-panel__t">Con tienda, sin aprobar · {interesados.length}</div>
                  {interesados.map(u => (
                    <div key={u.id} className="adm-row">
                      <div className="adm-row__main"><Ava u={u}/><div style={{ minWidth: 0 }}><div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div><div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{u.email}</div></div></div>
                      <div className="adm-row__act"><button className="adm-btn adm-btn--outline adm-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Aprobar"}</button></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="adm-panel">
                <div className="adm-panel__t">Vendedores activos · {aprobados.length}</div>
                {aprobados.length === 0 ? <p className="adm-row__meta">Todavía ninguno.</p> : aprobados.map(u => (
                  <div key={u.id} className="adm-row">
                    <div className="adm-row__main"><Ava u={u}/><div style={{ minWidth: 0 }}><div className="adm-row__name">{u.displayName ?? "Sin nombre"}{u.role === "admin" && <span className="adm-badge adm-badge--soft" style={{ marginLeft: 8 }}>Admin</span>}</div><div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{u.sellerCat ?? ""}{u.city ? ` · ${u.city}` : ""}</div></div></div>
                    <div className="adm-row__act">
                      <a className="adm-btn adm-btn--ghost adm-btn--sm" href={`/seller/${u.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver tienda</a>
                      {u.role !== "admin" && <button className="adm-btn adm-btn--danger adm-btn--sm" disabled={ocupado === `sp_${u.id}`} onClick={() => suspender(u)}>{ocupado === `sp_${u.id}` ? "…" : "Suspender"}</button>}
                    </div>
                  </div>
                ))}
              </div>
              {suspendidos.length > 0 && (
                <div className="adm-panel">
                  <div className="adm-panel__t">Suspendidos · {suspendidos.length}</div>
                  {suspendidos.map(u => (
                    <div key={u.id} className="adm-row">
                      <div className="adm-row__main"><Ava u={u}/><div className="adm-row__name">{u.displayName ?? u.email}</div></div>
                      <div className="adm-row__act"><button className="adm-btn adm-btn--outline adm-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Reactivar"}</button></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ═══ PAGOS ═══ */}
          {seccion === "pagos" && (
            <>
              <div className="adm-panel">
                <div className="adm-panel__t">Recargas por aprobar · {depositos.length}</div>
                {depositos.length === 0 ? <p className="adm-row__meta">No hay solicitudes pendientes.</p> : depositos.map(d => (
                  <div key={d.id} className="adm-row">
                    <div className="adm-row__main"><span className="adm-ava">{formatUsd(d.amountUsd).replace("$", "")}</span>
                      <div style={{ minWidth: 0 }}><div className="adm-row__name">{formatUsd(d.amountUsd)} · {d.userName ?? d.userId}</div>
                      <div className="adm-row__meta">{METODO_NOMBRE[d.method] ?? d.method} · ref <strong>{d.reference}</strong>{d.createdAt?.toDate ? ` · ${d.createdAt.toDate().toLocaleString("es-VE")}` : ""}</div></div></div>
                    <div className="adm-row__act">
                      <button className="adm-btn adm-btn--accent adm-btn--sm" disabled={ocupado === `dep_${d.id}`} onClick={() => decidirDeposito(d, "approve")}>{ocupado === `dep_${d.id}` ? "…" : "Acreditar"}</button>
                      <button className="adm-btn adm-btn--outline adm-btn--sm" disabled={ocupado === `dep_${d.id}`} onClick={() => decidirDeposito(d, "reject")}>Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="adm-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Pujar exige saldo</div>
                    <div className="adm-row__meta" style={{ whiteSpace: "normal", marginTop: 3, lineHeight: 1.45 }}>
                      {walletCfg?.biddingRequiresBalance
                        ? "Activo: cada puja se respalda con saldo disponible. Al ganar, el motor debita y la orden nace pagada."
                        : "Apagado: pujar es libre y el ganador coordina el pago después."}
                    </div>
                  </div>
                  <button className={`adm-toggle${walletCfg?.biddingRequiresBalance ? " on" : ""}`} disabled={ocupado === "wallet_toggle"} onClick={toggleSaldoObligatorio} aria-label="Pujar exige saldo"><span/></button>
                </div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel__t">Billeteras · acreditar o descontar</div>
                <input className="adm-input" placeholder="Busca por nombre o correo…" value={buscaUsuario} onChange={e => { setBuscaUsuario(e.target.value); setUsuarioSel(null); }}/>
                {buscaUsuario.trim().length >= 2 && !usuarioSel && (
                  <div style={{ marginTop: 8 }}>
                    {usuarios.filter(u => `${u.displayName ?? ""} ${u.email ?? ""}`.toLowerCase().includes(buscaUsuario.trim().toLowerCase())).slice(0, 6).map(u => (
                      <button key={u.id} className="adm-row" style={{ width: "100%", textAlign: "left" }} onClick={() => setUsuarioSel(u)}>
                        <div className="adm-row__main"><Ava u={u}/><div><div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div><div className="adm-row__meta">{u.email}</div></div></div>
                        <span className="adm-row__meta">elegir →</span>
                      </button>
                    ))}
                  </div>
                )}
                {usuarioSel && (
                  <div style={{ marginTop: 12 }}>
                    <div className="adm-row"><div className="adm-row__main"><Ava u={usuarioSel}/><div><div className="adm-row__name">{usuarioSel.displayName ?? usuarioSel.email}</div><div className="adm-row__meta">{usuarioSel.email}</div></div></div>
                      <div style={{ textAlign: "right" }}><div className="k" style={{ fontSize: "0.66rem", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 700 }}>Saldo</div><strong>{saldoSel === null ? "…" : formatUsd(saldoSel.total)}</strong>{saldoSel && saldoSel.retenido > 0 && <div className="adm-row__meta">{formatUsd(saldoSel.retenido)} retenidos</div>}</div></div>
                    <div className="adm-grid2" style={{ marginTop: 12 }}>
                      <div className="adm-field" style={{ margin: 0 }}><label>Monto (USD)</label><input className="adm-input" type="number" min="0" step="0.01" value={ajusteMonto} onChange={e => setAjusteMonto(e.target.value)} placeholder="Ej: 10"/></div>
                      <div className="adm-field" style={{ margin: 0 }}><label>Nota (la ve el usuario)</label><input className="adm-input" value={ajusteNota} onChange={e => setAjusteNota(e.target.value)} placeholder="Ej: Zelle ref 1234" maxLength={120}/></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button className="adm-btn adm-btn--accent adm-btn--sm" style={{ flex: 1 }} disabled={ocupado === "ajuste"} onClick={() => ajustarSaldo(1)}>+ Acreditar</button>
                      <button className="adm-btn adm-btn--outline adm-btn--sm" style={{ flex: 1 }} disabled={ocupado === "ajuste"} onClick={() => ajustarSaldo(-1)}>− Descontar</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="adm-panel">
                <div className="adm-panel__t">Cuentas de recarga</div>
                <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 12, lineHeight: 1.5 }}>Esto es lo que ve el usuario al recargar. Un método sin datos no se ofrece.</p>
                <div className="adm-grid2">
                  <div>
                    <div className="adm-field"><label>Pago móvil — Banco</label><input className="adm-input" value={pmBanco} onChange={e => setPmBanco(e.target.value)} placeholder="Ej: Banesco"/></div>
                    <div className="adm-field"><label>Teléfono</label><input className="adm-input" value={pmTel} onChange={e => setPmTel(e.target.value)} placeholder="0414-1234567"/></div>
                    <div className="adm-field"><label>Cédula o RIF</label><input className="adm-input" value={pmCi} onChange={e => setPmCi(e.target.value)} placeholder="V-12345678"/></div>
                  </div>
                  <div>
                    <div className="adm-field"><label>Zelle — Correo</label><input className="adm-input" value={zCorreo} onChange={e => setZCorreo(e.target.value)} placeholder="pagos@vendeloo.io"/></div>
                    <div className="adm-field"><label>Titular</label><input className="adm-input" value={zTitular} onChange={e => setZTitular(e.target.value)} placeholder="Nombre del titular"/></div>
                    <div className="adm-field"><label>Nota para el que recarga</label><input className="adm-input" value={ctaNota} onChange={e => setCtaNota(e.target.value)} placeholder="Ej: pon tu usuario en el concepto" maxLength={200}/></div>
                  </div>
                </div>
                <button className="adm-btn adm-btn--dark adm-btn--block" disabled={ocupado === "cuentas"} onClick={guardarCuentas}>{ocupado === "cuentas" ? "Guardando…" : "Guardar cuentas"}</button>
              </div>
            </>
          )}

          {/* ═══ ÓRDENES ═══ */}
          {seccion === "ordenes" && (
            <>
              <div className="adm-chips">
                {([["todas", "Todas"], ["pending_payment", "Por pagar"], ["payment_confirmed", "Pagadas"], ["shipped", "Enviadas"], ["delivered", "Entregadas"], ["cancelled", "Canceladas"]] as const).map(([v, label]) => (
                  <button key={v} className={`adm-chip${filtroOrden === v ? " adm-chip--active" : ""}`} onClick={() => setFiltroOrden(v)}>{label}</button>
                ))}
              </div>
              <div className="adm-panel" style={{ padding: "6px 12px" }}>
                {ordenesLista.filter(o => filtroOrden === "todas" || o.status === filtroOrden).length === 0 && <p className="adm-row__meta" style={{ padding: "14px 8px" }}>Nada por aquí.</p>}
                {ordenesLista.filter(o => filtroOrden === "todas" || o.status === filtroOrden).map(o => {
                  const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: "adm-badge--soft" };
                  const abierta = ordenAbierta === o.id;
                  return (
                    <div key={o.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <button style={{ width: "100%", textAlign: "left", padding: "12px 4px", display: "flex", alignItems: "center", gap: 12 }} onClick={() => setOrdenAbierta(abierta ? null : o.id)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="adm-row__name">{o.productTitle ?? o.auctionId}</div>
                          <div className="adm-row__meta">{o.buyerName} → {o.sellerName} · {formatUsd(o.bidAmountUsd ?? 0)}{o.paymentMethod === "wallet" ? " · pagó con billetera" : ""}</div>
                        </div>
                        <span className={`adm-badge ${e.clase}`}>{e.texto}</span>
                      </button>
                      {abierta && (
                        <div style={{ padding: "0 4px 14px" }}>
                          <div className="adm-row__meta" style={{ whiteSpace: "normal", lineHeight: 1.7 }}>
                            <div>Monto: <strong>{formatUsd(o.bidAmountUsd ?? 0)}</strong>{o.bidAmountBs ? ` · Bs ${o.bidAmountBs}` : ""} · comisión {formatUsd(o.commissionUsd ?? 0)} · recibe vendedor <strong>{formatUsd(o.sellerReceivesUsd ?? 0)}</strong></div>
                            <div>Pago: {o.paymentMethod ? `${METODO_NOMBRE[o.paymentMethod] ?? o.paymentMethod}${o.paymentReference ? ` · ref ${o.paymentReference}` : ""}` : "sin registrar"}</div>
                            <div>Comprador: {o.buyerName}{o.buyerWhatsapp && <> · <a href={`https://wa.me/${String(o.buyerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{o.buyerWhatsapp}</a></>} · Vendedor: {o.sellerName}{o.sellerWhatsapp && <> · <a href={`https://wa.me/${String(o.sellerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{o.sellerWhatsapp}</a></>}</div>
                            <div>Creada: {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("es-VE") : "—"} · id {o.id}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            {o.status === "pending_payment" && <>
                              <button className="adm-btn adm-btn--accent adm-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "payment_confirmed", paymentConfirmedAt: serverTimestamp(), paymentConfirmedBy: profile!.uid }, `¿Confirmar el pago de ${o.buyerName} por ${formatUsd(o.bidAmountUsd ?? 0)}?`, "Pago confirmado")}>Confirmar pago</button>
                              <button className="adm-btn adm-btn--danger adm-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "cancelled" }, "¿Cancelar esta orden? Política vigente: SIN reembolsos — cancelar no devuelve saldo ni pagos. Un ajuste manual en Pagos queda para casos excepcionales.", "Orden cancelada")}>Cancelar</button>
                            </>}
                            {o.status === "payment_confirmed" && <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "shipped", shippedAt: serverTimestamp() }, "¿Marcar como enviada?", "Orden marcada como enviada")}>Marcar enviada</button>}
                            {o.status === "shipped" && <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "delivered", deliveredAt: serverTimestamp() }, "¿Marcar como entregada? Normalmente lo confirma el comprador; usa esto solo para destrabar.", "Orden marcada como entregada")}>Marcar entregada</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ USUARIOS ═══ */}
          {seccion === "usuarios" && (
            <div className="adm-panel">
              <input className="adm-input" placeholder="Busca por nombre, correo o tienda…" value={buscaU} onChange={e => setBuscaU(e.target.value)} style={{ marginBottom: 14 }}/>
              <div style={{ overflowX: "auto" }}>
                <table className="adm-table">
                  <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Vendedor</th><th>WhatsApp</th><th>Ciudad</th></tr></thead>
                  <tbody>
                    {usuariosFiltrados.map(u => (
                      <tr key={u.id}>
                        <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Ava u={u}/><span style={{ fontWeight: 700 }}>{u.displayName ?? "Sin nombre"}</span></div></td>
                        <td className="adm-row__meta">{u.email}</td>
                        <td><span className={`adm-badge ${u.role === "admin" ? "adm-badge--accent" : u.role === "seller" ? "adm-badge--ok" : "adm-badge--soft"}`}>{ROL_ETIQUETA[u.role ?? "buyer"] ?? u.role}</span></td>
                        <td className="adm-row__meta">{VENDEDOR_ETIQUETA[u.sellerStatus ?? "none"] ?? u.sellerStatus}</td>
                        <td className="adm-row__meta">{u.whatsapp ? <a href={`https://wa.me/${String(u.whatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{u.whatsapp}</a> : "—"}</td>
                        <td className="adm-row__meta">{u.city || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usuariosFiltrados.length === 0 && <p className="adm-row__meta" style={{ padding: "12px 2px" }}>Sin resultados.</p>}
            </div>
          )}

          {/* ═══ AJUSTES ═══ */}
          {seccion === "ajustes" && (
            <>
              <div className="adm-grid2">
                <div className="adm-panel">
                  <div className="adm-panel__t">Tasa de cambio</div>
                  <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.5 }}>Al cerrar una subasta, el motor congela esta tasa en la orden. El comprador paga ese monto en bolívares aunque cambie después.</p>
                  <div className="adm-field"><label>Bolívares por dólar</label><input className="adm-input" type="number" step="0.01" min="0" value={tasaInput} onChange={e => setTasaInput(e.target.value)} placeholder="Ej: 745"/>
                    <div className="hint">{tasa?.usdToBs ? `Actual: Bs ${tasa.usdToBs} · ${tasa.updatedAt?.toDate?.()?.toLocaleString("es-VE") ?? ""}` : "Nunca configurada."}</div></div>
                  <button className="adm-btn adm-btn--dark adm-btn--block" disabled={ocupado === "tasa"} onClick={guardarTasa}>{ocupado === "tasa" ? "Guardando…" : "Guardar tasa"}</button>
                  <button className="adm-btn adm-btn--ghost adm-btn--block" style={{ marginTop: 8 }} disabled={ocupado === "bcv"} onClick={traerBcv}>{ocupado === "bcv" ? "Consultando…" : "Actualizar del BCV ahora"}</button>
                  <p className="hint" style={{ marginTop: 10 }}>Se sincroniza sola cada 4 h desde el BCV. Fijarla a mano vale hasta la próxima sincronización.</p>
                </div>

                <div className="adm-panel">
                  <div className="adm-panel__t">Comisión de la plataforma</div>
                  <div className="adm-field"><label>Quién cobra</label>
                    <div style={{ display: "grid", gap: 8 }}>
                      {([["seller_collects", "El vendedor cobra directo"], ["platform_collects", "La plataforma cobra todo"]] as const).map(([v, t]) => (
                        <button key={v} onClick={() => setModoInput(v)} className="adm-btn adm-btn--outline" style={{ textAlign: "left", boxShadow: modoInput === v ? "inset 0 0 0 2px var(--ink)" : "none" }}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="adm-field"><label>Porcentaje de comisión</label><input className="adm-input" type="number" step="0.5" min="0" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)} placeholder="10"/>
                    <div className="hint">{comision ? `Actual: ${comision.platformFeePct}% · ${comision.mode === "platform_collects" ? "plataforma cobra" : "vendedor cobra"}` : "Sin configurar."}{pctInput && isFinite(parseFloat(pctInput)) && <> · En $100 la plataforma se queda ${parseFloat(pctInput).toFixed(2)}</>}</div></div>
                  <button className="adm-btn adm-btn--dark adm-btn--block" disabled={ocupado === "comision"} onClick={guardarComision}>{ocupado === "comision" ? "Guardando…" : "Guardar comisión"}</button>
                </div>
              </div>

              <div className="adm-panel">
                <div className="adm-panel__t">Datos de demostración</div>
                <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 12, lineHeight: 1.5 }}>Catálogo de prueba con vendedores ficticios, para que la app no se vea vacía. Cero pujas inventadas. Ahora hay <strong>{demo}</strong> marcadas como demo.</p>
                <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
                  <button className="adm-btn adm-btn--accent adm-btn--sm" style={{ flex: 1 }} disabled={ocupado === "demo_seed"} onClick={() => demoAccion("seed")}>{ocupado === "demo_seed" ? "Sembrando…" : "Sembrar catálogo"}</button>
                  <button className="adm-btn adm-btn--outline adm-btn--sm" style={{ flex: 1 }} disabled={ocupado === "demo_purge" || demo === 0} onClick={() => demoAccion("purge")}>{ocupado === "demo_purge" ? "Borrando…" : "Purgar demo"}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
