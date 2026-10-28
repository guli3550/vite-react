import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Play, ArrowRight, Volume2, VolumeX } from "lucide-react";
import type { VideoAd } from "../../types/videoAd";
import { sanitizeDestinationUrl } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { detectPlatform } from "../../utils/platformAdapter";
import "./FullscreenVideoAdModal.css";

interface FullscreenVideoAdModalProps {
  isOpen: boolean;
  ad: VideoAd;
  initialTime?: number;
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
  isOpen,
  ad,
  initialTime = 0,
  onClose,
  onOpenProduct,
  onNavigateUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  // Send analytics events
  const sendEvent = useCallback(
    (eventType: "click" | "video_start" | "video_complete") => {
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
    },
    [ad.id]
  );

  // Lock body scroll and handle keyboard ESC
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle video playback and unmuting on modal open (triggered by user gesture)
  useEffect(() => {
    if (!isOpen) return;

    const video = videoRef.current;
    if (!video) return;

    if (initialTime > 0) {
      try {
        video.currentTime = initialTime;
      } catch {}
    }

    // Direct user tap triggered full-screen -> request unmuted audio
    video.muted = false;
    setIsMuted(false);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPaused(false);
          setIsMuted(false);
          if (!hasStarted) {
            setHasStarted(true);
            sendEvent("video_start");
          }
        })
        .catch(() => {
          // If browser policy blocks sound despite user gesture, keep video playing muted
          video.muted = true;
          setIsMuted(true);
          video
            .play()
            .then(() => {
              setIsPaused(false);
              if (!hasStarted) {
                setHasStarted(true);
                sendEvent("video_start");
              }
            })
            .catch(() => {
              setIsPaused(true);
            });
        });
    }
  }, [isOpen, initialTime, hasStarted, sendEvent]);

  // Video time update -> progress bar
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const percent = Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100));
    setProgress(percent);
  };

  // Toggle play / pause on video click
  const handleTogglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Telegram Haptic feedback
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    if (video.paused) {
      // If video was muted due to policy, try unmuting on subsequent user tap
      if (video.muted) {
        video.muted = false;
        setIsMuted(false);
      }
      video
        .play()
        .then(() => setIsPaused(false))
        .catch(() => setIsPaused(true));
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  // Toggle sound if user taps the subtle audio indicator
  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Close full-screen
  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    if (videoRef.current) {
      videoRef.current.pause();
    }
    onClose();
  };

  // CTA Click
  const handleCtaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}

    sendEvent("click");

    // Close modal and navigate
    onClose();

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

  if (!isOpen) return null;

  return createPortal(
    <div
      className="guli-fullscreen-ad-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ad.title || "Video Reklama"}
    >
      {/* Top Bar with Story-like Progress Bar and Close Button */}
      <div className="guli-fullscreen-ad-topbar">
        {/* Progress bar line */}
        <div className="guli-fullscreen-progress-track">
          <div
            className="guli-fullscreen-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="guli-fullscreen-header-row">
          <div className="guli-fullscreen-badge-group">
            <span className="guli-fullscreen-badge">Reklama</span>
            <span className="guli-fullscreen-brand">Guli Market</span>
          </div>

          <div className="guli-fullscreen-actions">
            {/* Subtle sound toggle if muted */}
            <button
              type="button"
              className="guli-fullscreen-sound-pill"
              onClick={handleToggleSound}
              aria-label={isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
              title={isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Close button */}
            <button
              type="button"
              className="guli-fullscreen-close-btn"
              onClick={handleClose}
              aria-label="Yopish"
              title="Yopish"
            >
              <X size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Viewport (tappable to play/pause) */}
      <div
        className="guli-fullscreen-video-stage"
        onClick={handleTogglePlayPause}
      >
        <video
          ref={videoRef}
          src={ad.video_url}
          poster={ad.poster_url || undefined}
          className="guli-fullscreen-video-element"
          playsInline
          webkit-playsinline="true"
          loop
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            sendEvent("video_complete");
          }}
        />

        {/* Play Icon Overlay shown when paused */}
        {isPaused && (
          <div className="guli-fullscreen-play-indicator" aria-hidden="true">
            <div className="guli-fullscreen-play-circle">
              <Play size={36} fill="#ffffff" color="#ffffff" className="translate-x-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Tolstoy-style Bottom Product & Ad Card Overlay */}
      <div className="guli-fullscreen-bottom-card" onClick={(e) => e.stopPropagation()}>
        <div className="guli-fullscreen-card-inner">
          {/* Thumbnail / Poster */}
          {ad.poster_url ? (
            <img
              src={ad.poster_url}
              alt={ad.title}
              className="guli-fullscreen-card-thumb"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="guli-fullscreen-card-thumb-placeholder">
              <span>GULI</span>
            </div>
          )}

          {/* Title and Short Bio */}
          <div className="guli-fullscreen-card-info">
            <h4 className="guli-fullscreen-card-title">{ad.title}</h4>
            {ad.description && (
              <p className="guli-fullscreen-card-desc">{ad.description}</p>
            )}
          </div>

          {/* CTA Action Button */}
          <button
            type="button"
            className="guli-fullscreen-cta-btn"
            onClick={handleCtaClick}
          >
            <span>{ad.cta_text || "Batafsil"}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
