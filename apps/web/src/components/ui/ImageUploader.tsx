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
      if (!file.type.startsWith("image/")) { setError("Solo se aceptan imágenes"); continue; }
      if (file.size > MAX_BYTES) { setError(`"${file.name}" pesa más de 5 MB`); continue; }
      try {
        const nombre = `${path}/${Date.now()}_${file.name.replace(/\s/g, "_")}`;
        const url = await upload(file, nombre);
        // Se acumula en una variable local: onChange con `images` dentro
        // del bucle perdería todas menos la última.
        acumuladas = [...acumuladas, url];
        onChange(acumuladas);
      } catch {
        setError("No se pudo subir la imagen");
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
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--ink)" }}>{progress}%</span>
                <span style={{ width: 38, height: 3, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${progress}%`, height: "100%", background: "var(--ink)", transition: "width 0.2s" }}/>
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
