import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { VideoAd } from "../../types/videoAd";
import { sanitizeDestinationUrl } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { detectPlatform } from "../../utils/platformAdapter";
import { FullscreenVideoAdModal } from "./FullscreenVideoAdModal";
import "./VideoAdCard.css";

interface VideoAdCardProps {
  ad: VideoAd;
  galleryAds?: VideoAd[];
  placement?: "home" | "product_feed";
  onOpenProduct?: (productId: string) => void;
  onNavigateUrl?: (url: string) => void;
  onDismiss?: (adId: string) => void;
}

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem("guli_ad_sid");
    if (!sid) {
      sid = "sid_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem("guli_ad_sid", sid);
    }
    return sid;
  } catch {
    return "sid_anon";
  }
}

export const VideoAdCard: React.FC<VideoAdCardProps> = ({
  ad,
  galleryAds,
  placement = "home",
  onOpenProduct,
  onNavigateUrl,
  onDismiss,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const impressionRecordedRef = useRef(false);

  // Check if ad was previously dismissed in this session
  useEffect(() => {
    // Home placement dismissal is owned by App: it hides the single slot until
    // the customer leaves Home and enters it again. Feed ads keep session dismissal.
    if (placement === "home") return;
    try {
      const dismissedList = JSON.parse(sessionStorage.getItem("guli_dismissed_ads") || "[]");
      if (Array.isArray(dismissedList) && dismissedList.includes(ad.id)) {
        setIsDismissed(true);
      }
    } catch {}
  }, [ad.id, placement]);

  // Video Autoplay (Always Muted on Main Page) & Smooth Viewport Observer
  // Uses rootMargin 300px so video starts playing early and never pauses during normal scrolling,
  // matching Reels behavior.
  useEffect(() => {
    if (isDismissed || isFullscreen || hasError || !ad.video_url) return;

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    let dwellTimer: ReturnType<typeof setTimeout> | null = null;

    const sendEvent = (eventType: "impression" | "click" | "video_start" | "video_complete") => {
      try {
        const apiBase = getApiBaseUrl();
        const platform = detectPlatform().isTelegram ? "telegram" : "web";
        fetch(`${apiBase}/api/video-ads/${ad.id}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: eventType,
            session_id: getSessionId(),
            platform,
          }),
        }).catch(() => {});
      } catch {}
    };

    const handlePlayAttempt = () => {
      video.muted = true;
      video.play()
        .then(() => {
          setIsPaused(false);
          sendEvent("video_start");
        })
        .catch(() => {
          setIsPaused(true);
        });
    };

    // Play immediately on mount if already near viewport
    handlePlayAttempt();

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          handlePlayAttempt();

          // Dwell timer: record impression once after 1.2s visible dwell
          if (!impressionRecordedRef.current) {
            dwellTimer = setTimeout(() => {
              impressionRecordedRef.current = true;
              sendEvent("impression");
            }, 1200);
          }
        } else {
          if (dwellTimer) {
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        }
      },
      { rootMargin: "500px 0px", threshold: 0 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (dwellTimer) clearTimeout(dwellTimer);
    };
  }, [ad.id, ad.video_url, hasError, isDismissed, isFullscreen]);

  // Open Tolstoy-style Fullscreen Modal on User Tap
  const handleOpenFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    setIsFullscreen(true);
  };

  // Close Fullscreen Modal and restore muted playback on main card
  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    if (placement !== "home") {
      try {
        const dismissedList = JSON.parse(sessionStorage.getItem("guli_dismissed_ads") || "[]");
        if (!dismissedList.includes(ad.id)) {
          dismissedList.push(ad.id);
          sessionStorage.setItem("guli_dismissed_ads", JSON.stringify(dismissedList));
        }
      } catch {}
    }

    if (onDismiss) onDismiss(ad.id);
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Track click event
    try {
      const apiBase = getApiBaseUrl();
      const platform = detectPlatform().isTelegram ? "telegram" : "web";
      fetch(`${apiBase}/api/video-ads/${ad.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "click",
          session_id: getSessionId(),
          platform,
        }),
      }).catch(() => {});
    } catch {}

    // Navigate to product if linked
    if (ad.product_id && onOpenProduct) {
      onOpenProduct(ad.product_id);
      return;
    }

    const safeUrl = sanitizeDestinationUrl(ad.destination_url);
    if (!safeUrl) return;

    if (onNavigateUrl) {
      onNavigateUrl(safeUrl);
    } else if (safeUrl.startsWith("/")) {
      window.location.href = safeUrl;
    } else {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openLink) {
        tg.openLink(safeUrl);
      } else {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  if (isDismissed) return null;

  const isFeed = placement === "product_feed";
  const wrapperClass = isFeed ? "guli-video-ad-feed" : "guli-video-ad-home";

  return (
    <>
      <div className={wrapperClass} ref={containerRef}>
        <div className={isFeed ? "guli-video-ad-feed-container" : "guli-video-ad-home-container"}>
          {/* Media Frame (Tapping opens Fullscreen Tolstoy-style Video Ad) */}
          <div
            className="guli-video-media-wrapper cursor-pointer"
            onClick={handleOpenFullscreen}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleOpenFullscreen(e as any);
              }
            }}
            aria-label="Videoni to‘liq ekranda ochish"
          >
            <div className="guli-video-badge">Reklama</div>

            {placement === "home" ? (
              <button
                type="button"
                className="guli-video-dismiss-btn"
                onClick={handleDismiss}
                title="Reklamani yopish"
                aria-label="Reklamani yopish"
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            ) : null}

            {/* Video or poster fallback */}
            {!hasError && ad.video_url && (
              <>
                <video
                  ref={videoRef}
                  src={ad.video_url}
                  poster={ad.poster_url || undefined}
                  className="guli-video-element"
                  playsInline
                  webkit-playsinline="true"
                  muted
                  loop
                  autoPlay
                  preload="auto"
                  onWaiting={() => {
                    setIsBuffering(true);
                    if (videoRef.current?.paused && !isDismissed && !isFullscreen) {
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  onCanPlay={() => {
                    setIsBuffering(false);
                    if (videoRef.current?.paused && !isDismissed && !isFullscreen) {
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  onPlaying={() => {
                    setIsBuffering(false);
                    setIsPaused(false);
                  }}
                  onPause={(e) => {
                    const v = e.currentTarget;
                    if (v.paused && !isDismissed && !isFullscreen) {
                      v.play().then(() => setIsPaused(false)).catch(() => setIsPaused(true));
                    } else {
                      setIsPaused(true);
                    }
                  }}
                  onError={() => {
                    setIsBuffering(false);
                    setIsPaused(true);
                    setHasError(true);
                  }}
                />
                {isPaused && !isBuffering && (
                  <div className="guli-video-card-play-overlay" aria-hidden="true">
                    <div className="guli-video-card-play-circle">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff" style={{ marginLeft: "2px" }}>
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                )}
                {isBuffering && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none transition-opacity"
                    aria-label="Video yuklanmoqda"
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-rose-500 animate-spin" />
                  </div>
                )}
              </>
            )}
            {(hasError || !ad.video_url) && ad.poster_url && (
              <img
                src={ad.poster_url}
                alt={ad.title}
                className="guli-video-poster"
                referrerPolicy="no-referrer"
              />
            )}
            {(hasError || !ad.video_url) && !ad.poster_url && (
              <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs">
                Guli Market Video
              </div>
            )}

          </div>

          {/* Content & Call to Action */}
          <div className="guli-video-content">
            <h3 className="guli-video-title">{ad.title}</h3>
            {ad.description && <p className="guli-video-desc">{ad.description}</p>}

            <button
              type="button"
              className="guli-video-cta-btn"
              onClick={handleCtaClick}
            >
              <span>{ad.cta_text || "Batafsil"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tolstoy-style Fullscreen Modal */}
      {isFullscreen && (
        <FullscreenVideoAdModal
          isOpen={isFullscreen}
          ad={ad}
          ads={galleryAds}
          onClose={handleCloseFullscreen}
          onOpenProduct={onOpenProduct}
          onNavigateUrl={onNavigateUrl}
        />
      )}
    </>
  );
};
