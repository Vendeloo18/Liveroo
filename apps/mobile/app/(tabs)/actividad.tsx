import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  collection, collectionGroup, query, where, orderBy, limit, onSnapshot, documentId, getDocs,
} from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { useAuthStore } from "../../src/store/authStore";
import { useCountdown } from "../../src/hooks/useCountdown";
import { color, space, radius, text as T, font, APP_MAX_WIDTH } from "../../src/theme";
import { Panel, Fila, Insignia, Vacio, Boton, Cargando } from "../../src/components/ui";

const ESTADO_ORDEN: Record<string, string> = {
  pending_payment: "Pago pendiente",
  payment_confirmed: "Pago confirmado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelada",
};

function FilaPuja({ s, monto, uid, ultima }: { s: any; monto: number; uid: string; ultima: boolean }) {
  const { texto, vencida } = useCountdown(s.endsAt);
  const activa = s.status === "active" && !vencida;
  const ganando = s.currentBidderId === uid;
  const gane = s.status === "sold" && s.winnerId === uid;

  const estado = activa
    ? (ganando ? { t: "Vas ganando", tono: "accent" as const } : { t: "Te superaron", tono: "live" as const })
    : gane ? { t: "Ganaste", tono: "accent" as const }
    : s.status === "sold" ? { t: "No ganaste", tono: "soft" as const }
    : { t: "Cerrada sin venta", tono: "soft" as const };

  const foto = s.imageURL ?? s.imageURLs?.[0];

  return (
    <Fila ultima={ultima}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.sm, overflow: "hidden", backgroundColor: color.surface2 }}>
          {foto ? <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} contentFit="cover"/> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: font.bold, color: color.ink }}>
            {s.title ?? "Venta"}
          </Text>
          <Text style={{ ...T.dim, marginTop: 2 }}>
            Ofertaste ${monto.toFixed(2)} · ahora ${(s.currentBidUsd ?? 0).toFixed(2)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
            <Insignia tono={estado.tono}>{estado.t}</Insignia>
            {activa ? <Text style={T.dim}>{texto}</Text> : null}
          </View>
        </View>
      </View>
    </Fila>
  );
}

export default function Actividad() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuthStore();

  const [tab, setTab] = useState<"pujas" | "compras">("pujas");
  const [misPujas, setMisPujas] = useState<{ auctionId: string; monto: number; cuando: any }[]>([]);
  const [subastas, setSubastas] = useState<Record<string, any>>({});
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  // El historial real vive en /auctions/*/bids, que solo escribe el motor
  useEffect(() => {
    if (!profile) { setCargando(false); return; }
    const q = query(collectionGroup(db, "bids"), where("bidderId", "==", profile.uid), orderBy("placedAt", "desc"), limit(60));
    return onSnapshot(q, s => {
      const porSubasta = new Map<string, { auctionId: string; monto: number; cuando: any }>();
      s.docs.forEach(d => {
        const b = d.data();
        if (!b.auctionId || porSubasta.has(b.auctionId)) return;
        porSubasta.set(b.auctionId, { auctionId: b.auctionId, monto: b.amountUsd, cuando: b.placedAt });
      });
      setMisPujas(Array.from(porSubasta.values()));
      setCargando(false);
    }, () => setCargando(false));
  }, [profile]);

  useEffect(() => {
    const ids = misPujas.map(p => p.auctionId).filter(id => !subastas[id]);
    if (!ids.length) return;
    let cancelado = false;
    (async () => {
      const nuevas: Record<string, any> = {};
      for (let i = 0; i < ids.length; i += 10) {
        const snap = await getDocs(query(collection(db, "auctions"), where(documentId(), "in", ids.slice(i, i + 10))));
        snap.docs.forEach(d => { nuevas[d.id] = { id: d.id, ...d.data() }; });
      }
      if (!cancelado) setSubastas(prev => ({ ...prev, ...nuevas }));
    })().catch(() => undefined);
    return () => { cancelado = true; };
  }, [misPujas, subastas]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, "orders"), where("buyerId", "==", profile.uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, s => setOrdenes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
  }, [profile]);

  const ordenadas = useMemo(() => {
    const ms = (v: any) => v?.toMillis?.() ?? 0;
    return [...misPujas].sort((a, b) => ms(b.cuando) - ms(a.cuando));
  }, [misPujas]);

  const contenido = Math.min(width, APP_MAX_WIDTH);

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 10 }}>
        <Text style={{ ...T.title, paddingHorizontal: space.lg, paddingBottom: 12 }}>Actividad</Text>
        <Vacio titulo="Entra para ver tu actividad" texto="Ahí quedan tus ofertas y tus compras.">
          <View style={{ paddingHorizontal: space.lg }}>
            <Boton onPress={() => router.push("/login")}>Entrar</Boton>
          </View>
        </Vacio>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{
        paddingTop: insets.top + 10, paddingHorizontal: space.lg, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: color.line,
      }}>
        <Text style={T.title}>Actividad</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24, alignItems: "center" }}>
        <View style={{ width: contenido, paddingHorizontal: space.lg }}>
          <View style={{ flexDirection: "row", gap: 8, paddingVertical: 12 }}>
            {([["pujas", `Mis ofertas${ordenadas.length ? ` (${ordenadas.length})` : ""}`],
               ["compras", `Mis compras${ordenes.length ? ` (${ordenes.length})` : ""}`]] as const).map(([v, l]) => (
              <Boton key={v} block={false} tamano="sm"
                     variante={tab === v ? "primary" : "soft"}
                     onPress={() => setTab(v as any)}>{l}</Boton>
            ))}
          </View>

          {tab === "pujas" ? (
            cargando ? <Cargando/> :
            ordenadas.length === 0 ? (
              <Vacio titulo="Todavía no has usado SUBELOO" texto="Cuando hagas una oferta, aquí verás si va de primera.">
                <Boton onPress={() => router.push("/explorar")}>Ver ventas</Boton>
              </Vacio>
            ) : (
              <Panel style={{ paddingVertical: 2 }}>
                {ordenadas.map((p, i) => {
                  const s = subastas[p.auctionId];
                  if (!s) return null;
                  return <FilaPuja key={p.auctionId} s={s} monto={p.monto} uid={profile.uid} ultima={i === ordenadas.length - 1}/>;
                })}
              </Panel>
            )
          ) : (
            ordenes.length === 0 ? (
              <Vacio titulo="Aún no has ganado nada" texto="Cuando ganes una venta, tu orden aparece aquí."/>
            ) : (
              <Panel style={{ paddingVertical: 2 }}>
                {ordenes.map((o, i) => (
                  <Fila key={o.id} ultima={i === ordenes.length - 1}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: font.bold, color: color.ink }}>
                        {o.productTitle ?? "Producto"}
                      </Text>
                      <Text style={{ ...T.dim, marginTop: 2 }}>
                        ${o.bidAmountUsd?.toFixed(2)}{o.sellerName ? ` · ${o.sellerName}` : ""}
                      </Text>
                      <Insignia style={{ marginTop: 5 }}>{ESTADO_ORDEN[o.status] ?? o.status}</Insignia>
                    </View>
                  </Fila>
                ))}
              </Panel>
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}
