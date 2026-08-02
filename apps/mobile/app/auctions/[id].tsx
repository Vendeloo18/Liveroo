import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../src/lib/firebase";
import { useAuthStore } from "../../src/store/authStore";
import { useCountdown } from "../../src/hooks/useCountdown";
import { color, space, radius, text as T, font, APP_MAX_WIDTH } from "../../src/theme";
import { Boton, Panel, Insignia, Aviso, Avatar, Fila, Cargando } from "../../src/components/ui";
import { BRAND, MOTIVO_RECHAZO } from "@subastas-ve/shared";

type Estado = "idle" | "pending" | "ok" | "err";

export default function DetalleSubasta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuthStore();

  const [subasta, setSubasta] = useState<any>(null);
  const [pujas, setPujas] = useState<any[]>([]);
  const [monto, setMonto] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);

  const { texto: cuenta, urgente, vencida } = useCountdown(subasta?.endsAt);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, "auctions", id), s => {
      if (!s.exists()) return;
      const a = { id: s.id, ...s.data() } as any;
      setSubasta(a);
      setMonto(prev => prev || (a.currentBidUsd + a.minIncrementUsd).toFixed(2));
    }, e => setError(`No se pudo cargar (${e.code})`));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "auctions", id, "bids"), orderBy("placedAt", "desc"), limit(20));
    return onSnapshot(q, s => setPujas(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => undefined);
  }, [id]);

  // Cloud Scheduler no baja de un minuto: cuando a quien mira se le acaba
  // el reloj, le avisa al servidor, que revalida por su cuenta.
  const cierrePedido = useRef(false);
  useEffect(() => {
    if (!subasta?.endsAt || subasta.status !== "active" || cierrePedido.current) return;
    const fin = subasta.endsAt?.toMillis?.() ?? new Date(subasta.endsAt).getTime();
    if (Date.now() < fin) return;
    cierrePedido.current = true;
    httpsCallable(functions, "closeAuctionNow")({ auctionId: id })
      .catch(e => console.warn("closeAuctionNow:", e?.message));
  }, [subasta?.status, subasta?.endsAt, vencida, id]);

  // El cliente no escribe el precio: deja la solicitud y el motor decide
  const pujar = async () => {
    if (!subasta) return;
    if (!profile) { router.push("/login"); return; }

    const valor = parseFloat(monto);
    const minimo = subasta.currentBidUsd + subasta.minIncrementUsd;
    if (!isFinite(valor) || valor < minimo) {
      setError(`La próxima oferta debe ser de al menos $${minimo.toFixed(2)}`);
      setEstado("err");
      setTimeout(() => setEstado("idle"), 3000);
      return;
    }

    setEstado("pending");
    setError(null);
    try {
      const ref = await addDoc(collection(db, "pendingBids"), {
        auctionId: id, bidderId: profile.uid, amountUsd: valor,
        status: "pending", submittedAt: serverTimestamp(),
      });
      const unsub = onSnapshot(doc(db, "pendingBids", ref.id), s => {
        const d = s.data();
        if (!d || d.status === "pending") return;
        unsub();
        if (d.status === "processed") setEstado("ok");
        else { setError(MOTIVO_RECHAZO[d.rejectedReason] ?? "Oferta rechazada"); setEstado("err"); }
        setTimeout(() => setEstado("idle"), 3500);
      });
      setTimeout(() => { unsub(); setEstado(p => p === "pending" ? "idle" : p); }, 15000);
    } catch {
      setError("No se pudo enviar la oferta");
      setEstado("err");
      setTimeout(() => setEstado("idle"), 3000);
    }
  };

  if (!subasta) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
        {error ? <Aviso tono="bad">{error}</Aviso> : <Cargando/>}
      </View>
    );
  }

  const foto = subasta.imageURL ?? subasta.imageURLs?.[0];
  const activa = subasta.status === "active" && !vencida;
  const voyGanando = !!profile && subasta.currentBidderId === profile.uid;
  const esMia = !!profile && subasta.sellerId === profile.uid;
  const minimo = subasta.currentBidUsd + subasta.minIncrementUsd;
  const contenido = Math.min(width, APP_MAX_WIDTH);
  const mostrarBarra = activa && !esMia;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: mostrarBarra ? 200 : 40, alignItems: "center" }}>
        <View style={{ width: contenido }}>

          <View style={{ width: "100%", aspectRatio: 1, backgroundColor: color.surface2 }}>
            {foto ? <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} contentFit="cover"/> : null}

            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Atrás"
              style={{
                position: "absolute", top: insets.top + 10, left: 12,
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: "rgba(255,255,255,0.92)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: font.bold, color: color.ink }}>‹</Text>
            </Pressable>

            <View style={{ position: "absolute", bottom: 12, left: 12, flexDirection: "row", gap: 8 }}>
              <Insignia tono={urgente && activa ? "live" : "flotante"}>
                {activa ? `⏱ ${cuenta}` : "Finalizada"}
              </Insignia>
              {(subasta.bidsCount ?? 0) > 0 && (
                <Insignia tono="flotante">{subasta.bidsCount} ofertas</Insignia>
              )}
            </View>
          </View>

          <View style={{ padding: space.lg, gap: space.lg }}>
            <Text style={{ fontSize: 21, fontWeight: font.extrabold, letterSpacing: -0.7, lineHeight: 27, color: color.ink }}>
              {subasta.title}
            </Text>

            {subasta.description ? (
              <Text style={{ ...T.muted, lineHeight: 21 }}>{subasta.description}</Text>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar nombre={subasta.sellerName}/>
              <View>
                <Text style={{ fontSize: 14, fontWeight: font.bold, color: color.ink }}>{subasta.sellerName}</Text>
                <Text style={T.dim}>Vendedor</Text>
              </View>
            </View>

            <Panel>
              <Text style={T.eyebrow}>{(subasta.bidsCount ?? 0) > 0 ? "Precio actual" : "Precio inicial"}</Text>
              <Text style={{ ...T.priceXl, marginVertical: 3 }}>${subasta.currentBidUsd.toFixed(2)}</Text>
              <Text style={T.dim}>
                Salió en ${subasta.startingPriceUsd?.toFixed(2)} · sube de ${subasta.minIncrementUsd?.toFixed(2)} en ${subasta.minIncrementUsd?.toFixed(2)}
              </Text>
              {subasta.currentBidderName ? (
                <Fila ultima>
                  <Text style={T.muted}>Va ganando</Text>
                  <Text style={{ fontWeight: font.bold, color: color.ink }}>
                    {voyGanando ? "Tú" : subasta.currentBidderName}
                  </Text>
                </Fila>
              ) : null}
            </Panel>

            {!activa && (
              <Aviso tono={subasta.status === "sold" ? "ok" : "neutral"}>
                {subasta.status === "sold"
                  ? `🏆 Ganó ${subasta.winnerName} por $${subasta.finalPriceUsd?.toFixed(2)}`
                  : subasta.status === "unsold" ? "Cerró sin ganador."
                  : "El tiempo terminó. Estamos cerrando la venta…"}
              </Aviso>
            )}

            {voyGanando && activa && <Aviso tono="ok">Vas ganando. Te avisamos si alguien te supera.</Aviso>}
            {esMia && <Aviso>Esta venta es tuya, no puedes hacer una oferta.</Aviso>}

            <Aviso>
              Si ganas, coordinas el pago y la entrega directamente con el vendedor por WhatsApp.
              {BRAND.name} registra la orden con el monto congelado en bolívares.
            </Aviso>

            {pujas.length > 0 && (
              <Panel>
                <Text style={{ ...T.eyebrow, marginBottom: 4 }}>Historial de ofertas · {pujas.length}</Text>
                {pujas.map((b, i) => (
                  <Fila key={b.id} ultima={i === pujas.length - 1}>
                    <Text style={{ fontSize: 14, fontWeight: i === 0 ? font.bold : font.regular, color: color.ink }}>
                      {b.bidderName ?? "Anónimo"}
                    </Text>
                    <Text style={{ fontWeight: font.bold, color: color.ink }}>${b.amountUsd?.toFixed(2)}</Text>
                  </Fila>
                ))}
              </Panel>
            )}
          </View>
        </View>
      </ScrollView>

      {mostrarBarra && (
        <View style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          backgroundColor: color.bg, borderTopWidth: 1, borderTopColor: color.line,
          padding: space.lg, paddingBottom: insets.bottom + 14,
          alignItems: "center",
        }}>
          <View style={{ width: contenido - space.lg * 2, gap: 10 }}>
            {estado === "ok" && <Aviso tono="ok">¡SUBELOO! Oferta registrada</Aviso>}
            {estado === "err" && error ? <Aviso tono="bad">{error}</Aviso> : null}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={T.eyebrow}>Mínimo ${minimo.toFixed(2)}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[1, 5, 10, 25].map(inc => (
                  <Pressable
                    key={inc}
                    onPress={() => setMonto((Math.max(minimo, parseFloat(monto) || 0) + inc).toFixed(2))}
                    style={{ backgroundColor: color.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: font.semibold, color: color.ink2 }}>+${inc}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={monto}
                onChangeText={setMonto}
                keyboardType="decimal-pad"
                accessibilityLabel="Monto de tu oferta"
                style={{
                  flex: 1, backgroundColor: color.surface2, borderRadius: radius.btn,
                  paddingHorizontal: 14, height: 52, fontSize: 18,
                  fontWeight: font.extrabold, color: color.ink,
                }}
              />
              <Boton
                block={false}
                tamano="lg"
                disabled={estado === "pending" || voyGanando}
                cargando={estado === "pending"}
                onPress={pujar}
                style={{ minWidth: 132 }}
              >
                {voyGanando ? "Vas ganando" : "SUBELOO"}
              </Boton>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
