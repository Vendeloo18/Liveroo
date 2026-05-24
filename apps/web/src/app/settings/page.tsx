"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "../../store/authStore";

export default function SettingsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState({ shows:true, pujas:true, ordenes:true, promo:false });
  const [currency, setCurrency] = useState("usd");
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const Toggle = ({ value, onChange }: { value:boolean; onChange:()=>void }) => (
    <div onClick={onChange} style={{ width:44, height:24, borderRadius:12, background:value?"linear-gradient(135deg,#a855f7,#e040fb)":"rgba(255,255,255,0.1)", position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0, border:`1px solid ${value?"rgba(168,85,247,0.4)":"rgba(255,255,255,0.08)"}` }}>
      <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left:value?22:2, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}/>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#080818", backgroundImage:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 60%)", fontFamily:"'Inter',-apple-system,sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:90 }}>
      <div style={{ padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <button onClick={() => router.push("/account")} style={{ width:38, height:38, background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.12)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 style={{ fontSize:"1.4rem", fontWeight:900, color:"#fff", letterSpacing:"-0.03em" }}>Configuración</h1>
        </div>

        {/* Notifications */}
        <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Notificaciones</div>
        <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, marginBottom:20, overflow:"hidden" }}>
          {[
            { key:"shows", label:"Shows por empezar", sub:"5 minutos antes de que inicie" },
            { key:"pujas", label:"Te superaron en una puja", sub:"Cuando alguien puja más que tú" },
            { key:"ordenes", label:"Actualizaciones de órdenes", sub:"Confirmaciones y entregas" },
            { key:"promo", label:"Promociones y novedades", sub:"Ofertas y nuevos vendedores" },
          ].map((item, i) => (
            <div key={item.key} style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:14, borderBottom: i<3 ? "1px solid rgba(168,85,247,0.06)" : "none" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"0.85rem", fontWeight:700, color:"#fff", marginBottom:2 }}>{item.label}</div>
                <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.35)" }}>{item.sub}</div>
              </div>
              <Toggle value={(notifications as any)[item.key]} onChange={() => setNotifications(prev => ({ ...prev, [item.key]:!(prev as any)[item.key] }))}/>
            </div>
          ))}
        </div>

        {/* Currency */}
        <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Moneda preferida</div>
        <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, marginBottom:20, overflow:"hidden" }}>
          {[
            { id:"usd", label:"USD — Dólar americano", sub:"Precios mostrados en dólares" },
            { id:"bs", label:"Bs — Bolívares", sub:"Precios mostrados en bolívares" },
            { id:"both", label:"Ambas monedas", sub:"Muestra USD y Bs simultáneamente" },
          ].map((opt, i) => (
            <div key={opt.id} onClick={() => setCurrency(opt.id)} style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:14, borderBottom: i<2 ? "1px solid rgba(168,85,247,0.06)" : "none", cursor:"pointer" }}>
              <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${currency===opt.id?"#a855f7":"rgba(255,255,255,0.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {currency===opt.id && <div style={{ width:8, height:8, borderRadius:"50%", background:"#a855f7" }}/>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"0.85rem", fontWeight:700, color:"#fff", marginBottom:2 }}>{opt.label}</div>
                <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.35)" }}>{opt.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Account info */}
        <div style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Cuenta</div>
        <div style={{ background:"rgba(13,13,32,0.9)", border:"1px solid rgba(168,85,247,0.1)", borderRadius:16, marginBottom:20, overflow:"hidden" }}>
          {[
            { label:"Correo electrónico", val: profile?.email ?? "—" },
            { label:"Nombre", val: profile?.displayName ?? "—" },
            { label:"Rol", val: profile?.role ?? "buyer" },
          ].map((row, i) => (
            <div key={row.label} style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom: i<2 ? "1px solid rgba(168,85,247,0.06)" : "none" }}>
              <span style={{ fontSize:"0.82rem", color:"rgba(255,255,255,0.4)" }}>{row.label}</span>
              <span style={{ fontSize:"0.82rem", fontWeight:600, color:"#fff" }}>{row.val}</span>
            </div>
          ))}
        </div>

        {/* Save */}
        <button onClick={save} style={{ width:"100%", background: saved ? "rgba(74,222,128,0.1)" : "linear-gradient(135deg,#00c8ff,#a855f7,#e040fb)", border: saved ? "1px solid rgba(74,222,128,0.3)" : "none", borderRadius:14, padding:"14px", fontSize:"0.92rem", fontWeight:800, color: saved ? "#4ade80" : "#fff", cursor:"pointer", fontFamily:"inherit", boxShadow: saved ? "none" : "0 0 24px rgba(168,85,247,0.25)" }}>
          {saved ? "Guardado" : "Guardar cambios"}
        </button>
      </div>
      
    </div>
  );
}
