import React, { useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { color, radius, font } from "../theme";

// =============================================================
// SubidorFotos — el equivalente móvil de ImageUploader (web)
// =============================================================
// Sube a Firebase Storage bajo la misma ruta que la web (auctions/{uid})
// y hace cumplir los mismos límites que storage.rules: solo imágenes,
// hasta 5 MB. El cliente avisa temprano; el servidor decide.
//
// El primer link de imageURLs es la portada, igual que en la web.
// =============================================================

const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  fotos: string[];
  onChange: (urls: string[]) => void;
  path: string;
  max?: number;
}

export function SubidorFotos({ fotos, onChange, path, max = 5 }: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const elegir = async (fuente: "galeria" | "camara") => {
    setError("");
    if (fotos.length >= max) { setError(`Ya tienes el máximo de ${max} fotos`); return; }

    // El permiso se pide en el momento, no al abrir la app: así el
    // usuario entiende para qué es. Si lo negó antes, se le explica.
    const permiso = fuente === "camara"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Permiso necesario",
        fuente === "camara"
          ? "Activa el acceso a la cámara en Ajustes para tomar fotos."
          : "Activa el acceso a tus fotos en Ajustes para elegir imágenes."
      );
      return;
    }

    const opciones: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, // comprime en el teléfono; casi siempre deja el archivo bajo 5 MB
      allowsMultipleSelection: fuente === "galeria",
      selectionLimit: max - fotos.length,
    };
    const r = fuente === "camara"
      ? await ImagePicker.launchCameraAsync({ ...opciones, allowsMultipleSelection: false })
      : await ImagePicker.launchImageLibraryAsync(opciones);

    if (r.canceled || !r.assets?.length) return;

    setSubiendo(true);
    let acumuladas = [...fotos];
    try {
      for (const asset of r.assets.slice(0, max - fotos.length)) {
        // fetch del uri local → blob, que es lo que Storage sube
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        if (blob.size > MAX_BYTES) {
          setError("Una foto pesa más de 5 MB, incluso comprimida. Prueba con otra.");
          continue;
        }
        const nombre = `${path}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const refImg = storageRef(storage, nombre);
        await uploadBytes(refImg, blob, { contentType: blob.type || "image/jpeg" });
        const url = await getDownloadURL(refImg);
        // Acumulado local: onChange(fotos) dentro del bucle perdería
        // todas menos la última (el mismo bug que ya mordió a la web).
        acumuladas = [...acumuladas, url];
        onChange(acumuladas);
      }
    } catch (e: any) {
      setError("No se pudo subir la foto. Revisa tu conexión.");
      console.error("SubidorFotos:", e?.code, e?.message);
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = (i: number) => onChange(fotos.filter((_, idx) => idx !== i));

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {fotos.map((url, i) => (
          <View key={url} style={{
            width: 82, height: 82, borderRadius: radius.sm, overflow: "hidden",
            borderWidth: 1, borderColor: color.line, position: "relative",
          }}>
            <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover"/>
            {i === 0 && (
              <View style={{
                position: "absolute", bottom: 4, left: 4,
                backgroundColor: color.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{ color: color.accentInk, fontSize: 9, fontWeight: font.bold }}>Portada</Text>
              </View>
            )}
            <Pressable
              onPress={() => quitar(i)}
              hitSlop={8}
              style={{
                position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: 11,
                backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 15, lineHeight: 17, fontWeight: font.bold }}>×</Text>
            </Pressable>
          </View>
        ))}

        {fotos.length < max && !subiendo && (
          <>
            <Pressable onPress={() => elegir("galeria")} style={cuadroBtn}>
              <Text style={{ fontSize: 22 }}>🖼️</Text>
              <Text style={etiquetaBtn}>Galería</Text>
            </Pressable>
            <Pressable onPress={() => elegir("camara")} style={cuadroBtn}>
              <Text style={{ fontSize: 22 }}>📷</Text>
              <Text style={etiquetaBtn}>Cámara</Text>
            </Pressable>
          </>
        )}

        {subiendo && (
          <View style={[cuadroBtn, { borderStyle: "solid" }]}>
            <ActivityIndicator color={color.accent}/>
          </View>
        )}
      </View>

      {error ? <Text style={{ color: color.error ?? "#c0392b", fontSize: 12.5 }}>{error}</Text> : null}
      <Text style={{ color: color.ink3, fontSize: 11.5, lineHeight: 16 }}>
        La primera foto es la portada. Hasta {max} fotos, cada una máx. 5 MB.
      </Text>
    </View>
  );
}

const cuadroBtn = {
  width: 82, height: 82, borderRadius: 14, borderWidth: 1.5, borderColor: color.line,
  borderStyle: "dashed" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 3,
};
const etiquetaBtn = { color: color.ink3, fontSize: 11, fontWeight: font.semibold };
