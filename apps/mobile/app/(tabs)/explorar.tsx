import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { color, space, radius, text as T, APP_MAX_WIDTH } from "../../src/theme";
import { AuctionCard, DatosSubasta } from "../../src/components/AuctionCard";
import { Cargando, Vacio, Boton } from "../../src/components/ui";

const CATEGORIAS = [
  "Todas", "Moda y Ropa", "Electronica", "Calzado", "Joyas y Relojes",
  "Hogar", "Colecciones", "Autos y Motos", "Deportes", "Arte", "Juguetes",
];

const ORDENES = [
  ["cierre", "Cierran pronto"],
  ["precio_asc", "Más baratas"],
  ["precio_desc", "Más caras"],
  ["pujas", "Más ofertadas"],
] as const;

type Orden = typeof ORDENES[number][0];

export default function Explorar() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [subastas, setSubastas] = useState<DatosSubasta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cat, setCat] = useState("Todas");
  const [orden, setOrden] = useState<Orden>("cierre");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const q = query(collection(db, "auctions"), where("status", "==", "active"));
    return onSnapshot(q,
      s => { setSubastas(s.docs.map(d => ({ id: d.id, ...d.data() } as DatosSubasta))); setCargando(false); },
      () => setCargando(false));
  }, []);

  const visibles = useMemo(() => {
    const ms = (v: any) => v?.toMillis?.() ?? new Date(v ?? 0).getTime();
    return subastas
      .filter(a => cat === "Todas" || a.category === cat)
      .filter(a => !busqueda.trim() || a.title?.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => {
        if (orden === "precio_asc") return (a.currentBidUsd ?? 0) - (b.currentBidUsd ?? 0);
        if (orden === "precio_desc") return (b.currentBidUsd ?? 0) - (a.currentBidUsd ?? 0);
        if (orden === "pujas") return (b.bidsCount ?? 0) - (a.bidsCount ?? 0);
        return ms(a.endsAt) - ms(b.endsAt);
      });
  }, [subastas, cat, orden, busqueda]);

  const contenido = Math.min(width, APP_MAX_WIDTH);
  const anchoTarjeta = (contenido - space.lg * 2 - space.md) / 2;
  const filtrado = busqueda.trim() !== "" || cat !== "Todas";

  const Chip = ({ activo, onPress, children, pequeno }: any) => (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: activo ? color.accent : color.surface2,
        borderRadius: 999,
        paddingHorizontal: pequeno ? 13 : 16,
        paddingVertical: pequeno ? 7 : 9,
      }}
    >
      <Text style={{ color: activo ? color.accentInk : color.ink2, fontSize: pequeno ? 12 : 13, fontWeight: activo ? "700" : "500" }}>
        {children}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{
        paddingTop: insets.top + 10, paddingHorizontal: space.lg, paddingBottom: 12,
        flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: color.line,
      }}>
        <Text style={{ ...T.title, flex: 1 }}>Explorar</Text>
        <Text style={{ ...T.dim, fontWeight: "700" }}>{visibles.length}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24, alignItems: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contenido }}>
          <View style={{ paddingHorizontal: space.lg, paddingTop: 14 }}>
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar ventas o productos"
              placeholderTextColor={color.ink3}
              accessibilityLabel="Buscar ventas o productos"
              style={{
                backgroundColor: color.surface2, borderRadius: radius.btn,
                paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: color.ink,
              }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: 12, gap: 8 }}>
            {CATEGORIAS.map(c => <Chip key={c} activo={cat === c} onPress={() => setCat(c)}>{c}</Chip>)}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 14, gap: 8 }}>
            {ORDENES.map(([v, label]) => (
              <Chip key={v} pequeno activo={orden === v} onPress={() => setOrden(v)}>{label}</Chip>
            ))}
          </ScrollView>

          {cargando ? <Cargando/> : visibles.length === 0 ? (
            <Vacio titulo={filtrado ? "Nada con ese filtro" : "No hay ventas activas"}>
              {filtrado ? (
                <View style={{ paddingHorizontal: space.lg }}>
                  <Boton variante="soft" onPress={() => { setBusqueda(""); setCat("Todas"); }}>
                    Limpiar filtros
                  </Boton>
                </View>
              ) : null}
            </Vacio>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.lg }}>
              {visibles.map(a => <AuctionCard key={a.id} subasta={a} ancho={anchoTarjeta}/>)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
