import React, { useState, useRef, useCallback } from "react";
import { type Language } from "../utils/translations";

interface PullToRefreshProps {
  onRefresh: () => Promise<any>;
  children: React.ReactNode;
  language?: Language;
  disabled?: boolean;
  className?: string;
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  language = "uz",
  disabled = false,
  className = "",
  pullText,
  releaseText,
  refreshingText,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const threshold = 65; // px to trigger refresh
  const maxPull = 95; // max visual pull distance

  const defaultPullText = pullText || (language === "ru" ? "Потяните для обновления" : language === "en" ? "Pull to refresh" : "Yangilash uchun pastga torting");
  const defaultReleaseText = releaseText || (language === "ru" ? "Отпустите для обновления" : language === "en" ? "Release to refresh" : "Yangilash uchun qo‘yib yuboring");
  const defaultRefreshingText = refreshingText || (language === "ru" ? "Обновление данных..." : language === "en" ? "Updating..." : "Ma’lumotlar yangilanmoqda...");

  const triggerHaptic = (type: "light" | "medium" | "success" | "warning") => {
    try {
      if (type === "success" || type === "warning") {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
      } else {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(type);
      }
    } catch {}
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(52); // Keep header visible during refresh
    triggerHaptic("medium");

    try {
      await onRefresh();
      triggerHaptic("success");
    } catch (e) {
      console.error("Pull to refresh failed", e);
    } finally {
      // Smooth exit
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
        pullDistanceRef.current = 0;
      }, 350);
    }
  }, [onRefresh]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || refreshing) return;
    
    // Check if at the top of scroll
    const isAtTop = window.scrollY <= 3 || (containerRef.current && containerRef.current.scrollTop <= 3);
    if (!isAtTop) return;

    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled || refreshing) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - startYRef.current;
    const diffX = currentX - startXRef.current;

    // Check if vertical gesture dominant
    if (Math.abs(diffX) > Math.abs(diffY)) {
      isDraggingRef.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const isAtTop = window.scrollY <= 3 || (containerRef.current && containerRef.current.scrollTop <= 3);
    if (!isAtTop && diffY > 0) {
      return;
    }

    if (diffY > 0) {
      // Apply rubber-band damping
      const damped = Math.min(diffY * 0.48, maxPull);
      pullDistanceRef.current = damped;
      setPullDistance(damped);
      setIsPulling(true);

      if (damped >= threshold && pullDistance < threshold) {
        triggerHaptic("light");
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current || disabled || refreshing) {
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = false;

    if (pullDistanceRef.current >= threshold) {
      handleRefresh();
    } else {
      setPullDistance(0);
      setIsPulling(false);
      pullDistanceRef.current = 0;
    }
  };

  // Mouse handlers for desktop preview support
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || refreshing) return;
    const isAtTop = window.scrollY <= 3 || (containerRef.current && containerRef.current.scrollTop <= 3);
    if (!isAtTop) return;

    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled || refreshing) return;
    const diffY = e.clientY - startYRef.current;
    if (diffY > 0) {
      const damped = Math.min(diffY * 0.45, maxPull);
      pullDistanceRef.current = damped;
      setPullDistance(damped);
      setIsPulling(true);
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (pullDistanceRef.current >= threshold) {
      handleRefresh();
    } else {
      setPullDistance(0);
      setIsPulling(false);
      pullDistanceRef.current = 0;
    }
  };

  const isReadyToRelease = pullDistance >= threshold;
  const progressPercent = Math.min(Math.round((pullDistance / threshold) * 100), 100);

  return (
    <div
      ref={containerRef}
      className={`pullToRefreshContainer ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className={`ptrIndicator ${isPulling ? "pulling" : ""} ${refreshing ? "refreshing" : ""} ${isReadyToRelease ? "ready" : ""}`}
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 8 || refreshing ? 1 : 0,
        }}
        aria-hidden={!isPulling && !refreshing}
      >
        <div className="ptrContent">
          <div className={`ptrSpinnerWrap ${refreshing ? "spin" : ""}`}>
            {refreshing ? (
              <span className="ptrLoader" />
            ) : (
              <span
                className="ptrIcon"
                style={{
                  transform: `rotate(${Math.min(pullDistance * 3.6, 180)}deg)`,
                }}
              >
                ↓
              </span>
            )}
          </div>
          <span className="ptrLabel">
            {refreshing
              ? defaultRefreshingText
              : isReadyToRelease
              ? defaultReleaseText
              : defaultPullText}
          </span>
          {!refreshing && pullDistance > 12 && (
            <span className="ptrPercentage">{progressPercent}%</span>
          )}
        </div>
      </div>

      <div
        className="ptrInnerContent"
        style={{
          transform: pullDistance > 0 ? `translate3d(0, ${pullDistance * 0.28}px, 0)` : undefined,
          transition: isDraggingRef.current ? "none" : "transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
