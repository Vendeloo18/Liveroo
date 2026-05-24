"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";

const DEPOSIT_METHODS = [
  { id: "zelle", label: "Zelle", detail: "zellepagos@liveroo.com" },
  { id: "pago_movil", label: "Pago Móvil", detail: "0414-0000000 · Banco Mercantil" },
  { id: "usdt_trc20", label: "USDT TRC-20", detail: "TXxx...xxxx" },
];

export default function WalletPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [wallet, setWallet] = useState({ balanceUsd:0, frozenUsd:0, totalDepositedUsd:0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [screen, setScreen] = useState<"main"|"deposit">("main");
  const [method, setMethod] = useState("zelle");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if(!profile) return;
    const u1 = onSnapshot(doc(db,"wallets",profile.uid), s => { if(s.exists()) setWallet(s.data() as any); });
    const q = query(collection(db,"walletTransactions"), orderBy("createdAt","desc"), limit(20));
    const u2 = onSnapshot(q, s => setTransactions(s.docs.filter(d => d.data().userId===profile.uid).map(d => ({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, [profile]);

  const handleDeposit = async () => {
    if(!profile||!amount||!reference) return;
    setLoading(true);
    try {
      await addDoc(collection(db,"deposits"), { userId:profile.uid, userName:profile.displayName, amountUsd:parseFloat(amount), method, reference, status:"pending", createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      setSuccess(true);
      setAmount(""); setReference("");
      setTimeout(() => { setSuccess(false); setScreen("main"); }, 3000);
    } catch(e) { alert("Error"); } finally { setLoading(false); }
  };

  const sel = DEPOSIT_METHODS.find(m => m.id===method)!;

  return (
    <div style={{minHeight:"100vh",background:"#080818",backgroundImage:"radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,200,255,0.05) 0%, transparent 60%)",fontFamily:"'Inter',-apple-system,sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:40}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"20px 20px 0"}}>
        <button onClick={() => screen==="deposit" ? setScreen("main") : router.push("/account")} style={{width:38,height:38,background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{fontSize:"1.4rem",fontWeight:900,color:"#fff",letterSpacing:"-0.03em"}}>{screen==="deposit" ? "Depositar" : "Mi Billetera"}</h1>
      </div>

      {screen==="main" && (
        <div style={{padding:"24px 20px 0"}}>
          <div style={{background:"linear-gradient(135deg,rgba(0,200,255,0.1),rgba(168,85,247,0.15))",border:"1px solid rgba(168,85,247,0.2)",borderRadius:24,padding:"28px 24px",marginBottom:16}}>
            <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.5)",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Saldo disponible</div>
            <div style={{fontSize:"2.8rem",fontWeight:900,color:"#fff",letterSpacing:"-0.04em",marginBottom:4}}>${wallet.balanceUsd.toFixed(2)}</div>
            <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.4)"}}>USD</div>
            {wallet.frozenUsd > 0 && (
              <div style={{marginTop:16,display:"flex",alignItems:"center",gap:8,background:"rgba(168,85,247,0.1)",borderRadius:10,padding:"8px 12px"}}>
                <span style={{fontSize:"0.75rem",color:"#a855f7",fontWeight:600}}>${wallet.frozenUsd.toFixed(2)} congelados en subastas</span>
              </div>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            {[{label:"Total depositado",val:`$${wallet.totalDepositedUsd.toFixed(2)}`},{label:"Congelado",val:`$${wallet.frozenUsd.toFixed(2)}`}].map(s => (
              <div key={s.label} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.1)",borderRadius:14,padding:"16px"}}>
                <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
                <div style={{fontSize:"1.2rem",fontWeight:800,color:"#fff"}}>{s.val}</div>
              </div>
            ))}
          </div>

          <button onClick={() => setScreen("deposit")} style={{width:"100%",background:"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:28,boxShadow:"0 0 30px rgba(168,85,247,0.3)"}}>
            Depositar fondos
          </button>

          <div style={{fontSize:"0.72rem",fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Movimientos</div>
          {transactions.length===0 ? (
            <div style={{textAlign:"center",padding:"40px 0",fontSize:"0.82rem",color:"rgba(255,255,255,0.2)"}}>Sin movimientos aún</div>
          ) : transactions.map(tx => (
            <div key={tx.id} style={{background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.08)",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:"0.82rem",fontWeight:600,color:"#fff",marginBottom:2}}>{tx.description}</div>
                <div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.3)"}}>{tx.createdAt?.toDate?.()?.toLocaleDateString("es-VE")??""}</div>
              </div>
              <div style={{fontSize:"0.92rem",fontWeight:800,color:tx.amountUsd>0?"#4ade80":"#a855f7"}}>
                {tx.amountUsd>0?"+":""}{tx.amountUsd.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {screen==="deposit" && (
        <div style={{padding:"24px 20px 0"}}>
          {success ? (
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{width:64,height:64,background:"rgba(0,200,100,0.1)",border:"1px solid rgba(0,200,100,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{fontSize:"1.2rem",fontWeight:800,color:"#fff",marginBottom:8}}>Solicitud enviada</div>
              <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>El admin verificará tu depósito<br/>y acreditará tu saldo en breve.</div>
            </div>
          ) : (
            <>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.5)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Monto (USD)</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:"1.2rem",fontWeight:700,color:"rgba(255,255,255,0.5)"}}>$</span>
                  <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" style={{width:"100%",background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:14,padding:"16px 16px 16px 36px",color:"#fff",fontSize:"1.4rem",fontWeight:800,fontFamily:"inherit",outline:"none"}}/>
                </div>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  {[20,50,100,200].map(v => (
                    <button key={v} onClick={()=>setAmount(String(v))} style={{flex:1,background:amount===String(v)?"rgba(168,85,247,0.2)":"rgba(13,13,32,0.9)",border:`1px solid ${amount===String(v)?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.1)"}`,borderRadius:10,padding:"8px 0",fontSize:"0.78rem",fontWeight:700,color:amount===String(v)?"#a855f7":"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit"}}>${v}</button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:20}}>
                <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.5)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Método de pago</div>
                {DEPOSIT_METHODS.map(m => (
                  <button key={m.id} onClick={()=>setMethod(m.id)} style={{width:"100%",background:method===m.id?"rgba(168,85,247,0.1)":"rgba(13,13,32,0.9)",border:`1px solid ${method===m.id?"rgba(168,85,247,0.3)":"rgba(168,85,247,0.08)"}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginBottom:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:method===m.id?"#a855f7":"rgba(255,255,255,0.2)",flexShrink:0,boxShadow:method===m.id?"0 0 8px #a855f7":"none"}}/>
                    <div>
                      <div style={{fontSize:"0.88rem",fontWeight:700,color:"#fff"}}>{m.label}</div>
                      <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)",marginTop:2}}>{m.detail}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{background:"rgba(0,200,255,0.05)",border:"1px solid rgba(0,200,255,0.1)",borderRadius:12,padding:"14px 16px",marginBottom:20}}>
                <div style={{fontSize:"0.75rem",fontWeight:700,color:"#00c8ff",marginBottom:6}}>Instrucciones</div>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.5)",lineHeight:1.7}}>
                  1. Envía <strong style={{color:"#fff"}}>${amount||"el monto"}</strong> por <strong style={{color:"#fff"}}>{sel.label}</strong><br/>
                  2. Destino: <strong style={{color:"#fff"}}>{sel.detail}</strong><br/>
                  3. Ingresa la referencia abajo<br/>
                  4. El admin confirma en menos de 24h
                </div>
              </div>

              <div style={{marginBottom:28}}>
                <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.5)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Número de referencia</div>
                <input type="text" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Ej: 123456789" style={{width:"100%",background:"rgba(13,13,32,0.9)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:"13px 16px",color:"#fff",fontSize:"0.9rem",fontFamily:"inherit",outline:"none"}}/>
              </div>

              <button onClick={handleDeposit} disabled={loading||!amount||!reference} style={{width:"100%",background:(!amount||!reference)?"rgba(168,85,247,0.2)":"linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)",border:"none",borderRadius:14,padding:"15px",fontSize:"0.92rem",fontWeight:800,color:"#fff",cursor:(!amount||!reference)?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:(!amount||!reference)?"none":"0 0 30px rgba(168,85,247,0.3)"}}>
                {loading ? "Enviando..." : "Enviar solicitud"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
