"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  doc, collection, onSnapshot, query, where, orderBy, limit, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { Copiable } from "../../components/ui/Copiable";
import { formatUsd } from "@subastas-ve/shared";

// =============================================================
// Billetera
// =============================================================
// El saldo respalda las pujas y paga solo al ganar. El flujo de plata:
//
//   1. El usuario envía dinero a una cuenta de la plataforma (las que el
//      admin configuró en config/paymentAccounts — nada inventado: si no
//      hay cuentas, aquí se dice y no se puede "recargar" a la nada).
//   2. Declara el envío creando una solicitud en /deposits.
//   3. El admin la aprueba y el saldo se acredita en la misma transacción.
//
// El cliente jamás escribe /wallets ni /walletTransactions: el ledger es
// del motor. Esta pantalla solo mira y solicita.
// =============================================================

interface CuentaPagoMovil { banco?: string; telefono?: string; cedula?: string }
interface CuentaZelle { correo?: string; titular?: string }
interface CuentasCobro { pagoMovil?: CuentaPagoMovil; zelle?: CuentaZelle; binance?: string; nota?: string }

const METODO_NOMBRE: Record<string, string> = {
  pago_movil: "Pago móvil", zelle: "Zelle", binance: "Binance", efectivo: "Efectivo",
};

const TIPO_MOVIMIENTO: Record<string, string> = {
  deposit: "Recarga aprobada",
  welcome_bonus: "Bono de bienvenida",
  admin_credit: "Crédito del equipo",
  admin_debit: "Ajuste del equipo",
  auction_payment: "Pago de venta",
  refund: "Reembolso",
};

export default function WalletPage() {
  const { profile } = useAuthStore();
  const router = useRouter();

  const [saldo, setSaldo] = useState<{ total: number; retenido: number } | null>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cuentas, setCuentas] = useState<CuentasCobro | null>(null);
  const [tasa, setTasa] = useState<number | null>(null);

  const [recargando, setRecargando] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<string>("");
  const [referencia, setReferencia] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    const u1 = onSnapshot(doc(db, "wallets", profile.uid),
      s => {
        const d = s.data() as any;
        setSaldo({ total: d?.balanceUsd ?? 0, retenido: d?.heldUsd ?? 0 });
      }, () => setSaldo({ total: 0, retenido: 0 }));
    const u2 = onSnapshot(
      query(collection(db, "walletTransactions"), where("userId", "==", profile.uid), orderBy("createdAt", "desc"), limit(25)),
      s => setMovimientos(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
    const u3 = onSnapshot(
      query(collection(db, "deposits"), where("userId", "==", profile.uid), orderBy("createdAt", "desc"), limit(10)),
      s => setSolicitudes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
    const u4 = onSnapshot(doc(db, "config", "paymentAccounts"),
      s => setCuentas(s.exists() ? (s.data() as CuentasCobro) : null), () => setCuentas(null));
    const u5 = onSnapshot(doc(db, "exchangeRates", "current"),
      s => setTasa((s.data() as any)?.usdToBs ?? null), () => undefined);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [profile]);

  // Solo se ofrecen los métodos cuya cuenta el admin configuró de verdad
  const metodosDisponibles = useMemo(() => {
    const m: string[] = [];
    if (cuentas?.pagoMovil?.telefono) m.push("pago_movil");
    if (cuentas?.zelle?.correo) m.push("zelle");
    if (cuentas?.binance) m.push("binance");
    return m;
  }, [cuentas]);

  useEffect(() => {
    if (metodosDisponibles.length && !metodosDisponibles.includes(metodo)) {
      setMetodo(metodosDisponibles[0]);
    }
  }, [metodosDisponibles, metodo]);

  const enviarSolicitud = async () => {
    if (!profile) return;
    const v = parseFloat(monto);
    if (!isFinite(v) || v <= 0) { setAviso({ tipo: "bad", texto: "Pon el monto que enviaste, en dólares" }); return; }
    if (referencia.trim().length < 4) { setAviso({ tipo: "bad", texto: "La referencia del pago es obligatoria (mínimo 4 caracteres)" }); return; }
    setOcupado(true);
    setAviso(null);
    try {
      await addDoc(collection(db, "deposits"), {
        userId: profile.uid,
        userName: profile.displayName ?? profile.email ?? "",
        amountUsd: Math.round(v * 100) / 100,
        method: metodo,
        reference: referencia.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setAviso({ tipo: "ok", texto: "Solicitud enviada. Te acreditamos el saldo al verificar el pago." });
      setMonto(""); setReferencia(""); setRecargando(false);
    } catch (e: any) {
      setAviso({ tipo: "bad", texto: e?.message ?? "No se pudo enviar la solicitud" });
    } finally {
      setOcupado(false);
      setTimeout(() => setAviso(null), 6000);
    }
  };

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
      <div className="lv-app lv-app--aurora">
        <Cabecera/>
        <div className="lv-empty">
          <div className="lv-empty__title">Entra para ver tu billetera</div>
          <button className="lv-btn lv-btn--primary" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Entrar</button>
        </div>
      </div>
    );
  }

  const ESTADO_SOLICITUD: Record<string, { texto: string; clase: string }> = {
    pending: { texto: "En revisión", clase: "lv-badge--soft" },
    approved: { texto: "Acreditada", clase: "lv-badge--accent" },
    rejected: { texto: "Rechazada", clase: "lv-badge--live" },
  };

  return (
    <div className="lv-app lv-app--aurora">
      <Cabecera/>
      <div className="lv-pad" style={{ paddingTop: 16, display: "grid", gap: 14 }}>
        {aviso && <div className={`lv-note lv-note--${aviso.tipo}`}>{aviso.texto}</div>}

        {/* Saldo */}
        <section className="lv-panel" style={{ textAlign: "center", padding: "22px 16px" }}>
          <div className="lv-eyebrow">Disponible para PUJALOO</div>
          <div className="lv-price lv-price--xl" style={{ fontSize: "2.1rem", marginTop: 4 }}>
            {saldo === null ? "…" : formatUsd(Math.max(0, saldo.total - saldo.retenido))}
          </div>
          {saldo !== null && saldo.retenido > 0 && (
            <div className="lv-dim" style={{ fontSize: "0.78rem", marginTop: 4 }}>
              Saldo total {formatUsd(saldo.total)} · <strong>{formatUsd(saldo.retenido)} respaldando tus ofertas líderes</strong>
            </div>
          )}
          {tasa && saldo !== null && saldo.total - saldo.retenido > 0 && (
            <div className="lv-dim" style={{ fontSize: "0.76rem", marginTop: 3 }}>
              ≈ Bs {((saldo.total - saldo.retenido) * tasa).toLocaleString("es-VE", { maximumFractionDigits: 2 })} a la tasa de hoy
            </div>
          )}
          <p className="lv-dim" style={{ fontSize: "0.76rem", lineHeight: 1.5, marginTop: 10 }}>
            Mientras tu oferta va ganando, ese monto queda apartado.
            Si te superan, se libera al instante; si ganas, paga tu orden solo.
          </p>
          <button
            className="lv-btn lv-btn--accent lv-btn--block lv-btn--lg"
            style={{ marginTop: 12 }}
            onClick={() => setRecargando(r => !r)}
          >
            {recargando ? "Cerrar" : "Recargar saldo"}
          </button>
        </section>

        {/* Recarga */}
        {recargando && (
          metodosDisponibles.length === 0 ? (
            <section className="lv-panel">
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 4 }}>Recargas aún no disponibles</div>
              <p className="lv-dim" style={{ fontSize: "0.79rem", lineHeight: 1.55 }}>
                Las cuentas para recibir pagos todavía no están configuradas.
                Escríbenos por soporte y lo resolvemos.
              </p>
              <button className="lv-btn lv-btn--soft lv-btn--block" style={{ marginTop: 12 }} onClick={() => router.push("/support")}>
                Contactar soporte
              </button>
            </section>
          ) : (
            <>
              <section className="lv-panel">
                <div className="lv-eyebrow" style={{ marginBottom: 8 }}>1 · Envía tu pago a</div>
                {cuentas?.pagoMovil?.telefono && (
                  <div className="lv-panel lv-panel--flat" style={{ padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 8 }}>Pago móvil</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {cuentas.pagoMovil.banco && <Copiable etiqueta="Banco" valor={cuentas.pagoMovil.banco}/>}
                      <Copiable etiqueta="Teléfono" valor={cuentas.pagoMovil.telefono} destacado/>
                      {cuentas.pagoMovil.cedula && <Copiable etiqueta="Cédula / RIF" valor={cuentas.pagoMovil.cedula}/>}
                    </div>
                  </div>
                )}
                {cuentas?.zelle?.correo && (
                  <div className="lv-panel lv-panel--flat" style={{ padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 8 }}>Zelle</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <Copiable etiqueta="Correo" valor={cuentas.zelle.correo} destacado/>
                      {cuentas.zelle.titular && <Copiable etiqueta="Titular" valor={cuentas.zelle.titular}/>}
                    </div>
                  </div>
                )}
                {cuentas?.binance && (
                  <div className="lv-panel lv-panel--flat" style={{ padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 8 }}>Binance Pay</div>
                    <Copiable etiqueta="Binance Pay" valor={String(cuentas.binance)} destacado/>
                  </div>
                )}
                {cuentas?.nota && <p className="lv-dim" style={{ fontSize: "0.74rem", lineHeight: 1.5 }}>{cuentas.nota}</p>}
              </section>

              <section className="lv-panel">
                <div className="lv-eyebrow" style={{ marginBottom: 8 }}>2 · Declara tu envío</div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="w-monto">Monto enviado (USD)</label>
                  <input id="w-monto" className="lv-input" type="number" inputMode="decimal" min="1" step="0.01"
                    value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 20"/>
                  {tasa && isFinite(parseFloat(monto)) && parseFloat(monto) > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {/* Lo que se escribe en la app del banco es esto, no los
                          dólares: por eso va copiable y no como texto de ayuda. */}
                      <Copiable
                        etiqueta="Envía exactamente"
                        valor={(parseFloat(monto) * tasa).toFixed(2)}
                        destacado
                      />
                      <div className="lv-field__hint" style={{ marginTop: 4 }}>
                        Bolívares, a la tasa de hoy (Bs {tasa} por dólar).
                      </div>
                    </div>
                  )}
                </div>

                <div className="lv-field">
                  <span className="lv-field__label">Método</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {metodosDisponibles.map(m => (
                      <button key={m} onClick={() => setMetodo(m)}
                        className={`lv-chip${metodo === m ? " lv-chip--active" : ""}`} style={{ flex: 1 }}>
                        {METODO_NOMBRE[m]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lv-field">
                  <label className="lv-field__label" htmlFor="w-ref">Referencia del pago</label>
                  <input id="w-ref" className="lv-input" value={referencia} onChange={e => setReferencia(e.target.value)}
                    placeholder="Los últimos dígitos de la operación" maxLength={60}/>
                  <div className="lv-field__hint">Con esto verificamos tu pago. Sin referencia no podemos acreditar.</div>
                </div>

                <button className="lv-btn lv-btn--primary lv-btn--block" disabled={ocupado} onClick={enviarSolicitud}>
                  {ocupado ? "Enviando…" : "Enviar solicitud"}
                </button>
                <p className="lv-dim" style={{ fontSize: "0.72rem", lineHeight: 1.5, marginTop: 10 }}>
                  <strong>Importante:</strong> las recargas no son reembolsables. El saldo
                  se usa para respaldar ofertas y pagar dentro de Vendeloo.
                </p>
              </section>
            </>
          )
        )}

        {/* Solicitudes */}
        {solicitudes.length > 0 && (
          <section className="lv-panel" style={{ padding: "2px 16px" }}>
            <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Mis recargas</div>
            {solicitudes.map(s => {
              const e = ESTADO_SOLICITUD[s.status] ?? { texto: s.status, clase: "lv-badge--soft" };
              return (
                <div key={s.id} className="lv-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{formatUsd(s.amountUsd)} · {METODO_NOMBRE[s.method] ?? s.method}</div>
                    <div className="lv-dim" style={{ fontSize: "0.72rem" }}>
                      Ref {s.reference}{s.status === "rejected" && s.rejectReason ? ` · ${s.rejectReason}` : ""}
                    </div>
                  </div>
                  <span className={`lv-badge ${e.clase}`} style={{ flexShrink: 0 }}>{e.texto}</span>
                </div>
              );
            })}
          </section>
        )}

        {/* Movimientos */}
        <section className="lv-panel" style={{ padding: "2px 16px" }}>
          <div className="lv-eyebrow" style={{ padding: "14px 0 4px" }}>Movimientos</div>
          {movimientos.length === 0
            ? <p className="lv-dim" style={{ fontSize: "0.8rem", padding: "6px 0 14px" }}>Todavía no hay movimientos.</p>
            : movimientos.map(m => (
                <div key={m.id} className="lv-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{TIPO_MOVIMIENTO[m.type] ?? m.type}</div>
                    <div className="lv-dim" style={{ fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.note ?? m.reference ?? ""}{m.createdAt?.toDate ? ` · ${m.createdAt.toDate().toLocaleDateString("es-VE")}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color: m.amountUsd >= 0 ? "var(--accent-strong)" : "var(--ink)" }}>
                      {m.amountUsd >= 0 ? "+" : ""}{formatUsd(m.amountUsd)}
                    </div>
                    <div className="lv-dim" style={{ fontSize: "0.7rem" }}>saldo {formatUsd(m.balanceAfterUsd ?? 0)}</div>
                  </div>
                </div>
              ))}
        </section>

        <p className="lv-dim" style={{ fontSize: "0.72rem", lineHeight: 1.55, textAlign: "center", padding: "0 8px 10px" }}>
          Las recargas se acreditan cuando el equipo verifica el pago y no son
          reembolsables. Si quedas primero en una venta, tu oferta es un compromiso de compra.
          ¿Algo no cuadra? Escríbenos por soporte con tu referencia.
        </p>
      </div>
    </div>
  );
}
