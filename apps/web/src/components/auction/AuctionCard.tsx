"use client";
import { useRouter } from "next/navigation";
import { useCountdown } from "../../hooks/useCountdown";

export interface AuctionCardData {
  id: string;
  title?: string;
  imageURL?: string;
  imageURLs?: string[];
  currentBidUsd?: number;
  startingPriceUsd?: number;
  sellerName?: string;
  endsAt?: any;
  bidsCount?: number;
  status?: string;
  mode?: string;
  isDemo?: boolean;
}

/**
 * Sigue la estructura de assets/card-lote.png:
 *   · superficie de imagen en durazno, con su propio radio
 *   · "EN VIVO" arriba a la izquierda, contador arriba a la derecha
 *   · fila del vendedor DENTRO de la imagen, abajo, en monoespaciada
 *   · título en display condensada mayúscula
 *   · "PUJA ACTUAL" en mono espaciada, y el precio en naranja
 */
export function AuctionCard({ auction, onClick }: { auction: AuctionCardData; onClick?: () => void }) {
  const router = useRouter();
  const { texto, urgente, vencida } = useCountdown(auction.endsAt);

  const foto = auction.imageURL ?? auction.imageURLs?.[0];
  const precio = auction.currentBidUsd ?? auction.startingPriceUsd ?? 0;
  const pujas = auction.bidsCount ?? 0;
  const abrir = onClick ?? (() => router.push(`/auctions/${auction.id}`));

  return (
    <article
      className="lv-card"
      onClick={abrir}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") abrir(); }}
    >
      <div className="lv-card__media">
        {foto
          ? <img src={foto} alt={auction.title ?? ""} loading="lazy"/>
          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-disabled)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/>
              </svg>
            </div>}

        {auction.mode === "live" && (
          <span className="lv-badge lv-badge--live" style={{ position:"absolute", top:8, left:8 }}>
            <i className="lv-dot"/> EN VIVO
          </span>
        )}

        {/* Contador: chip de dato, mono, arriba a la derecha */}
        <span
          className="lv-badge lv-badge--data"
          style={{ position:"absolute", top:8, right:8, background: urgente && !vencida ? "var(--accent)" : undefined }}
        >
          {vencida ? "cerrada" : texto}
        </span>

        {/* Vendedor y pujas, dentro de la imagen como en el asset */}
        {auction.sellerName && (
          <div style={{
            position:"absolute", bottom:8, left:8, right:8,
            display:"flex", alignItems:"center", gap:6, minWidth:0,
          }}>
            <span style={{
              width:20, height:20, borderRadius:"50%", flexShrink:0,
              background:"var(--accent-soft)", border:"1.5px solid var(--accent)",
            }}/>
            <span className="lv-mono" style={{
              fontSize:"0.62rem", color:"#fff", fontWeight:500,
              textShadow:"0 1px 3px rgba(0,0,0,0.5)",
              overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
            }}>
              {auction.sellerName}{pujas > 0 ? ` · ${pujas} ${pujas === 1 ? "oferta" : "ofertas"}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="lv-card__body">
        <h3 className="lv-card__title">{auction.title ?? "Sin título"}</h3>
        <div className="lv-card__foot">
          <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
            <div className="lv-price">${precio % 1 === 0 ? precio : precio.toFixed(2)}</div>
            {pujas > 0 && <span className="lv-dim" style={{ fontSize: "0.7rem", fontWeight: 600 }}>{pujas} {pujas === 1 ? "oferta" : "ofertas"}</span>}
          </div>
          <span className="lv-btn lv-btn--sm lv-btn--accent">SUBELOO</span>
        </div>
      </div>
    </article>
  );
}
