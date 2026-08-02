"use client";
import { useRouter } from "next/navigation";
import { BRAND } from "@subastas-ve/shared";

// Un link mal copiado en WhatsApp caía en el 404 por defecto de Next:
// "This page could not be found", en inglés y sin salida.
export default function NotFound() {
  const router = useRouter();
  return (
    <div className="lv-app">
      <div className="lv-empty" style={{ minHeight: "80dvh" }}>
        <div className="lv-empty__title">Esta página no existe</div>
        <div className="lv-empty__text" style={{ maxWidth: 300 }}>
          Puede que el enlace esté incompleto o que la venta ya haya terminado.
        </div>
        <button className="lv-btn lv-btn--accent lv-btn--lg" style={{ marginTop: 18 }} onClick={() => router.push("/")}>
          Ir a {BRAND.name}
        </button>
        <button className="lv-btn lv-btn--soft" style={{ marginTop: 10 }} onClick={() => router.push("/auctions")}>
          Ver lo que está en vivo
        </button>
      </div>
    </div>
  );
}
