import React, { useState, useRef, useEffect, useCallback } from "react";

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  align: "left" | "right";
  onReply: () => void;
  className?: string;
  id?: string;
}

export function SwipeableMessageRow({
  children,
  align,
  onReply,
  className = "",
  id,
}: SwipeableMessageRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const handleStart = (clientX: number, clientY: number, target: HTMLElement, e: React.SyntheticEvent) => {
    // Ignore interactive controls inside bubble
    if (target.closest("button, a, audio, input, textarea, select, .chat2-action-icon, .chat2-reaction-pill")) {
      return;
    }

    // Stop propagation so background swipe never triggers when touching a message
    e.stopPropagation();

    startXRef.current = clientX;
    startYRef.current = clientY;
    isHorizontalRef.current = null;
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY, e.target as HTMLElement, e);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    handleStart(e.clientX, e.clientY, e.target as HTMLElement, e);
  };

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const deltaX = clientX - startXRef.current;
      const deltaY = clientY - startYRef.current;

      if (isHorizontalRef.current === null) {
        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
          isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
        }
      }

      if (isHorizontalRef.current) {
        if (align === "left") {
          // Incoming message: swipe LEFT (deltaX < 0) to reply
          const clamped = Math.min(0, Math.max(deltaX, -85));
          setTranslateX(clamped);
        } else {
          // Outgoing message: swipe RIGHT (deltaX > 0) to reply
          const clamped = Math.max(0, Math.min(deltaX, 85));
          setTranslateX(clamped);
        }
      }
    },
    [align, isDragging]
  );

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (
      (align === "left" && translateX <= -32) ||
      (align === "right" && translateX >= 32) ||
      Math.abs(translateX) >= 48
    ) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
      } catch {}
      onReply();
    }

    setTranslateX(0);
    isHorizontalRef.current = null;
  }, [align, isDragging, onReply, translateX]);

  // Window-level mouseup listener to catch drag release anywhere
  useEffect(() => {
    if (!isDragging) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onGlobalMouseUp = () => {
      handleEnd();
    };

    window.addEventListener("mousemove", onGlobalMouseMove);
    window.addEventListener("mouseup", onGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", onGlobalMouseMove);
      window.removeEventListener("mouseup", onGlobalMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  const replyIconScale = Math.min(1, Math.abs(translateX) / 35);
  const isTriggered = Math.abs(translateX) >= 32;

  return (
    <div
      id={id}
      className={`swipeableRowWrap ${align === "left" ? "swipeAlignLeft" : "swipeAlignRight"} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleMouseDown}
      style={{
        position: "relative",
        userSelect: "none",
        width: "100%",
        touchAction: "pan-y",
      }}
    >
      {/* Left Reply Indicator Badge */}
      {translateX > 0 && (
        <div
          className="swipeReplyIndicator leftIndicator"
          style={{
            position: "absolute",
            left: "8px",
            top: "50%",
            transform: `translateY(-50%) scale(${replyIconScale})`,
            opacity: replyIconScale > 0.1 ? 1 : 0,
            transition: isDragging ? "none" : "all 0.2s ease",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <div
            className={`swipeReplyPill ${isTriggered ? "activeTrigger" : ""}`}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: isTriggered ? "var(--primary, #c9526b)" : "rgba(201, 82, 107, 0.75)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "13px",
              boxShadow: "0 4px 12px rgba(201, 82, 107, 0.35)",
              transform: `rotate(${isTriggered ? "0deg" : "-15deg"})`,
            }}
          >
            <span>↩️</span>
          </div>
        </div>
      )}

      {/* Right Reply Indicator Badge */}
      {translateX < 0 && (
        <div
          className="swipeReplyIndicator rightIndicator"
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: `translateY(-50%) scale(${replyIconScale})`,
            opacity: replyIconScale > 0.1 ? 1 : 0,
            transition: isDragging ? "none" : "all 0.2s ease",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <div
            className={`swipeReplyPill ${isTriggered ? "activeTrigger" : ""}`}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: isTriggered ? "var(--primary, #c9526b)" : "rgba(201, 82, 107, 0.75)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "13px",
              boxShadow: "0 4px 12px rgba(201, 82, 107, 0.35)",
              transform: `rotate(${isTriggered ? "0deg" : "15deg"})`,
            }}
          >
            <span>↩️</span>
          </div>
        </div>
      )}

      {/* Bubble Content Wrapper */}
      <div
        className={`swipeableInnerBubble ${align === "left" ? "swipeAlignLeft" : "swipeAlignRight"}`}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          width: "100%",
          display: "flex",
          justifyContent: align === "left" ? "flex-start" : "flex-end",
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface SwipeableChatBackgroundProps {
  children: React.ReactNode;
  onExit: () => void;
  className?: string;
  id?: string;
}

export function SwipeableChatBackground({
  children,
  onExit,
  className = "",
  id,
}: SwipeableChatBackgroundProps) {
  const [bgTranslateX, setBgTranslateX] = useState(0);
  const [isSwipingBg, setIsSwipingBg] = useState(false);
  const bgStartXRef = useRef<number>(0);
  const bgStartYRef = useRef<number>(0);
  const isHorizontalBgRef = useRef<boolean | null>(null);

  const handleBgStart = (clientX: number, clientY: number, target: HTMLElement) => {
    // Ignore if target is interactive or inside a message bubble row
    if (
      target.closest(
        "input, textarea, button, a, select, audio, .swipeableRowWrap, .chatBubbleRow, .chat2-bubble-wrap, .chat2-bubble, .bubbleBox, .chatQuickChipsScroll, .chatInputBar, .chat2-quick-replies, .chat2-footer, .chat2-header-actions, .chat2-action-btn"
      )
    ) {
      return;
    }

    bgStartXRef.current = clientX;
    bgStartYRef.current = clientY;
    isHorizontalBgRef.current = null;
    setIsSwipingBg(true);
  };

  const handleBgTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleBgStart(touch.clientX, touch.clientY, e.target as HTMLElement);
  };

  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    handleBgStart(e.clientX, e.clientY, e.target as HTMLElement);
  };

  const handleBgMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isSwipingBg) return;
      const deltaX = clientX - bgStartXRef.current;
      const deltaY = clientY - bgStartYRef.current;

      if (isHorizontalBgRef.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalBgRef.current = deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;
        }
      }

      if (isHorizontalBgRef.current && deltaX > 0) {
        const clamped = Math.min(deltaX, 150);
        setBgTranslateX(clamped);
      }
    },
    [isSwipingBg]
  );

  const handleBgTouchMove = (e: React.TouchEvent) => {
    if (!isSwipingBg) return;
    const touch = e.touches[0];
    handleBgMove(touch.clientX, touch.clientY);
  };

  const handleBgEnd = useCallback(() => {
    if (!isSwipingBg) return;
    setIsSwipingBg(false);

    if (bgTranslateX >= 65) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
      } catch {}
      onExit();
    }

    setBgTranslateX(0);
    isHorizontalBgRef.current = null;
  }, [bgTranslateX, isSwipingBg, onExit]);

  // Window-level listeners for smooth mouse drag release
  useEffect(() => {
    if (!isSwipingBg) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      handleBgMove(e.clientX, e.clientY);
    };

    const onGlobalMouseUp = () => {
      handleBgEnd();
    };

    window.addEventListener("mousemove", onGlobalMouseMove);
    window.addEventListener("mouseup", onGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", onGlobalMouseMove);
      window.removeEventListener("mouseup", onGlobalMouseUp);
    };
  }, [isSwipingBg, handleBgMove, handleBgEnd]);

  const exitOpacity = Math.min(1, bgTranslateX / 55);

  return (
    <div
      id={id}
      className={`swipeableChatBgWrap ${className}`}
      onTouchStart={handleBgTouchStart}
      onTouchMove={handleBgTouchMove}
      onTouchEnd={handleBgEnd}
      onMouseDown={handleBgMouseDown}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "pan-y",
      }}
    >
      {/* Visual Exit Overlay Banner */}
      {bgTranslateX > 4 && (
        <div
          className="chatSwipeExitOverlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${bgTranslateX}px`,
            background: "linear-gradient(90deg, rgba(201, 82, 107, 0.22), rgba(201, 82, 107, 0.03))",
            borderRight: "2px solid var(--primary, #c9526b)",
            display: "flex",
            alignItems: "center",
            paddingLeft: "12px",
            zIndex: 999,
            pointerEvents: "none",
            opacity: exitOpacity,
            transition: isSwipingBg ? "none" : "all 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--primary, #c9526b)",
              color: "#ffffff",
              padding: "6px 13px",
              borderRadius: "999px",
              fontSize: "11.5px",
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(201, 82, 107, 0.4)",
              whiteSpace: "nowrap",
            }}
          >
            <span>‹</span>
            <span>Chiqish</span>
          </div>
        </div>
      )}

      <div
        style={{
          transform: `translateX(${bgTranslateX * 0.35}px)`,
          transition: isSwipingBg ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
