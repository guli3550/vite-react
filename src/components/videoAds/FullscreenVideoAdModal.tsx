import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Play, ArrowRight } from "lucide-react";
import type { VideoAd } from "../../types/videoAd";
import { sanitizeDestinationUrl } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { detectPlatform } from "../../utils/platformAdapter";
import "./FullscreenVideoAdModal.css";
import "./FullscreenVideoAdPlayer.css";

interface FullscreenVideoAdModalProps {
  isOpen: boolean;
  ad: VideoAd;
  ads?: VideoAd[];
  onClose: () => void;
  onOpenProduct?: (productId: string) => void;
  onNavigateUrl?: (url: string) => void;
}

type PlayResult = "ok" | "blocked" | "aborted";

const HAVE_FUTURE_DATA = 3;
const SPINNER_DELAY_MS = 250;
const STALL_RECOVERY_MS = 8000;
const MAX_RECOVERIES = 2;

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

function playSafely(video: HTMLVideoElement): Promise<PlayResult> {
  try {
    const promise = video.play();
    if (!promise || typeof promise.then !== "function") return Promise.resolve("ok");
    return promise.then(
      () => "ok" as PlayResult,
      (err: unknown) => ((err as { name?: string })?.name === "AbortError" ? "aborted" : "blocked") as PlayResult,
    );
  } catch {
    return Promise.resolve("blocked");
  }
}

export const FullscreenVideoAdModal: React.FC<FullscreenVideoAdModalProps> = ({
  isOpen, ad, ads, onClose, onOpenProduct, onNavigateUrl,
}) => {
  const gallery = useMemo(() => (ads?.length ? ads : [ad]), [ads, ad]);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, gallery.findIndex((item) => item.id === ad.id)),
  );
  const activeAd = gallery[Math.min(currentIndex, gallery.length - 1)] || ad;

  const [isPaused, setIsPaused] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  // One persistent <video>; only the active ad's source is ever attached to it.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Progress fills are updated directly on the DOM: no React state, no re-render.
  const segmentRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = useRef(0);
  const lastRatioRef = useRef(0);
  const currentIndexRef = useRef(currentIndex);
  const activeAdRef = useRef(activeAd);
  activeAdRef.current = activeAd;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const userPausedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const bufferingRef = useRef(true);
  const recoverCountRef = useRef(0);
  const resumeAtRef = useRef(0);
  const spinnerTimerRef = useRef(0);
  const stallTimerRef = useRef(0);
  const endedWhileInfoOpenRef = useRef(false);

  const setBuffering = useCallback((value: boolean) => {
    bufferingRef.current = value;
    setIsBuffering(value);
  }, []);

  const clearBufferTimers = useCallback(() => {
    if (spinnerTimerRef.current) { window.clearTimeout(spinnerTimerRef.current); spinnerTimerRef.current = 0; }
    if (stallTimerRef.current) { window.clearTimeout(stallTimerRef.current); stallTimerRef.current = 0; }
  }, []);

  // ---- Progress: the fill is a pure function of video.currentTime / duration ----
  const writeProgress = useCallback((force = false) => {
    const video = videoRef.current;
    const fill = segmentRefs.current[currentIndexRef.current];
    if (!video || !fill) return;
    const duration = video.duration;
    const ratio = Number.isFinite(duration) && duration > 0
      ? Math.min(1, Math.max(0, video.currentTime / duration))
      : 0;
    if (!force && Math.abs(ratio - lastRatioRef.current) < 0.0002) return;
    lastRatioRef.current = ratio;
    fill.style.transform = `scaleX(${ratio})`;
  }, []);

  const startProgressLoop = useCallback(() => {
    if (rafRef.current) return;
    const tick = () => {
      writeProgress();
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }, [writeProgress]);

  const stopProgressLoop = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  // Reset every segment before paint whenever the active ad changes.
  useLayoutEffect(() => {
    currentIndexRef.current = currentIndex;
    lastRatioRef.current = 0;
    segmentRefs.current.forEach((el, i) => {
      if (el) el.style.transform = i < currentIndex ? "scaleX(1)" : "scaleX(0)";
    });
  }, [currentIndex, gallery.length]);

  const sendEvent = useCallback((eventType: "click" | "video_start" | "video_complete", targetAd?: VideoAd) => {
    const target = targetAd || activeAdRef.current;
    try {
      const apiBase = getApiBaseUrl();
      const platform = detectPlatform().isTelegram ? "telegram" : "web";
      fetch(`${apiBase}/api/video-ads/${target.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, session_id: getSessionId(), platform }),
      }).catch(() => {});
    } catch {}
  }, []);

  // ---- Recovery: reload the same source and resume from the last good time ----
  const recover = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.getAttribute("src")) return;
    clearBufferTimers();
    if (recoverCountRef.current >= MAX_RECOVERIES) {
      setBuffering(false);
      userPausedRef.current = true;
      setIsPaused(true);
      return;
    }
    recoverCountRef.current += 1;
    resumeAtRef.current = video.currentTime || 0;
    setBuffering(true);
    video.load();
    void playSafely(video);
  }, [clearBufferTimers, setBuffering]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= gallery.length) return;
    const video = videoRef.current;
    if (nextIndex === currentIndexRef.current) {
      // Same story tapped again: restart it (state would not change, so the effect would not run).
      if (video) {
        video.currentTime = 0;
        userPausedRef.current = false;
        setIsPaused(false);
        void playSafely(video);
      }
      return;
    }
    video?.pause();
    setCurrentIndex(nextIndex);
    setIsPaused(false);
    setIsInfoExpanded(false);
    setBuffering(true);
    endedWhileInfoOpenRef.current = false;
  }, [gallery.length, setBuffering]);

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
    };
  }, [isOpen, isInfoExpanded, onClose, next, previous]);

  // Attach ONLY the active ad's source. Re-runs only when the ad itself changes
  // (not on parent re-renders), so playback is never restarted by React.
  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    hasStartedRef.current = false;
    recoverCountRef.current = 0;
    resumeAtRef.current = 0;
    userPausedRef.current = false;
    lastRatioRef.current = 0;
    clearBufferTimers();
    stopProgressLoop();
    setBuffering(true);
    setIsPaused(false);
    video.muted = false;
    video.src = activeAd.video_url;
    playSafely(video).then((result) => {
      if (cancelled) return;
      if (result === "blocked") {
        userPausedRef.current = true;
        setBuffering(false);
        setIsPaused(true);
      }
    });
    return () => {
      cancelled = true;
      clearBufferTimers();
      stopProgressLoop();
      video.pause();
    };
  }, [isOpen, activeAd.id, activeAd.video_url, clearBufferTimers, stopProgressLoop, setBuffering]);

  // Release the decoder and the network connection when the viewer closes.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [isOpen]);

  // Pause when the app goes to background (Android Chrome tab hidden / Telegram deactivated).
  useEffect(() => {
    if (!isOpen) return;
    let resume = false;
    const hide = () => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      resume = !userPausedRef.current;
      video.pause();
    };
    const show = () => {
      const video = videoRef.current;
      if (!video || !resume) return;
      resume = false;
      void playSafely(video);
    };
    const onVisibility = () => (document.hidden ? hide() : show());
    document.addEventListener("visibilitychange", onVisibility);
    const tg = (window as any).Telegram?.WebApp;
    tg?.onEvent?.("deactivated", hide);
    tg?.onEvent?.("activated", show);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      tg?.offEvent?.("deactivated", hide);
      tg?.offEvent?.("activated", show);
    };
  }, [isOpen]);

  // ---- <video> event handlers (state is only set on real transitions) ----
  const handleLoadStart = () => setBuffering(true);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (resumeAtRef.current > 0) {
      try { video.currentTime = resumeAtRef.current; } catch {}
      resumeAtRef.current = 0;
    }
    writeProgress(true);
  };

  const handleCanPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      clearBufferTimers();
      setBuffering(false);
    } else if (!userPausedRef.current && !video.ended) {
      void playSafely(video);
    }
  };

  const handlePlaying = () => {
    clearBufferTimers();
    setBuffering(false);
    setIsPaused(false);
    startProgressLoop();
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      sendEvent("video_start");
    }
  };

  const beginBufferingWatch = () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;
    // Short hiccups never flash a spinner; real stalls do, and get recovered.
    if (!spinnerTimerRef.current) {
      spinnerTimerRef.current = window.setTimeout(() => {
        spinnerTimerRef.current = 0;
        setBuffering(true);
      }, SPINNER_DELAY_MS);
    }
    if (!stallTimerRef.current) {
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = 0;
        const current = videoRef.current;
        if (current && !current.paused && current.readyState < HAVE_FUTURE_DATA) recover();
      }, STALL_RECOVERY_MS);
    }
  };

  const handleStalled = () => {
    const video = videoRef.current;
    if (video && video.readyState < HAVE_FUTURE_DATA) beginBufferingWatch();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    writeProgress();
    if (bufferingRef.current && !video.paused && video.readyState >= HAVE_FUTURE_DATA) {
      clearBufferTimers();
      setBuffering(false);
    }
  };

  const handlePause = () => {
    clearBufferTimers();
    stopProgressLoop();
    writeProgress(true);
  };

  const handleEnded = () => {
    clearBufferTimers();
    stopProgressLoop();
    writeProgress(true);
    setBuffering(false);
    sendEvent("video_complete");
    if (isInfoExpanded) endedWhileInfoOpenRef.current = true;
    else next();
  };

  const handleError = () => {
    const video = videoRef.current;
    if (!video || !video.getAttribute("src")) return;
    recover();
  };

  const handleStageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (suppressClick.current) { suppressClick.current = false; return; }
    const bounds = e.currentTarget.getBoundingClientRect();
    const zone = (e.clientX - bounds.left) / Math.max(bounds.width, 1);
    if (zone < 0.33) { previous(); return; }
    if (zone > 0.67) { if (!isInfoExpanded) next(); return; }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      video.muted = false;
      setIsPaused(false);
      playSafely(video).then((result) => {
        if (result === "blocked") { userPausedRef.current = true; setIsPaused(true); }
      });
    } else {
      userPausedRef.current = true;
      video.pause();
      setBuffering(false);
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
              userPausedRef.current = false;
              setIsPaused(false);
              void playSafely(video);
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
              <span ref={(el) => { segmentRefs.current[index] = el; }} />
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
          ref={videoRef}
          poster={activeAd.poster_url || undefined}
          className="guli-fullscreen-video-element"
          playsInline
          webkit-playsinline="true"
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onLoadStart={handleLoadStart}
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={() => writeProgress(true)}
          onSeeked={() => writeProgress(true)}
          onCanPlay={handleCanPlay}
          onPlaying={handlePlaying}
          onWaiting={beginBufferingWatch}
          onStalled={handleStalled}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onEmptied={stopProgressLoop}
          onError={handleError}
          onEnded={handleEnded}
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
