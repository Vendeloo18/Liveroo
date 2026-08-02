import React, { useState } from "react";
import {
  View, Text, ScrollView, useWindowDimensions, TextInput, Pressable, Alert, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { useAuthStore } from "../../src/store/authStore";
import { color, space, text as T, font, radius, APP_MAX_WIDTH } from "../../src/theme";
import { Panel, Boton, Vacio } from "../../src/components/ui";
import { SubidorFotos } from "../../src/components/SubidorFotos";
import { BRAND } from "@subastas-ve/shared";

const CATEGORIAS = [
  "Moda y Ropa", "Electronica", "Calzado", "Joyas y Relojes", "Hogar",
  "Colecciones", "Autos y Motos", "Deportes", "Arte", "Juguetes", "Comida", "Mascotas",
];
const DURACIONES: [string, number][] = [["12 h", 12], ["1 día", 24], ["3 días", 72], ["7 días", 168]];

// Campo de texto con etiqueta, del mismo estilo que la web
function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: font.semibold, color: color.ink, marginBottom: 6 }}>{label}</Text>
      {children}
      {hint ? <Text style={{ color: color.ink3, fontSize: 11.5, marginTop: 5, lineHeight: 16 }}>{hint}</Text> : null}
    </View>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: color.line, borderRadius: radius.sm,
  paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: color.ink,
  backgroundColor: color.surface,
};

function Chips({ opciones, valor, onChange }: { opciones: string[]; valor: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
      {opciones.map((o) => {
        const activo = o === valor;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={{
            paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill,
            backgroundColor: activo ? color.accent : color.surface2,
            borderWidth: 1, borderColor: activo ? color.accent : color.line,
          }}>
            <Text style={{ fontSize: 13, fontWeight: font.semibold, color: activo ? color.accentInk : color.ink }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Vender() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuthStore();
  const contenido = Math.min(width, APP_MAX_WIDTH);

  const Cabecera = ({ titulo }: { titulo: string }) => (
    <View style={{
      paddingTop: insets.top + 10, paddingHorizontal: space.lg, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: color.line,
    }}>
      <Text style={T.title}>{titulo}</Text>
    </View>
  );

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <Cabecera titulo="Vender"/>
        <Vacio titulo="Entra para vender">
          <View style={{ paddingHorizontal: space.lg }}>
            <Boton onPress={() => router.push("/login")}>Entrar</Boton>
          </View>
        </Vacio>
      </View>
    );
  }

  if (profile.sellerStatus !== "approved") {
    return <Solicitud contenido={contenido} Cabecera={Cabecera} estado={profile.sellerStatus} perfil={profile}/>;
  }

  return <Publicar contenido={contenido} Cabecera={Cabecera} perfil={profile} router={router}/>;
}

// =============================================================
// Solicitud de vendedor — espejo del estado no-aprobado de la web
// =============================================================
function Solicitud({ contenido, Cabecera, estado, perfil }: any) {
  const [tienda, setTienda] = useState("");
  const [cat, setCat] = useState("Moda y Ropa");
  const [whatsapp, setWhatsapp] = useState(perfil?.whatsapp ?? "");
  const [ciudad, setCiudad] = useState(perfil?.city ?? "");
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (tienda.trim().length < 3) { Alert.alert("Falta el nombre", "El nombre de la tienda necesita al menos 3 caracteres."); return; }
    if (whatsapp.trim().length < 7) { Alert.alert("Falta tu WhatsApp", "Es obligatorio: por ahí coordinas con tus compradores."); return; }
    setOcupado(true);
    try {
      // Único movimiento que permiten las reglas: none → pending
      await updateDoc(doc(db, "users", perfil.uid), {
        sellerStatus: "pending",
        shopName: tienda.trim(), sellerCat: cat,
        whatsapp: whatsapp.trim(), city: ciudad.trim(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert("¡Solicitud enviada!", "Te avisamos cuando un administrador la apruebe.");
    } catch (e: any) {
      Alert.alert("No se pudo enviar", e?.message ?? "Intenta de nuevo.");
    } finally { setOcupado(false); }
  };

  const Marco = ({ children }: { children: React.ReactNode }) => (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Cabecera titulo="Vender"/>
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contenido, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>{children}</View>
      </ScrollView>
    </View>
  );

  if (estado === "pending") {
    return (
      <Marco>
        <Panel>
          <Text style={{ fontSize: 16, fontWeight: font.bold, color: color.ink, marginBottom: 6 }}>Tu solicitud está en revisión ⏳</Text>
          <Text style={{ ...T.muted, lineHeight: 21 }}>
            Un administrador la revisa a mano. Apenas quede aprobada podrás publicar ventas y vender en vivo.
          </Text>
        </Panel>
      </Marco>
    );
  }

  if (estado === "suspended") {
    return (
      <Marco>
        <Panel>
          <Text style={{ fontSize: 16, fontWeight: font.bold, color: color.ink, marginBottom: 6 }}>Tu cuenta de vendedor está suspendida</Text>
          <Text style={{ ...T.muted, lineHeight: 21 }}>Escríbenos por soporte para revisar tu caso.</Text>
          <Boton variante="soft" style={{ marginTop: 14 }} onPress={() => Linking.openURL(`${BRAND.url}/support`)}>Contactar soporte</Boton>
        </Panel>
      </Marco>
    );
  }

  return (
    <Marco>
      <Panel>
        <Text style={{ fontSize: 16, fontWeight: font.bold, color: color.ink, marginBottom: 6 }}>{`Vende en ${BRAND.name}`}</Text>
        <Text style={{ ...T.muted, lineHeight: 21 }}>
          Cuéntanos de tu tienda y un administrador revisa tu solicitud. Es lo que evita que cualquiera publique a nombre de otro.
        </Text>
      </Panel>

      <Panel>
        <Campo label="Nombre de tu tienda">
          <TextInput style={inputStyle} value={tienda} onChangeText={setTienda} placeholder="Ej: Tecno Caracas" placeholderTextColor={color.ink3} maxLength={40}/>
        </Campo>
        <Campo label="Qué vendes">
          <Chips opciones={CATEGORIAS} valor={cat} onChange={setCat}/>
        </Campo>
        <Campo label="Tu WhatsApp" hint="Por ahí coordinas pagos y entregas con tus compradores.">
          <TextInput style={inputStyle} value={whatsapp} onChangeText={setWhatsapp} placeholder="Ej: +58 414 1234567" placeholderTextColor={color.ink3} keyboardType="phone-pad" maxLength={20}/>
        </Campo>
        <Campo label="Ciudad">
          <TextInput style={inputStyle} value={ciudad} onChangeText={setCiudad} placeholder="Ej: Caracas" placeholderTextColor={color.ink3} maxLength={40}/>
        </Campo>
        <Boton onPress={enviar} cargando={ocupado}>Enviar solicitud</Boton>
      </Panel>
    </Marco>
  );
}

// =============================================================
// Publicar subasta — espejo de crearSubasta (web), nativo
// =============================================================
function Publicar({ contenido, Cabecera, perfil, router }: any) {
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Moda y Ropa");
  const [precio, setPrecio] = useState("");
  const [incremento, setIncremento] = useState("1");
  const [duracion, setDuracion] = useState(24);
  const [fotos, setFotos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const publicar = async () => {
    const p = parseFloat(precio);
    const inc = parseFloat(incremento);
    if (titulo.trim().length < 3) { Alert.alert("Falta el título", "Ponle un nombre claro al producto."); return; }
    if (!isFinite(p) || p <= 0) { Alert.alert("Precio inválido", "El precio de salida debe ser mayor que cero."); return; }
    if (!isFinite(inc) || inc <= 0) { Alert.alert("Incremento inválido", "El incremento mínimo debe ser mayor que cero."); return; }
    if (fotos.length === 0) { Alert.alert("Falta la foto", "Sube al menos una foto del producto."); return; }

    setOcupado(true);
    try {
      // Mismos campos que crearSubasta en la web: las reglas exigen que
      // nazca sin pujas, con currentBidUsd == startingPriceUsd y cierre
      // futuro. El motor hace el resto.
      const ref = await addDoc(collection(db, "auctions"), {
        mode: "standalone", showId: null,
        sellerId: perfil.uid, sellerName: perfil.displayName ?? "Vendedor",
        title: titulo.trim(), description: desc.trim(), category: cat,
        startingPriceUsd: p, currentBidUsd: p, minIncrementUsd: inc,
        status: "active",
        endsAt: new Date(Date.now() + duracion * 3600_000),
        bidsCount: 0, currentBidderId: null, currentBidderName: null,
        winnerId: null, orderId: null, sortOrder: null,
        imageURL: fotos[0] ?? null, imageURLs: fotos,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      Alert.alert("¡Publicada!", "Tu venta ya está disponible.", [
        { text: "Verla", onPress: () => router.push(`/auctions/${ref.id}`) },
        { text: "Publicar otra", onPress: () => { setTitulo(""); setDesc(""); setPrecio(""); setFotos([]); } },
      ]);
    } catch (e: any) {
      Alert.alert("No se pudo publicar", e?.message ?? "Intenta de nuevo.");
    } finally { setOcupado(false); }
  };

  const p = parseFloat(precio);
  const bs = isFinite(p) && p > 0 ? p : null;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Cabecera titulo="Publicar una venta"/>
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contenido, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>

          {/* Los shows en vivo siguen en la web: necesitan cámara de video
              en tiempo real, que es otro módulo nativo. */}
          <Panel style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 20 }}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: font.bold, color: color.ink }}>¿Quieres vender en vivo?</Text>
              <Text style={{ color: color.ink3, fontSize: 12, lineHeight: 16 }}>Las ventas con video se manejan desde la web, por ahora.</Text>
            </View>
            <Pressable onPress={() => Linking.openURL(`${BRAND.url}/seller`)}>
              <Text style={{ color: color.accent, fontWeight: font.bold, fontSize: 13 }}>Abrir →</Text>
            </Pressable>
          </Panel>

          <Panel>
            <Campo label="Fotos del producto" hint="La primera es la portada.">
              <SubidorFotos fotos={fotos} onChange={setFotos} path={`auctions/${perfil.uid}`} max={5}/>
            </Campo>

            <Campo label="Título">
              <TextInput style={inputStyle} value={titulo} onChangeText={setTitulo} placeholder="Ej: iPhone 13 128GB usado" placeholderTextColor={color.ink3} maxLength={80}/>
            </Campo>

            <Campo label="Descripción" hint="Estado, detalles, lo que el comprador debe saber.">
              <TextInput style={[inputStyle, { minHeight: 84, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} placeholder="Cuéntale al comprador cómo está" placeholderTextColor={color.ink3} multiline maxLength={600}/>
            </Campo>

            <Campo label="Categoría">
              <Chips opciones={CATEGORIAS} valor={cat} onChange={setCat}/>
            </Campo>
          </Panel>

          <Panel>
            <Campo label="Precio de salida (USD)" hint={bs ? `≈ Bs ${(bs * 745).toLocaleString("es-VE")} · las ofertas arrancan aquí` : "En dólares; las ofertas arrancan en este monto."}>
              <TextInput style={inputStyle} value={precio} onChangeText={setPrecio} placeholder="Ej: 20" placeholderTextColor={color.ink3} keyboardType="decimal-pad"/>
            </Campo>

            <Campo label="Incremento mínimo (USD)" hint="Cuánto sube cada uso de SUBELOO.">
              <TextInput style={inputStyle} value={incremento} onChangeText={setIncremento} placeholder="1" placeholderTextColor={color.ink3} keyboardType="decimal-pad"/>
            </Campo>

            <Campo label="Duración">
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DURACIONES.map(([label, horas]) => {
                  const activo = horas === duracion;
                  return (
                    <Pressable key={horas} onPress={() => setDuracion(horas)} style={{
                      flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm,
                      backgroundColor: activo ? color.accent : color.surface2,
                      borderWidth: 1, borderColor: activo ? color.accent : color.line,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: font.semibold, color: activo ? color.accentInk : color.ink }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Campo>
          </Panel>

          <Boton onPress={publicar} cargando={ocupado} tamano="lg">Publicar venta</Boton>
        </View>
      </ScrollView>
    </View>
  );
}
