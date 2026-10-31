import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ReelItem, ReelComment } from "../../types/reels";
import { loadReelsFromStorage } from "../../data/demoReels";
import { fetchPublicReels, loadCachedPublicReels, saveCachedPublicReels, toggleServerReelLike, addServerReelComment, recordServerReelView } from "../../lib/reelsApi";
import {
  evaluateSwipeGesture,
  calculateVideoProgress,
  isIndexPreloaded,
} from "../../utils/reelsEngine";
import { ReelsCommentsModal } from "./ReelsCommentsModal";
import { ReelsShareModal } from "./ReelsShareModal";
import { isInstagramUrl, extractInstagramShortcode } from "../../utils/instagramFetcher";
import "./Reels.css";

function prepareReelsCycle(active: ReelItem[]): { reels: ReelItem[]; startIndex: number } {
  return { reels: active, startIndex: 0 };
}

function markReelSeen(reelId: string): void {
  try {
    const raw = localStorage.getItem("guli_seen_reels_v1");
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (!seen.includes(reelId)) {
      seen.push(reelId);
      localStorage.setItem("guli_seen_reels_v1", JSON.stringify(seen));
    }
  } catch {}
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
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Popping animated hearts burst on like (keyed by unique ID for 100% reliable re-render)
  const [heartAnimId, setHeartAnimId] = useState<number | null>(null);
  const heartCounterRef = useRef<number>(0);
  const heartTimerRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<number | null>(null);

  const triggerHeartAnimation = useCallback(() => {
    heartCounterRef.current += 1;
    const newId = Date.now() * 1000 + heartCounterRef.current;
    setHeartAnimId(newId);
    if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
    heartTimerRef.current = window.setTimeout(() => {
      setHeartAnimId((curr) => (curr === newId ? null : curr));
    }, 1000);
  }, []);

  // Modals
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Centered modern Play/Pause animated overlay
  const [playPauseIndicator, setPlayPauseIndicator] = useState<{
    type: "play" | "pause";
    id: number;
  } | null>(null);

  // Centered modern Volume Mute/Unmute indicator overlay
  const [volumeIndicator, setVolumeIndicator] = useState<{
    isMuted: boolean;
    id: number;
  } | null>(null);

  // Swipe / Drag state for continuous peek transition
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isSwipingVertically = useRef<boolean | null>(null);
  const wheelLockRef = useRef<boolean>(false);

  // Video element references map. Stable callbacks prevent React from detaching
  // and reattaching refs on every render (which can interrupt mobile playback).
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoRefCallbacks = useRef<Map<string, (el: HTMLVideoElement | null) => void>>(new Map());
  const playbackGenerationRef = useRef(0);
  const currentReelRef = useRef<ReelItem | null>(null);

  const playActiveVideo = useCallback((activeVideo: HTMLVideoElement) => {
    if (!activeVideo) return;
    const generation = playbackGenerationRef.current;
    
    activeVideo.currentTime = 0;
    activeVideo.muted = isMutedRef.current;

    const stillCurrent = () => playbackGenerationRef.current === generation;

    activeVideo
      .play()
      .then(() => {
        if (!stillCurrent()) {
          activeVideo.pause();
          return;
        }
        setIsLoadingVideo(false);
        setIsPlaying(true);
      })
      .catch(() => {
        if (!stillCurrent()) return;
        // Fallback for autoplay policy: try playing muted
        activeVideo.muted = true;
        if (!isMutedRef.current) {
          isMutedRef.current = true;
          setIsMuted(true);
        }
        activeVideo
          .play()
          .then(() => {
            if (!stillCurrent()) {
              activeVideo.pause();
              return;
            }
            setIsLoadingVideo(false);
            setIsPlaying(true);
          })
          .catch(() => {
            if (!stillCurrent()) return;
            setIsPlaying(false);
            setIsLoadingVideo(false);
          });
      });
  }, []);

  const initialReelIdRef = useRef(initialReelId);
  const initialIndexRef = useRef(initialIndex);
  const initialConfigAppliedRef = useRef(false);

  const getVideoRef = useCallback((reelId: string) => {
    let callback = videoRefCallbacks.current.get(reelId);
    if (!callback) {
      callback = (el) => {
        if (el) {
          videoRefs.current.set(reelId, el);
        } else {
          const previous = videoRefs.current.get(reelId);
          // A slide leaving the preload window must never keep playing off-screen.
          previous?.pause();
          videoRefs.current.delete(reelId);
        }
      };
      videoRefCallbacks.current.set(reelId, callback);
    }
    return callback;
  }, []);

  // Stop every media element when Reels is left or the app is backgrounded.
  useEffect(() => {
    const videoRefsMap = videoRefs.current;
    const callbacksMap = videoRefCallbacks.current;
    const stopAllVideos = () => {
      playbackGenerationRef.current += 1;
      videoRefsMap.forEach((video) => {
        video.pause();
        video.muted = true;
      });
    };
    const handleVisibilityChange = () => {
      if (document.hidden) stopAllVideos();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", stopAllVideos);
    return () => {
      stopAllVideos();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", stopAllVideos);
      videoRefsMap.clear();
      callbacksMap.clear();
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const resolveInitialIndex = useCallback((list: ReelItem[]): number => {
    if (initialReelIdRef.current) {
      const found = list.findIndex((r) => r.id === initialReelIdRef.current);
      if (found !== -1) return found;
    }
    if (
      typeof initialIndexRef.current === "number" &&
      initialIndexRef.current >= 0 &&
      initialIndexRef.current < list.length
    ) {
      return initialIndexRef.current;
    }
    return 0;
  }, []);

  // Load published Reels from the shared server source; local demo data is development-only.
  const reloadReels = useCallback(async () => {
    setFeedError(null);
    const cached = loadCachedPublicReels();
    if (cached.length > 0) {
      const cachedCycle = prepareReelsCycle(cached);
      setReels(cachedCycle.reels);
      if (!initialConfigAppliedRef.current) {
        const startIdx = resolveInitialIndex(cachedCycle.reels);
        initialConfigAppliedRef.current = true;
        setCurrentIndex(startIdx);
      }
      setIsFeedLoading(false);
    } else {
      setIsFeedLoading(true);
    }
    try {
      const all = await fetchPublicReels();
      const active = all.filter((r) => r.status === "active" && Boolean(r.videoUrl));
      saveCachedPublicReels(active);
      const cycle = prepareReelsCycle(active);
      const list = cycle.reels;

      setReels(list);
      if (!initialConfigAppliedRef.current) {
        const startIdx = resolveInitialIndex(list);
        initialConfigAppliedRef.current = true;
        setCurrentIndex(startIdx);
      }
    } catch (error) {
      console.error("[Reels] Published server feed could not be loaded:", error);
      if (!import.meta.env.PROD) {
        const active = loadReelsFromStorage().filter((r) => r.status === "active");
        const cycle = prepareReelsCycle(active);
        setReels(cycle.reels);
        if (!initialConfigAppliedRef.current) {
          const startIdx = resolveInitialIndex(cycle.reels);
          initialConfigAppliedRef.current = true;
          setCurrentIndex(startIdx);
        }
      } else {
        if (cached.length === 0) {
          setReels([]);
          setFeedError("Reels serveriga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.");
        }
      }
    } finally {
      setIsFeedLoading(false);
    }
  }, [resolveInitialIndex]);

  // Update position if initialReelId is provided later (e.g. user clicked a specific reel in brand profile)
  useEffect(() => {
    if (initialReelId && initialReelId !== initialReelIdRef.current) {
      initialReelIdRef.current = initialReelId;
      initialConfigAppliedRef.current = false;
      void reloadReels();
    }
  }, [initialReelId, reloadReels]);

  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  onActiveIndexChangeRef.current = onActiveIndexChange;
  const lastReportedIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (lastReportedIndexRef.current !== currentIndex) {
      lastReportedIndexRef.current = currentIndex;
      onActiveIndexChangeRef.current?.(currentIndex);
    }
  }, [currentIndex]);

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
  currentReelRef.current = currentReel;
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

  const triggerVolumeOverlay = useCallback((muted: boolean) => {
    setVolumeIndicator({ isMuted: muted, id: Date.now() });
    setTimeout(() => {
      setVolumeIndicator((prev) => (prev && Date.now() - prev.id >= 600 ? null : prev));
    }, 650);
  }, []);

  const toggleMute = useCallback(() => {
    if (!currentReel) return;
    const activeVideo = videoRefs.current.get(currentReel.id);
    if (!activeVideo) return;
    const nextMuted = !activeVideo.muted;
    activeVideo.muted = nextMuted;
    setIsMuted(nextMuted);
    triggerVolumeOverlay(nextMuted);
  }, [currentReel, triggerVolumeOverlay]);

  // Manage exactly one active player. Ignore late play() resolutions after a
  // swipe, route change, or component unmount.
  useEffect(() => {
    const generation = ++playbackGenerationRef.current;
    let activeVideo: HTMLVideoElement | undefined;

    setIsLoadingVideo(true);
    setVideoProgress(0);
    setIsPlaying(true);
    setCaptionExpanded(false);

    videoRefs.current.forEach((videoEl, id) => {
      if (!currentReel || id !== currentReel.id) videoEl.pause();
    });

    if (currentReel && isInstagramUrl(currentReel.videoUrl)) {
      setIsLoadingVideo(false);
      setIsPlaying(true);
      return () => {
        if (playbackGenerationRef.current === generation) playbackGenerationRef.current += 1;
      };
    }

    if (currentReel) {
      activeVideo = videoRefs.current.get(currentReel.id);
      if (activeVideo) {
        playActiveVideo(activeVideo);
      }
    }

    return () => {
      if (playbackGenerationRef.current === generation) playbackGenerationRef.current += 1;
      activeVideo?.pause();
    };
  // Deliberately exclude the reel object and isMuted: engagement updates and
  // mute toggles must not restart the video from the beginning.
  }, [currentIndex, currentReel?.id, playActiveVideo]);

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

  // Persist likes against the shared Reels record with instant optimistic update and center animated hearts.
  const handleToggleLike = useCallback(async () => {
    const reel = currentReelRef.current;
    if (!reel) return;
    const targetId = reel.id;
    const prevLiked = Boolean(reel.isLiked);
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, (reel.likesCount || 0) + (nextLiked ? 1 : -1));

    // 1. Instant optimistic feedback & animated hearts burst if turning to liked
    setReels((previous) =>
      previous.map((r) =>
        r.id === targetId ? { ...r, isLiked: nextLiked, likesCount: nextCount } : r
      )
    );
    if (nextLiked) {
      triggerHeartAnimation();
    }

    // 2. Persist to server (falls back gracefully to offline/local storage)
    try {
      const result = await toggleServerReelLike(targetId);
      setReels((previous) =>
        previous.map((r) =>
          r.id === targetId ? { ...r, isLiked: result.isLiked, likesCount: result.likesCount } : r
        )
      );
    } catch (error) {
      console.warn("[Reels] Like sync warning (optimistic like preserved):", error);
    }
  }, [triggerHeartAnimation]);

  // Video tap handler (Single tap: Play/Pause with animated overlay; Double tap: Like with heart animation)
  const handleVideoTap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation?.();
    const now = Date.now();
    const timeSinceLast = now - lastTapTimeRef.current;

    // Double tap window: 50ms to 450ms
    if (timeSinceLast > 50 && timeSinceLast < 450) {
      // Double tap confirmed! Cancel pending single-tap play/pause timeout immediately
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;

      // 1. Always trigger central animated hearts burst on double tap!
      triggerHeartAnimation();

      // 2. Turn heart red immediately if not already liked (Instagram behavior: double-tap always likes)
      const reel = currentReelRef.current;
      if (reel && !reel.isLiked) {
        const targetId = reel.id;
        const nextCount = (reel.likesCount || 0) + 1;
        setReels((previous) =>
          previous.map((r) =>
            r.id === targetId ? { ...r, isLiked: true, likesCount: nextCount } : r
          )
        );
        toggleServerReelLike(targetId)
          .then((result) => {
            setReels((previous) =>
              previous.map((r) =>
                r.id === targetId ? { ...r, isLiked: result.isLiked, likesCount: result.likesCount } : r
              )
            );
          })
          .catch((error) => console.warn("[Reels] Double-tap like sync warning:", error));
      }
    } else {
      // First tap: register timestamp and wait 280ms for potential second tap before toggling play/pause
      lastTapTimeRef.current = now;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = window.setTimeout(() => {
        togglePlayPause();
        lastTapTimeRef.current = 0;
        singleTapTimerRef.current = null;
      }, 280);
    }
  }, [togglePlayPause, triggerHeartAnimation]);

  // Save comments to the shared Reels database.
  const handleAddComment = async (reelId: string, newComment: ReelComment): Promise<ReelComment> => {
    const saved = await addServerReelComment(reelId, newComment.text);
    setReels((previous) => previous.map((r) => r.id === reelId
      ? { ...r, commentsCount: Math.max(r.commentsCount + 1, (r.comments || []).length + 1), comments: [saved, ...(r.comments || []).filter((item) => item.id !== saved.id)] }
      : r));
    showToast("✓ Izoh serverda saqlandi!");
    return saved;
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

  // Mount only the active video. Keeping adjacent video elements mounted can
  // exhaust Android Chrome media decoders and leave the next Reel buffering forever.
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
                        ref={getVideoRef(reel.id)}
                        src={reel.videoUrl}
                        poster={reel.posterUrl}
                        className="reelsVideoElement"
                        playsInline
                        loop
                        muted={isMuted}
                        preload="auto"
                        onTimeUpdate={isActive ? handleTimeUpdate : undefined}
                        onWaiting={isActive ? () => setIsLoadingVideo(true) : undefined}
                        onCanPlay={isActive ? () => {
                          setIsLoadingVideo(false);
                          const video = videoRefs.current.get(reel.id);
                          if (video && video.paused && isPlaying) video.play().catch(() => {});
                        } : undefined}
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

                  {/* Centered Modern Volume Mute/Unmute Animated Overlay */}
                  {isActive && volumeIndicator && (
                    <div
                      key={volumeIndicator.id}
                      className="reelsVolumePopup"
                      aria-hidden="true"
                    >
                      <div className="reelsVolumeBubble">
                        <span className="reelsVolumeIcon">
                          {volumeIndicator.isMuted ? "🔇" : "🔊"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Animated Hearts Burst on Like (keyed for guaranteed animation re-trigger) */}
                  {isActive && heartAnimId && (
                    <div key={heartAnimId} className="reelsHeartsBurst" aria-hidden="true">
                      <div className="reelsHeartMain">
                        <svg viewBox="0 0 24 24" width="105" height="105" fill="url(#reelsHeartGrad)" style={{ filter: "drop-shadow(0 8px 26px rgba(255, 46, 99, 0.75))" }}>
                          <defs>
                            <linearGradient id="reelsHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#ff2e63" />
                              <stop offset="50%" stopColor="#ff4b72" />
                              <stop offset="100%" stopColor="#ff758c" />
                            </linearGradient>
                          </defs>
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                      <span className="reelsHeartParticle p1">💖</span>
                      <span className="reelsHeartParticle p2">✨</span>
                      <span className="reelsHeartParticle p3">💕</span>
                      <span className="reelsHeartParticle p4">💗</span>
                      <span className="reelsHeartParticle p5">🌸</span>
                      <span className="reelsHeartParticle p6">❤️</span>
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
                      <svg
                        viewBox="0 0 24 24"
                        width="26"
                        height="26"
                        fill={reel.isLiked ? "#ff2e63" : "none"}
                        stroke={reel.isLiked ? "#ff2e63" : "#ffffff"}
                        strokeWidth="2.2"
                        className={`reelsActionHeartSvg ${reel.isLiked ? "popLiked" : ""}`}
                        style={{
                          filter: reel.isLiked
                            ? "drop-shadow(0 0 8px rgba(255, 46, 99, 0.75))"
                            : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))",
                          transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        }}
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <span
                      className="reelsActionCount"
                      style={{ color: reel.isLiked ? "#ff4d79" : "#ffffff", fontWeight: 700 }}
                    >
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
                  {/* Optional external promo replaces the linked inventory product CTA when configured. */}
                  {reel.promoImageUrl && reel.promoText && reel.promoUrl ? (
                    <a
                      className="reelsProductPill"
                      href={reel.promoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={reel.promoText}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className="reelsProductThumbWrap">
                        <img src={reel.promoImageUrl} alt={reel.promoText} className="reelsProductThumb" />
                      </div>
                      <div className="reelsProductDetails">
                        <span className="reelsProductTitle">{reel.promoText}</span>
                        <span className="reelsProductPrice">Batafsil ›</span>
                      </div>
                      <span className="reelsProductArrow">O‘tish ↗</span>
                    </a>
                  ) : reel.productName ? (
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
                  ) : null}

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
