import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ReelItem, ReelComment } from "../../types/reels";
import { loadReelsFromStorage } from "../../data/demoReels";
import { fetchPublicReels, toggleServerReelLike, addServerReelComment, recordServerReelView } from "../../lib/reelsApi";
import {
  isIndexPreloaded,
  evaluateSwipeGesture,
  calculateVideoProgress,
} from "../../utils/reelsEngine";
import { ReelsCommentsModal } from "./ReelsCommentsModal";
import { ReelsShareModal } from "./ReelsShareModal";
import { isInstagramUrl, extractInstagramShortcode } from "../../utils/instagramFetcher";
import "./Reels.css";

const REELS_CYCLE_STORAGE_KEY = "guli_reels_cycle_v1";

type ReelsCycleState = { seenIds: string[]; orderIds: string[] };

function readReelsCycleState(): ReelsCycleState {
  try {
    const raw = localStorage.getItem(REELS_CYCLE_STORAGE_KEY);
    if (!raw) return { seenIds: [], orderIds: [] };
    const parsed = JSON.parse(raw) as Partial<ReelsCycleState>;
    return {
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds.filter((id): id is string => typeof id === "string") : [],
      orderIds: Array.isArray(parsed.orderIds) ? parsed.orderIds.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return { seenIds: [], orderIds: [] };
  }
}

function saveReelsCycleState(state: ReelsCycleState): void {
  try { localStorage.setItem(REELS_CYCLE_STORAGE_KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
}

function shuffledIds(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function prepareReelsCycle(active: ReelItem[]): { reels: ReelItem[]; startIndex: number } {
  const byId = new Map(active.map((reel) => [reel.id, reel]));
  const activeIds = active.map((reel) => reel.id);
  let state = readReelsCycleState();
  let seenIds = state.seenIds.filter((id) => byId.has(id));
  const seen = new Set(seenIds);
  let orderIds = state.orderIds.filter((id) => byId.has(id));
  const orderedSet = new Set(orderIds);
  const newIds = activeIds.filter((id) => !orderedSet.has(id));
  orderIds = [...orderIds, ...shuffledIds(newIds)];

  // Start a fresh shuffled cycle only after every currently active Reel was seen.
  if (activeIds.length > 0 && activeIds.every((id) => seen.has(id))) {
    seenIds = [];
    orderIds = shuffledIds(activeIds);
  }

  // Recover gracefully if saved ordering was empty or stale.
  if (orderIds.length !== activeIds.length) orderIds = [...orderIds, ...shuffledIds(activeIds.filter((id) => !orderIds.includes(id)))];
  state = { seenIds, orderIds };
  saveReelsCycleState(state);

  const orderedReels = orderIds.map((id) => byId.get(id)).filter((reel): reel is ReelItem => Boolean(reel));
  const firstUnseen = orderedReels.findIndex((reel) => !new Set(seenIds).has(reel.id));
  return { reels: orderedReels, startIndex: firstUnseen >= 0 ? firstUnseen : 0 };
}

function markReelSeen(reelId: string): void {
  const state = readReelsCycleState();
  if (!state.seenIds.includes(reelId)) {
    state.seenIds.push(reelId);
    saveReelsCycleState(state);
  }
}

interface ReelsFeedProps {
  onBack?: () => void;
  onOpenProduct?: (productId: string | number) => void;
  onNavigateToCatalog?: () => void;
  onOpenBrandProfile?: () => void;
  initialReelId?: string;
  initialIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  onBack,
  onOpenProduct,
  onNavigateToCatalog,
  onOpenBrandProfile,
  initialReelId,
  initialIndex,
  onActiveIndexChange,
}) => {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<Record<string, boolean>>({});
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Big popping heart on double-tap
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Modals
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Centered modern Play/Pause animated overlay
  const [playPauseIndicator, setPlayPauseIndicator] = useState<{
    type: "play" | "pause";
    id: number;
  } | null>(null);

  // Swipe / Drag state for continuous peek transition
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isSwipingVertically = useRef<boolean | null>(null);
  const wheelLockRef = useRef<boolean>(false);

  // Video element references map
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Load published Reels from the shared server source; local demo data is development-only.
  const reloadReels = useCallback(async () => {
    setIsFeedLoading(true);
    setFeedError(null);
    try {
      const all = await fetchPublicReels();
      const active = all.filter((r) => r.status === "active" && Boolean(r.videoUrl));
      const cycle = prepareReelsCycle(active);
      let list = cycle.reels;
      let startIdx = cycle.startIndex;

      if (initialReelId) {
        const found = list.findIndex((r) => r.id === initialReelId);
        if (found !== -1) startIdx = found;
      } else if (typeof initialIndex === "number" && initialIndex >= 0 && initialIndex < list.length) {
        startIdx = initialIndex;
      }

      setReels(list);
      setCurrentIndex(startIdx);
    } catch (error) {
      console.error("[Reels] Published server feed could not be loaded:", error);
      if (!import.meta.env.PROD) {
        const active = loadReelsFromStorage().filter((r) => r.status === "active");
        const cycle = prepareReelsCycle(active);
        setReels(cycle.reels);
        setCurrentIndex(cycle.startIndex);
      } else {
        setReels([]);
        setFeedError("Reels serveriga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.");
      }
    } finally {
      setIsFeedLoading(false);
    }
  }, [initialReelId, initialIndex]);

  useEffect(() => {
    onActiveIndexChange?.(currentIndex);
  }, [currentIndex, onActiveIndexChange]);

  useEffect(() => {
    reloadReels();

    const handleStorageChange = () => {
      reloadReels();
    };

    window.addEventListener("storage", handleStorageChange as EventListener);
    window.addEventListener("guli_reels_updated", handleStorageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange as EventListener);
      window.removeEventListener("guli_reels_updated", handleStorageChange as EventListener);
    };
  }, [reloadReels]);

  const currentReel = reels[currentIndex];
  const viewedReelIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentReel || viewedReelIdsRef.current.has(currentReel.id)) return;
    viewedReelIdsRef.current.add(currentReel.id);
    markReelSeen(currentReel.id);
    recordServerReelView(currentReel.id)
      .then(({ viewsCount }) => {
        setReels((previous) => previous.map((r) => r.id === currentReel.id ? { ...r, viewsCount } : r));
      })
      .catch((error) => console.warn("[Reels] View count was not saved:", error));
  }, [currentReel?.id]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const toggleMute = useCallback(() => {
    if (!currentReel) return;
    const activeVideo = videoRefs.current.get(currentReel.id);
    if (!activeVideo) return;
    const nextMuted = !activeVideo.muted;
    activeVideo.muted = nextMuted;
    setIsMuted(nextMuted);
    showToast(nextMuted ? "🔇 Ovoz o‘chirildi" : "🔊 Ovoz yoqildi");
  }, [currentReel, showToast]);

  // Manage video playback when currentIndex changes
  useEffect(() => {
    setIsLoadingVideo(true);
    setVideoProgress(0);
    setIsPlaying(true);
    setCaptionExpanded(false);

    // Pause all other videos
    videoRefs.current.forEach((videoEl, id) => {
      if (!currentReel || id !== currentReel.id) {
        videoEl.pause();
      }
    });

    if (currentReel && isInstagramUrl(currentReel.videoUrl)) {
      // Instagram's own embed player controls playback; it is not an HTML5 MP4.
      setIsLoadingVideo(false);
      setIsPlaying(true);
      return;
    }

    if (currentReel) {
      const activeVideo = videoRefs.current.get(currentReel.id);
      if (activeVideo) {
        activeVideo.currentTime = 0;
        // User requested: reels ga kirish bilan video avtomatik ovozli rejimda bo'lsin
        activeVideo.muted = isMuted;
        const playPromise = activeVideo.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsLoadingVideo(false);
              setIsPlaying(true);
            })
            .catch(() => {
              // Browser autoplay policy might restrict unmuted audio before user interaction
              // Fallback to muted playback so video runs, then unmute on first gesture
              activeVideo.muted = true;
              activeVideo
                .play()
                .then(() => {
                  setIsLoadingVideo(false);
                  setIsPlaying(true);
                  const unmuteOnInteraction = () => {
                    activeVideo.muted = false;
                    setIsMuted(false);
                    window.removeEventListener("touchstart", unmuteOnInteraction);
                    window.removeEventListener("click", unmuteOnInteraction);
                  };
                  window.addEventListener("touchstart", unmuteOnInteraction, { once: true });
                  window.addEventListener("click", unmuteOnInteraction, { once: true });
                })
                .catch(() => {
                  setIsPlaying(false);
                  setIsLoadingVideo(false);
                });
            });
        }
      }
    }
  // Depend on the reel identity, not the whole object: view-count updates must
  // not restart playback from time zero.
  }, [currentIndex, currentReel?.id]);

  // Navigate between reels
  const goToReel = useCallback(
    (index: number) => {
      if (index >= 0 && index < reels.length) {
        setCurrentIndex(index);
      }
    },
    [reels.length]
  );

  const goNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      goToReel(currentIndex + 1);
    } else {
      showToast("Barcha Reels videolari ko‘rib chiqildi 💫");
    }
  }, [currentIndex, reels.length, goToReel, showToast]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      goToReel(currentIndex - 1);
    }
  }, [currentIndex, goToReel]);

  // Trigger Play / Pause indicator animation
  const triggerPlayPauseOverlay = useCallback((type: "play" | "pause") => {
    setPlayPauseIndicator({ type, id: Date.now() });
    setTimeout(() => {
      setPlayPauseIndicator((prev) => (prev && Date.now() - prev.id >= 450 ? null : prev));
    }, 500);
  }, []);

  // Toggle Play / Pause for the active video
  const togglePlayPause = useCallback(() => {
    if (!currentReel) return;
    const activeVideo = videoRefs.current.get(currentReel.id);
    if (!activeVideo) return;

    if (activeVideo.paused) {
      activeVideo
        .play()
        .then(() => {
          setIsPlaying(true);
          triggerPlayPauseOverlay("play");
        })
        .catch(() => {});
    } else {
      activeVideo.pause();
      setIsPlaying(false);
      triggerPlayPauseOverlay("pause");
    }
  }, [currentReel, triggerPlayPauseOverlay]);

  // Handle Touch gestures with live drag preview
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isSwipingVertically.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - touchStartY.current;
    const diffX = currentX - touchStartX.current;

    // Detect gesture direction on initial threshold
    if (isSwipingVertically.current === null) {
      if (Math.abs(diffY) > 6 || Math.abs(diffX) > 6) {
        isSwipingVertically.current = Math.abs(diffY) > Math.abs(diffX);
      }
    }

    if (isSwipingVertically.current) {
      // Resistance at boundaries
      if (
        (currentIndex === 0 && diffY > 0) ||
        (currentIndex === reels.length - 1 && diffY < 0)
      ) {
        setDragOffsetY(diffY * 0.3);
      } else {
        setDragOffsetY(diffY);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const deltaY = -dragOffsetY; // positive = dragged UP
    const decision = evaluateSwipeGesture(deltaY, 45);

    if (decision === "next" && currentIndex < reels.length - 1) {
      goNext();
    } else if (decision === "prev" && currentIndex > 0) {
      goPrev();
    }

    setDragOffsetY(0);
    touchStartY.current = 0;
    touchStartX.current = 0;
    isSwipingVertically.current = null;
  };

  // Wheel / Touchpad scroll handling with debounce
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isCommentsOpen || isShareOpen || wheelLockRef.current) return;
      if (Math.abs(e.deltaY) > 35) {
        wheelLockRef.current = true;
        if (e.deltaY > 0) {
          goNext();
        } else {
          goPrev();
        }
        setTimeout(() => {
          wheelLockRef.current = false;
        }, 400);
      }
    },
    [goNext, goPrev, isCommentsOpen, isShareOpen]
  );

  // Keyboard navigation: ArrowUp, ArrowDown, Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentsOpen || isShareOpen) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, isCommentsOpen, isShareOpen, togglePlayPause]);

  // Video time update for progress bar
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (videoEl && videoEl.duration) {
      const progress = calculateVideoProgress(videoEl.currentTime, videoEl.duration);
      setVideoProgress(progress);
    }
  };

  // Persist likes against the shared Reels record.
  const handleToggleLike = useCallback(async () => {
    if (!currentReel) return;
    try {
      const result = await toggleServerReelLike(currentReel.id);
      setReels((previous) => previous.map((r) => r.id === currentReel.id
        ? { ...r, isLiked: result.isLiked, likesCount: result.likesCount }
        : r));
      if (result.isLiked) showToast("❤️ Sizga yoqdi");
    } catch (error) {
      console.error("[Reels] Like was not saved:", error);
      showToast("Like saqlanmadi. Server aloqasini tekshiring.");
    }
  }, [currentReel, showToast]);

  // Video tap handler (Single tap: Play/Pause with animated overlay; Double tap: Like)
  const handleVideoTap = () => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;

    if (timeDiff < 280) {
      // Double tap detected -> Like reel!
      if (currentReel && !currentReel.isLiked) {
        handleToggleLike();
      }
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (Date.now() - lastTapRef.current >= 260 && lastTapRef.current !== 0) {
          togglePlayPause();
          lastTapRef.current = 0;
        }
      }, 270);
    }
  };

  // Save comments to the shared Reels database.
  const handleAddComment = async (reelId: string, newComment: ReelComment) => {
    try {
      const saved = await addServerReelComment(reelId, newComment.text);
      setReels((previous) => previous.map((r) => r.id === reelId
        ? { ...r, commentsCount: r.commentsCount + 1, comments: [saved, ...(r.comments || [])] }
        : r));
      showToast("✓ Izoh serverda saqlandi!");
    } catch (error) {
      console.error("[Reels] Comment was not saved:", error);
      showToast("Izoh yuborilmadi. Server aloqasini tekshiring.");
    }
  };

  // Never replace a failed reel with an unrelated sample video.
  const handleVideoError = (id: string) => {
    setVideoError((prev) => ({ ...prev, [id]: true }));
    setIsLoadingVideo(false);
  };

  // Retry loading video
  const handleRetryVideo = (reelId: string) => {
    setVideoError((prev) => ({ ...prev, [reelId]: false }));
    setIsLoadingVideo(true);
    const videoEl = videoRefs.current.get(reelId);
    if (videoEl) {
      videoEl.load();
      videoEl.play().catch(() => {});
    }
  };

  // Empty State View
  if (reels.length === 0) {
    return (
      <main className="reelsContainer reelsEmptyView">
        <div className="reelsEmptyContent">
          <div className="reelsEmptyIcon">🎬</div>
          <h2 className="reelsEmptyTitle">Hozircha faol Reels yo‘q</h2>
          <p className="reelsEmptySubtitle">
            Admin panel orqali yangi video reklama va Reels roliklarini qo‘shishingiz mumkin.
          </p>
          <div className="reelsEmptyActions">
            {onBack && (
              <button
                type="button"
                className="reelsBtnSecondary"
                onClick={onBack}
              >
                🏠 Bosh sahifaga qaytish
              </button>
            )}
            {onNavigateToCatalog && (
              <button
                type="button"
                className="reelsBtnPrimary"
                onClick={onNavigateToCatalog}
              >
                👗 Katalogga o‘tish
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Preload window calculation: active index + next 2 reels (and prev 1 if available)
  // All other videos are unmounted or render poster only to conserve mobile data.
  const trackTranslateStyle = {
    transform: `translate3d(0, calc(-${currentIndex * 100}% + ${dragOffsetY}px), 0)`,
    transition: isDragging ? "none" : "transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <main
      className="reelsContainer"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      aria-label="Guli Market Reels video lentasi"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="reelsToast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {/* Main Viewport */}
      <div className="reelsViewport">
        {/* Top Bar Overlay */}
        <header className="reelsTopBar">
          <button
            type="button"
            className="reelsTopBrandBadge"
            onClick={(e) => {
              e.stopPropagation();
              onOpenBrandProfile?.();
            }}
            aria-label="Guli Market profil sahifasini ochish"
            title="Guli Market rasmiy profili"
          >
            <div className="reelsTopBrandLogoWrap">
              <img
                src="/guli-logo.png"
                alt="Guli Market"
                className="reelsTopBrandLogo"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/guli-logo.webp";
                }}
              />
            </div>
            <span className="reelsTopBrandTitle">Guli Market</span>
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="#0095f6"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.8-4.2-4.2 1.41-1.41 2.79 2.79 6.29-6.29 1.41 1.41-7.7 7.7z" />
            </svg>
          </button>

          <div className="reelsTopControls">
            {onBack && (
              <button
                type="button"
                className="reelsTopIconBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  onBack();
                }}
                aria-label="Orqaga qaytish"
                title="Orqaga"
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {/* Vertical Sliding Reel Track for Continuous Instagram-Style Gestures */}
        <div className="reelsTrack" style={trackTranslateStyle}>
          {reels.map((reel, index) => {
            const isActive = index === currentIndex;
            const isPreloaded = isIndexPreloaded(index, currentIndex, reels.length, 2, 1);
            const hasError = videoError[reel.id];

            return (
              <div
                key={reel.id}
                className={`reelsSlide ${isActive ? "active" : ""}`}
                style={{ top: `${index * 100}%` }}
              >
                {/* Media area */}
                <div
                  className="reelsMediaWrap"
                  onClick={isActive ? (isInstagramUrl(reel.videoUrl) ? undefined : handleVideoTap) : () => goToReel(index)}
                >
                  {/* Poster Image */}
                  <img
                    src={reel.posterUrl}
                    alt={reel.caption}
                    className={`reelsPoster ${
                      isActive && !hasError && isPlaying ? "hiddenBehindVideo" : ""
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=900&q=80";
                    }}
                  />

                  {/* HTML5 Video Player: Preload metadata for active + next 2 reels */}
                  {isPreloaded && !hasError && reel.videoUrl && (
                    isInstagramUrl(reel.videoUrl) ? (
                      <iframe
                        src={"https://www.instagram.com/reel/" + extractInstagramShortcode(reel.videoUrl) + "/embed/"}
                        title={"Instagram Reels: " + reel.caption}
                        className="reelsVideoElement"
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{ width: "100%", height: "100%", border: 0, background: "#000" }}
                      />
                    ) : (
                      <video
                        ref={(el) => {
                          if (el) {
                            videoRefs.current.set(reel.id, el);
                            if (isActive && el.paused && isPlaying) el.play().catch(() => {});
                          } else {
                            videoRefs.current.delete(reel.id);
                          }
                        }}
                        src={reel.videoUrl}
                        poster={reel.posterUrl}
                        className="reelsVideoElement"
                        playsInline
                        loop
                        muted={isMuted}
                        preload="metadata"
                        onTimeUpdate={isActive ? handleTimeUpdate : undefined}
                        onWaiting={isActive ? () => setIsLoadingVideo(true) : undefined}
                        onPlaying={isActive ? () => setIsLoadingVideo(false) : undefined}
                        onError={() => handleVideoError(reel.id)}
                      />
                    )
                  )}

                  {/* Loading Spinner for active reel */}
                  {isActive && isLoadingVideo && !hasError && (
                    <div className="reelsLoadingSpinner">
                      <div className="reelsSpinnerCircle" />
                    </div>
                  )}

                  {/* Centered Modern Play/Pause Animated Overlay */}
                  {isActive && playPauseIndicator && (
                    <div
                      key={playPauseIndicator.id}
                      className="reelsPlayPausePopup"
                      aria-hidden="true"
                    >
                      <div className="reelsPlayPauseBubble">
                        <span>{playPauseIndicator.type === "play" ? "▶" : "⏸"}</span>
                      </div>
                    </div>
                  )}

                  {/* Big Heart on Double Tap */}
                  {isActive && showHeartAnim && (
                    <div className="reelsDoubleTapHeart" aria-hidden="true">
                      <span>❤️</span>
                    </div>
                  )}

                  {/* Video Loading Error with Retry */}
                  {hasError && (
                    <div className="reelsErrorOverlay">
                      <span className="reelsErrorIcon">⚠️</span>
                      <p className="reelsErrorText">Video yuklanmadi</p>
                      <button
                        type="button"
                        className="reelsRetryBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryVideo(reel.id);
                        }}
                      >
                        Qayta urinish
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Action Column */}
                <aside className="reelsActionBar" aria-label="Amallar">
                  {/* Like Button */}
                  <button
                    type="button"
                    className={`reelsActionBtn ${reel.isLiked ? "liked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isActive) {
                        handleToggleLike();
                      } else {
                        goToReel(index);
                      }
                    }}
                    aria-label={reel.isLiked ? "Like bekor qilish" : "Like bosish"}
                  >
                    <div className="reelsActionIconCircle">
                      <span className="reelsActionIcon">
                        {reel.isLiked ? "❤️" : "🤍"}
                      </span>
                    </div>
                    <span className="reelsActionCount">
                      {(reel.likesCount + (reel.displayLikesCount || 0)).toLocaleString("uz-UZ")}
                    </span>

                  </button>

                  {/* Comments Button */}
                  <button
                    type="button"
                    className="reelsActionBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isActive) goToReel(index);
                      setIsCommentsOpen(true);
                    }}
                    aria-label="Izohlarni ochish"
                  >
                    <div className="reelsActionIconCircle">
                      <span className="reelsActionIcon">💬</span>
                    </div>
                    <span className="reelsActionCount">
                      {reel.comments.length || reel.commentsCount}
                    </span>
                  </button>

                  {/* Share Button: Modern Instagram/Telegram paper plane send button */}
                  <button
                    type="button"
                    className="reelsActionBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isActive) goToReel(index);
                      setIsShareOpen(true);
                    }}
                    aria-label="Ulashish"
                  >
                    <div className="reelsActionIconCircle">
                      <svg
                        className="reelsShareSendIcon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </div>
                    <span className="reelsActionCount">
                      {reel.sharesCount}
                    </span>
                  </button>

                  {/* Spinning Audio Disc with Sound Toggle */}
                  <div
                    className={`reelsMusicDisc ${isActive && isPlaying ? "spinning" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    title={isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
                    role="button"
                    tabIndex={0}
                    aria-label={isMuted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
                  >
                    <span className="reelsMusicDiscIcon">{isMuted ? "🔇" : "🎵"}</span>
                  </div>
                </aside>

                {/* Bottom Overlay: Caption, Author info, Product link */}
                <div className="reelsBottomOverlay">
                  {/* Attached Product Pill */}
                  {reel.productName && (
                    <div
                      className="reelsProductPill"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (reel.productId && onOpenProduct) {
                          onOpenProduct(reel.productId);
                        } else if (onNavigateToCatalog) {
                          onNavigateToCatalog();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="reelsProductThumbWrap">
                        <img
                          src={
                            reel.productImage ||
                            "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=120&q=80"
                          }
                          alt={reel.productName}
                          className="reelsProductThumb"
                        />
                      </div>
                      <div className="reelsProductDetails">
                        <span className="reelsProductTitle">{reel.productName}</span>
                        {reel.productPrice && (
                          <span className="reelsProductPrice">
                            {reel.productPrice.toLocaleString("uz-UZ")} so‘m
                          </span>
                        )}
                      </div>
                      <span className="reelsProductArrow">Ko‘rish ›</span>
                    </div>
                  )}

                  {/* Standardized Author Row: [Logo] Guli Market [Verified Badge] */}
                  <div
                    className="reelsAuthorRow reelsAuthorRowClickable"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenBrandProfile?.();
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Guli Market brend profili sahifasini ochish"
                  >
                    <div className="reelsAuthorLogoWrap">
                      <img
                        src="/guli-logo.png"
                        alt="Guli Market"
                        className="reelsAuthorRowLogo"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/icons/icon-192.png";
                        }}
                      />
                    </div>
                    <span className="reelsAuthorName">Guli Market</span>
                    <span
                      className="reelsVerifiedCheck"
                      title="Tasdiqlangan brend"
                      aria-label="Tasdiqlangan brend"
                    >
                      <svg viewBox="0 0 24 24" className="reelsVerifiedSvg" fill="currentColor" aria-hidden="true">
                        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                      </svg>
                    </span>
                  </div>

                  {/* Caption with Expand toggle */}
                  <div
                    className={`reelsCaptionBox ${captionExpanded ? "expanded" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCaptionExpanded((prev) => !prev);
                    }}
                  >
                    <p className="reelsCaptionText">{reel.caption}</p>
                    {reel.caption.length > 70 && !captionExpanded && (
                      <span className="reelsMoreToggle">...</span>
                    )}
                  </div>

                  {/* Music Track Row */}
                  <div className="reelsMusicTrackRow">
                    <span className="reelsMusicNote">🎵</span>
                    <div className="reelsMusicTicker">
                      <span className="reelsMusicTitle">
                        {reel.musicTitle || "Guli Market — Original Soundtrack"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video Bottom Progress Bar (Active reel only) */}
                {isActive && (
                  <div className="reelsProgressBarContainer">
                    <div
                      className="reelsProgressBarFill"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isFeedLoading && reels.length === 0 && (
        <div role="status" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", zIndex: 30 }}>
          Reels yuklanmoqda…
        </div>
      )}
      {feedError && reels.length === 0 && (
        <div role="alert" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", padding: "28px", color: "#fff", textAlign: "center", zIndex: 30 }}>
          <span>{feedError}</span>
          <button type="button" onClick={() => void reloadReels()} style={{ border: 0, borderRadius: "999px", padding: "10px 20px", fontWeight: 700 }}>Qayta urinish</button>
        </div>
      )}

      {/* Comments Sheet Modal */}
      {currentReel && (
        <ReelsCommentsModal
          reel={currentReel}
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
          onAddComment={handleAddComment}
        />
      )}

      {/* Share Sheet Modal */}
      {currentReel && (
        <ReelsShareModal
          reel={currentReel}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          onShowToast={showToast}
        />
      )}
    </main>
  );
};
