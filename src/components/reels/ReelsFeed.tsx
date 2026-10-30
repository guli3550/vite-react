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
import { Reels3DIcon } from "../Nav3DIcons";
import { getGuliInstallPrompt, isGuliStandalone, promptGuliInstall, subscribeToGuliInstallPrompt, type GuliInstallPromptEvent } from "../../lib/pwaInstall";
import "./Reels.css";

const REELS_CYCLE_STORAGE_KEY = "guli_reels_cycle_v1";
const REELS_CACHE_STORAGE_KEY = "guli_public_reels_cache_v1";
const REELS_POSITION_STORAGE_KEY = "guli_reels_position_v1";
const REELS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type SavedReelPosition = { reelId: string; currentTime: number };

function readSavedReelPosition(): SavedReelPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(REELS_POSITION_STORAGE_KEY) || "null") as Partial<SavedReelPosition> | null;
    return value && typeof value.reelId === "string"
      ? { reelId: value.reelId, currentTime: Number.isFinite(value.currentTime) ? Math.max(0, Number(value.currentTime)) : 0 }
      : null;
  } catch { return null; }
}

function saveCurrentReel(reelId: string): void {
  try {
    const previous = readSavedReelPosition();
    localStorage.setItem(REELS_POSITION_STORAGE_KEY, JSON.stringify({
      reelId,
      currentTime: previous?.reelId === reelId ? previous.currentTime : 0,
    }));
  } catch { /* local storage may be unavailable */ }
}

function readCachedPublicReels(): ReelItem[] {
  try {
    const cached = JSON.parse(localStorage.getItem(REELS_CACHE_STORAGE_KEY) || "null") as { savedAt?: number; reels?: ReelItem[] } | null;
    if (!cached || !Array.isArray(cached.reels) || !Number.isFinite(cached.savedAt)) return [];
    if (Date.now() - Number(cached.savedAt) > REELS_CACHE_MAX_AGE_MS) return [];
    return cached.reels.filter((reel) => reel && reel.status === "active" && typeof reel.id === "string" && typeof reel.videoUrl === "string");
  } catch { return []; }
}

function writeCachedPublicReels(reels: ReelItem[]): void {
  try {
    // Preserve the complete public payload so cached comments remain available offline.
    const activeReels = reels.filter((reel) => reel.status === "active");
    localStorage.setItem(REELS_CACHE_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), reels: activeReels }));
  } catch (error) { console.warn("[Reels] Lokal cache saqlanmadi:", error); }
}

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
  const savedReelId = readSavedReelPosition()?.reelId;
  const resumeIndex = savedReelId ? orderedReels.findIndex((reel) => reel.id === savedReelId) : -1;
  const firstUnseen = orderedReels.findIndex((reel) => !new Set(seenIds).has(reel.id));
  return { reels: orderedReels, startIndex: resumeIndex >= 0 ? resumeIndex : firstUnseen >= 0 ? firstUnseen : 0 };
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
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  onBack,
  onOpenProduct,
  onNavigateToCatalog,
}) => {
  // Render the last known feed synchronously; refresh it in the background.
  const [initialCycle] = useState(() => prepareReelsCycle(readCachedPublicReels()));
  const [reels, setReels] = useState<ReelItem[]>(initialCycle.reels);
  const [isLoadingReels, setIsLoadingReels] = useState(initialCycle.reels.length === 0);
  const [reelsLoadError, setReelsLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialCycle.startIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<Record<string, boolean>>({});
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showBrowserInstallGate, setShowBrowserInstallGate] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<GuliInstallPromptEvent | null>(getGuliInstallPrompt());
  const [isInstallingApp, setIsInstallingApp] = useState(false);

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

  // Keep callback refs stable: inline ref callbacks detach/reattach on every render.
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoRefCallbacks = useRef<Map<string, (el: HTMLVideoElement | null) => void>>(new Map());

  const getVideoRefCallback = (reelId: string) => {
    let callback = videoRefCallbacks.current.get(reelId);
    if (!callback) {
      callback = (el) => {
        if (el) {
          videoRefs.current.set(reelId, el);
        } else {
          const previousVideo = videoRefs.current.get(reelId);
          if (previousVideo) {
            try { previousVideo.pause(); } catch { /* media may already be detached */ }
          }
          videoRefs.current.delete(reelId);
        }
      };
      videoRefCallbacks.current.set(reelId, callback);
    }
    return callback;
  };

  const currentReelRef = useRef<ReelItem | undefined>(undefined);
  currentReelRef.current = reels[currentIndex];

  const stopAllReelMedia = useCallback(() => {
    const active = currentReelRef.current;
    videoRefs.current.forEach((videoEl, reelId) => {
      try {
        if (active?.id === reelId && Number.isFinite(videoEl.currentTime)) {
          localStorage.setItem(REELS_POSITION_STORAGE_KEY, JSON.stringify({
            reelId,
            currentTime: Math.max(0, videoEl.currentTime),
          }));
        }
        videoEl.pause();
      } catch { /* detached or unavailable media */ }
    });
  }, []);

  // Require browser visitors to install the GULI MARKET PWA before viewing Reels.
  // Installed standalone app and Telegram Mini App users bypass this gate.
  useEffect(() => {
    const isTelegramMiniApp = Boolean((window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData);
    setShowBrowserInstallGate(!isGuliStandalone() && !isTelegramMiniApp);

    const unsubscribeInstallPrompt = subscribeToGuliInstallPrompt(() => {
      setInstallPromptEvent(getGuliInstallPrompt());
    });
    const handleAppInstalled = () => {
      setIsInstallingApp(false);
      setShowBrowserInstallGate(false);
      // Keep the site on its app start URL. Whether Chrome immediately switches
      // into the newly installed PWA is controlled by the browser.
      window.location.replace("/");
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      unsubscribeInstallPrompt();
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!installPromptEvent) {
      window.alert("Bu brauzer hozir tezkor o‘rnatish oynasini bermadi. Chrome yangilanganini tekshirib, sahifani qayta oching.");
      return;
    }
    setIsInstallingApp(true);
    const outcome = await promptGuliInstall();
    if (outcome === "dismissed" || outcome === "unavailable") {
      setIsInstallingApp(false);
      setInstallPromptEvent(null);
      if (outcome === "unavailable") {
        window.alert("O‘rnatish oynasi ochilmadi. Gulii.uz sahifasini Chrome’da qayta ochib, yana urinib ko‘ring.");
      }
    }
    // On acceptance, keep the spinner until the browser fires appinstalled.
  }, [installPromptEvent]);

  // Load active reels in a persisted randomized cycle, resuming at the first unseen Reel.
  const reloadReels = useCallback(async () => {
    try {
      const active = await fetchPublicReels();
      writeCachedPublicReels(active);
      const cycle = prepareReelsCycle(active);
      setReels(cycle.reels);
      setCurrentIndex(cycle.startIndex);
      setReelsLoadError(null);
    } catch (error) {
      console.error("[Reels] Server lentasini yuklab bo'lmadi:", error);
      const message = error instanceof Error ? error.message : "Server bilan aloqa yo‘q";
      setReelsLoadError(message);
      // Do not mask a failed server request with local demo videos on deployed sites.
      const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
      const isDeployedSite = host === "gulii.uz" || host === "www.gulii.uz" || host.endsWith(".vercel.app");
      const cachedFallback = readCachedPublicReels();
      const fallback = cachedFallback.length > 0
        ? cachedFallback
        : isDeployedSite ? [] : loadReelsFromStorage().filter((r) => r.status === "active");
      const cycle = prepareReelsCycle(fallback);
      setReels(cycle.reels);
      setCurrentIndex(cycle.startIndex);
    } finally {
      setIsLoadingReels(false);
    }
  }, []);

  useEffect(() => {
    reloadReels();

    const handleStorageChange = () => {
      reloadReels();
    };
    const stopWhenPageIsHidden = () => {
      if (document.visibilityState === "hidden") stopAllReelMedia();
    };

    window.addEventListener("storage", handleStorageChange as EventListener);
    window.addEventListener("guli_reels_updated", handleStorageChange as EventListener);
    window.addEventListener("pagehide", stopAllReelMedia);
    document.addEventListener("visibilitychange", stopWhenPageIsHidden);

    return () => {
      window.removeEventListener("storage", handleStorageChange as EventListener);
      window.removeEventListener("guli_reels_updated", handleStorageChange as EventListener);
      window.removeEventListener("pagehide", stopAllReelMedia);
      document.removeEventListener("visibilitychange", stopWhenPageIsHidden);
      // Route exit/unmount must stop every active or preloaded video immediately.
      stopAllReelMedia();
      videoRefs.current.clear();
      videoRefCallbacks.current.clear();
    };
  }, [reloadReels, stopAllReelMedia]);

  const currentReel = reels[currentIndex];
  const lastPositionWriteRef = useRef(0);
  useEffect(() => {
    if (currentReel) saveCurrentReel(currentReel.id);
  }, [currentReel?.id]);

  const viewedReelIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentReel || viewedReelIdsRef.current.has(currentReel.id)) return;
    viewedReelIdsRef.current.add(currentReel.id);
    markReelSeen(currentReel.id);
    recordServerReelView(currentReel.id).then(({ viewsCount }) => {
      setReels((previous) => previous.map((r) => r.id === currentReel.id ? { ...r, viewsCount } : r));
    }).catch((error) => console.warn("[Reels] Ko'rish statistikasi saqlanmadi:", error));
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
    let effectIsCurrent = true;
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
        const savedPosition = readSavedReelPosition();
        if (savedPosition?.reelId === currentReel.id && savedPosition.currentTime > 1) {
          const restorePlaybackPosition = () => {
            if (Number.isFinite(activeVideo.duration) && savedPosition.currentTime < activeVideo.duration - 1) {
              activeVideo.currentTime = savedPosition.currentTime;
            }
          };
          if (activeVideo.readyState >= 1) restorePlaybackPosition();
          else activeVideo.addEventListener("loadedmetadata", restorePlaybackPosition, { once: true });
        }
        // User requested: reels ga kirish bilan video avtomatik ovozli rejimda bo'lsin
        activeVideo.muted = isMuted;
        const playPromise = activeVideo.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (!effectIsCurrent) {
                activeVideo.pause();
                return;
              }
              setIsLoadingVideo(false);
              setIsPlaying(true);
            })
            .catch(() => {
              if (!effectIsCurrent) return;
              // Browser autoplay policy might restrict unmuted audio before user interaction
              // Fallback to muted playback so video runs, then unmute on first gesture
              activeVideo.muted = true;
              activeVideo
                .play()
                .then(() => {
                  if (!effectIsCurrent) {
                    activeVideo.pause();
                    return;
                  }
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
    return () => {
      effectIsCurrent = false;
      // If this playback effect is replaced, don't leave its video audible.
      if (currentReel) {
        const previousVideo = videoRefs.current.get(currentReel.id);
        previousVideo?.pause();
      }
    };
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
      const now = Date.now();
      if (currentReel && now - lastPositionWriteRef.current >= 2000) {
        lastPositionWriteRef.current = now;
        try {
          localStorage.setItem(REELS_POSITION_STORAGE_KEY, JSON.stringify({ reelId: currentReel.id, currentTime: videoEl.currentTime }));
        } catch { /* local storage may be unavailable */ }
      }
    }
  };

  // Like Reel handler
  const handleToggleLike = useCallback(async () => {
    if (!currentReel) return;
    try {
      const result = await toggleServerReelLike(currentReel.id);
      setReels((previous) => previous.map((r) => r.id === currentReel.id
        ? { ...r, isLiked: result.isLiked, likesCount: result.likesCount }
        : r));
      if (result.isLiked) showToast("❤️ Sizga yoqdi");
    } catch (error) {
      console.error("[Reels] Like saqlanmadi:", error);
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

  // Add Comment handler
  const handleAddComment = async (reelId: string, newComment: ReelComment) => {
    try {
      const saved = await addServerReelComment(reelId, newComment.text);
      setReels((previous) => previous.map((r) => r.id === reelId
        ? { ...r, commentsCount: r.commentsCount + 1, comments: [saved, ...r.comments] }
        : r));
      showToast("✓ Izoh serverda saqlandi!");
    } catch (error) {
      console.error("[Reels] Izoh saqlanmadi:", error);
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

  if (showBrowserInstallGate) {
    return (
      <main className="reelsContainer reelsEmptyView reelsInstallGate">
        <div className="reelsEmptyContent reelsInstallGateContent">
          <div className="reelsInstallBrandIcon" aria-hidden="true">
            <Reels3DIcon active width={120} height={120} />
          </div>
          <h2 className="reelsEmptyTitle reelsInstallGateTitle">Reels ko‘rish uchun</h2>
          <p className="reelsEmptySubtitle reelsInstallGateSubtitle">GULI MARKET’ni oching</p>
          <button type="button" className="reelsInstallIconButton" onClick={() => void handleInstallApp()} aria-label="GULI MARKET’ni o‘rnatish" disabled={isInstallingApp}>
            {isInstallingApp ? (
              <span className="reelsInstallSpinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v4h14v-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </main>
    );
  }

  if (reels.length === 0 && isLoadingReels) {
    return (
      <main className="reelsContainer reelsEmptyView" aria-busy="true">
        <div className="reelsEmptyContent">
          <div className="reelsEmptyIcon">🎬</div>
          <h2 className="reelsEmptyTitle">Reels yuklanmoqda…</h2>
        </div>
      </main>
    );
  }

  // Distinguish a server failure from a successfully loaded empty feed.
  if (reels.length === 0 && reelsLoadError) {
    return (
      <main className="reelsContainer reelsEmptyView" role="alert">
        <div className="reelsEmptyContent">
          <div className="reelsEmptyIcon">⚠️</div>
          <h2 className="reelsEmptyTitle">Reels serveriga ulanib bo‘lmadi</h2>
          <p className="reelsEmptySubtitle">Demo videolar ko‘rsatilmayapti. Internet yoki server aloqasini tekshirib, qayta urinib ko‘ring.</p>
          <div className="reelsEmptyActions">
            <button type="button" className="reelsBtnPrimary" onClick={() => { setIsLoadingReels(true); void reloadReels(); }}>
              🔄 Qayta urinish
            </button>
            {onBack && <button type="button" className="reelsBtnSecondary" onClick={onBack}>🏠 Bosh sahifaga qaytish</button>}
          </div>
        </div>
      </main>
    );
  }

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
                        ref={getVideoRefCallback(reel.id)}
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
                  <div className="reelsAuthorRow">
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
