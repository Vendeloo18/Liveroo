"use client";
import { useRef, useState } from "react";
import { useUpload } from "../../hooks/useUpload";
import { comprimirAJpeg } from "./ImageUploader";

interface Props {
  url?: string;
  /** Letra que se muestra cuando todavía no hay foto */
  inicial: string;
  /** Su propia carpeta en Storage: avatars/{uid}/… — las reglas no dejan otra */
  uid: string;
  /** Recibe la URL ya subida. Guardar en el perfil es cosa de quien lo use. */
  onSubida: (url: string) => void | Promise<void>;
  tamano?: number;
}

// El avatar se recorta cuadrado y se baja a 512px: siempre se ve dentro de
// un círculo pequeño, así que subir 1600px era mandar peso de más por una
// red móvil para luego tirarlo en el escalado.
const LADO_MAX = 512;

export function AvatarUploader({ url, inicial, uid, onSubida, tamano = 92 }: Props) {
  const { upload, uploading, progress } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const elegir = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError("");

    // iOS a veces manda el tipo vacío para HEIC: también se acepta por
    // extensión para no rechazar una foto válida del carrete.
    const pareceImagen = file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name);
    if (!pareceImagen) { setError("Eso no es una imagen"); return; }

    try {
      let dato: Blob = file;
      try {
        dato = await comprimirAJpeg(file, { max: LADO_MAX, cuadrado: true });
      } catch {
        // Sin canvas utilizable subimos el original, pero ahí sí manda el
        // tope de 5 MB que hacen cumplir las reglas de Storage.
        if (file.size > 5 * 1024 * 1024) {
          setError("Esa foto pesa más de 5 MB. Prueba con otra.");
          return;
        }
      }
      const nueva = await upload(dato, `avatars/${uid}/${Date.now()}_avatar.jpg`);
      await onSubida(nueva);
    } catch (e: any) {
      setError(`No se pudo subir (${e?.code ?? e?.message ?? "error"})`);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={url ? "Cambiar tu foto de perfil" : "Poner una foto de perfil"}
        style={{ position: "relative", width: tamano, height: tamano, borderRadius: "50%", flexShrink: 0 }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span
            style={{
              width: "100%", height: "100%", borderRadius: "50%", background: "var(--accent)",
              color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: tamano * 0.36, fontWeight: 800,
            }}
          >
            {inicial}
          </span>
        )}

        {uploading && (
          <span
            style={{
              position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(11,11,13,0.58)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.82rem", fontWeight: 800,
            }}
          >
            {progress}%
          </span>
        )}

        {/* Chapa de cámara: sin ella, un avatar redondo no se lee como
            algo tocable y nadie descubre que se puede cambiar. */}
        {!uploading && (
          <span
            style={{
              position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: "50%",
              background: "var(--accent)", color: "var(--accent-ink)", border: "2.5px solid var(--bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent-strong)" }}
      >
        {uploading ? "Subiendo…" : url ? "Cambiar foto" : "Agregar foto"}
      </button>

      {error && (
        <div style={{ fontSize: "0.74rem", color: "var(--live)", fontWeight: 600, textAlign: "center" }}>{error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => elegir(e.target.files)}
      />
    </div>
  );
}
