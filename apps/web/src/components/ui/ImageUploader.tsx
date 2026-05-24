"use client";
import { useRef, useState } from "react";
import { useUpload } from "../../hooks/useUpload";

interface Props {
  images: string[];
  onChange: (urls: string[]) => void;
  path: string;
  max?: number;
}

export function ImageUploader({ images, onChange, path, max = 5 }: Props) {
  const { upload, uploading, progress } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const remaining = max - images.length;
    if (remaining <= 0) { setError(`Máximo ${max} fotos`); return; }
    const toUpload = Array.from(files).slice(0, remaining);
    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) { setError("Solo imágenes"); continue; }
      if (file.size > 5 * 1024 * 1024) { setError("Máximo 5MB por imagen"); continue; }
      try {
        const filename = `${path}/${Date.now()}_${file.name.replace(/\s/g,"_")}`;
        const url = await upload(file, filename);
        onChange([...images, url]);
      } catch(e) { setError("Error subiendo imagen"); }
    }
  };

  const removeImage = (idx: number) => {
    onChange(images.filter((_,i) => i !== idx));
  };

  return (
    <div style={{ marginBottom:16 }}>
      {/* Image grid */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:8 }}>
        {images.map((url, i) => (
          <div key={i} style={{ position:"relative", width:80, height:80, borderRadius:10, overflow:"hidden", border:"1px solid rgba(168,85,247,0.2)" }}>
            <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            <button
              onClick={() => removeImage(i)}
              style={{ position:"absolute", top:4, right:4, width:20, height:20, background:"rgba(255,45,45,0.9)", border:"none", borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:"0.7rem", lineHeight:1, fontWeight:900 }}
            >×</button>
          </div>
        ))}

        {/* Add button */}
        {images.length < max && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{ width:80, height:80, background:"rgba(168,85,247,0.06)", border:`2px dashed ${uploading?"rgba(168,85,247,0.4)":"rgba(168,85,247,0.2)"}`, borderRadius:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:uploading?"not-allowed":"pointer", gap:4 }}
          >
            {uploading ? (
              <>
                <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#a855f7" }}>{progress}%</div>
                <div style={{ width:40, height:3, background:"rgba(168,85,247,0.1)", borderRadius:2 }}>
                  <div style={{ width:`${progress}%`, height:"100%", background:"#a855f7", borderRadius:2, transition:"width 0.2s" }}/>
                </div>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                <span style={{ fontSize:"0.55rem", color:"rgba(168,85,247,0.6)", fontWeight:600 }}>Foto</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && <div style={{ fontSize:"0.72rem", color:"#ff8080", marginBottom:4 }}>{error}</div>}
      <div style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.25)" }}>{images.length}/{max} fotos · Máx 5MB c/u</div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display:"none" }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}
