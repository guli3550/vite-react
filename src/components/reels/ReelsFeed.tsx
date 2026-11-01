import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ReelItem, ReelComment } from "../../types/reels";
import { loadReelsFromStorage } from "../../data/demoReels";
import { fetchPublicReels, loadCachedPublicReels, saveCachedPublicReels, toggleServerReelLike, addServerReelComment, recordServerReelView } from "../../lib/reelsApi";
import { evaluateSwipeGesture, calculateVideoProgress } from "../../utils/reelsEngine";
import {
  REELS_FEED_FRESH_MS,
  REEL_SEEN_AFTER_MS,
  buildFeedOrder,
  dedupeById,
  feedAgeMs,
  markFeedFetched,
  markSeen,
  mergeFeed,
  readResume,
  readSeen,
  windowPositions,
  wrapIndex,
  writeResume,
  writeSeen,
} from "../../utils/reelsFeedLogic";
import { scheduleReelsWarmup } from "../../lib/reelsPrefetch";
import { ReelsCommentsModal } from "./ReelsCommentsModal";
import { ReelsShareModal } from "./ReelsShareModal";
import { isInstagramUrl, extractInstagramShortcode } from "../../utils/instagramFetcher";
import "./Reels.css";

// App.tsx imports this module at start-up: warm the feed while the customer is still on the home screen.
scheduleReelsWarmup();

interface ReelsFeedProps {
  onBack?: () => void;
  onOpenProduct?: (productId: string | number) => void;
  onNavigateToCatalog?: () => void;
  onOpenBrandProfile?: () => void;
  initialReelId?: string;
  /** Kept for backward compatibility. The resume position is now persisted by reel id. */
  initialIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  onBack,
  onOpenProduct,
  onNavigateToCatalog,
  onOpenBrandProfile,
  initialReelId,
  onActiveIndexChange,
}) => {
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  // Virtual, unbounded position. The reel shown is reels[wrapIndex(pos, reels.length)],
  // so the feed loops forever without ever animating across the whole list.
  const [pos, setPos] = useState(0);
  const [instant, setInstant] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoError, setVideoError] = useState<Record<string, boolean>>({});
  const [retryNonce, setRetryNonce] = useState(0);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const count = reels.length;
  const reelsRef = useRef<ReelItem[]>([]);
  reelsRef.current = reels;
  const posRef = useRef(pos);
  posRef.current = pos;
  const currentReel: ReelItem | undefined = count > 0 ? reels[wrapIndex(pos, count)] : undefined;
  const currentReelRef = useRef<ReelItem | null>(null);
  currentReelRef.current = currentReel ?? null;
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = currentReel?.id ?? null;

  // Timers are tracked so nothing fires after the feed is closed.
  const timersRef = useRef<Set<number>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

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
  const [playPauseIndicator, setPlayPauseIndicator] = useState<{ type: "play" | "pause"; id: number } | null>(null);

  // Centered modern Volume Mute/Unmute indicator overlay
  const [volumeIndicator, setVolumeIndicator] = useState<{ isMuted: boolean; id: number } | null>(null);

  // Swipe / Drag state for continuous peek transition
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isSwipingVertically = useRef<boolean | null>(null);
  const wheelLockRef = useRef<boolean>(false);

  // Video elements are keyed by their virtual position (the same reel can occupy two
  // positions in a tiny feed). The progress bar is updated through a ref so the
  // timeupdate event never re-renders the whole slide tree.
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const videoRefCallbacks = useRef<Map<number, (el: HTMLVideoElement | null) => void>>(new Map());
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const playbackGenerationRef = useRef(0);

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
  // The first reel of a session: a reel opened from the brand profile, otherwise the resume reel.
  const forceFirstIdRef = useRef<string | null>(initialReelId ?? null);
  const orderBuiltRef = useRef(false);

  const getVideoRef = useCallback((position: number) => {
    let callback = videoRefCallbacks.current.get(position);
    if (!callback) {
      callback = (el) => {
        if (el) {
          videoRefs.current.set(position, el);
        } else {
          // A slide leaving the 3-slide window must never keep playing off-screen.
          videoRefs.current.get(position)?.pause();
          videoRefs.current.delete(position);
          videoRefCallbacks.current.delete(position);
        }
      };
      videoRefCallbacks.current.set(position, callback);
    }
    return callback;
  }, []);

  // Stop every media element when Reels is left or the app is backgrounded.
  useEffect(() => {
    const videoRefsMap = videoRefs.current;
    const timers = timersRef.current;
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
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current);
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Turns a list coming from cache / server into the visible feed.
  // First time: build the session order (resume + unseen first). Afterwards: merge without reordering.
  const applyIncoming = useCallback((incoming: ReelItem[]) => {
    const fresh = dedupeById(incoming);
    if (!orderBuiltRef.current) {
      if (fresh.length === 0) {
        setReels([]);
        return;
      }
      orderBuiltRef.current = true;
      setInstant(true);
      setPos(0);
      setReels(buildFeedOrder(fresh, readSeen(), readResume(), forceFirstIdRef.current));
      return;
    }
    const currentId = currentIdRef.current;
    const { list, idsChanged } = mergeFeed(reelsRef.current, fresh, currentId);
    setReels(list);
    if (idsChanged) {
      const idx = currentId ? list.findIndex((r) => r.id === currentId) : -1;
      setInstant(true);
      setPos(idx >= 0 ? idx : 0);
    }
  }, []);

  // Load published Reels: instant from cache, then (only if the cache is stale) from the server.
  const reloadReels = useCallback(async (force = false) => {
    setFeedError(null);
    const cached = loadCachedPublicReels();
    if (!orderBuiltRef.current) {
      if (cached.length > 0) {
        applyIncoming(cached);
        setIsFeedLoading(false);
      } else {
        setIsFeedLoading(true);
      }
    }
    if (!force && cached.length > 0 && feedAgeMs() < REELS_FEED_FRESH_MS) {
      setIsFeedLoading(false);
      return;
    }
    try {
      const all = await fetchPublicReels();
      const active = all.filter((r) => r.status === "active" && Boolean(r.videoUrl));
      saveCachedPublicReels(active);
      markFeedFetched();
      applyIncoming(active);
    } catch (error) {
      console.error("[Reels] Published server feed could not be loaded:", error);
      if (!import.meta.env.PROD) {
        applyIncoming(loadReelsFromStorage().filter((r) => r.status === "active"));
      } else if (reelsRef.current.length === 0) {
        setFeedError("Reels serveriga ulanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.");
      }
    } finally {
      setIsFeedLoading(false);
    }
  }, [applyIncoming]);

  // A specific reel was requested later (e.g. tapped in the brand profile).
  useEffect(() => {
    if (initialReelId && initialReelId !== initialReelIdRef.current) {
      initialReelIdRef.current = initialReelId;
      forceFirstIdRef.current = initialReelId;
      orderBuiltRef.current = false;
      void reloadReels();
    }
  }, [initialReelId, reloadReels]);

  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  onActiveIndexChangeRef.current = onActiveIndexChange;
  const lastReportedIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (count === 0) return;
    const index = wrapIndex(pos, count);
    if (lastReportedIndexRef.current !== index) {
      lastReportedIndexRef.current = index;
      onActiveIndexChangeRef.current?.(index);
    }
  }, [pos, count]);

  useEffect(() => {
    void reloadReels();
    // Only an explicit admin update refreshes the feed; unrelated `storage` events must not.
    const handleReelsUpdated = () => void reloadReels(true);
    window.addEventListener("guli_reels_updated", handleReelsUpdated);
    return () => window.removeEventListener("guli_reels_updated", handleReelsUpdated);
  }, [reloadReels]);

  // The jump animation is skipped when the list is rebuilt.
  useEffect(() => {
    if (!instant) return;
    const id = window.setTimeout(() => setInstant(false), 60);
    return () => clearTimeout(id);
  }, [instant]);

  // Resume position is saved the moment a reel becomes active; "seen" + view count only after
  // the reel stayed on screen, so quick swipe-throughs do not burn a reel or a request.
  const viewedReelIdsRef = useRef<Set<string>>(new Set());
  const currentReelId = currentReel?.id;
  useEffect(() => {
    if (!currentReelId) return;
    writeResume(currentReelId);
    const timer = window.setTimeout(() => {
      writeSeen(markSeen(readSeen(), currentReelId, reelsRef.current.map((r) => r.id)));
      if (viewedReelIdsRef.current.has(currentReelId)) return;
      viewedReelIdsRef.current.add(currentReelId);
      recordServerReelView(currentReelId)
        .then(({ viewsCount }) => {
          setReels((previous) => previous.map((r) => (r.id === currentReelId ? { ...r, viewsCount } : r)));
        })
        .catch((error) => console.warn("[Reels] View count was not saved:", error));
    }, REEL_SEEN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [currentReelId]);

  // Decode the posters two and three reels ahead so the next swipes never show a blank frame.
  useEffect(() => {
    const list = reelsRef.current;
    if (list.length < 3) return;
    for (const offset of [2, 3]) {
      const poster = list[wrapIndex(pos + offset, list.length)]?.posterUrl;
      if (poster) {
        const img = new Image();
        img.decoding = "async";
        img.src = poster;
      }
    }
  }, [pos, count]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const triggerVolumeOverlay = useCallback((muted: boolean) => {
    const id = Date.now();
    setVolumeIndicator({ isMuted: muted, id });
    later(() => setVolumeIndicator((prev) => (prev && prev.id === id ? null : prev)), 650);
  }, [later]);

  const toggleMute = useCallback(() => {
    const activeVideo = videoRefs.current.get(posRef.current);
    if (!activeVideo) return;
    const nextMuted = !activeVideo.muted;
    activeVideo.muted = nextMuted;
    setIsMuted(nextMuted);
    triggerVolumeOverlay(nextMuted);
  }, [triggerVolumeOverlay]);

  // Manage exactly one active player. Ignore late play() resolutions after a
  // swipe, route change, or component unmount.
  useEffect(() => {
    const generation = ++playbackGenerationRef.current;
    let activeVideo: HTMLVideoElement | undefined;

    setIsLoadingVideo(true);
    setIsPlaying(true);
    setCaptionExpanded(false);
    if (progressFillRef.current) progressFillRef.current.style.width = "0%";

    videoRefs.current.forEach((videoEl, position) => {
      if (position !== pos) videoEl.pause();
    });

    if (currentReel && isInstagramUrl(currentReel.videoUrl)) {
      setIsLoadingVideo(false);
      return () => {
        if (playbackGenerationRef.current === generation) playbackGenerationRef.current += 1;
      };
    }

    if (currentReel) {
      activeVideo = videoRefs.current.get(pos);
      if (activeVideo) playActiveVideo(activeVideo);
      else setIsLoadingVideo(false);
    }

    return () => {
      if (playbackGenerationRef.current === generation) playbackGenerationRef.current += 1;
      activeVideo?.pause();
    };
  // Deliberately exclude the reel object and isMuted: engagement updates and
  // mute toggles must not restart the video from the beginning.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, currentReelId, retryNonce, playActiveVideo]);

  // Navigate between reels (infinite loop: the position is unbounded, the reel wraps).
  const goToPos = useCallback((position: number) => {
    if (reelsRef.current.length > 1) setPos(position);
  }, []);

  const goNext = useCallback(() => goToPos(posRef.current + 1), [goToPos]);
  const goPrev = useCallback(() => goToPos(posRef.current - 1), [goToPos]);

  // Trigger Play / Pause indicator animation
  const triggerPlayPauseOverlay = useCallback((type: "play" | "pause") => {
    const id = Date.now();
    setPlayPauseIndicator({ type, id });
    later(() => setPlayPauseIndicator((prev) => (prev && prev.id === id ? null : prev)), 500);
  }, [later]);

  // Toggle Play / Pause for the active video
  const togglePlayPause = useCallback(() => {
    const activeVideo = videoRefs.current.get(posRef.current);
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
  }, [triggerPlayPauseOverlay]);

  // Handle Touch gestures with live drag preview. Ignored while a sheet is open so
  // scrolling the comments never swipes the feed behind it.
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isCommentsOpen || isShareOpen) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isSwipingVertically.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diffY = e.touches[0].clientY - touchStartY.current;
    const diffX = e.touches[0].clientX - touchStartX.current;

    // Detect gesture direction on initial threshold
    if (isSwipingVertically.current === null) {
      if (Math.abs(diffY) > 6 || Math.abs(diffX) > 6) {
        isSwipingVertically.current = Math.abs(diffY) > Math.abs(diffX);
      }
    }

    if (isSwipingVertically.current) {
      // The feed loops, so only a single-reel feed has an edge to resist.
      setDragOffsetY(count < 2 ? diffY * 0.3 : diffY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const decision = evaluateSwipeGesture(-dragOffsetY, 45);

    if (decision === "next") goNext();
    else if (decision === "prev") goPrev();

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
        if (e.deltaY > 0) goNext();
        else goPrev();
        later(() => {
          wheelLockRef.current = false;
        }, 400);
      }
    },
    [goNext, goPrev, isCommentsOpen, isShareOpen, later]
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

  // Video time update for the progress bar: written straight to the DOM (no React re-render).
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (videoEl && videoEl.duration && progressFillRef.current) {
      progressFillRef.current.style.width = `${calculateVideoProgress(videoEl.currentTime, videoEl.duration)}%`;
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

  // Retry: clear the error so the <video> mounts again, then re-run the player effect to start it.
  const handleRetryVideo = (reelId: string) => {
    setVideoError((prev) => ({ ...prev, [reelId]: false }));
    setIsLoadingVideo(true);
    setRetryNonce((n) => n + 1);
  };

  // Loading / error / empty states (previously the loading and error views were unreachable).
  if (count === 0) {
    if (isFeedLoading) {
      return (
        <main className="reelsContainer reelsEmptyView" aria-busy="true">
          <div role="status" className="reelsEmptyContent">
            <div className="reelsLoadingSpinner" style={{ position: "static", marginBottom: 12 }}>
              <div className="reelsSpinnerCircle" />
            </div>
            <p className="reelsEmptySubtitle" style={{ margin: 0 }}>Reels yuklanmoqda…</p>
          </div>
        </main>
      );
    }
    if (feedError) {
      return (
        <main className="reelsContainer reelsEmptyView">
          <div role="alert" className="reelsEmptyContent">
            <div className="reelsEmptyIcon">⚠️</div>
            <p className="reelsEmptySubtitle">{feedError}</p>
            <div className="reelsEmptyActions">
              <button type="button" className="reelsBtnPrimary" onClick={() => void reloadReels(true)}>Qayta urinish</button>
              {onBack && (
                <button type="button" className="reelsBtnSecondary" onClick={onBack}>🏠 Bosh sahifaga qaytish</button>
              )}
            </div>
          </div>
        </main>
      );
    }
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
              <button type="button" className="reelsBtnSecondary" onClick={onBack}>
                🏠 Bosh sahifaga qaytish
              </button>
            )}
            {onNavigateToCatalog && (
              <button type="button" className="reelsBtnPrimary" onClick={onNavigateToCatalog}>
                👗 Katalogga o‘tish
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Only previous / current / next are mounted (at most 3 <video> elements). Mounting more can
  // exhaust Android Chrome media decoders and leave the next Reel buffering forever.
  const trackTranslateStyle = {
    transform: `translate3d(0, calc(-${pos * 100}% + ${dragOffsetY}px), 0)`,
    transition: isDragging || instant ? "none" : "transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <main
      className="reelsContainer"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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
          {windowPositions(pos, count).map((position) => {
            const reel = reels[wrapIndex(position, count)];
            const isActive = position === pos;
            const isNext = position === pos + 1;
            const hasError = videoError[reel.id];

            return (
              <div
                key={position}
                className={`reelsSlide ${isActive ? "active" : ""}`}
                style={{ top: `${position * 100}%` }}
              >
                {/* Media area */}
                <div
                  className="reelsMediaWrap"
                  onClick={isActive ? (isInstagramUrl(reel.videoUrl) ? undefined : handleVideoTap) : () => goToPos(position)}
                >
                  {/* Poster Image */}
                  {reel.posterUrl && (
                    <img
                      src={reel.posterUrl}
                      alt={reel.caption}
                      className={`reelsPoster ${
                        isActive && !hasError && isPlaying && !isLoadingVideo ? "hiddenBehindVideo" : ""
                      }`}
                      onError={(e) => {
                        // Never substitute an unrelated picture; just reveal the black background.
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  )}

                  {/* Instagram embeds mount only when active; HTML5 videos buffer in the 3-slide window */}
                  {!hasError && reel.videoUrl && (
                    isInstagramUrl(reel.videoUrl) ? (
                      isActive && (
                        <iframe
                          src={"https://www.instagram.com/reel/" + extractInstagramShortcode(reel.videoUrl) + "/embed/"}
                          title={"Instagram Reels: " + reel.caption}
                          className="reelsVideoElement"
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                          style={{ width: "100%", height: "100%", border: 0, background: "#000" }}
                        />
                      )
                    ) : (
                      <video
                        ref={getVideoRef(position)}
                        src={reel.videoUrl}
                        poster={reel.posterUrl || undefined}
                        className="reelsVideoElement"
                        playsInline
                        loop
                        muted={isMuted}
                        preload={isActive || isNext ? "auto" : "metadata"}
                        onTimeUpdate={isActive ? handleTimeUpdate : undefined}
                        onWaiting={isActive ? () => setIsLoadingVideo(true) : undefined}
                        onCanPlay={isActive ? () => {
                          setIsLoadingVideo(false);
                          const video = videoRefs.current.get(position);
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
                        goToPos(position);
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
                      if (!isActive) goToPos(position);
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
                      if (!isActive) goToPos(position);
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
                    className={`reelsCaptionBox ${isActive && captionExpanded ? "expanded" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCaptionExpanded((prev) => !prev);
                    }}
                  >
                    <p className="reelsCaptionText">{reel.caption}</p>
                    {reel.caption.length > 70 && !(isActive && captionExpanded) && (
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

                {/* Video Bottom Progress Bar (Active reel only; width is written via ref) */}
                {isActive && (
                  <div className="reelsProgressBarContainer">
                    <div
                      ref={progressFillRef}
                      className="reelsProgressBarFill"
                      style={{ width: "0%" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
