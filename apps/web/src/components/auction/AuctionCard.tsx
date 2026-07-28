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
}

export function AuctionCard({ auction, onClick }: { auction: AuctionCardData; onClick?: () => void }) {
  const router = useRouter();
  const { texto, urgente, vencida } = useCountdown(auction.endsAt);
  const foto = auction.imageURL ?? auction.imageURLs?.[0];
  const precio = auction.currentBidUsd ?? auction.startingPriceUsd ?? 0;
  const pujas = auction.bidsCount ?? 0;

  return (
    <article
      className="lv-card"
      onClick={onClick ?? (() => router.push(`/auctions/${auction.id}`))}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") (onClick ?? (() => router.push(`/auctions/${auction.id}`)))(); }}
    >
      <div className="lv-card__media">
        {foto
          ? <img src={foto} alt={auction.title ?? ""} loading="lazy"/>
          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/>
              </svg>
            </div>}

        {auction.mode === "live" && (
          <span className="lv-badge lv-badge--live lv-badge--float" style={{ top: 8, left: 8 }}>
            <i className="lv-dot"/> EN VIVO
          </span>
        )}

        <span
          className={`lv-badge lv-badge--float${urgente ? " lv-badge--urgent" : ""}`}
          style={{ bottom: 8, left: 8 }}
        >
          {vencida ? "Finalizada" : texto}
        </span>

        {pujas > 0 && (
          <span className="lv-badge lv-badge--float" style={{ top: 8, right: 8 }}>
            {pujas} {pujas === 1 ? "puja" : "pujas"}
          </span>
        )}
      </div>

      <div className="lv-card__body">
        <h3 className="lv-card__title">{auction.title ?? "Sin título"}</h3>
        <div className="lv-card__foot">
          <div>
            <div className="lv-eyebrow">{pujas > 0 ? "Puja actual" : "Precio inicial"}</div>
            <div className="lv-price">${precio.toFixed(2)}</div>
          </div>
          <span className="lv-btn lv-btn--accent lv-btn--sm">Pujar</span>
        </div>
      </div>
    </article>
  );
}
