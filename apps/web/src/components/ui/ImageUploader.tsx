"use client";
import { useRef, useState } from "react";
import { useUpload } from "../../hooks/useUpload";

interface Props {
  images: string[];
  onChange: (urls: string[]) => void;
  path: string;
  max?: number;
}

// Los límites de aquí son los mismos que hacen cumplir storage.rules
// (solo imágenes, hasta 5 MB): el cliente avisa temprano, el servidor decide.
const MAX_BYTES = 5 * 1024 * 1024;

// Reencodea la foto a JPEG y limita el lado mayor a 1600px. Esto:
//  · convierte fotos de iPhone (HEIC) a un formato que se ve en todos lados
//  · baja el peso muy por debajo de 5 MB (las fotos de celular pesan más)
//  · normaliza la orientación al dibujarla en el canvas
// Si el navegador no puede decodificar el archivo, se avisa y se cae al
// original (que el chequeo de tamaño atrapa si es muy pesado).
//
// `cuadrado` recorta al centro: lo usa el avatar, que siempre se muestra
// dentro de un círculo. Sin recortar, una foto vertical salía aplastada.
export async function comprimirAJpeg(
  file: File,
  opciones: { max?: number; cuadrado?: boolean } = {}
): Promise<Blob> {
  const { max: MAX_LADO = 1600, cuadrado = false } = opciones;
  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("no se pudo leer"));
    fr.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("no se pudo decodificar"));
    im.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin canvas");

  if (cuadrado) {
    // Recorte central: se toma el cuadrado más grande que quepa y se
    // dibuja lleno, así el círculo del avatar nunca deforma la cara.
    const lado = Math.min(img.width, img.height);
    const sx = (img.width - lado) / 2;
    const sy = (img.height - lado) / 2;
    const destino = Math.min(lado, MAX_LADO);
    canvas.width = destino;
    canvas.height = destino;
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, destino, destino);
  } else {
    let { width, height } = img;
    if (Math.max(width, height) > MAX_LADO) {
      const s = MAX_LADO / Math.max(width, height);
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
  }

  return await new Promise((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error("sin blob"))), "image/jpeg", 0.85));
}

export function ImageUploader({ images, onChange, path, max = 5 }: Props) {
  const { upload, uploading, progress } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const subir = async (files: FileList | null) => {
    if (!files) return;
    setError("");

    const quedan = max - images.length;
    if (quedan <= 0) { setError(`Ya tienes el máximo de ${max} fotos`); return; }

    let acumuladas = [...images];
    for (const file of Array.from(files).slice(0, quedan)) {
      // iOS a veces manda el tipo vacío para HEIC: aceptamos también por
      // extensión para no rechazar fotos válidas del celular.
      const pareceImagen = file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name);
      if (!pareceImagen) { setError("Solo se aceptan imágenes"); continue; }
      try {
        // Comprimir/convertir a JPEG. Si el navegador no puede, subimos el
        // original (y ahí sí exigimos que no pase de 5 MB).
        let dato: Blob = file;
        try {
          dato = await comprimirAJpeg(file);
        } catch {
          if (file.size > MAX_BYTES) { setError(`"${file.name}" pesa más de 5 MB. Tómale una captura o bájale la resolución.`); continue; }
        }
        const nombre = `${path}/${Date.now()}_foto.jpg`;
        const url = await upload(dato, nombre);
        // Se acumula en una variable local: onChange con `images` dentro
        // del bucle perdería todas menos la última.
        acumuladas = [...acumuladas, url];
        onChange(acumuladas);
      } catch (e: any) {
        // Mostrar el motivo real ayuda a diagnosticar (permiso, red, config).
        setError(`No se pudo subir la foto (${e?.code ?? e?.message ?? "error"})`);
      }
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const quitar = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {images.map((url, i) => (
          <div key={url} style={{ position: "relative", width: 78, height: 78, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
            <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            {i === 0 && (
              <span className="lv-badge lv-badge--accent" style={{ position: "absolute", bottom: 4, left: 4, fontSize: "0.55rem", padding: "2px 6px" }}>
                Portada
              </span>
            )}
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label={`Quitar foto ${i + 1}`}
              style={{
                position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                background: "rgba(11,11,13,0.72)", color: "#fff", fontSize: "0.85rem", lineHeight: 1,
                fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(4px)",
              }}
            >
              ×
            </button>
          </div>
        ))}

        {images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              width: 78, height: 78, borderRadius: 12, background: "var(--surface-2)",
              border: "1.5px dashed var(--line-strong)", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 5, color: "var(--ink-3)",
            }}
          >
            {uploading ? (
              <>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent)" }}>{progress}%</span>
                <span style={{ width: 38, height: 3, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width 0.2s" }}/>
                </span>
              </>
            ) : (
              <>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                <span style={{ fontSize: "0.58rem", fontWeight: 700 }}>Foto</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && <div style={{ fontSize: "0.74rem", color: "var(--live)", fontWeight: 600, marginBottom: 4 }}>{error}</div>}
      <div className="lv-dim" style={{ fontSize: "0.7rem" }}>
        {images.length}/{max} fotos · máximo 5 MB cada una{images.length > 0 ? " · la primera es la portada" : ""}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={e => subir(e.target.files)}
      />
    </div>
  );
}
