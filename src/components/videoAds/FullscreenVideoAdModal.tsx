import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight } from "lucide-react";
import type { VideoAd } from "../../types/videoAd";
import { sanitizeDestinationUrl } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { detectPlatform } from "../../utils/platformAdapter";
import { GULI_LOGO_BASE64 } from "../../utils/guliLogoBase64";
import "./FullscreenVideoAdModal.css";

interface FullscreenVideoAdModalProps {
  isOpen: boolean;
  ad: VideoAd;
  ads?: VideoAd[];
  onClose: () => void;
  onOpenProduct?: (productId: string) => void;
  onNavigateUrl?: (url: string) => void;
  onOpenBrandProfile?: () => void;
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
  isOpen, ad, ads, onClose, onOpenProduct, onNavigateUrl, onOpenBrandProfile,
}) => {
  const gallery = ads?.length ? ads : [ad];
  const requestedIndex = Math.max(0, gallery.findIndex((item) => item.id === ad.id));
  const [currentIndex, setCurrentIndex] = useState(requestedIndex);
  const activeAd = gallery[Math.min(currentIndex, gallery.length - 1)] || ad;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const progressFillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const progressRafRef = useRef<number | null>(null);

  const stopProgressLoop = useCallback(() => {
    if (progressRafRef.current !== null) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const startProgressLoop = useCallback(() => {
    stopProgressLoop();
    const paint = () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || !Number.isFinite(video.duration) || video.duration <= 0) {
        progressRafRef.current = null;
        return;
      }
      const fill = progressFillRefs.current[currentIndex];
      if (fill) {
        const scale = Math.min(1, Math.max(0, video.currentTime / video.duration));
        fill.style.transform = `scaleX(${scale})`;
      }
      progressRafRef.current = requestAnimationFrame(paint);
    };
    progressRafRef.current = requestAnimationFrame(paint);
  }, [currentIndex, stopProgressLoop]);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showPlayIndicator, setShowPlayIndicator] = useState(false);
  const playIndicatorTimerRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const retryCountRef = useRef(0);
  const endedWhileInfoOpenRef = useRef(false);
  // Distinguish a customer's deliberate pause from a mobile browser/WebView
  // pausing the media element while it is buffering or changing visibility.
  const userPausedRef = useRef(false);

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    videoRef.current?.pause();
    onClose();
    if (onOpenBrandProfile) {
      onOpenBrandProfile();
    } else if (onNavigateUrl) {
      onNavigateUrl("/profile/guli-market");
    } else {
      const globalNav = (window as any).openGuliBrandProfile;
      if (typeof globalNav === "function") {
        globalNav();
      } else {
        window.location.href = "/profile/guli-market";
      }
    }
  };

  const sendEvent = useCallback((eventType: "click" | "video_start" | "video_complete", targetAdId = activeAd.id) => {
    try {
      const apiBase = getApiBaseUrl();
      const platform = detectPlatform().isTelegram ? "telegram" : "web";
      fetch(`${apiBase}/api/video-ads/${targetAdId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, session_id: getSessionId(), platform }),
      }).catch(() => {});
    } catch {}
  }, [activeAd.id]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= gallery.length) return;
    userPausedRef.current = false;
    setIsPaused(false);
    setShowPlayIndicator(false);
    stopProgressLoop();
    videoRef.current?.pause();
    setCurrentIndex(nextIndex);
    progressFillRefs.current.forEach((fill, index) => {
      if (fill) fill.style.transform = `scaleX(${index < nextIndex ? 1 : 0})`;
    });
    setIsInfoExpanded(false);
    setIsBuffering(true);
    retryCountRef.current = 0;
    endedWhileInfoOpenRef.current = false;
    hasStartedRef.current = false;
  }, [gallery.length, stopProgressLoop]);

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
      if (e.key === " ") {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          if (playIndicatorTimerRef.current) clearTimeout(playIndicatorTimerRef.current);
          if (video.paused) {
            userPausedRef.current = false;
            video.play().then(() => setIsPaused(false)).catch(() => {});
            setIsPaused(false);
            setShowPlayIndicator(true);
            playIndicatorTimerRef.current = window.setTimeout(() => setShowPlayIndicator(false), 600);
          } else {
            userPausedRef.current = true;
            video.pause();
            setIsPaused(true);
            setShowPlayIndicator(false);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
      stopProgressLoop();
      videoRef.current?.pause();
      if (playIndicatorTimerRef.current) clearTimeout(playIndicatorTimerRef.current);
    };
  }, [isOpen, onClose, next, previous, stopProgressLoop]);

  // Each selected ad starts automatically with sound. Navigation is triggered by
  // an explicit swipe or by the previous video ending after the initial user tap.
  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;
    userPausedRef.current = false;
    setIsPaused(false);
    video.muted = false;
    let active = true;
    video.play()
      .then(() => {
        if (!active) { video.pause(); return; }
        setIsBuffering(false);
        setIsPaused(false);
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          sendEvent("video_start", activeAd.id);
        }
      })
      .catch(() => {
        // Fallback to muted playback if browser policy blocks unmuted auto-play, matching Reels
        if (active) {
          video.muted = true;
          video.play()
            .then(() => {
              if (!active) { video.pause(); return; }
              setIsBuffering(false);
              setIsPaused(false);
              const unmute = () => {
                if (videoRef.current) videoRef.current.muted = false;
                window.removeEventListener("touchstart", unmute);
                window.removeEventListener("click", unmute);
              };
              window.addEventListener("touchstart", unmute, { once: true });
              window.addEventListener("click", unmute, { once: true });
            })
            .catch(() => {
              setIsBuffering(false);
            });
        }
      });
    return () => {
      active = false;
      video.pause();
    };
  }, [isOpen, currentIndex, activeAd.id, sendEvent]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    // Keep a final exact update for seeks/ended events; RAF paints smoothly while playing.
    const fill = progressFillRefs.current[currentIndex];
    if (fill) {
      const scale = Math.min(1, Math.max(0, video.currentTime / video.duration));
      fill.style.transform = `scaleX(${scale})`;
    }
  };

  const handleStageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (suppressClick.current) { suppressClick.current = false; return; }
    const bounds = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - bounds.left;
    const zone = relativeX / Math.max(bounds.width, 1);
    if (zone < 0.28) {
      previous();
      return;
    }
    if (zone > 0.72) {
      if (!isInfoExpanded) next();
      return;
    }

    // Center zone: Toggle Play / Pause!
    const video = videoRef.current;
    if (video) {
      if (playIndicatorTimerRef.current) clearTimeout(playIndicatorTimerRef.current);
      if (video.paused) {
        userPausedRef.current = false;
        video.muted = false;
        video.play().then(() => setIsPaused(false)).catch(() => {});
        setIsPaused(false);
        setShowPlayIndicator(true);
        playIndicatorTimerRef.current = window.setTimeout(() => {
          setShowPlayIndicator(false);
        }, 600);
      } else {
        userPausedRef.current = true;
        video.pause();
        setIsPaused(true);
        setShowPlayIndicator(false);
      }
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

    if (Math.hypot(dx, dy) > 12) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 400);
    }

    if (Math.abs(dy) > 85 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      if (dy > 0) {
        if (isInfoExpanded) {
          setIsInfoExpanded(false);
          if (endedWhileInfoOpenRef.current) {
            endedWhileInfoOpenRef.current = false;
            const video = videoRef.current;
            if (video) {
              video.currentTime = 0;
              video.play().then(() => { setIsBuffering(false); }).catch(() => {});
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
    sendEvent("click", activeAd.id);
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
              <span
                ref={(element) => { progressFillRefs.current[index] = element; }}
                style={{ width: "100%", transform: index < currentIndex ? "scaleX(1)" : "scaleX(0)" }}
              />
            </button>
          ))}
        </div>
        <div className="guli-fullscreen-header-row">
          <div
            className="guli-story-account"
            onClick={handleProfileClick}
            style={{ cursor: "pointer" }}
            title="Guli Market profil sahifasiga o'tish"
          >
            <div className="guli-story-avatar">
              <img
                src="/guli-logo.png"
                alt="Guli Market"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = GULI_LOGO_BASE64;
                }}
              />
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
          autoPlay
          onTimeUpdate={handleTimeUpdate}
          onWaiting={() => {
            setIsBuffering(true);
            if (!userPausedRef.current && videoRef.current?.paused) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onCanPlay={() => {
            setIsBuffering(false);
            if (!userPausedRef.current && videoRef.current?.paused) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPaused(false);
            startProgressLoop();
          }}
          onPause={(e) => {
            const v = e.currentTarget;
            if (!userPausedRef.current && isOpen && v.paused) {
              v.play().catch(() => {});
            } else {
              setIsPaused(true);
            }
          }}
          onEnded={() => {
            sendEvent("video_complete", activeAd.id);
            if (!userPausedRef.current) {
              if (!isInfoExpanded && gallery.length > 1) {
                // Auto-advance to the next ad video when 2+ videos exist and bio is not expanded
                const nextIndex = (currentIndex + 1) % gallery.length;
                goTo(nextIndex);
              } else {
                if (isInfoExpanded) {
                  endedWhileInfoOpenRef.current = true;
                }
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }
            }
          }}
          onError={() => {
            stopProgressLoop();
            setIsBuffering(false);
          }}
        />
        {(showPlayIndicator || isPaused) && (
          <div
            className={`guli-fullscreen-play-indicator${!isPaused && showPlayIndicator ? " guli-play-flash" : ""}`}
            aria-hidden="true"
          >
            <div className="guli-fullscreen-play-circle">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#ffffff" style={{ marginLeft: "3px" }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        )}
        {isBuffering && <div className="guli-fullscreen-buffering" aria-label="Video yuklanmoqda"><span /></div>}
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
