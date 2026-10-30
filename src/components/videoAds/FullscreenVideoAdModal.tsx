import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Play, ArrowRight } from "lucide-react";
import type { VideoAd } from "../../types/videoAd";
import { sanitizeDestinationUrl } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { detectPlatform } from "../../utils/platformAdapter";
import "./FullscreenVideoAdModal.css";

interface FullscreenVideoAdModalProps {
  isOpen: boolean;
  ad: VideoAd;
  ads?: VideoAd[];
  onClose: () => void;
  onOpenProduct?: (productId: string) => void;
  onNavigateUrl?: (url: string) => void;
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

export const FullscreenVideoAdModal: React.FC<FullscreenVideoAdModalProps> = ({
  isOpen, ad, ads, onClose, onOpenProduct, onNavigateUrl,
}) => {
  const gallery = ads?.length ? ads : [ad];
  const requestedIndex = Math.max(0, gallery.findIndex((item) => item.id === ad.id));
  const [currentIndex, setCurrentIndex] = useState(requestedIndex);
  const activeAd = gallery[Math.min(currentIndex, gallery.length - 1)] || ad;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const hasStartedRef = useRef(false);
  const retryCountRef = useRef(0);
  const endedWhileInfoOpenRef = useRef(false);

  const sendEvent = useCallback((eventType: "click" | "video_start" | "video_complete", targetAd = activeAd) => {
    try {
      const apiBase = getApiBaseUrl();
      const platform = detectPlatform().isTelegram ? "telegram" : "web";
      fetch(`${apiBase}/api/video-ads/${targetAd.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, session_id: getSessionId(), platform }),
      }).catch(() => {});
    } catch {}
  }, [activeAd]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= gallery.length) return;
    videoRef.current?.pause();
    setCurrentIndex(nextIndex);
    setProgress(0);
    setIsPaused(false);
    setIsInfoExpanded(false);
    setIsBuffering(true);
    retryCountRef.current = 0;
    endedWhileInfoOpenRef.current = false;
    hasStartedRef.current = false;
  }, [gallery.length]);

  const next = useCallback(() => {
    if (currentIndex < gallery.length - 1) goTo(currentIndex + 1);
    else onClose();
  }, [currentIndex, gallery.length, goTo, onClose]);

  const previous = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !isInfoExpanded) next();
      if (e.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
      videoRef.current?.pause();
    };
  }, [isOpen, onClose, next, previous]);

  // Each selected ad starts automatically with sound. Navigation is triggered by
  // an explicit swipe or by the previous video ending after the initial user tap.
  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setIsBuffering(video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
    let active = true;
    video.play().then(() => {
      if (!active) { video.pause(); return; }
      setIsPaused(false);
      setIsBuffering(false);
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        sendEvent("video_start", activeAd);
      }
    }).catch(() => {
      if (active) { setIsPaused(true); setIsBuffering(false); }
    });
    return () => {
      active = false;
      video.pause();
    };
  }, [isOpen, currentIndex, activeAd.id, sendEvent]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress(Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100)));
  };

  const handleStageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (suppressClick.current) { suppressClick.current = false; return; }
    const bounds = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - bounds.left;
    const zone = relativeX / Math.max(bounds.width, 1);
    if (zone < 0.33) {
      previous();
      return;
    }
    if (zone > 0.67) {
      if (!isInfoExpanded) next();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.muted = false;
      video.play().then(() => setIsPaused(false)).catch(() => setIsPaused(true));
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Own all story gestures so the storefront's page/category swipe cannot run.
    e.stopPropagation();
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!touchStart.current || isDismissing) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dy) > 85 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 450);
      if (dy > 0) {
        if (isInfoExpanded) {
          setIsInfoExpanded(false);
          if (endedWhileInfoOpenRef.current) {
            endedWhileInfoOpenRef.current = false;
            const video = videoRef.current;
            if (video) {
              video.currentTime = 0;
              video.play().then(() => { setIsPaused(false); setIsBuffering(false); }).catch(() => setIsPaused(true));
            }
          }
        } else {
          setIsDismissing(true);
          videoRef.current?.pause();
          window.setTimeout(() => onClose(), 260);
        }
      } else {
        setIsInfoExpanded(true);
      }
      return;
    }

    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 450);
      if (dx < 0) { if (!isInfoExpanded) next(); }
      else previous();
    }
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sendEvent("click", activeAd);
    videoRef.current?.pause();
    onClose();
    if (activeAd.product_id && onOpenProduct) {
      onOpenProduct(activeAd.product_id);
      return;
    }
    const safeUrl = sanitizeDestinationUrl(activeAd.destination_url);
    if (!safeUrl) return;
    if (onNavigateUrl) onNavigateUrl(safeUrl);
    else if (safeUrl.startsWith("/")) window.location.href = safeUrl;
    else {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openLink) tg.openLink(safeUrl);
      else window.open(safeUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    videoRef.current?.pause();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`guli-fullscreen-ad-overlay${isDismissing ? " guli-story-dismissing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={activeAd.title || "Video Reklama"}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="guli-fullscreen-ad-topbar">
        <div className="guli-fullscreen-gallery-progress" aria-label={`Reklama ${currentIndex + 1} / ${gallery.length}`}>
          {gallery.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className="guli-fullscreen-gallery-segment"
              onClick={() => goTo(index)}
              disabled={isInfoExpanded && index > currentIndex}
              aria-label={`${index + 1}-reklamaga o'tish`}
            >
              <span style={{ width: index < currentIndex ? "100%" : index === currentIndex ? `${progress}%` : "0%" }} />
            </button>
          ))}
        </div>
        <div className="guli-fullscreen-header-row">
          <div className="guli-story-account">
            <div className="guli-story-avatar">
              <img src="/guli-logo.webp" alt="Guli Market" />
            </div>
            <div className="guli-story-account-copy">
              <strong>Guli Market</strong>
              <span>Reklama · {currentIndex + 1}/{gallery.length}</span>
            </div>
          </div>
          <button type="button" className="guli-fullscreen-close-btn" onClick={handleClose} aria-label="Yopish" title="Yopish">
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="guli-fullscreen-video-stage" onClick={handleStageTap}>
        <video
          key={activeAd.id}
          ref={videoRef}
          src={activeAd.video_url}
          poster={activeAd.poster_url || undefined}
          className="guli-fullscreen-video-element"
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadStart={() => setIsBuffering(true)}
          onLoadedData={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => { setIsBuffering(false); setIsPaused(false); }}
          onError={() => {
            const video = videoRef.current;
            if (!video) return;
            if (retryCountRef.current < 1) {
              retryCountRef.current += 1;
              setIsBuffering(true);
              video.load();
              video.play().then(() => setIsPaused(false)).catch(() => { setIsBuffering(false); setIsPaused(true); });
            } else setIsBuffering(false);
          }}
          onEnded={() => {
            sendEvent("video_complete", activeAd);
            if (isInfoExpanded) endedWhileInfoOpenRef.current = true;
            else next();
          }}
        />
        {isBuffering && !isPaused && <div className="guli-fullscreen-buffering" aria-label="Video yuklanmoqda"><span /></div>}
        {isPaused && (
          <div className="guli-fullscreen-play-indicator" aria-hidden="true">
            <div className="guli-fullscreen-play-circle">
              <Play size={36} fill="#ffffff" color="#ffffff" className="translate-x-0.5" />
            </div>
          </div>
        )}
      </div>

      <div className={`guli-fullscreen-bottom-card${isInfoExpanded ? " guli-story-info-expanded" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="guli-fullscreen-card-inner">
          {activeAd.poster_url ? (
            <img src={activeAd.poster_url} alt={activeAd.title} className="guli-fullscreen-card-thumb" referrerPolicy="no-referrer" />
          ) : (
            <div className="guli-fullscreen-card-thumb-placeholder"><span>GULI</span></div>
          )}
          <div className="guli-fullscreen-card-info">
            <h4 className="guli-fullscreen-card-title">{activeAd.title}</h4>
            {activeAd.description && <p className="guli-fullscreen-card-desc">{activeAd.description}</p>}
          </div>
          <button type="button" className="guli-fullscreen-cta-btn" onClick={handleCtaClick}>
            <span>{activeAd.cta_text || "Batafsil"}</span><ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
