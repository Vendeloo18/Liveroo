import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { color, space, text as T, APP_MAX_WIDTH } from "../../src/theme";
import { AuctionCard, DatosSubasta } from "../../src/components/AuctionCard";
import { Cargando, Vacio, Boton } from "../../src/components/ui";
import { Logo } from "../../src/components/Logo";

const CATEGORIAS = ["Para Ti", "Moda y Ropa", "Electronica", "Calzado", "Joyas y Relojes", "Hogar", "Deportes"];

export default function Inicio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [subastas, setSubastas] = useState<DatosSubasta[]>([]);
  const [cat, setCat] = useState("Para Ti");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"));
    return onSnapshot(q,
      s => { setSubastas(s.docs.map(d => ({ id: d.id, ...d.data() } as DatosSubasta))); setCargando(false); },
      e => { setError(`No se pudieron cargar las subastas (${e.code})`); setCargando(false); });
  }, []);

  const visibles = useMemo(() => {
    const ms = (v: any) => v?.toMillis?.() ?? new Date(v ?? 0).getTime();
    return subastas
      .filter(a => cat === "Para Ti" || a.category === cat)
      .sort((a, b) => ms(a.endsAt) - ms(b.endsAt));
  }, [subastas, cat]);

  // Dos columnas dentro del ancho máximo, con 16 de margen y 12 entre ellas
  const contenido = Math.min(width, APP_MAX_WIDTH);
  const anchoTarjeta = (contenido - space.lg * 2 - space.md) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{
        paddingTop: insets.top + 10, paddingHorizontal: space.lg, paddingBottom: 12,
        flexDirection: "row", alignItems: "center", gap: 10,
        borderBottomWidth: 1, borderBottomColor: color.line,
      }}>
        <Logo tamano={26}/>
        <View style={{ flex: 1 }}/>
        <Pressable
          onPress={() => router.push("/explorar")}
          accessibilityLabel="Buscar"
          style={({ pressed }) => ({
            width: 38, height: 38, borderRadius: 19, backgroundColor: color.surface2,
            alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 16 }}>🔍</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, alignItems: "center" }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={color.ink3}/>}
      >
        <View style={{ width: contenido }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: 12, gap: 8 }}
          >
            {CATEGORIAS.map(c => (
              <Pressable
                key={c}
                onPress={() => setCat(c)}
                style={{
                  backgroundColor: cat === c ? color.accent : color.surface2,
                  borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9,
                }}
              >
                <Text style={{ color: cat === c ? color.accentInk : color.ink2, fontSize: 13, fontWeight: cat === c ? "700" : "500" }}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 12,
          }}>
            <Text style={T.section}>Subastas activas</Text>
            <Pressable onPress={() => router.push("/explorar")}>
              <Text style={{ ...T.muted, fontWeight: "700" }}>Ver todas →</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <Vacio titulo="No se pudo cargar" texto={error}/>
            </View>
          ) : cargando ? (
            <Cargando/>
          ) : visibles.length === 0 ? (
            <Vacio
              titulo={cat === "Para Ti" ? "Todavía no hay subastas activas" : `Nada en ${cat}`}
              texto="Vuelve pronto o publica la tuya."
            >
              <View style={{ paddingHorizontal: space.lg }}>
                <Boton variante="soft" onPress={() => setCat("Para Ti")}>Ver todas las categorías</Boton>
              </View>
            </Vacio>
          ) : (
            <View style={{
              flexDirection: "row", flexWrap: "wrap", gap: space.md,
              paddingHorizontal: space.lg,
            }}>
              {visibles.map(a => <AuctionCard key={a.id} subasta={a} ancho={anchoTarjeta}/>)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
