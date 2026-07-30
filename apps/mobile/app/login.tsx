import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { color, space, radius, text as T, font, APP_MAX_WIDTH } from "../src/theme";
import { Boton, Aviso } from "../src/components/ui";
import { BRAND } from "@subastas-ve/shared";
import { Hero } from "../src/components/Hero";
import { Logo } from "../src/components/Logo";

type Modo = "entrar" | "crear";
type Vista = "hero" | "formulario";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { signIn, signUp, error, clearError, profile } = useAuthStore();

  // Primero el hero de marca; el formulario aparece al elegir.
  const [vista, setVista] = useState<Vista>("hero");
  const [modo, setModo] = useState<Modo>("crear");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { if (profile) router.replace("/"); }, [profile, router]);

  const enviar = async () => {
    setOcupado(true);
    try {
      if (modo === "crear") await signUp({ email: email.trim(), password: clave, displayName: nombre.trim() });
      else await signIn(email.trim(), clave);
      router.replace("/");
    } catch { /* el store expone el error */ }
    finally { setOcupado(false); }
  };

  const puede = !!email.trim() && clave.length >= 6 && (modo === "entrar" || !!nombre.trim());
  const contenido = Math.min(width, APP_MAX_WIDTH);

  const campo = {
    backgroundColor: color.surface2, borderRadius: radius.btn,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: color.ink,
  };

  if (vista === "hero") {
    return (
      <Hero
        onCrearCuenta={() => { setModo("crear"); clearError(); setVista("formulario"); }}
        onIniciarSesion={() => { setModo("entrar"); clearError(); setVista("formulario"); }}
        onEntrarSinCuenta={() => router.replace("/")}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: contenido, paddingHorizontal: space.lg, paddingTop: insets.top + 40 }}>
          <Logo tamano={30}/>
          <Text style={{ ...T.muted, lineHeight: 21, marginTop: 8, marginBottom: 26 }}>
            {BRAND.tagline}. Puja, gana y coordina con el vendedor.
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
            {([["crear", "Crear cuenta"], ["entrar", "Ya tengo cuenta"]] as const).map(([v, l]) => (
              <Pressable
                key={v}
                onPress={() => { setModo(v); clearError(); }}
                style={{
                  flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 999,
                  backgroundColor: modo === v ? color.ink : color.surface2,
                }}
              >
                <Text style={{ color: modo === v ? color.bg : color.ink2, fontWeight: "700", fontSize: 13 }}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {modo === "crear" && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ ...T.label, marginBottom: 6 }}>Tu nombre</Text>
              <TextInput
                value={nombre} onChangeText={setNombre}
                placeholder="Como quieres que te vean" placeholderTextColor={color.ink3}
                autoCapitalize="words" style={campo}
              />
            </View>
          )}

          <View style={{ marginBottom: 14 }}>
            <Text style={{ ...T.label, marginBottom: 6 }}>Correo</Text>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="tucorreo@ejemplo.com" placeholderTextColor={color.ink3}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={campo}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ ...T.label, marginBottom: 6 }}>Contraseña</Text>
            <TextInput
              value={clave} onChangeText={setClave}
              placeholder="Mínimo 6 caracteres" placeholderTextColor={color.ink3}
              secureTextEntry autoCapitalize="none" style={campo}
            />
            {modo === "crear" && clave.length > 0 && clave.length < 6 ? (
              <Text style={{ ...T.dim, marginTop: 6 }}>Te faltan {6 - clave.length} caracteres</Text>
            ) : null}
          </View>

          {error ? <View style={{ marginBottom: 14 }}><Aviso tono="bad">{error}</Aviso></View> : null}

          <Boton tamano="lg" disabled={!puede} cargando={ocupado} onPress={enviar}>
            {modo === "crear" ? "Crear mi cuenta" : "Entrar"}
          </Boton>

          <Text style={{ ...T.dim, textAlign: "center", lineHeight: 18, marginTop: 18 }}>
            Tu correo y tu teléfono no son públicos: solo los ve el vendedor con quien cierres una compra.
          </Text>

          <Boton variante="soft" style={{ marginTop: 18 }} onPress={() => router.replace("/")}>
            Ver subastas sin entrar
          </Boton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
