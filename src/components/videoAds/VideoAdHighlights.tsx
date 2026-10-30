import React, { useState } from "react";
import { X, Play } from "lucide-react";
import type { VideoAd } from "../../types/videoAd";
import { FullscreenVideoAdModal } from "./FullscreenVideoAdModal";
import "./VideoAdHighlights.css";

interface VideoAdHighlightsProps {
  ads: VideoAd[];
  onOpenProduct?: (productId: string) => void;
  onNavigateUrl?: (url: string) => void;
  onDismiss?: () => void;
}

/** Compact circular storefront lane for admin-managed video advertisements. */
export const VideoAdHighlights: React.FC<VideoAdHighlightsProps> = ({
  ads,
  onOpenProduct,
  onNavigateUrl,
  onDismiss,
}) => {
  const [activeAd, setActiveAd] = useState<VideoAd | null>(null);

  if (!ads.length) return null;

  return (
    <section className="guli-video-highlights" aria-label="Guli Market reklama videolari">
      <div className="guli-video-highlights-track">
        {ads.map((ad) => (
          <button
            className="guli-video-highlight"
            key={ad.id}
            type="button"
            onClick={() => setActiveAd(ad)}
            aria-label={`${ad.title || "Guli Market"} reklama videosini ko‘rish`}
          >
            <span className="guli-video-highlight-ring">
              {ad.video_url ? (
                <video
                  src={ad.video_url}
                  poster={ad.poster_url || undefined}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                />
              ) : ad.poster_url ? (
                <img src={ad.poster_url} alt="" loading="lazy" />
              ) : (
                <span className="guli-video-highlight-placeholder">G</span>
              )}
              <span className="guli-video-highlight-play"><Play size={17} fill="currentColor" /></span>
            </span>
            <span className="guli-video-highlight-title">{ad.title || "Guli Market"}</span>
          </button>
        ))}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="guli-video-highlights-dismiss"
          onClick={onDismiss}
          aria-label="Reklama lentasini yopish"
          title="Yopish"
        >
          <X size={15} />
        </button>
      )}
      {activeAd && (
        <FullscreenVideoAdModal
          isOpen={Boolean(activeAd)}
          ad={activeAd}
          ads={ads}
          onClose={() => setActiveAd(null)}
          onOpenProduct={onOpenProduct}
          onNavigateUrl={onNavigateUrl}
        />
      )}
    </section>
  );
};
