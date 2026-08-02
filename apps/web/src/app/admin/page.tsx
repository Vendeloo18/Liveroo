"use client";
import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  updateDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { SIMBOLO_PATH, formatUsd } from "@subastas-ve/shared";

interface Usuario {
  id: string; displayName?: string; email?: string; role?: string;
  sellerStatus?: string; shopName?: string; sellerCat?: string;
  cedula?: string; whatsapp?: string; city?: string; avatar?: string; createdAt?: any;
  totalPurchases?: number; totalSales?: number; ratingAvg?: number; ratingCount?: number;
}
type Seccion = "resumen" | "usuarios" | "vendedores" | "pagos" | "ordenes" | "ajustes";

const ESTADO_ORDEN: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: "Por pagar", clase: "adm-al" },
  payment_confirmed: { texto: "Pagada", clase: "lv-badge--accent" },
  shipped: { texto: "Enviada", clase: "lv-badge--soft" },
  delivered: { texto: "Entregada", clase: "adm-ok" },
  cancelled: { texto: "Cancelada", clase: "lv-badge--soft" },
};
const ESTADO_DEP: Record<string, { texto: string; clase: string }> = {
  pending: { texto: "Pendiente", clase: "adm-wn" },
  approved: { texto: "Acreditada", clase: "adm-ok" },
  rejected: { texto: "Rechazada", clase: "adm-al" },
};
const METODO_NOMBRE: Record<string, string> = { pago_movil: "Pago móvil", zelle: "Zelle", binance: "Binance", efectivo: "Efectivo", wallet: "Billetera" };
const ROL_ETIQUETA: Record<string, string> = { admin: "Admin", seller: "Vendedor", buyer: "Comprador" };
const VENDEDOR_ETIQUETA: Record<string, string> = { approved: "Vendedor", pending: "Solicitud pendiente", suspended: "Suspendido" };

// ¿Hace cuánto está en la app?
const tiempoDesde = (t: any): string => {
  const ms = t?.toDate?.()?.getTime?.() ?? (t ? new Date(t).getTime() : NaN);
  if (!isFinite(ms)) return "—";
  const d = Math.floor((Date.now() - ms) / 86400_000);
  if (d < 1) return "hoy";
  if (d < 30) return `${d} día${d === 1 ? "" : "s"}`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} mes${m === 1 ? "" : "es"}`;
  const a = Math.floor(m / 12);
  return `${a} año${a === 1 ? "" : "s"}`;
};

const I = {
  resumen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  usuarios: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  vendedores: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16"/></svg>,
  pagos: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  ordenes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5"/></svg>,
  ajustes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  subasta: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v3M12 19v3M5 12H2M22 12h-3M4.9 4.9l2.1 2.1M16.9 16.9l2.2 2.2M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>,
  sellermas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>,
  reloj: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  pct: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  out: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
};

function Mark({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff"><path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/></svg>;
}

function Metric({ label, icon, value, ctx, alerta, go }: {
  label: string; icon: JSX.Element; value: React.ReactNode; ctx?: React.ReactNode; alerta?: boolean; go?: () => void;
}) {
  return (
    <div className={`adm-mc${alerta ? " adm-mc--alerta" : ""}`}>
      <div className="adm-mc__top"><span className="adm-mc__lbl">{label}</span><span className="adm-mc__ic">{icon}</span></div>
      <div className="adm-mc__num">{value}</div>
      {ctx && <div className="adm-mc__ctx">{ctx}</div>}
      {go && <a className="adm-mc__go" onClick={go} style={{ cursor: "pointer" }}>Ver →</a>}
    </div>
  );
}

export default function AdminPage() {
  const { profile, loading: authLoading, signIn, signOut, error } = useAuthStore();
  const [seccion, setSeccion] = useState<Seccion>("resumen");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tasa, setTasa] = useState<{ usdToBs?: number; updatedAt?: any; source?: string } | null>(null);
  const [comision, setComision] = useState<{ mode?: string; platformFeePct?: number } | null>(null);
  const [activas, setActivas] = useState(0);
  const [demo, setDemo] = useState(0);
  const [ordenes, setOrdenes] = useState(0);
  const [walletsTotal, setWalletsTotal] = useState<{ saldo: number; retenido: number } | null>(null);
  const [walletsMap, setWalletsMap] = useState<Record<string, { saldo: number; retenido: number }>>({});

  const [depositos, setDepositos] = useState<any[]>([]);
  const [depositosHist, setDepositosHist] = useState<any[]>([]);
  const [walletCfg, setWalletCfg] = useState<{ biddingRequiresBalance?: boolean } | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null);
  const [saldoSel, setSaldoSel] = useState<{ total: number; retenido: number } | null>(null);
  const [ajusteMonto, setAjusteMonto] = useState(""); const [ajusteNota, setAjusteNota] = useState("");
  const [pmBanco, setPmBanco] = useState(""); const [pmTel, setPmTel] = useState(""); const [pmCi, setPmCi] = useState("");
  const [zCorreo, setZCorreo] = useState(""); const [zTitular, setZTitular] = useState(""); const [ctaNota, setCtaNota] = useState("");

  const [filtroOrden, setFiltroOrden] = useState<string>("todas");
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null);
  const [ordenesLista, setOrdenesLista] = useState<any[]>([]);
  const [buscaU, setBuscaU] = useState("");
  const [usuarioAbierto, setUsuarioAbierto] = useState<string | null>(null);

  const [tasaInput, setTasaInput] = useState(""); const [pctInput, setPctInput] = useState("");
  const [modoInput, setModoInput] = useState<"seller_collects" | "platform_collects">("seller_collects");

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState(""); const [loginPass, setLoginPass] = useState(""); const [entrando, setEntrando] = useState(false);

  const esAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!esAdmin) return;
    const u1 = onSnapshot(collection(db, "users"), s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario))),
      e => setAviso({ tipo: "bad", texto: `No se pudieron leer los usuarios: ${e.code}` }));
    const u2 = onSnapshot(doc(db, "exchangeRates", "current"), s => { const d = s.data(); setTasa(d ?? null); if (d?.usdToBs) setTasaInput(String(d.usdToBs)); });
    const u3 = onSnapshot(doc(db, "config", "commission"), s => { const d = s.data(); setComision(d ?? null); if (d?.platformFeePct != null) setPctInput(String(d.platformFeePct)); if (d?.mode) setModoInput(d.mode); });
    const u4 = onSnapshot(query(collection(db, "auctions"), where("status", "==", "active")), s => setActivas(s.size));
    const u5 = onSnapshot(query(collection(db, "auctions"), where("isDemo", "==", true)), s => setDemo(s.size), () => setDemo(0));
    const u6 = onSnapshot(query(collection(db, "deposits"), where("status", "==", "pending"), orderBy("createdAt", "asc")), s => setDepositos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setDepositos([]));
    const u7 = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)), s => setOrdenesLista(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setOrdenesLista([]));
    const u8 = onSnapshot(doc(db, "config", "wallet"), s => setWalletCfg(s.exists() ? (s.data() as any) : null), () => undefined);
    const u9 = onSnapshot(doc(db, "config", "paymentAccounts"), s => { const d = s.data() as any; if (!d) return; setPmBanco(d.pagoMovil?.banco ?? ""); setPmTel(d.pagoMovil?.telefono ?? ""); setPmCi(d.pagoMovil?.cedula ?? ""); setZCorreo(d.zelle?.correo ?? ""); setZTitular(d.zelle?.titular ?? ""); setCtaNota(d.nota ?? ""); }, () => undefined);
    const u10 = onSnapshot(collection(db, "wallets"), s => {
      let saldo = 0, retenido = 0;
      const m: Record<string, { saldo: number; retenido: number }> = {};
      s.docs.forEach(d => {
        const w = d.data() as any; const b = w.balanceUsd ?? 0, h = w.heldUsd ?? 0;
        saldo += b; retenido += h;
        m[d.id] = { saldo: Math.round(b * 100) / 100, retenido: Math.round(h * 100) / 100 };
      });
      setWalletsTotal({ saldo: Math.round(saldo * 100) / 100, retenido: Math.round(retenido * 100) / 100 });
      setWalletsMap(m);
    }, () => { setWalletsTotal(null); setWalletsMap({}); });
    // Historial de recargas (todas, no solo pendientes): quién recargó y cuándo
    const u11 = onSnapshot(query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(15)), s => setDepositosHist(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setDepositosHist([]));
    const uO = onSnapshot(collection(db, "orders"), s => setOrdenes(s.size), () => setOrdenes(0));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); uO(); };
  }, [esAdmin]);

  useEffect(() => {
    if (!usuarioSel) { setSaldoSel(null); return; }
    return onSnapshot(doc(db, "wallets", usuarioSel.id), s => { const d = s.data() as any; setSaldoSel({ total: d?.balanceUsd ?? 0, retenido: d?.heldUsd ?? 0 }); }, () => setSaldoSel({ total: 0, retenido: 0 }));
  }, [usuarioSel?.id]);

  const correr = async (clave: string, fn: () => Promise<any>, exito: string) => {
    setOcupado(clave); setAviso(null);
    try { await fn(); setAviso({ tipo: "ok", texto: exito }); }
    catch (e: any) { setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo completar la acción" }); }
    finally { setOcupado(null); setTimeout(() => setAviso(null), 5000); }
  };
  const aprobar = (u: Usuario) => correr(`ap_${u.id}`, () => httpsCallable(functions, "approveSeller")({ sellerUid: u.id }), `${u.displayName ?? u.id} ya puede vender`);
  const suspender = (u: Usuario) => { if (!confirm(`¿Suspender a ${u.displayName ?? u.id}? No podrá publicar más ventas.`)) return; correr(`sp_${u.id}`, () => httpsCallable(functions, "suspendSeller")({ sellerUid: u.id }), `${u.displayName ?? u.id} quedó suspendido`); };
  const demoAccion = (accion: "seed" | "purge") => { if (accion === "purge" && !confirm(`¿Borrar las ${demo} ventas de demostración? Las reales no se tocan.`)) return; correr(`demo_${accion}`, () => httpsCallable(functions, "manageDemoAuctions")({ action: accion }), accion === "seed" ? "Catálogo de demostración sembrado" : "Demostración purgada"); };
  const decidirDeposito = (d: any, action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") { const r = prompt(`¿Por qué se rechaza la recarga de ${d.userName} (${formatUsd(d.amountUsd)}, ref ${d.reference})? El usuario lo va a ver:`); if (r === null) return; reason = r; }
    else if (!confirm(`¿Acreditar ${formatUsd(d.amountUsd)} a ${d.userName}? Verificaste la referencia ${d.reference}.`)) return;
    correr(`dep_${d.id}`, () => httpsCallable(functions, "manageDeposit")({ depositId: d.id, action, reason }), action === "approve" ? `${formatUsd(d.amountUsd)} acreditados a ${d.userName}` : "Solicitud rechazada");
  };
  const ajustarSaldo = (signo: 1 | -1) => {
    if (!usuarioSel) return;
    const v = parseFloat(ajusteMonto);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "Pon un monto mayor que cero" }); return; }
    if (ajusteNota.trim().length < 3) { setAviso({ tipo: "bad", texto: "La nota es obligatoria: queda en el historial del usuario" }); return; }
    if (!confirm(`¿${signo > 0 ? "Acreditar" : "Descontar"} ${formatUsd(v)} a ${usuarioSel.displayName ?? usuarioSel.email}?`)) return;
    correr("ajuste", () => httpsCallable(functions, "adjustWallet")({ userId: usuarioSel.id, amountUsd: signo * v, note: ajusteNota.trim() }), `Saldo de ${usuarioSel.displayName ?? usuarioSel.email} actualizado`);
    setAjusteMonto(""); setAjusteNota("");
  };
  const guardarCuentas = () => correr("cuentas", async () => { await setDoc(doc(db, "config", "paymentAccounts"), { pagoMovil: pmTel.trim() ? { banco: pmBanco.trim(), telefono: pmTel.trim(), cedula: pmCi.trim() } : null, zelle: zCorreo.trim() ? { correo: zCorreo.trim(), titular: zTitular.trim() } : null, nota: ctaNota.trim() || null, updatedAt: serverTimestamp() }); }, "Cuentas de recarga guardadas");
  const toggleSaldoObligatorio = () => {
    const activo = walletCfg?.biddingRequiresBalance === true;
    if (!activo && depositos.length === 0 && !pmTel && !zCorreo) { if (!confirm("Nadie puede recargar todavía (no hay cuentas configuradas). Si activas esto, nadie sin saldo podrá usar SUBELOO. ¿Seguro?")) return; }
    correr("wallet_toggle", async () => { await setDoc(doc(db, "config", "wallet"), { biddingRequiresBalance: !activo, updatedAt: serverTimestamp() }, { merge: true }); }, !activo ? "Ahora SUBELOO exige saldo en la billetera" : "SUBELOO vuelve a ser libre, sin saldo");
  };
  const moverOrden = (o: any, cambios: Record<string, any>, pregunta: string, exito: string) => { if (!confirm(pregunta)) return; correr(`ord_${o.id}`, () => updateDoc(doc(db, "orders", o.id), { ...cambios, updatedAt: serverTimestamp() }), exito); };
  const traerBcv = () => correr("bcv", () => httpsCallable(functions, "syncBcvRateNow")({}), "Tasa actualizada desde el BCV");
  const guardarTasa = () => { const v = parseFloat(tasaInput); if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "La tasa debe ser un número mayor que cero" }); return; } correr("tasa", () => httpsCallable(functions, "updateExchangeRate")({ usdToBs: v }), `Tasa actualizada a Bs ${v.toFixed(2)} por dólar`); };
  const guardarComision = () => { const p = parseFloat(pctInput); if (!isFinite(p) || p < 0 || p > 100) { setAviso({ tipo: "bad", texto: "El porcentaje debe estar entre 0 y 100" }); return; } correr("comision", () => httpsCallable(functions, "updateCommissionConfig")({ mode: modoInput, platformFeePct: p }), "Configuración de comisión guardada"); };
  const entrar = async () => { if (!loginEmail.trim() || !loginPass) return; setEntrando(true); try { await signIn(loginEmail.trim(), loginPass); } finally { setEntrando(false); } };

  // ══ Puertas ══
  if (authLoading) return <div className="adm-login"><div className="adm-login__card" style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</div></div>;
  if (!profile) {
    return (
      <div className="adm-login">
        <svg viewBox="0 0 24 24" aria-hidden className="adm-login__wm"><path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/></svg>
        <div className="adm-login__card">
          <div className="adm-login__brand"><span className="mk"><Mark size={23}/></span><div><div className="wm">Vendeloo</div><div className="pl">CONSOLA ADMIN</div></div></div>
          <h1>Entra a<br/>controlar todo</h1>
          <p>Acceso solo para administradores: usuarios, vendedores, pagos, órdenes y configuración.</p>
          {error && <div className="lv-note lv-note--bad" style={{ marginBottom: 14 }}>{error}</div>}
          <div className="lv-field"><label className="lv-field__label" htmlFor="ale">Correo</label><input id="ale" className="lv-input" type="email" autoComplete="username" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="admin@vendeloo.io"/></div>
          <div className="lv-field"><label className="lv-field__label" htmlFor="alp">Contraseña</label><input id="alp" className="lv-input" type="password" autoComplete="current-password" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="••••••••"/></div>
          <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={entrando} onClick={entrar}>{entrando ? "Entrando…" : "Entrar al panel"}</button>
        </div>
      </div>
    );
  }
  if (!esAdmin) {
    return (
      <div className="adm-login">
        <svg viewBox="0 0 24 24" aria-hidden className="adm-login__wm"><path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/></svg>
        <div className="adm-login__card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}><Mark size={24}/></span></div>
        <h1>Sin acceso</h1><p style={{ marginBottom: 18 }}>Tu cuenta ({profile.email}) no es administradora.</p>
        <button className="lv-btn lv-btn--outline lv-btn--block" onClick={() => signOut()}>Cerrar sesión</button>
      </div></div>
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
  const porRevisar = pendientes.length + interesados.length;
  const vapidOk = !!(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "").trim();
  const suma = (arr: any[]) => Math.round(arr.reduce((n, o) => n + (o.bidAmountUsd ?? 0), 0) * 100) / 100;
  const comprasDe = (uid: string) => ordenesLista.filter(o => o.buyerId === uid && o.status !== "cancelled");
  const ventasDe = (uid: string) => ordenesLista.filter(o => o.sellerId === uid && o.status !== "cancelled");

  const GRUPOS: { grupo: string; items: { id: Seccion; label: string; ct?: number }[] }[] = [
    { grupo: "General", items: [{ id: "resumen", label: "Resumen" }, { id: "usuarios", label: "Usuarios" }] },
    { grupo: "Operación", items: [{ id: "vendedores", label: "Vendedores", ct: porRevisar }, { id: "pagos", label: "Pagos", ct: depositos.length }, { id: "ordenes", label: "Órdenes", ct: porPagar }] },
    { grupo: "Configuración", items: [{ id: "ajustes", label: "Ajustes" }] },
  ];
  const titulos: Record<Seccion, { t: string; s: string }> = {
    resumen: { t: "Resumen", s: "Todo lo que pasa en Vendeloo, de un vistazo" },
    usuarios: { t: "Usuarios", s: `${usuarios.length} cuentas · toca una para ver toda su data` },
    vendedores: { t: "Vendedores", s: "Aprueba, suspende y revisa quién vende" },
    pagos: { t: "Pagos", s: "Billeteras, recargas y cuentas de cobro" },
    ordenes: { t: "Órdenes", s: "Cada venta, su estado y con quién se hizo" },
    ajustes: { t: "Ajustes", s: "Tasa, comisión, avisos y demostración" },
  };

  const Ava = ({ u, size = 36 }: { u: Usuario; size?: number }) => u.avatar
    ? <img className="lv-avatar" src={u.avatar} alt="" style={{ width: size, height: size, objectFit: "cover" }}/>
    : <span className="lv-avatar" style={{ width: size, height: size }}>{(u.displayName ?? u.email ?? "?")[0].toUpperCase()}</span>;

  const usuariosFiltrados = usuarios.filter(u => { const t = buscaU.trim().toLowerCase(); return !t || `${u.displayName ?? ""} ${u.email ?? ""} ${u.shopName ?? ""}`.toLowerCase().includes(t); }).sort((a, b) => (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? ""));

  // Liquidaciones pendientes: órdenes pagadas con billetera cuya parte del
  // vendedor aún no se pagó por fuera. Cubre órdenes viejas sin el campo.
  const porLiquidar = ordenesLista.filter(o => o.paymentMethod === "wallet" && o.status !== "cancelled" && o.payoutStatus !== "paid");
  const gruposLiquidar: Record<string, { sellerId: string; nombre: string; ordenes: any[]; total: number }> = {};
  for (const o of porLiquidar) {
    const k = o.sellerId as string;
    if (!gruposLiquidar[k]) gruposLiquidar[k] = { sellerId: k, nombre: o.sellerName ?? k, ordenes: [], total: 0 };
    gruposLiquidar[k].ordenes.push(o);
    gruposLiquidar[k].total = Math.round((gruposLiquidar[k].total + (o.payoutUsd ?? o.sellerReceivesUsd ?? 0)) * 100) / 100;
  }
  const liquidarPorVendedor = Object.values(gruposLiquidar).sort((a, b) => b.total - a.total);
  const totalLiquidar = Math.round(liquidarPorVendedor.reduce((n, g) => n + g.total, 0) * 100) / 100;

  const liquidarVendedor = (g: { sellerId: string; nombre: string; ordenes: any[]; total: number }) => {
    const nota = prompt(
      `Vas a asentar que YA le pagaste ${formatUsd(g.total)} a ${g.nombre} (${g.ordenes.length} ${g.ordenes.length === 1 ? "orden" : "órdenes"}). Hazlo solo si la transferencia ya salió. Referencia del pago (opcional):`
    );
    if (nota === null) return;
    correr(
      `pay_${g.sellerId}`,
      () => httpsCallable(functions, "markSellerPaid")({ orderIds: g.ordenes.map(o => o.id), note: nota }),
      `Liquidado ${formatUsd(g.total)} a ${g.nombre}`
    );
  };
  const billeterasTop = Object.entries(walletsMap)
    .map(([id, w]) => ({ id, ...w, u: usuarios.find(x => x.id === id) }))
    .filter(x => x.saldo > 0 || x.retenido > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 8);

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-side__brand"><span className="mk"><Mark/></span><div><div className="wm">Vendeloo</div><div className="pl">CONSOLA ADMIN</div></div></div>
        <nav className="adm-side__nav">
          {GRUPOS.map(g => (
            <div key={g.grupo}>
              <div className="adm-side__grp">{g.grupo}</div>
              {g.items.map(n => (
                <button key={n.id} className={`adm-nav-item${seccion === n.id ? " active" : ""}`} onClick={() => setSeccion(n.id)}>
                  {I[n.id]}<span>{n.label}</span>{!!n.ct && n.ct > 0 && <span className="ct">{n.ct}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="adm-side__foot">
          <span className="av">{(profile.displayName ?? profile.email ?? "A")[0].toUpperCase()}</span>
          <div className="who"><div className="n">{profile.displayName ?? "Administrador"}</div><div className="r">{profile.email}</div></div>
          <button className="out" onClick={() => { if (confirm("¿Cerrar sesión del panel?")) signOut(); }}>{I.out}</button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-top">
          <div><h1>{titulos[seccion].t}</h1><div className="sub">{titulos[seccion].s}</div></div>
          <div className="adm-kpis">
            <div className="adm-chip"><div className="k">Tasa BCV</div><div className="v mono">{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "—"}</div></div>
            <div className="adm-chip"><div className="k">SUBELOO exige saldo</div><div className="v"><span className={`adm-dot ${walletCfg?.biddingRequiresBalance ? "adm-dot--o" : "adm-dot--x"}`}/>{walletCfg?.biddingRequiresBalance ? "Activo" : "Apagado"}</div></div>
          </div>
        </div>

        <div className="adm-body">
          {aviso && <div className={`lv-note lv-note--${aviso.tipo === "ok" ? "ok" : "bad"}`} style={{ marginBottom: 16 }}>{aviso.texto}</div>}
          {!tasa?.usdToBs && seccion !== "ajustes" && <div className="lv-note lv-note--warn" style={{ marginBottom: 16 }}>Falta la tasa de cambio. Sin ella, las órdenes nacen sin monto en bolívares. Configúrala en <b>Ajustes</b>.</div>}

          {/* ═══ RESUMEN ═══ */}
          {seccion === "resumen" && (
            <>
              <div className="adm-sech"><div className="t">Indicadores</div></div>
              <div className="adm-metrics">
                <Metric label="Usuarios" icon={I.usuarios} value={usuarios.length} ctx={<><b>{compradores}</b> compradores · <b>{aprobados.length}</b> vendedores</>}/>
                <Metric label="Ventas activas" icon={I.subasta} value={activas} ctx={<><b>{demo}</b> de demostración</>}/>
                <Metric label="Órdenes" icon={I.ordenes} value={ordenes} ctx={<><b>{formatUsd(gmv)}</b> transados</>}/>
                <Metric label="En billeteras" icon={I.pagos} value={walletsTotal ? formatUsd(walletsTotal.saldo) : "…"} ctx={walletsTotal ? <><b>{formatUsd(walletsTotal.retenido)}</b> retenidos</> : ""}/>
              </div>

              <div className="adm-sech"><div className="t">Necesita tu <b>atención</b></div></div>
              <div className="adm-metrics">
                <Metric alerta={porRevisar > 0} label="Vendedores por aprobar" icon={I.sellermas} value={porRevisar} go={() => setSeccion("vendedores")}/>
                <Metric alerta={depositos.length > 0} label="Recargas por aprobar" icon={I.pagos} value={depositos.length} go={() => setSeccion("pagos")}/>
                <Metric alerta={porPagar > 0} label="Órdenes por pagar" icon={I.reloj} value={porPagar} go={() => setSeccion("ordenes")}/>
                <Metric label="Comisión" icon={I.pct} value={comision?.platformFeePct != null ? `${comision.platformFeePct}%` : "—"} ctx={comision?.mode === "platform_collects" ? "Cobra la plataforma" : "Cobra el vendedor"}/>
              </div>

              <div className="adm-cols">
                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Órdenes recientes</span><a className="a" onClick={() => setSeccion("ordenes")} style={{ cursor: "pointer" }}>Ver todas →</a></div>
                  {ordenesLista.length === 0 ? <div className="adm-empty">Todavía no hay órdenes.</div> : (
                    <table className="adm-tbl">
                      <thead><tr><th>Producto</th><th>Comprador</th><th style={{ textAlign: "right" }}>Monto</th><th>Estado</th></tr></thead>
                      <tbody>
                        {ordenesLista.slice(0, 6).map(o => { const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: "lv-badge--soft" }; return (
                          <tr key={o.id}>
                            <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span className="lv-avatar" style={{ width: 30, height: 30, fontSize: "0.72rem" }}>{(o.productTitle ?? "?")[0]}</span><div style={{ minWidth: 0, maxWidth: 190 }}><div className="adm-row__name" style={{ fontSize: "0.84rem" }}>{o.productTitle ?? o.auctionId}</div><div className="adm-row__meta">de {o.sellerName}</div></div></div></td>
                            <td className="adm-row__meta">{o.buyerName}</td>
                            <td className="amt">{formatUsd(o.bidAmountUsd ?? 0)}</td>
                            <td><span className={`lv-badge ${e.clase}`}>{e.texto}</span></td>
                          </tr>
                        ); })}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Estado de la plataforma</span></div>
                  <div className="adm-state">
                    <div className="r"><div className="l">Tasa de cambio<div className="s">Sincroniza sola cada 4 h</div></div><span className="v">{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "—"}</span></div>
                    <div className="r"><div className="l">SUBELOO exige saldo<div className="s">Beta por invitación</div></div><button className={`adm-toggle${walletCfg?.biddingRequiresBalance ? " on" : ""}`} disabled={ocupado === "wallet_toggle"} onClick={toggleSaldoObligatorio} aria-label="SUBELOO exige saldo"><span/></button></div>
                    <div className="r"><div className="l">Cuentas de recarga<div className="s">Lo que ve el que deposita</div></div><span className={`lv-badge ${pmTel || zCorreo ? "adm-ok" : "adm-wn"}`}>{pmTel || zCorreo ? "Configuradas" : "Sin configurar"}</span></div>
                    <div className="r"><div className="l">Avisos push<div className="s">Te superaron · ganaste</div></div><span className={`lv-badge ${vapidOk ? "adm-ok" : "adm-wn"}`}>{vapidOk ? "Activos" : "Falta clave"}</span></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ USUARIOS ═══ */}
          {seccion === "usuarios" && (
            <div className="adm-panel">
              <div className="adm-panel__b" style={{ paddingBottom: 14 }}><input className="lv-input" placeholder="Busca por nombre, correo o tienda…" value={buscaU} onChange={e => setBuscaU(e.target.value)}/></div>
              {usuariosFiltrados.length === 0 && <div className="adm-empty">Sin resultados.</div>}
              {usuariosFiltrados.map(u => {
                const abierto = usuarioAbierto === u.id;
                const w = walletsMap[u.id];
                const compras = comprasDe(u.id); const ventas = ventasDe(u.id);
                const esVendedor = u.sellerStatus === "approved";
                return (
                  <div key={u.id}>
                    <button className="adm-row" style={{ width: "100%", textAlign: "left" }} onClick={() => setUsuarioAbierto(abierto ? null : u.id)}>
                      <div className="adm-row__main">
                        <Ava u={u}/>
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-row__name">
                            {u.displayName ?? "Sin nombre"}
                            {u.role === "admin" && <span className="lv-badge lv-badge--accent" style={{ marginLeft: 8 }}>Admin</span>}
                            {u.sellerStatus && u.sellerStatus !== "none" && u.role !== "admin" && (
                              <span className={`lv-badge ${u.sellerStatus === "approved" ? "adm-ok" : u.sellerStatus === "suspended" ? "adm-al" : "adm-wn"}`} style={{ marginLeft: 8 }}>{VENDEDOR_ETIQUETA[u.sellerStatus] ?? u.sellerStatus}</span>
                            )}
                          </div>
                          <div className="adm-row__meta">{u.email}{u.shopName ? ` · ${u.shopName}` : ""}{u.city ? ` · ${u.city}` : ""}</div>
                        </div>
                      </div>
                      <div className="adm-row__act">
                        <span className="mono" style={{ fontSize: "0.84rem", fontWeight: 600 }}>{w ? formatUsd(w.saldo) : "—"}</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                    </button>

                    {abierto && (
                      <div className="adm-det">
                        <div className="adm-det__grid">
                          <div className="adm-det__stat"><div className="k">Saldo</div><div className="v">{formatUsd(w?.saldo ?? 0)}</div><div className="s">{formatUsd(w?.retenido ?? 0)} retenidos</div></div>
                          <div className="adm-det__stat"><div className="k">Compras</div><div className="v">{u.totalPurchases ?? compras.length}</div><div className="s">{formatUsd(suma(compras))} gastados</div></div>
                          <div className="adm-det__stat"><div className="k">Ventas</div><div className="v">{esVendedor ? (u.totalSales ?? ventas.length) : "—"}</div><div className="s">{esVendedor ? `${formatUsd(suma(ventas))} vendidos` : "no es vendedor"}</div></div>
                          <div className="adm-det__stat"><div className="k">En la app</div><div className="v" style={{ fontSize: "1.05rem", paddingTop: 3 }}>{tiempoDesde(u.createdAt)}</div><div className="s">{u.ratingAvg ? `${u.ratingAvg.toFixed(1)}★ (${u.ratingCount ?? 0})` : "sin calificaciones"}</div></div>
                        </div>
                        <div className="adm-row__meta" style={{ whiteSpace: "normal", lineHeight: 1.7 }}>
                          Rol: <b style={{ color: "var(--ink-2)" }}>{ROL_ETIQUETA[u.role ?? "buyer"] ?? u.role}</b>
                          {" · "}Cédula: <b style={{ color: "var(--ink-2)" }}>{u.cedula || "—"}</b>
                          {" · "}WhatsApp: {u.whatsapp ? <a href={`https://wa.me/${String(u.whatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{u.whatsapp}</a> : "—"}
                          {" · "}Ciudad: {u.city || "—"}
                          {u.sellerCat ? <> · Vende: {u.sellerCat}</> : null}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                          {(u.sellerStatus === "pending" || (u.sellerStatus == null && u.shopName)) && <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Aprobar como vendedor"}</button>}
                          {u.sellerStatus === "suspended" && <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Reactivar"}</button>}
                          {esVendedor && <a className="lv-btn lv-btn--soft lv-btn--sm" href={`/seller/${u.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver tienda</a>}
                          {esVendedor && u.role !== "admin" && <button className="lv-btn lv-btn--danger lv-btn--sm" disabled={ocupado === `sp_${u.id}`} onClick={() => suspender(u)}>{ocupado === `sp_${u.id}` ? "…" : "Suspender"}</button>}
                          <button className="lv-btn lv-btn--soft lv-btn--sm" onClick={() => { setUsuarioSel(u); setSeccion("pagos"); }}>Ajustar saldo</button>
                        </div>
                        <div className="adm-row__meta" style={{ marginTop: 10, fontSize: "0.68rem" }}>Compras y ventas calculadas sobre las últimas 100 órdenes.</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ VENDEDORES ═══ */}
          {seccion === "vendedores" && (
            <>
              {pendientes.length > 0 && (
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Solicitudes pendientes · {pendientes.length}</span></div>
                  {pendientes.map(u => (<div key={u.id} className="adm-row"><div className="adm-row__main"><Ava u={u}/><div style={{ minWidth: 0 }}><div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div><div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{u.email}</div><div className="adm-row__meta">{u.cedula || "Sin cédula"} · {u.city || "Sin ciudad"}{u.sellerCat ? ` · ${u.sellerCat}` : ""}</div></div></div><div className="adm-row__act"><button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Aprobar"}</button></div></div>))}
                </div>
              )}
              {interesados.length > 0 && (
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Con tienda, sin aprobar · {interesados.length}</span></div>
                  {interesados.map(u => (<div key={u.id} className="adm-row"><div className="adm-row__main"><Ava u={u}/><div style={{ minWidth: 0 }}><div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div><div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{u.email}</div></div></div><div className="adm-row__act"><button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Aprobar"}</button></div></div>))}
                </div>
              )}
              <div className="adm-panel"><div className="adm-panel__h"><span className="t">Vendedores activos · {aprobados.length}</span></div>
                {aprobados.length === 0 ? <div className="adm-empty">Todavía ninguno.</div> : aprobados.map(u => {
                  const ventas = ventasDe(u.id);
                  return (
                    <div key={u.id} className="adm-row"><div className="adm-row__main"><Ava u={u}/><div style={{ minWidth: 0 }}><div className="adm-row__name">{u.displayName ?? "Sin nombre"}{u.role === "admin" && <span className="lv-badge lv-badge--soft" style={{ marginLeft: 8 }}>Admin</span>}</div><div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{ventas.length} ventas · {formatUsd(suma(ventas))}{u.ratingAvg ? ` · ${u.ratingAvg.toFixed(1)}★` : ""}</div></div></div>
                      <div className="adm-row__act"><a className="lv-btn lv-btn--soft lv-btn--sm" href={`/seller/${u.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver tienda</a>{u.role !== "admin" && <button className="lv-btn lv-btn--danger lv-btn--sm" disabled={ocupado === `sp_${u.id}`} onClick={() => suspender(u)}>{ocupado === `sp_${u.id}` ? "…" : "Suspender"}</button>}</div></div>
                  );
                })}
              </div>
              {suspendidos.length > 0 && (
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Suspendidos · {suspendidos.length}</span></div>
                  {suspendidos.map(u => (<div key={u.id} className="adm-row"><div className="adm-row__main"><Ava u={u}/><div className="adm-row__name">{u.displayName ?? u.email}</div></div><div className="adm-row__act"><button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobar(u)}>{ocupado === `ap_${u.id}` ? "…" : "Reactivar"}</button></div></div>))}
                </div>
              )}
            </>
          )}

          {/* ═══ PAGOS ═══ */}
          {seccion === "pagos" && (
            <>
              <div className="adm-metrics">
                <Metric label="En billeteras" icon={I.pagos} value={walletsTotal ? formatUsd(walletsTotal.saldo) : "…"} ctx={<>{billeterasTop.length} billeteras con saldo</>}/>
                <Metric label="Retenido en ofertas" icon={I.reloj} value={walletsTotal ? formatUsd(walletsTotal.retenido) : "…"} ctx="respaldo de ofertas líderes"/>
                <Metric alerta={depositos.length > 0} label="Recargas por aprobar" icon={I.sellermas} value={depositos.length} ctx={depositos.length > 0 ? <b>{suma2(depositos)}</b> : "todo al día"}/>
                <Metric alerta={totalLiquidar > 0} label="Debes a vendedores" icon={I.vendedores} value={formatUsd(totalLiquidar)} ctx={totalLiquidar > 0 ? <>{liquidarPorVendedor.length} vendedor{liquidarPorVendedor.length === 1 ? "" : "es"} por liquidar</> : "todo liquidado"}/>
              </div>

              <div className="adm-panel"><div className="adm-panel__h"><span className="t">Por liquidar a vendedores · {liquidarPorVendedor.length}</span>{totalLiquidar > 0 && <span className="lv-badge adm-wn">{formatUsd(totalLiquidar)}</span>}</div>
                {liquidarPorVendedor.length === 0 ? (
                  <div className="adm-empty">Nada pendiente: lo cobrado por billetera ya está liquidado.</div>
                ) : liquidarPorVendedor.map(g => {
                  const u = usuarios.find(x => x.id === g.sellerId);
                  return (
                    <div key={g.sellerId} className="adm-row">
                      <div className="adm-row__main">
                        {u ? <Ava u={u}/> : <span className="lv-avatar">{(g.nombre ?? "?")[0]}</span>}
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-row__name">{g.nombre}</div>
                          <div className="adm-row__meta">{g.ordenes.length} {g.ordenes.length === 1 ? "orden pagada" : "órdenes pagadas"} con billetera · {u?.whatsapp ? `WhatsApp ${u.whatsapp}` : "sin WhatsApp"}</div>
                        </div>
                      </div>
                      <div className="adm-row__act">
                        <span className="mono" style={{ fontSize: "0.88rem", fontWeight: 700 }}>{formatUsd(g.total)}</span>
                        <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `pay_${g.sellerId}`} onClick={() => liquidarVendedor(g)}>
                          {ocupado === `pay_${g.sellerId}` ? "…" : "Ya le pagué"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="adm-panel"><div className="adm-panel__h"><span className="t">Recargas por aprobar · {depositos.length}</span></div>
                {depositos.length === 0 ? <div className="adm-empty">No hay solicitudes pendientes.</div> : depositos.map(d => (
                  <div key={d.id} className="adm-row"><div className="adm-row__main"><span className="lv-avatar" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)", fontWeight: 800 }}>$</span><div style={{ minWidth: 0 }}><div className="adm-row__name">{formatUsd(d.amountUsd)} · {d.userName ?? d.userId}</div><div className="adm-row__meta">{METODO_NOMBRE[d.method] ?? d.method} · ref <strong>{d.reference}</strong>{d.createdAt?.toDate ? ` · ${d.createdAt.toDate().toLocaleString("es-VE")}` : ""}</div></div></div>
                    <div className="adm-row__act"><button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `dep_${d.id}`} onClick={() => decidirDeposito(d, "approve")}>{ocupado === `dep_${d.id}` ? "…" : "Acreditar"}</button><button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `dep_${d.id}`} onClick={() => decidirDeposito(d, "reject")}>Rechazar</button></div></div>
                ))}
              </div>

              <div className="adm-grid2">
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Movimientos de recarga</span></div>
                  {depositosHist.length === 0 ? <div className="adm-empty">Todavía no hay recargas.</div> : depositosHist.map(d => {
                    const e = ESTADO_DEP[d.status] ?? { texto: d.status, clase: "lv-badge--soft" };
                    return (
                      <div key={d.id} className="adm-row">
                        <div className="adm-row__main"><div style={{ minWidth: 0 }}><div className="adm-row__name" style={{ fontSize: "0.85rem" }}>{d.userName ?? d.userId}</div><div className="adm-row__meta">{METODO_NOMBRE[d.method] ?? d.method}{d.createdAt?.toDate ? ` · ${d.createdAt.toDate().toLocaleDateString("es-VE")}` : ""}</div></div></div>
                        <div className="adm-row__act"><span className="mono" style={{ fontSize: "0.84rem", fontWeight: 600 }}>{formatUsd(d.amountUsd ?? 0)}</span><span className={`lv-badge ${e.clase}`}>{e.texto}</span></div>
                      </div>
                    );
                  })}
                </div>
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Billeteras con saldo</span></div>
                  {billeterasTop.length === 0 ? <div className="adm-empty">Nadie tiene saldo todavía.</div> : billeterasTop.map(b => (
                    <div key={b.id} className="adm-row">
                      <div className="adm-row__main">{b.u ? <Ava u={b.u} size={32}/> : <span className="lv-avatar" style={{ width: 32, height: 32 }}>?</span>}<div style={{ minWidth: 0 }}><div className="adm-row__name" style={{ fontSize: "0.85rem" }}>{b.u?.displayName ?? b.id.slice(0, 8)}</div><div className="adm-row__meta">{b.retenido > 0 ? `${formatUsd(b.retenido)} retenidos` : "sin retenciones"}</div></div></div>
                      <div className="adm-row__act"><span className="mono" style={{ fontSize: "0.84rem", fontWeight: 600 }}>{formatUsd(b.saldo)}</span>{b.u && <button className="lv-btn lv-btn--soft lv-btn--sm" onClick={() => setUsuarioSel(b.u!)}>Ajustar</button>}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="adm-panel"><div className="adm-panel__b" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: "0.95rem", fontWeight: 800 }}>SUBELOO exige saldo</div><div className="adm-row__meta" style={{ whiteSpace: "normal", marginTop: 3, lineHeight: 1.45 }}>{walletCfg?.biddingRequiresBalance ? "Activo: cada oferta se respalda con saldo. Al quedar primero, el motor debita y la orden nace pagada." : "Apagado: ofertar es libre y quien queda primero coordina el pago después."}</div></div>
                <button className={`adm-toggle${walletCfg?.biddingRequiresBalance ? " on" : ""}`} disabled={ocupado === "wallet_toggle"} onClick={toggleSaldoObligatorio} aria-label="SUBELOO exige saldo"><span/></button>
              </div></div>

              <div className="adm-panel"><div className="adm-panel__h"><span className="t">Acreditar o descontar saldo</span></div><div className="adm-panel__b">
                <input className="lv-input" placeholder="Busca por nombre o correo…" value={buscaUsuario} onChange={e => { setBuscaUsuario(e.target.value); setUsuarioSel(null); }}/>
                {buscaUsuario.trim().length >= 2 && !usuarioSel && (
                  <div style={{ marginTop: 8 }}>{usuarios.filter(u => `${u.displayName ?? ""} ${u.email ?? ""}`.toLowerCase().includes(buscaUsuario.trim().toLowerCase())).slice(0, 6).map(u => (
                    <button key={u.id} className="adm-row" style={{ width: "100%", textAlign: "left", padding: "10px 0" }} onClick={() => setUsuarioSel(u)}><div className="adm-row__main"><Ava u={u} size={32}/><div><div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div><div className="adm-row__meta">{u.email}</div></div></div><span className="adm-row__meta">elegir →</span></button>
                  ))}</div>
                )}
                {usuarioSel && (
                  <div style={{ marginTop: 12 }}>
                    <div className="adm-row" style={{ padding: "10px 0" }}><div className="adm-row__main"><Ava u={usuarioSel}/><div><div className="adm-row__name">{usuarioSel.displayName ?? usuarioSel.email}</div><div className="adm-row__meta">{usuarioSel.email}</div></div></div><div style={{ textAlign: "right" }}><div className="adm-mc__lbl">Saldo</div><strong className="mono">{saldoSel === null ? "…" : formatUsd(saldoSel.total)}</strong>{saldoSel && saldoSel.retenido > 0 && <div className="adm-row__meta">{formatUsd(saldoSel.retenido)} retenidos</div>}</div></div>
                    <div className="adm-grid2" style={{ marginTop: 12 }}>
                      <div className="lv-field" style={{ margin: 0 }}><label className="lv-field__label">Monto (USD)</label><input className="lv-input" type="number" min="0" step="0.01" value={ajusteMonto} onChange={e => setAjusteMonto(e.target.value)} placeholder="Ej: 10"/></div>
                      <div className="lv-field" style={{ margin: 0 }}><label className="lv-field__label">Nota (la ve el usuario)</label><input className="lv-input" value={ajusteNota} onChange={e => setAjusteNota(e.target.value)} placeholder="Ej: Zelle ref 1234" maxLength={120}/></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="lv-btn lv-btn--accent lv-btn--sm" style={{ flex: 1 }} disabled={ocupado === "ajuste"} onClick={() => ajustarSaldo(1)}>+ Acreditar</button><button className="lv-btn lv-btn--outline lv-btn--sm" style={{ flex: 1 }} disabled={ocupado === "ajuste"} onClick={() => ajustarSaldo(-1)}>− Descontar</button></div>
                  </div>
                )}
              </div></div>

              <div className="adm-panel"><div className="adm-panel__h"><span className="t">Cuentas de recarga</span><span className={`lv-badge ${pmTel || zCorreo ? "adm-ok" : "adm-wn"}`}>{pmTel || zCorreo ? "Configuradas" : "Sin configurar"}</span></div><div className="adm-panel__b">
                <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.5 }}>Esto es lo que ve el usuario al recargar. Un método sin datos no se ofrece.</p>
                <div className="adm-grid2">
                  <div>
                    <div className="lv-field"><label className="lv-field__label">Pago móvil — Banco</label><input className="lv-input" value={pmBanco} onChange={e => setPmBanco(e.target.value)} placeholder="Ej: Banesco"/></div>
                    <div className="lv-field"><label className="lv-field__label">Teléfono</label><input className="lv-input" value={pmTel} onChange={e => setPmTel(e.target.value)} placeholder="0414-1234567"/></div>
                    <div className="lv-field"><label className="lv-field__label">Cédula o RIF</label><input className="lv-input" value={pmCi} onChange={e => setPmCi(e.target.value)} placeholder="V-12345678"/></div>
                  </div>
                  <div>
                    <div className="lv-field"><label className="lv-field__label">Zelle — Correo</label><input className="lv-input" value={zCorreo} onChange={e => setZCorreo(e.target.value)} placeholder="pagos@vendeloo.io"/></div>
                    <div className="lv-field"><label className="lv-field__label">Titular</label><input className="lv-input" value={zTitular} onChange={e => setZTitular(e.target.value)} placeholder="Nombre del titular"/></div>
                    <div className="lv-field"><label className="lv-field__label">Nota para el que recarga</label><input className="lv-input" value={ctaNota} onChange={e => setCtaNota(e.target.value)} placeholder="Ej: pon tu usuario en el concepto" maxLength={200}/></div>
                  </div>
                </div>
                <button className="lv-btn lv-btn--accent lv-btn--block" disabled={ocupado === "cuentas"} onClick={guardarCuentas}>{ocupado === "cuentas" ? "Guardando…" : "Guardar cuentas"}</button>
              </div></div>
            </>
          )}

          {/* ═══ ÓRDENES ═══ */}
          {seccion === "ordenes" && (
            <>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                {([["todas", "Todas"], ["pending_payment", "Por pagar"], ["payment_confirmed", "Pagadas"], ["shipped", "Enviadas"], ["delivered", "Entregadas"], ["cancelled", "Canceladas"]] as const).map(([v, label]) => (
                  <button key={v} className={`lv-chip${filtroOrden === v ? " lv-chip--active" : ""}`} onClick={() => setFiltroOrden(v)}>{label}</button>
                ))}
              </div>
              <div className="adm-panel">
                {ordenesLista.filter(o => filtroOrden === "todas" || o.status === filtroOrden).length === 0 && <div className="adm-empty">Nada por aquí.</div>}
                {ordenesLista.filter(o => filtroOrden === "todas" || o.status === filtroOrden).map(o => {
                  const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: "lv-badge--soft" }; const abierta = ordenAbierta === o.id;
                  const num = o.orderNumber ?? (o.id ?? "").slice(-6).toUpperCase();
                  return (
                    <div key={o.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <button style={{ width: "100%", textAlign: "left", padding: "13px 20px", display: "flex", alignItems: "center", gap: 12 }} onClick={() => setOrdenAbierta(abierta ? null : o.id)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="adm-row__name"><span className="mono" style={{ color: "var(--accent-strong)", fontSize: "0.72rem", marginRight: 8 }}>#{num}</span>{o.productTitle ?? o.auctionId}</div>
                          <div className="adm-row__meta">{o.buyerName} → {o.sellerName} · {formatUsd(o.bidAmountUsd ?? 0)}{o.paymentMethod === "wallet" ? " · pagó con billetera" : ""}</div>
                        </div>
                        <span className={`lv-badge ${e.clase}`}>{e.texto}</span>
                      </button>
                      {abierta && (
                        <div style={{ padding: "0 20px 16px" }}>
                          <div className="adm-row__meta" style={{ whiteSpace: "normal", lineHeight: 1.7 }}>
                            <div>Monto: <strong>{formatUsd(o.bidAmountUsd ?? 0)}</strong>{o.bidAmountBs ? ` · Bs ${o.bidAmountBs}` : ""} · comisión {formatUsd(o.commissionUsd ?? 0)} · recibe vendedor <strong>{formatUsd(o.sellerReceivesUsd ?? 0)}</strong></div>
                            <div>Pago: {o.paymentMethod ? `${METODO_NOMBRE[o.paymentMethod] ?? o.paymentMethod}${o.paymentReference ? ` · ref ${o.paymentReference}` : ""}` : "sin registrar"}</div>
                            <div>Comprador: {o.buyerName}{o.buyerWhatsapp && <> · <a href={`https://wa.me/${String(o.buyerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{o.buyerWhatsapp}</a></>} · Vendedor: {o.sellerName}{o.sellerWhatsapp && <> · <a href={`https://wa.me/${String(o.sellerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{o.sellerWhatsapp}</a></>}</div>
                            <div>Creada: {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("es-VE") : "—"} · id {o.id}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            {o.status === "pending_payment" && <>
                              <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "payment_confirmed", paymentConfirmedAt: serverTimestamp(), paymentConfirmedBy: profile!.uid }, `¿Confirmar el pago de ${o.buyerName} por ${formatUsd(o.bidAmountUsd ?? 0)}?`, "Pago confirmado")}>Confirmar pago</button>
                              <button className="lv-btn lv-btn--danger lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "cancelled" }, "¿Cancelar esta orden? Política vigente: SIN reembolsos — cancelar no devuelve saldo ni pagos.", "Orden cancelada")}>Cancelar</button>
                            </>}
                            {o.status === "payment_confirmed" && <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "shipped", shippedAt: serverTimestamp() }, "¿Marcar como enviada?", "Orden marcada como enviada")}>Marcar enviada</button>}
                            {o.status === "shipped" && <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "delivered", deliveredAt: serverTimestamp() }, "¿Marcar como entregada?", "Orden marcada como entregada")}>Marcar entregada</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ AJUSTES ═══ */}
          {seccion === "ajustes" && (
            <>
              <div className="adm-grid2">
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Tasa de cambio</span><span className={`lv-badge ${tasa?.usdToBs ? "adm-ok" : "adm-al"}`}>{tasa?.usdToBs ? "Al día" : "Falta"}</span></div><div className="adm-panel__b">
                  <div style={{ fontFamily: "var(--f-display)", fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "—"}</div>
                  <div className="adm-row__meta" style={{ marginTop: 6, marginBottom: 16 }}>
                    por dólar{tasa?.source ? ` · fuente: ${tasa.source}` : ""}{tasa?.updatedAt?.toDate ? ` · ${tasa.updatedAt.toDate().toLocaleString("es-VE")}` : ""}
                  </div>
                  <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.5 }}>Al cerrar una venta, el motor congela esta tasa en la orden. Se sincroniza sola del BCV cada 4 h; fijarla a mano vale hasta la próxima sincronización.</p>
                  <div className="lv-field"><label className="lv-field__label">Fijar a mano (Bs por dólar)</label><input className="lv-input" type="number" step="0.01" min="0" value={tasaInput} onChange={e => setTasaInput(e.target.value)} placeholder="Ej: 745"/></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="lv-btn lv-btn--accent" style={{ flex: 1 }} disabled={ocupado === "tasa"} onClick={guardarTasa}>{ocupado === "tasa" ? "Guardando…" : "Guardar tasa"}</button>
                    <button className="lv-btn lv-btn--soft" style={{ flex: 1 }} disabled={ocupado === "bcv"} onClick={traerBcv}>{ocupado === "bcv" ? "Consultando…" : "Traer del BCV"}</button>
                  </div>
                </div></div>

                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Comisión de la plataforma</span></div><div className="adm-panel__b">
                  <div style={{ fontFamily: "var(--f-display)", fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: "var(--accent)" }}>{comision?.platformFeePct != null ? `${comision.platformFeePct}%` : "—"}</div>
                  <div className="adm-row__meta" style={{ marginTop: 6, marginBottom: 16 }}>{comision?.mode === "platform_collects" ? "la plataforma cobra todo y luego paga al vendedor" : "el vendedor cobra directo y debe la comisión"}</div>
                  <div className="lv-field"><span className="lv-field__label">Quién cobra</span>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {([["seller_collects", "El vendedor cobra directo"], ["platform_collects", "La plataforma cobra todo"]] as const).map(([v, t]) => (
                        <button key={v} onClick={() => setModoInput(v)} className={`lv-chip${modoInput === v ? " lv-chip--active" : ""}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="lv-field"><label className="lv-field__label">Porcentaje</label><input className="lv-input" type="number" step="0.5" min="0" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)} placeholder="10"/>
                    {pctInput && isFinite(parseFloat(pctInput)) && <div className="lv-field__hint">En una venta de $100, la plataforma se queda ${parseFloat(pctInput).toFixed(2)}.</div>}
                  </div>
                  <button className="lv-btn lv-btn--accent lv-btn--block" disabled={ocupado === "comision"} onClick={guardarComision}>{ocupado === "comision" ? "Guardando…" : "Guardar comisión"}</button>
                </div></div>
              </div>

              <div className="adm-grid2">
                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Estado de la plataforma</span></div>
                  <div className="adm-state">
                    <div className="r"><div className="l">SUBELOO exige saldo<div className="s">Beta por invitación con billetera</div></div><button className={`adm-toggle${walletCfg?.biddingRequiresBalance ? " on" : ""}`} disabled={ocupado === "wallet_toggle"} onClick={toggleSaldoObligatorio} aria-label="SUBELOO exige saldo"><span/></button></div>
                    <div className="r"><div className="l">Cuentas de recarga<div className="s">Se configuran en Pagos</div></div><span className={`lv-badge ${pmTel || zCorreo ? "adm-ok" : "adm-wn"}`}>{pmTel || zCorreo ? "Configuradas" : "Sin configurar"}</span></div>
                    <div className="r"><div className="l">Avisos push (VAPID)<div className="s">Te superaron · ganaste · recargas</div></div><span className={`lv-badge ${vapidOk ? "adm-ok" : "adm-wn"}`}>{vapidOk ? "Activos" : "Falta la clave"}</span></div>
                    <div className="r"><div className="l">Términos y privacidad<div className="s">/terminos · /privacidad</div></div><a className="lv-badge adm-ok" href="/terminos" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Publicados</a></div>
                  </div>
                </div>

                <div className="adm-panel"><div className="adm-panel__h"><span className="t">Catálogo de demostración</span><span className="lv-badge lv-badge--soft">{demo} activas</span></div><div className="adm-panel__b">
                  <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.55 }}>Ventas de muestra con vendedores ficticios para que la app no se vea vacía. Llevan la insignia “Muestra”, <b>no aceptan ofertas</b> y no generan órdenes.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="lv-btn lv-btn--accent lv-btn--sm" style={{ flex: 1 }} disabled={ocupado === "demo_seed"} onClick={() => demoAccion("seed")}>{ocupado === "demo_seed" ? "Sembrando…" : "Sembrar catálogo"}</button>
                    <button className="lv-btn lv-btn--outline lv-btn--sm" style={{ flex: 1 }} disabled={ocupado === "demo_purge" || demo === 0} onClick={() => demoAccion("purge")}>{ocupado === "demo_purge" ? "Borrando…" : "Purgar demo"}</button>
                  </div>
                </div></div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// Suma de montos de depósitos (usa amountUsd, no bidAmountUsd)
function suma2(arr: any[]): string {
  const t = Math.round(arr.reduce((n, d) => n + (d.amountUsd ?? 0), 0) * 100) / 100;
  return formatUsd(t);
}
