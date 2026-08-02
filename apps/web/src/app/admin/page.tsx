"use client";
import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  updateDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { SIMBOLO_PATH, formatUsd } from "@subastas-ve/shared";
import {
  Clock,
  CreditCard,
  GearSix,
  GoogleLogo,
  Package,
  Plus,
  SignOut,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";

// =============================================================
// Consola de administración
// =============================================================
// Está organizada por el TRABAJO de quien la usa, no por las colecciones
// de la base de datos. Quien entra aquí a diario hace cobranza: alguien le
// escribe "ya te pagué, aquí está el comprobante" y tiene que encontrar a
// esa persona, confirmar y acreditarle. Por eso "Cobranza" es la pantalla
// de entrada y acreditar saldo es lo primero que se ve, siempre.
//
// Todo monto se muestra también en bolívares: el pago móvil entra en Bs y
// la billetera vive en dólares. Sin esa conversión a la vista, la persona
// de cobranza tiene que calcular de cabeza, y ahí es donde se equivoca.
// =============================================================

interface Usuario {
  id: string; displayName?: string; email?: string; role?: string;
  sellerStatus?: string; shopName?: string; sellerCat?: string;
  cedula?: string; whatsapp?: string; city?: string; avatar?: string; createdAt?: any;
  totalPurchases?: number; totalSales?: number; ratingAvg?: number; ratingCount?: number;
}
type Seccion = "cobranza" | "personas" | "ventas" | "ajustes";

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
const METODO: Record<string, string> = {
  pago_movil: "Pago móvil", zelle: "Zelle", binance: "Binance",
  efectivo: "Efectivo", wallet: "Billetera",
};
const MONTOS_RAPIDOS = [5, 10, 20, 50];

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
const fecha = (t: any) => t?.toDate?.()?.toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) ?? "—";

const I = {
  cobranza: <CreditCard weight="bold" aria-hidden="true"/>,
  personas: <UsersThree weight="bold" aria-hidden="true"/>,
  ventas: <Package weight="bold" aria-hidden="true"/>,
  ajustes: <GearSix weight="bold" aria-hidden="true"/>,
  mas: <Plus weight="bold" aria-hidden="true"/>,
  reloj: <Clock weight="bold" aria-hidden="true"/>,
  tienda: <Storefront weight="bold" aria-hidden="true"/>,
  out: <SignOut size={18} weight="bold" aria-hidden="true"/>,
};

const Mark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff"><path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/></svg>
);

function Metric({ label, icon, value, ctx, alerta }: {
  label: string; icon: JSX.Element; value: React.ReactNode; ctx?: React.ReactNode; alerta?: boolean;
}) {
  return (
    <div className={`adm-mc${alerta ? " adm-mc--alerta" : ""}`}>
      <div className="adm-mc__top"><span className="adm-mc__lbl">{label}</span><span className="adm-mc__ic">{icon}</span></div>
      <div className="adm-mc__num">{value}</div>
      {ctx && <div className="adm-mc__ctx">{ctx}</div>}
    </div>
  );
}

export default function AdminPage() {
  const { profile, loading: authLoading, signIn, signInWithGoogle, signOut, error } = useAuthStore();
  const [seccion, setSeccion] = useState<Seccion>("cobranza");

  // ── datos ──
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [wallets, setWallets] = useState<Record<string, { saldo: number; retenido: number }>>({});
  const [depositos, setDepositos] = useState<any[]>([]);
  const [depHist, setDepHist] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [activas, setActivas] = useState<any[]>([]);
  const [tasa, setTasa] = useState<{ usdToBs?: number; updatedAt?: any; source?: string } | null>(null);
  const [comision, setComision] = useState<{ mode?: string; platformFeePct?: number } | null>(null);
  const [walletCfg, setWalletCfg] = useState<{ biddingRequiresBalance?: boolean } | null>(null);

  // ── acreditar saldo (el flujo principal) ──
  const [busca, setBusca] = useState("");
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");

  // ── personas ──
  const [buscaP, setBuscaP] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  // ── ventas ──
  const [filtro, setFiltro] = useState("todas");
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null);

  // ── ajustes ──
  const [tasaInput, setTasaInput] = useState("");
  const [pctInput, setPctInput] = useState("");
  const [modoInput, setModoInput] = useState<"seller_collects" | "platform_collects">("seller_collects");
  const [pmBanco, setPmBanco] = useState(""); const [pmTel, setPmTel] = useState(""); const [pmCi, setPmCi] = useState("");
  const [zCorreo, setZCorreo] = useState(""); const [zTitular, setZTitular] = useState(""); const [ctaNota, setCtaNota] = useState("");

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState("info@vendeloo.io"); const [loginPass, setLoginPass] = useState(""); const [entrando, setEntrando] = useState(false);

  const esAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!esAdmin) return;
    const subs = [
      onSnapshot(collection(db, "users"), s => setUsuarios(s.docs.map(d => ({ id: d.id, ...d.data() } as Usuario))),
        e => setAviso({ tipo: "bad", texto: `No se pudieron leer las personas: ${e.code}` })),
      onSnapshot(collection(db, "wallets"), s => {
        const m: Record<string, { saldo: number; retenido: number }> = {};
        s.docs.forEach(d => {
          const w = d.data() as any;
          m[d.id] = { saldo: Math.round((w.balanceUsd ?? 0) * 100) / 100, retenido: Math.round((w.heldUsd ?? 0) * 100) / 100 };
        });
        setWallets(m);
      }, () => setWallets({})),
      onSnapshot(query(collection(db, "deposits"), where("status", "==", "pending"), orderBy("createdAt", "asc")),
        s => setDepositos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setDepositos([])),
      onSnapshot(query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(40)),
        s => setDepHist(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setDepHist([])),
      onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(120)),
        s => setOrdenes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setOrdenes([])),
      onSnapshot(query(collection(db, "auctions"), where("status", "==", "active"), limit(100)),
        s => setActivas(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setActivas([])),
      onSnapshot(doc(db, "exchangeRates", "current"), s => { const d = s.data(); setTasa(d ?? null); if (d?.usdToBs) setTasaInput(String(d.usdToBs)); }),
      onSnapshot(doc(db, "config", "commission"), s => { const d = s.data(); setComision(d ?? null); if (d?.platformFeePct != null) setPctInput(String(d.platformFeePct)); if (d?.mode) setModoInput(d.mode); }),
      onSnapshot(doc(db, "config", "wallet"), s => setWalletCfg(s.exists() ? (s.data() as any) : null), () => undefined),
      onSnapshot(doc(db, "config", "paymentAccounts"), s => {
        const d = s.data() as any; if (!d) return;
        setPmBanco(d.pagoMovil?.banco ?? ""); setPmTel(d.pagoMovil?.telefono ?? ""); setPmCi(d.pagoMovil?.cedula ?? "");
        setZCorreo(d.zelle?.correo ?? ""); setZTitular(d.zelle?.titular ?? ""); setCtaNota(d.nota ?? "");
      }, () => undefined),
    ];
    return () => subs.forEach(u => u());
  }, [esAdmin]);

  const correr = async (clave: string, fn: () => Promise<any>, exito: string) => {
    setOcupado(clave); setAviso(null);
    try { await fn(); setAviso({ tipo: "ok", texto: exito }); }
    catch (e: any) { setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo completar la acción" }); }
    finally { setOcupado(null); setTimeout(() => setAviso(null), 6000); }
  };

  const bs = (usd: number) => tasa?.usdToBs ? `Bs ${(usd * tasa.usdToBs).toLocaleString("es-VE", { maximumFractionDigits: 2 })}` : null;

  // ── acciones ──
  const moverSaldo = (signo: 1 | -1) => {
    if (!elegido) return;
    const v = parseFloat(monto);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "Escribe un monto mayor que cero" }); return; }
    if (nota.trim().length < 3) { setAviso({ tipo: "bad", texto: "La nota es obligatoria: la persona la ve en su historial" }); return; }
    const quien = elegido.displayName ?? elegido.email ?? elegido.id;
    const verbo = signo > 0 ? "ACREDITAR" : "DESCONTAR";
    if (!confirm(`${verbo} ${formatUsd(v)}${bs(v) ? ` (${bs(v)})` : ""}\n\nA: ${quien}\nMotivo: ${nota.trim()}\n\n¿Confirmas?`)) return;
    correr("saldo",
      () => httpsCallable(functions, "adjustWallet")({ userId: elegido.id, amountUsd: signo * v, note: nota.trim() }),
      `${signo > 0 ? "Acreditados" : "Descontados"} ${formatUsd(v)} a ${quien}`);
    setMonto(""); setNota("");
  };

  const decidirDeposito = (d: any, action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") {
      const r = prompt(`¿Por qué se rechaza la recarga de ${d.userName} por ${formatUsd(d.amountUsd)} (referencia ${d.reference})?\n\nLa persona va a leer este motivo:`);
      if (r === null) return;
      reason = r;
    } else if (!confirm(`ACREDITAR ${formatUsd(d.amountUsd)}${bs(d.amountUsd) ? ` (${bs(d.amountUsd)})` : ""}\n\nA: ${d.userName}\nMétodo: ${METODO[d.method] ?? d.method}\nReferencia: ${d.reference}\n\n¿Ya verificaste que ese pago llegó?`)) return;
    correr(`dep_${d.id}`, () => httpsCallable(functions, "manageDeposit")({ depositId: d.id, action, reason }),
      action === "approve" ? `${formatUsd(d.amountUsd)} acreditados a ${d.userName}` : "Recarga rechazada");
  };

  const aprobarVendedor = (u: Usuario) => correr(`ap_${u.id}`, () => httpsCallable(functions, "approveSeller")({ sellerUid: u.id }), `${u.displayName ?? u.id} ya puede vender`);
  const cambiarRol = (u: Usuario, hacerAdmin: boolean) => {
    const quien = u.displayName ?? u.email ?? u.id;
    const aviso = hacerAdmin
      ? `${quien} va a poder acreditar saldo, aprobar recargas, liquidar vendedores, cambiar tu comisión y ver los datos de todos.\n\n¿Lo haces administrador?`
      : `${quien} deja de tener acceso a esta consola.\n\n¿Le quitas el acceso?`;
    if (!confirm(aviso)) return;
    correr(`rol_${u.id}`, () => httpsCallable(functions, "setUserRole")({ userId: u.id, makeAdmin: hacerAdmin }),
      hacerAdmin ? `${quien} ya es administrador` : `${quien} ya no es administrador`);
  };
  const suspender = (u: Usuario) => { if (!confirm(`¿Suspender a ${u.displayName ?? u.id}? No podrá publicar más.`)) return; correr(`sp_${u.id}`, () => httpsCallable(functions, "suspendSeller")({ sellerUid: u.id }), `${u.displayName ?? u.id} suspendido`); };
  const cancelarSubasta = (a: any) => {
    const r = prompt(`Cancelar "${a.title}".\n\nSi alguien va ganando, su saldo retenido se le libera.\n\n¿Motivo?`);
    if (r === null) return;
    if (r.trim().length < 3) { setAviso({ tipo: "bad", texto: "Hace falta un motivo" }); return; }
    correr(`can_${a.id}`, () => httpsCallable(functions, "cancelAuction")({ auctionId: a.id, reason: r.trim() }), `"${a.title}" cancelada`);
  };
  const moverOrden = (o: any, cambios: Record<string, any>, pregunta: string, exito: string) => { if (!confirm(pregunta)) return; correr(`ord_${o.id}`, () => updateDoc(doc(db, "orders", o.id), { ...cambios, updatedAt: serverTimestamp() }), exito); };
  const guardarCuentas = () => correr("cuentas", async () => {
    await setDoc(doc(db, "config", "paymentAccounts"), {
      pagoMovil: pmTel.trim() ? { banco: pmBanco.trim(), telefono: pmTel.trim(), cedula: pmCi.trim() } : null,
      zelle: zCorreo.trim() ? { correo: zCorreo.trim(), titular: zTitular.trim() } : null,
      nota: ctaNota.trim() || null, updatedAt: serverTimestamp(),
    });
  }, "Cuentas de cobro guardadas");
  const toggleSaldo = () => {
    const activo = walletCfg?.biddingRequiresBalance === true;
    if (!activo && !pmTel && !zCorreo && !confirm("Todavía no hay cuentas de cobro cargadas, así que nadie puede recargar. Si activas esto, nadie sin saldo podrá ofertar. ¿Seguro?")) return;
    correr("wcfg", async () => { await setDoc(doc(db, "config", "wallet"), { biddingRequiresBalance: !activo, updatedAt: serverTimestamp() }, { merge: true }); },
      !activo ? "Ahora hay que tener saldo para ofertar" : "Ofertar vuelve a ser libre");
  };
  const traerBcv = () => correr("bcv", () => httpsCallable(functions, "syncBcvRateNow")({}), "Tasa actualizada desde el BCV");
  const guardarTasa = () => { const v = parseFloat(tasaInput); if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "La tasa debe ser mayor que cero" }); return; } correr("tasa", () => httpsCallable(functions, "updateExchangeRate")({ usdToBs: v }), `Tasa: Bs ${v} por dólar`); };
  const guardarComision = () => { const p = parseFloat(pctInput); if (!isFinite(p) || p < 0 || p > 100) { setAviso({ tipo: "bad", texto: "El porcentaje va de 0 a 100" }); return; } correr("com", () => httpsCallable(functions, "updateCommissionConfig")({ mode: modoInput, platformFeePct: p }), "Comisión guardada"); };
  const demo = (action: "seed" | "purge") => {
    if (action === "purge" && !confirm("Se borran las publicaciones de muestra (las de vendedores ficticios). Las reales no se tocan. ¿Seguro?")) return;
    correr(`demo_${action}`, () => httpsCallable(functions, "manageDemoAuctions")({ action }), action === "seed" ? "Muestras sembradas" : "Muestras borradas");
  };
  const entrar = async () => { if (!loginEmail.trim() || !loginPass) return; setEntrando(true); try { await signIn(loginEmail.trim(), loginPass); } finally { setEntrando(false); } };
  const entrarGoogle = async () => { setEntrando(true); try { await signInWithGoogle(); } finally { setEntrando(false); } };

  // ── derivados ──
  const saldoDe = (uid: string) => wallets[uid] ?? { saldo: 0, retenido: 0 };
  const comprasDe = (uid: string) => ordenes.filter(o => o.buyerId === uid && o.status !== "cancelled");
  const ventasDe = (uid: string) => ordenes.filter(o => o.sellerId === uid && o.status !== "cancelled");
  const depositosDe = (uid: string) => depHist.filter(d => d.userId === uid);
  const suma = (arr: any[], campo = "bidAmountUsd") => Math.round(arr.reduce((n, o) => n + (o[campo] ?? 0), 0) * 100) / 100;

  const totalEnBilleteras = useMemo(() => Math.round(Object.values(wallets).reduce((n, w) => n + w.saldo, 0) * 100) / 100, [wallets]);
  const totalRetenido = useMemo(() => Math.round(Object.values(wallets).reduce((n, w) => n + w.retenido, 0) * 100) / 100, [wallets]);

  const porLiquidar = ordenes.filter(o => o.paymentMethod === "wallet" && o.status !== "cancelled" && o.payoutStatus === "pending");
  const gruposLiq: Record<string, { sellerId: string; nombre: string; ordenes: any[]; total: number }> = {};
  for (const o of porLiquidar) {
    const k = o.sellerId as string;
    if (!gruposLiq[k]) gruposLiq[k] = { sellerId: k, nombre: o.sellerName ?? k, ordenes: [], total: 0 };
    gruposLiq[k].ordenes.push(o);
    gruposLiq[k].total = Math.round((gruposLiq[k].total + (o.payoutUsd ?? 0)) * 100) / 100;
  }
  const liquidar = Object.values(gruposLiq).sort((a, b) => b.total - a.total);
  const totalLiquidar = Math.round(liquidar.reduce((n, g) => n + g.total, 0) * 100) / 100;
  const pendientesVendedor = usuarios.filter(u => u.sellerStatus === "pending");
  const cuentasListas = !!(pmTel || zCorreo);

  const liquidarA = (g: { sellerId: string; nombre: string; ordenes: any[]; total: number }) => {
    const r = prompt(`Vas a dejar asentado que YA le pagaste ${formatUsd(g.total)}${bs(g.total) ? ` (${bs(g.total)})` : ""} a ${g.nombre}, por ${g.ordenes.length} ${g.ordenes.length === 1 ? "venta" : "ventas"}.\n\nHazlo solo si la transferencia ya salió.\n\nReferencia del pago (opcional):`);
    if (r === null) return;
    correr(`pay_${g.sellerId}`, () => httpsCallable(functions, "markSellerPaid")({ orderIds: g.ordenes.map(o => o.id), note: r }), `Liquidado ${formatUsd(g.total)} a ${g.nombre}`);
  };

  const Ava = ({ u, size = 38 }: { u: Usuario; size?: number }) => u.avatar
    ? <img className="lv-avatar" src={u.avatar} alt="" style={{ width: size, height: size, objectFit: "cover" }}/>
    : <span className="lv-avatar" style={{ width: size, height: size }}>{(u.displayName ?? u.email ?? "?")[0].toUpperCase()}</span>;

  // ══ Puertas ══
  if (authLoading) return <div className="adm-login"><div className="adm-login__card" style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</div></div>;

  if (!profile || !esAdmin) {
    return (
      <div className="adm-login">
        <svg viewBox="0 0 24 24" aria-hidden className="adm-login__wm"><path fillRule="evenodd" clipRule="evenodd" d={SIMBOLO_PATH}/></svg>
        <div className="adm-login__card">
          <div className="adm-login__brand"><span className="mk"><Mark size={23}/></span><div><div className="wm">Vendeloo</div><div className="pl">CONSOLA ADMIN</div></div></div>
          {!profile ? (
            <>
              <h1>Entra a<br/>la consola</h1>
              <p>Usa la cuenta oficial <b>info@vendeloo.io</b> para administrar la plataforma.</p>
              {error && <div className="lv-note lv-note--bad" style={{ marginBottom: 14 }}>{error}</div>}
              <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg adm-login__google" disabled={entrando} onClick={entrarGoogle}>
                <GoogleLogo size={20} weight="bold" aria-hidden="true"/>
                {entrando ? "Entrando…" : "Continuar con Google"}
              </button>
              <div className="adm-login__or"><span>o entra con contraseña</span></div>
              <div className="lv-field"><label className="lv-field__label" htmlFor="ale">Correo</label><input id="ale" className="lv-input" type="email" autoComplete="username" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="info@vendeloo.io"/></div>
              <div className="lv-field"><label className="lv-field__label" htmlFor="alp">Contraseña</label><input id="alp" className="lv-input" type="password" autoComplete="current-password" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="••••••••"/></div>
              <button className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg" disabled={entrando} onClick={entrar}>{entrando ? "Entrando…" : "Entrar"}</button>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <h1>Sin acceso</h1>
              <p style={{ marginBottom: 18 }}>La cuenta {profile.email} no es administradora.</p>
              <button className="lv-btn lv-btn--accent lv-btn--block" onClick={() => signOut()}>Cambiar a info@vendeloo.io</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const NAV: { id: Seccion; label: string; ct?: number }[] = [
    { id: "cobranza", label: "Cobranza", ct: depositos.length },
    { id: "personas", label: "Personas", ct: pendientesVendedor.length },
    { id: "ventas", label: "Ventas" },
    { id: "ajustes", label: "Ajustes" },
  ];
  const TITULOS: Record<Seccion, { t: string; s: string }> = {
    cobranza: { t: "Cobranza", s: "Acredita pagos, aprueba recargas y liquida a los vendedores" },
    personas: { t: "Personas", s: `${usuarios.length} cuentas · toca una para ver todo su historial` },
    ventas: { t: "Ventas", s: "Órdenes y publicaciones activas" },
    ajustes: { t: "Ajustes", s: "Tasa, comisión, cuentas de cobro y muestras" },
  };

  const resultados = (() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    return usuarios
      .filter(u => `${u.displayName ?? ""} ${u.email ?? ""} ${u.shopName ?? ""} ${u.whatsapp ?? ""} ${u.cedula ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  })();
  const personas = usuarios
    .filter(u => { const q = buscaP.trim().toLowerCase(); return !q || `${u.displayName ?? ""} ${u.email ?? ""} ${u.shopName ?? ""} ${u.whatsapp ?? ""} ${u.cedula ?? ""}`.toLowerCase().includes(q); })
    .sort((a, b) => saldoDe(b.id).saldo - saldoDe(a.id).saldo);

  const montoNum = parseFloat(monto);
  const listoParaGuardar = isFinite(montoNum) && montoNum > 0 && nota.trim().length >= 3;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-side__brand"><span className="mk"><Mark/></span><div><div className="wm">Vendeloo</div><div className="pl">CONSOLA ADMIN</div></div></div>
        <nav className="adm-side__nav">
          {NAV.map(n => (
            <button key={n.id} className={`adm-nav-item${seccion === n.id ? " active" : ""}`} onClick={() => setSeccion(n.id)}>
              {I[n.id]}<span>{n.label}</span>{!!n.ct && n.ct > 0 && <span className="ct">{n.ct}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-side__foot">
          <span className="av">{(profile.displayName ?? profile.email ?? "A")[0].toUpperCase()}</span>
          <div className="who"><div className="n">{profile.displayName ?? "Administrador"}</div><div className="r">{profile.email}</div></div>
          <button className="out" onClick={() => { if (confirm("¿Cerrar sesión?")) signOut(); }}>{I.out}</button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-top">
          <div><h1>{TITULOS[seccion].t}</h1><div className="sub">{TITULOS[seccion].s}</div></div>
          <div className="adm-kpis">
            <div className="adm-chip"><div className="k">Tasa del día</div><div className="v mono">{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "—"}</div></div>
            <div className="adm-chip"><div className="k">Ofertar exige saldo</div><div className="v"><span className={`adm-dot ${walletCfg?.biddingRequiresBalance ? "adm-dot--o" : "adm-dot--x"}`}/>{walletCfg?.biddingRequiresBalance ? "Sí" : "No"}</div></div>
          </div>
        </div>

        <div className="adm-body">
          {aviso && <div className={`lv-note lv-note--${aviso.tipo === "ok" ? "ok" : "bad"}`} style={{ marginBottom: 16 }}>{aviso.texto}</div>}

          {!cuentasListas && (
            <div className="adm-alerta">
              <span style={{ color: "var(--error)", flexShrink: 0, marginTop: 1, width: 20, height: 20 }}>{I.reloj}</span>
              <div>
                <div className="adm-alerta__t">Nadie puede recargar todavía</div>
                <div className="adm-alerta__d">
                  No hay cuentas de cobro cargadas, así que la pantalla de recarga se ve vacía para todos.
                  {walletCfg?.biddingRequiresBalance ? " Y como ofertar exige saldo, nadie puede ofertar." : ""}{" "}
                  <a onClick={() => setSeccion("ajustes")} style={{ color: "var(--accent-strong)", fontWeight: 700, cursor: "pointer" }}>Cargar cuentas →</a>
                </div>
              </div>
            </div>
          )}
          {!tasa?.usdToBs && (
            <div className="adm-alerta">
              <span style={{ color: "var(--error)", flexShrink: 0, marginTop: 1, width: 20, height: 20 }}>{I.reloj}</span>
              <div>
                <div className="adm-alerta__t">Falta la tasa del día</div>
                <div className="adm-alerta__d">Sin tasa, las órdenes salen sin monto en bolívares. <a onClick={() => setSeccion("ajustes")} style={{ color: "var(--accent-strong)", fontWeight: 700, cursor: "pointer" }}>Configurar →</a></div>
              </div>
            </div>
          )}

          {/* ═══════════ COBRANZA ═══════════ */}
          {seccion === "cobranza" && (
            <div className="adm-cobro">
              <div className="adm-metrics">
                <Metric alerta={depositos.length > 0} label="Recargas por aprobar" icon={I.cobranza} value={depositos.length}
                  ctx={depositos.length > 0 ? <b>{formatUsd(suma(depositos, "amountUsd"))}</b> : "todo al día"}/>
                <Metric alerta={totalLiquidar > 0} label="Debes a vendedores" icon={I.tienda} value={formatUsd(totalLiquidar)}
                  ctx={totalLiquidar > 0 ? <>{liquidar.length} por pagar</> : "todo liquidado"}/>
                <Metric label="En billeteras" icon={I.cobranza} value={formatUsd(totalEnBilleteras)} ctx={bs(totalEnBilleteras) ?? ""}/>
                <Metric label="Retenido en ofertas" icon={I.reloj} value={formatUsd(totalRetenido)} ctx="respaldo de quien va ganando"/>
              </div>

              {/* ── ACREDITAR SALDO: lo primero, siempre ── */}
              <div className="adm-cobro__card">
                <div className="adm-cobro__head">
                  <span className="ic" style={{ width: 40, height: 40 }}>{I.mas}</span>
                  <div>
                    <h2>Cargarle saldo a alguien</h2>
                    <p>Cuando te pagaron por fuera y hay que meterle el saldo a mano.</p>
                  </div>
                </div>
                <div className="adm-cobro__body">
                  {!elegido ? (
                    <>
                      <div className="lv-field" style={{ marginBottom: 0 }}>
                        <label className="lv-field__label" htmlFor="bq">Paso 1 · ¿A quién?</label>
                        <input id="bq" className="lv-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nombre, correo, WhatsApp o cédula…" autoComplete="off"/>
                      </div>
                      {busca.trim().length >= 2 && (
                        <div className="adm-find">
                          {resultados.length === 0
                            ? <div className="adm-empty" style={{ padding: 18 }}>Nadie coincide con «{busca}»</div>
                            : resultados.map(u => (
                              <button key={u.id} className="adm-find__row" onClick={() => { setElegido(u); setBusca(""); }}>
                                <Ava u={u} size={34}/>
                                <div style={{ minWidth: 0 }}>
                                  <div className="n">{u.displayName ?? "Sin nombre"}</div>
                                  <div className="s">{u.email}{u.whatsapp ? ` · ${u.whatsapp}` : ""}</div>
                                </div>
                                <span className="b">{formatUsd(saldoDe(u.id).saldo)}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="adm-elegido">
                        <Ava u={elegido} size={44}/>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>{elegido.displayName ?? "Sin nombre"}</div>
                          <div style={{ fontSize: "0.76rem", color: "var(--ink-3)" }}>{elegido.email}{elegido.whatsapp ? ` · ${elegido.whatsapp}` : ""}</div>
                        </div>
                        <div className="adm-elegido__saldo">
                          <div className="k">Saldo hoy</div>
                          <div className="v">{formatUsd(saldoDe(elegido.id).saldo)}</div>
                          {saldoDe(elegido.id).retenido > 0 && <div className="r">{formatUsd(saldoDe(elegido.id).retenido)} retenidos</div>}
                        </div>
                        <button className="lv-btn lv-btn--soft lv-btn--sm" onClick={() => { setElegido(null); setMonto(""); setNota(""); }}>Cambiar</button>
                      </div>

                      <div className="lv-field">
                        <span className="lv-field__label">Paso 2 · ¿Cuánto?</span>
                        <div className="adm-montos">
                          {MONTOS_RAPIDOS.map(v => (
                            <button key={v} className={montoNum === v ? "on" : ""} onClick={() => setMonto(String(v))}>
                              ${v}{bs(v) && <small>{bs(v)}</small>}
                            </button>
                          ))}
                        </div>
                        <input className="lv-input" type="number" min="0" step="0.01" inputMode="decimal" value={monto}
                          onChange={e => setMonto(e.target.value)} placeholder="U otro monto, en dólares"/>
                        {montoNum > 0 && bs(montoNum) && <div className="adm-bs">Son <b>{bs(montoNum)}</b> a la tasa de hoy.</div>}
                      </div>

                      <div className="lv-field">
                        <label className="lv-field__label" htmlFor="nt">Paso 3 · ¿Por qué?</label>
                        <input id="nt" className="lv-input" value={nota} onChange={e => setNota(e.target.value)} maxLength={120}
                          placeholder="Ej: Pago móvil Banesco ref 004512"/>
                        <div className="lv-field__hint">La persona ve esta nota en su historial de billetera.</div>
                      </div>

                      {listoParaGuardar && (
                        <div className="adm-confirmar">
                          A <b>{elegido.displayName ?? elegido.email}</b> le vas a <b>sumar {formatUsd(montoNum)}</b>
                          {bs(montoNum) ? <> ({bs(montoNum)})</> : null}. Su saldo pasaría de {formatUsd(saldoDe(elegido.id).saldo)} a{" "}
                          <b>{formatUsd(saldoDe(elegido.id).saldo + montoNum)}</b>.
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="lv-btn lv-btn--accent lv-btn--lg" style={{ flex: 2 }} disabled={ocupado === "saldo" || !listoParaGuardar} onClick={() => moverSaldo(1)}>
                          {ocupado === "saldo" ? "Guardando…" : "Acreditar saldo"}
                        </button>
                        <button className="lv-btn lv-btn--outline lv-btn--lg" style={{ flex: 1 }} disabled={ocupado === "saldo" || !listoParaGuardar} onClick={() => moverSaldo(-1)}>
                          Descontar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Cola de recargas ── */}
              <div className="adm-panel">
                <div className="adm-panel__h">
                  <span className="t">Recargas que la gente reportó · {depositos.length}</span>
                  {depositos.length > 0 && <span className="lv-badge adm-wn">{formatUsd(suma(depositos, "amountUsd"))}</span>}
                </div>
                {depositos.length === 0 ? (
                  <div className="adm-empty">Nada esperando. Cuando alguien reporte un pago desde la app, aparece aquí.</div>
                ) : depositos.map(d => {
                  const u = usuarios.find(x => x.id === d.userId);
                  return (
                    <div key={d.id} className="adm-row">
                      <div className="adm-row__main">
                        {u ? <Ava u={u}/> : <span className="lv-avatar">?</span>}
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-cola__monto">{formatUsd(d.amountUsd)} {bs(d.amountUsd) && <span className="adm-cola__bs">· {bs(d.amountUsd)}</span>}</div>
                          <div className="adm-row__name" style={{ fontSize: "0.85rem" }}>{d.userName ?? d.userId}</div>
                          <div className="adm-row__meta" style={{ marginTop: 3 }}>
                            {METODO[d.method] ?? d.method} · ref <span className="adm-cola__ref">{d.reference}</span> · {fecha(d.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="adm-row__act">
                        <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `dep_${d.id}`} onClick={() => decidirDeposito(d, "reject")}>Rechazar</button>
                        <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `dep_${d.id}`} onClick={() => decidirDeposito(d, "approve")}>
                          {ocupado === `dep_${d.id}` ? "…" : "Acreditar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Liquidar a vendedores ── */}
              <div className="adm-panel">
                <div className="adm-panel__h">
                  <span className="t">Por pagarle a vendedores · {liquidar.length}</span>
                  {totalLiquidar > 0 && <span className="lv-badge adm-wn">{formatUsd(totalLiquidar)}</span>}
                </div>
                {liquidar.length === 0 ? (
                  <div className="adm-empty">Nada pendiente. Aquí aparece lo que cobraste tú por ventas pagadas con saldo.</div>
                ) : liquidar.map(g => {
                  const u = usuarios.find(x => x.id === g.sellerId);
                  return (
                    <div key={g.sellerId} className="adm-row">
                      <div className="adm-row__main">
                        {u ? <Ava u={u}/> : <span className="lv-avatar">{g.nombre[0]}</span>}
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-cola__monto">{formatUsd(g.total)} {bs(g.total) && <span className="adm-cola__bs">· {bs(g.total)}</span>}</div>
                          <div className="adm-row__name" style={{ fontSize: "0.85rem" }}>{g.nombre}</div>
                          <div className="adm-row__meta">{g.ordenes.length} {g.ordenes.length === 1 ? "venta" : "ventas"} · {u?.whatsapp ? `WhatsApp ${u.whatsapp}` : "sin WhatsApp"}</div>
                        </div>
                      </div>
                      <div className="adm-row__act">
                        <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `pay_${g.sellerId}`} onClick={() => liquidarA(g)}>
                          {ocupado === `pay_${g.sellerId}` ? "…" : "Ya le pagué"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Historial ── */}
              <div className="adm-panel">
                <div className="adm-panel__h"><span className="t">Últimas recargas</span></div>
                {depHist.length === 0 ? <div className="adm-empty">Todavía no hay recargas.</div> : depHist.slice(0, 12).map(d => {
                  const e = ESTADO_DEP[d.status] ?? { texto: d.status, clase: "lv-badge--soft" };
                  return (
                    <div key={d.id} className="adm-row">
                      <div className="adm-row__main">
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-row__name" style={{ fontSize: "0.85rem" }}>{d.userName ?? d.userId}</div>
                          <div className="adm-row__meta">{METODO[d.method] ?? d.method} · ref {d.reference} · {fecha(d.createdAt)}</div>
                        </div>
                      </div>
                      <div className="adm-row__act">
                        <span className="mono" style={{ fontSize: "0.86rem", fontWeight: 700 }}>{formatUsd(d.amountUsd ?? 0)}</span>
                        <span className={`lv-badge ${e.clase}`}>{e.texto}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════ PERSONAS ═══════════ */}
          {seccion === "personas" && (
            <>
              {pendientesVendedor.length > 0 && (
                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Quieren ser vendedores · {pendientesVendedor.length}</span></div>
                  {pendientesVendedor.map(u => (
                    <div key={u.id} className="adm-row">
                      <div className="adm-row__main">
                        <Ava u={u}/>
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-row__name">{u.displayName ?? "Sin nombre"}</div>
                          <div className="adm-row__meta">{u.shopName ? `${u.shopName} · ` : ""}{u.city ?? ""}{u.whatsapp ? ` · ${u.whatsapp}` : " · sin WhatsApp"}</div>
                        </div>
                      </div>
                      <div className="adm-row__act">
                        <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobarVendedor(u)}>
                          {ocupado === `ap_${u.id}` ? "…" : "Aprobar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="adm-panel">
                <div className="adm-panel__b" style={{ paddingBottom: 14 }}>
                  <input className="lv-input" placeholder="Busca por nombre, correo, tienda, WhatsApp o cédula…" value={buscaP} onChange={e => setBuscaP(e.target.value)}/>
                </div>
                {personas.length === 0 && <div className="adm-empty">Sin resultados.</div>}
                {personas.slice(0, 60).map(u => {
                  const w = saldoDe(u.id);
                  const abierto = abierta === u.id;
                  const compras = comprasDe(u.id); const ventas = ventasDe(u.id); const deps = depositosDe(u.id);
                  const esVendedor = u.sellerStatus === "approved";
                  return (
                    <div key={u.id}>
                      <button className="adm-row" style={{ width: "100%", textAlign: "left" }} onClick={() => setAbierta(abierto ? null : u.id)}>
                        <div className="adm-row__main">
                          <Ava u={u}/>
                          <div style={{ minWidth: 0 }}>
                            <div className="adm-row__name">
                              {u.displayName ?? "Sin nombre"}
                              {u.role === "admin" && <span className="lv-badge lv-badge--accent" style={{ marginLeft: 8 }}>Admin</span>}
                              {esVendedor && <span className="lv-badge adm-ok" style={{ marginLeft: 8 }}>Vendedor</span>}
                              {u.sellerStatus === "suspended" && <span className="lv-badge adm-al" style={{ marginLeft: 8 }}>Suspendido</span>}
                            </div>
                            <div className="adm-row__meta">{u.email}{u.whatsapp ? ` · ${u.whatsapp}` : ""}{u.city ? ` · ${u.city}` : ""}</div>
                          </div>
                        </div>
                        <div className="adm-row__act">
                          <div style={{ textAlign: "right" }}>
                            <div className="mono" style={{ fontSize: "0.95rem", fontWeight: 700 }}>{formatUsd(w.saldo)}</div>
                            {w.retenido > 0 && <div style={{ fontSize: "0.68rem", color: "var(--accent-strong)", fontWeight: 600 }}>{formatUsd(w.retenido)} retenidos</div>}
                          </div>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.2" strokeLinecap="round" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                      </button>

                      {abierto && (
                        <div className="adm-persona">
                          <div className="adm-det__grid">
                            <div className="adm-det__stat"><div className="k">Saldo</div><div className="v">{formatUsd(w.saldo)}</div><div className="s">{bs(w.saldo) ?? "—"}</div></div>
                            <div className="adm-det__stat"><div className="k">Compras</div><div className="v">{compras.length}</div><div className="s">{formatUsd(suma(compras))} gastados</div></div>
                            <div className="adm-det__stat"><div className="k">Ventas</div><div className="v">{esVendedor ? ventas.length : "—"}</div><div className="s">{esVendedor ? `${formatUsd(suma(ventas))} vendidos` : "no vende"}</div></div>
                            <div className="adm-det__stat"><div className="k">En la app</div><div className="v" style={{ fontSize: "1.05rem", paddingTop: 3 }}>{tiempoDesde(u.createdAt)}</div><div className="s">{u.ratingAvg ? `${u.ratingAvg.toFixed(1)}★` : "sin calificar"}</div></div>
                          </div>

                          <div className="adm-row__meta" style={{ whiteSpace: "normal", lineHeight: 1.7 }}>
                            WhatsApp: {u.whatsapp
                              ? <a href={`https://wa.me/${String(u.whatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{u.whatsapp}</a>
                              : "—"}
                            {" · "}Correo: {u.email ?? "—"}
                            {u.cedula ? <> · Cédula: {u.cedula}</> : null}
                            {u.shopName ? <> · Tienda: <b>{u.shopName}</b></> : null}
                          </div>

                          {deps.length > 0 && (
                            <div className="adm-persona__hist">
                              <div className="t">Sus recargas</div>
                              {deps.slice(0, 5).map(d => (
                                <div key={d.id} className="l">
                                  <span>{fecha(d.createdAt)} · {METODO[d.method] ?? d.method} · ref {d.reference}</span>
                                  <strong>{formatUsd(d.amountUsd ?? 0)} · {(ESTADO_DEP[d.status] ?? { texto: d.status }).texto}</strong>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="adm-persona__acciones">
                            <button className="lv-btn lv-btn--accent lv-btn--sm" onClick={() => { setElegido(u); setSeccion("cobranza"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                              Cargarle saldo
                            </button>
                            {(u.sellerStatus === "pending" || u.sellerStatus === "suspended") && (
                              <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `ap_${u.id}`} onClick={() => aprobarVendedor(u)}>
                                {u.sellerStatus === "suspended" ? "Reactivar" : "Aprobar como vendedor"}
                              </button>
                            )}
                            {esVendedor && <a className="lv-btn lv-btn--soft lv-btn--sm" href={`/seller/${u.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver su tienda</a>}
                            {esVendedor && u.role !== "admin" && (
                              <button className="lv-btn lv-btn--danger lv-btn--sm" disabled={ocupado === `sp_${u.id}`} onClick={() => suspender(u)}>Suspender</button>
                            )}
                            {/* El rol propio no se toca: evita quedarse fuera de la consola por error. */}
                            {u.id !== profile.uid && (
                              u.role === "admin"
                                ? <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `rol_${u.id}`} onClick={() => cambiarRol(u, false)}>Quitar admin</button>
                                : <button className="lv-btn lv-btn--outline lv-btn--sm" disabled={ocupado === `rol_${u.id}`} onClick={() => cambiarRol(u, true)}>Hacer administrador</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══════════ VENTAS ═══════════ */}
          {seccion === "ventas" && (
            <>
              <div className="adm-panel">
                <div className="adm-panel__h"><span className="t">Publicaciones activas · {activas.length}</span></div>
                {activas.length === 0 ? <div className="adm-empty">Nada activo ahora mismo.</div> : activas.slice(0, 30).map(a => (
                  <div key={a.id} className="adm-row">
                    <div className="adm-row__main">
                      <div style={{ width: 42, height: 42, borderRadius: 11, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                        {(a.imageURL ?? a.imageURLs?.[0]) && <img src={a.imageURL ?? a.imageURLs[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="adm-row__name">{a.title}{a.isDemo && <span className="lv-badge lv-badge--soft" style={{ marginLeft: 8 }}>Muestra</span>}</div>
                        <div className="adm-row__meta">{a.sellerName} · {formatUsd(a.currentBidUsd ?? 0)} · {a.bidsCount ?? 0} ofertas</div>
                      </div>
                    </div>
                    <div className="adm-row__act">
                      <a className="lv-btn lv-btn--soft lv-btn--sm" href={`/auctions/${a.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver</a>
                      <button className="lv-btn lv-btn--danger lv-btn--sm" disabled={ocupado === `can_${a.id}`} onClick={() => cancelarSubasta(a)}>
                        {ocupado === `can_${a.id}` ? "…" : "Cancelar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                {([["todas", "Todas"], ["pending_payment", "Por pagar"], ["payment_confirmed", "Pagadas"], ["shipped", "Enviadas"], ["delivered", "Entregadas"], ["cancelled", "Canceladas"]] as const).map(([v, l]) => (
                  <button key={v} className={`lv-chip${filtro === v ? " lv-chip--active" : ""}`} onClick={() => setFiltro(v)}>{l}</button>
                ))}
              </div>

              <div className="adm-panel">
                {ordenes.filter(o => filtro === "todas" || o.status === filtro).length === 0 && <div className="adm-empty">Nada por aquí.</div>}
                {ordenes.filter(o => filtro === "todas" || o.status === filtro).slice(0, 60).map(o => {
                  const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: "lv-badge--soft" };
                  const ab = ordenAbierta === o.id;
                  const num = o.orderNumber ?? (o.id ?? "").slice(-6).toUpperCase();
                  return (
                    <div key={o.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <button style={{ width: "100%", textAlign: "left", padding: "13px 20px", display: "flex", alignItems: "center", gap: 12 }} onClick={() => setOrdenAbierta(ab ? null : o.id)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="adm-row__name"><span className="mono" style={{ color: "var(--accent-strong)", fontSize: "0.72rem", marginRight: 8 }}>#{num}</span>{o.productTitle ?? o.auctionId}</div>
                          <div className="adm-row__meta">{o.buyerName} → {o.sellerName} · {formatUsd(o.bidAmountUsd ?? 0)}{o.paymentMethod === "wallet" ? " · pagó con saldo" : ""}</div>
                        </div>
                        <span className={`lv-badge ${e.clase}`}>{e.texto}</span>
                      </button>
                      {ab && (
                        <div style={{ padding: "0 20px 16px" }}>
                          <div className="adm-row__meta" style={{ whiteSpace: "normal", lineHeight: 1.7 }}>
                            <div>Monto: <b>{formatUsd(o.bidAmountUsd ?? 0)}</b>{o.bidAmountBs ? ` · Bs ${o.bidAmountBs}` : ""} · comisión {formatUsd(o.commissionUsd ?? 0)} · al vendedor <b>{formatUsd(o.payoutUsd ?? o.sellerReceivesUsd ?? 0)}</b></div>
                            <div>Comprador: {o.buyerName}{o.buyerWhatsapp && <> · <a href={`https://wa.me/${String(o.buyerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{o.buyerWhatsapp}</a></>}</div>
                            <div>Vendedor: {o.sellerName}{o.sellerWhatsapp && <> · <a href={`https://wa.me/${String(o.sellerWhatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{o.sellerWhatsapp}</a></>}</div>
                            <div>Creada: {fecha(o.createdAt)}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            {o.status === "pending_payment" && <>
                              <button className="lv-btn lv-btn--accent lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "payment_confirmed", paymentConfirmedAt: serverTimestamp(), paymentConfirmedBy: profile!.uid }, `¿Confirmar que ${o.buyerName} pagó ${formatUsd(o.bidAmountUsd ?? 0)}?`, "Pago confirmado")}>Confirmar pago</button>
                              <button className="lv-btn lv-btn--danger lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "cancelled" }, "¿Cancelar esta orden? Política vigente: SIN reembolsos.", "Orden cancelada")}>Cancelar</button>
                            </>}
                            {o.status === "payment_confirmed" && <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "shipped", shippedAt: serverTimestamp() }, "¿Marcar como enviada?", "Marcada como enviada")}>Marcar enviada</button>}
                            {o.status === "shipped" && <button className="lv-btn lv-btn--soft lv-btn--sm" disabled={ocupado === `ord_${o.id}`} onClick={() => moverOrden(o, { status: "delivered", deliveredAt: serverTimestamp() }, "¿Marcar como entregada?", "Marcada como entregada")}>Marcar entregada</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══════════ AJUSTES ═══════════ */}
          {seccion === "ajustes" && (
            <>
              <div className="adm-panel">
                <div className="adm-panel__h">
                  <span className="t">Cuentas donde te pagan</span>
                  <span className={`lv-badge ${cuentasListas ? "adm-ok" : "adm-al"}`}>{cuentasListas ? "Listas" : "Sin cargar"}</span>
                </div>
                <div className="adm-panel__b">
                  <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.5 }}>
                    Esto es exactamente lo que ve la persona cuando va a recargar. Si un método queda vacío, no se le ofrece.
                  </p>
                  <div className="adm-grid2">
                    <div>
                      <div className="lv-field"><label className="lv-field__label">Pago móvil · Banco</label><input className="lv-input" value={pmBanco} onChange={e => setPmBanco(e.target.value)} placeholder="Banesco"/></div>
                      <div className="lv-field"><label className="lv-field__label">Teléfono</label><input className="lv-input" value={pmTel} onChange={e => setPmTel(e.target.value)} placeholder="0414-1234567"/></div>
                      <div className="lv-field"><label className="lv-field__label">Cédula o RIF</label><input className="lv-input" value={pmCi} onChange={e => setPmCi(e.target.value)} placeholder="V-12345678"/></div>
                    </div>
                    <div>
                      <div className="lv-field"><label className="lv-field__label">Zelle · Correo</label><input className="lv-input" value={zCorreo} onChange={e => setZCorreo(e.target.value)} placeholder="pagos@vendeloo.io"/></div>
                      <div className="lv-field"><label className="lv-field__label">Titular</label><input className="lv-input" value={zTitular} onChange={e => setZTitular(e.target.value)} placeholder="Nombre del titular"/></div>
                      <div className="lv-field"><label className="lv-field__label">Nota para quien recarga</label><input className="lv-input" value={ctaNota} onChange={e => setCtaNota(e.target.value)} maxLength={200} placeholder="Pon tu nombre en el concepto"/></div>
                    </div>
                  </div>
                  <button className="lv-btn lv-btn--accent lv-btn--block" disabled={ocupado === "cuentas"} onClick={guardarCuentas}>{ocupado === "cuentas" ? "Guardando…" : "Guardar cuentas"}</button>
                </div>
              </div>

              <div className="adm-grid2">
                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Tasa del día</span><span className={`lv-badge ${tasa?.usdToBs ? "adm-ok" : "adm-al"}`}>{tasa?.usdToBs ? "Al día" : "Falta"}</span></div>
                  <div className="adm-panel__b">
                    <div style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: "var(--accent)", letterSpacing: "-0.03em" }}>{tasa?.usdToBs ? `Bs ${tasa.usdToBs}` : "—"}</div>
                    <div className="adm-row__meta" style={{ marginTop: 6, marginBottom: 16 }}>por dólar{tasa?.source ? ` · ${tasa.source}` : ""}{tasa?.updatedAt?.toDate ? ` · ${fecha(tasa.updatedAt)}` : ""}</div>
                    <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.5 }}>Se actualiza sola desde el BCV cada 4 horas. Al cerrar una venta, esta tasa queda congelada en la orden.</p>
                    <div className="lv-field"><label className="lv-field__label">Fijarla a mano</label><input className="lv-input" type="number" step="0.01" min="0" value={tasaInput} onChange={e => setTasaInput(e.target.value)}/></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="lv-btn lv-btn--accent" style={{ flex: 1 }} disabled={ocupado === "tasa"} onClick={guardarTasa}>Guardar</button>
                      <button className="lv-btn lv-btn--soft" style={{ flex: 1 }} disabled={ocupado === "bcv"} onClick={traerBcv}>{ocupado === "bcv" ? "…" : "Traer del BCV"}</button>
                    </div>
                  </div>
                </div>

                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Tu comisión</span></div>
                  <div className="adm-panel__b">
                    <div style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: "var(--accent)", letterSpacing: "-0.03em" }}>{comision?.platformFeePct != null ? `${comision.platformFeePct}%` : "—"}</div>
                    <div className="adm-row__meta" style={{ marginTop: 6, marginBottom: 16 }}>{comision?.mode === "platform_collects" ? "cobras tú y le pagas al vendedor" : "cobra el vendedor y te debe la comisión"}</div>
                    <div className="lv-field"><span className="lv-field__label">¿Quién cobra?</span>
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        {([["platform_collects", "Cobro yo"], ["seller_collects", "Cobra el vendedor"]] as const).map(([v, t]) => (
                          <button key={v} onClick={() => setModoInput(v)} className={`lv-chip${modoInput === v ? " lv-chip--active" : ""}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="lv-field"><label className="lv-field__label">Porcentaje</label><input className="lv-input" type="number" step="0.5" min="0" max="100" value={pctInput} onChange={e => setPctInput(e.target.value)}/>
                      {pctInput && isFinite(parseFloat(pctInput)) && <div className="lv-field__hint">De una venta de $100 te quedas ${parseFloat(pctInput).toFixed(2)}.</div>}
                    </div>
                    <button className="lv-btn lv-btn--accent lv-btn--block" disabled={ocupado === "com"} onClick={guardarComision}>Guardar comisión</button>
                  </div>
                </div>
              </div>

              <div className="adm-grid2">
                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Reglas de la plataforma</span></div>
                  <div className="adm-state">
                    <div className="r">
                      <div className="l">Hay que tener saldo para ofertar<div className="s">Si lo apagas, se puede ofertar sin haber recargado</div></div>
                      <button className={`adm-toggle${walletCfg?.biddingRequiresBalance ? " on" : ""}`} disabled={ocupado === "wcfg"} onClick={toggleSaldo} aria-label="Ofertar exige saldo"><span/></button>
                    </div>
                    <div className="r"><div className="l">Cuentas de cobro<div className="s">Lo que ve quien recarga</div></div><span className={`lv-badge ${cuentasListas ? "adm-ok" : "adm-al"}`}>{cuentasListas ? "Listas" : "Sin cargar"}</span></div>
                    <div className="r"><div className="l">Términos y privacidad<div className="s">Públicos en la app</div></div><a className="lv-badge adm-ok" href="/terminos" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver</a></div>
                    <div className="r"><div className="l">Preguntas frecuentes<div className="s">Lo que lee la gente cuando duda</div></div><a className="lv-badge adm-ok" href="/support" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Ver</a></div>
                  </div>
                </div>

                <div className="adm-panel">
                  <div className="adm-panel__h"><span className="t">Catálogo de muestra</span><span className="lv-badge lv-badge--soft">{activas.filter(a => a.isDemo).length} activas</span></div>
                  <div className="adm-panel__b">
                    <p className="adm-row__meta" style={{ whiteSpace: "normal", marginBottom: 14, lineHeight: 1.55 }}>
                      Publicaciones de vendedores ficticios para que la app no se vea vacía. <b>Antes de abrir a gente real, bórralas</b>: si no, tus vendedores de verdad quedan mezclados con las inventadas.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="lv-btn lv-btn--outline lv-btn--sm" style={{ flex: 1 }} disabled={ocupado === "demo_seed"} onClick={() => demo("seed")}>{ocupado === "demo_seed" ? "…" : "Sembrar muestras"}</button>
                      <button className="lv-btn lv-btn--danger lv-btn--sm" style={{ flex: 1 }} disabled={ocupado === "demo_purge"} onClick={() => demo("purge")}>{ocupado === "demo_purge" ? "…" : "Borrar muestras"}</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
