import React, { useEffect, useRef, useState } from "react";
import type { VideoAd } from "../../types/videoAd";
import { sanitizeDestinationUrl } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { detectPlatform } from "../../utils/platformAdapter";
import "./VideoAdCard.css";

interface VideoAdCardProps {
  ad: VideoAd;
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
  placement = "home",
  onOpenProduct,
  onNavigateUrl,
  onDismiss,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [impressionRecorded, setImpressionRecorded] = useState(false);

  // Check if ad was previously dismissed in this session
  useEffect(() => {
    try {
      const dismissedList = JSON.parse(sessionStorage.getItem("guli_dismissed_ads") || "[]");
      if (Array.isArray(dismissedList) && dismissedList.includes(ad.id)) {
        setIsDismissed(true);
      }
    } catch {}
  }, [ad.id]);

  // Video Autoplay & Intersection Observer
  useEffect(() => {
    if (isDismissed || hasError || !ad.video_url) return;

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

    const handlePlayAttempt = async () => {
      // Always start ads silently. Sound is enabled only after an explicit user action.
      video.muted = true;
      setIsMuted(true);
      try {
        await video.play();
        sendEvent("video_start");
      } catch {
        // Playback may still be blocked until the user interacts with the page.
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          handlePlayAttempt();

          // Dwell timer: record impression after 1.2s visible dwell
          if (!impressionRecorded) {
            dwellTimer = setTimeout(() => {
              setImpressionRecorded(true);
              sendEvent("impression");
            }, 1200);
          }
        } else {
          // Pause when scrolled out of view to save battery and network bandwidth
          if (video && !video.paused) {
            video.pause();
          }
          if (dwellTimer) {
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (dwellTimer) clearTimeout(dwellTimer);
    };
  }, [ad.id, ad.video_url, hasError, isDismissed, impressionRecorded]);

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);

    if (video.paused) {
      video.play().catch(() => {});
    }
  };

  const handleOpenFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    // A direct tap is a user gesture, so request audio and expand the whole ad card.
    video.muted = false;
    setIsMuted(false);
    setIsFullscreen(true);
    try {
      await video.play();
    } catch {
      // Keep the expanded player open; the sound toggle remains available below.
    }
  };

  const handleCloseFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(false);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try {
      const dismissedList = JSON.parse(sessionStorage.getItem("guli_dismissed_ads") || "[]");
      if (!dismissedList.includes(ad.id)) {
        dismissedList.push(ad.id);
        sessionStorage.setItem("guli_dismissed_ads", JSON.stringify(dismissedList));
      }
    } catch {}

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
    <div className={`${wrapperClass}${isFullscreen ? " guli-video-ad-fullscreen" : ""}`} ref={containerRef}>
      <div className={isFeed ? "guli-video-ad-feed-container" : "guli-video-ad-home-container"}>
        {/* Media column keeps sound control below, never over the video */}
        <div className="guli-video-media-column">
        <div className="guli-video-media-wrapper" onClick={handleOpenFullscreen}>
          <div className="guli-video-badge">Reklama</div>

          {isFullscreen && (
            <button type="button" className="guli-video-fullscreen-close" onClick={handleCloseFullscreen} aria-label="To‘liq ekrandan chiqish" title="Yopish">✕</button>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            className="guli-video-dismiss-btn"
            onClick={handleDismiss}
            title="Reklamani yopish"
            aria-label="Reklamani yopish"
          >
            ✕
          </button>

          {/* Video or poster fallback */}
          {!hasError && ad.video_url ? (
            <video
              ref={videoRef}
              src={ad.video_url}
              poster={ad.poster_url || undefined}
              className="guli-video-element"
              playsInline
              webkit-playsinline="true"
              loop
              preload="metadata"
              onError={() => setHasError(true)}
              onEnded={() => {
                // Track video complete
                try {
                  const apiBase = getApiBaseUrl();
                  fetch(`${apiBase}/api/video-ads/${ad.id}/events`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ event_type: "video_complete", session_id: getSessionId() }),
                  }).catch(() => {});
                } catch {}
              }}
            />
          ) : ad.poster_url ? (
            <img
              src={ad.poster_url}
              alt={ad.title}
              className="guli-video-poster"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs">
              Guli Market Video
            </div>
          )}

        </div>
        {!hasError && ad.video_url && (
          <div className="guli-video-sound-controls">
            <button
              type="button"
              className="guli-video-sound-btn"
              onClick={handleToggleSound}
              title={isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
              aria-label={isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
            >
              <span>{isMuted ? "🔇 Ovozni yoqish" : "🔊 Ovozni o‘chirish"}</span>
            </button>
          </div>
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
  );
};
