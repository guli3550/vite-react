import React, { useState } from "react";
import type { VideoAd } from "../../types/videoAd";
import { FullscreenVideoAdModal } from "./FullscreenVideoAdModal";
import "./VideoAdStoriesRow.css";

interface VideoAdStoriesRowProps {
  ads: VideoAd[];
  onOpenProduct?: (productId: string) => void;
  onNavigateUrl?: (url: string) => void;
}

export const VideoAdStoriesRow: React.FC<VideoAdStoriesRowProps> = ({
  ads,
  onOpenProduct,
  onNavigateUrl,
}) => {
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  if (!ads.length) return null;

  const selectedAd = ads.find((item) => item.id === selectedAdId) || null;

  return (
    <>
      <section className="guli-ad-stories" aria-label="Faol reklamalar">
        <div
          className="guli-ad-stories-track"
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onTouchCancel={(event) => event.stopPropagation()}
        >
          {ads.map((ad) => (
            <button
              key={ad.id}
              type="button"
              className="guli-ad-story"
              onClick={() => setSelectedAdId(ad.id)}
              aria-label={`Reklamani ko‘rish: ${ad.title}`}
            >
              <span className="guli-ad-story-ring">
                <span className="guli-ad-story-image-wrap">
                  {ad.poster_url ? (
                    <img src={ad.poster_url} alt="" loading="lazy" />
                  ) : (
                    <span className="guli-ad-story-fallback">G</span>
                  )}
                  <span className="guli-ad-story-play" aria-hidden="true">▶</span>
                </span>
              </span>
              <span className="guli-ad-story-title">{ad.title || "Guli Market"}</span>
            </button>
          ))}
        </div>
      </section>
      {selectedAd && (
        <FullscreenVideoAdModal
          isOpen={true}
          ad={selectedAd}
          ads={ads}
          onClose={() => setSelectedAdId(null)}
          onOpenProduct={onOpenProduct}
          onNavigateUrl={onNavigateUrl}
        />
      )}
    </>
  );
};
