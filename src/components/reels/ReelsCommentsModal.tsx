import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ReelItem, ReelComment } from "../../types/reels";
import { fetchServerReelComments } from "../../lib/reelsApi";
import {
  evaluateCommentsSheetDrag,
  type CommentsSheetHeight,
} from "../../utils/reelsEngine";

function formatCommentDateTime(value: string): string {
  if (!value || value === "Hozirgina") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  const dateText = `${part("year")}-${part("month")}-${part("day")}`;
  const timeText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${dateText} ${timeText}`;
}

interface ReelsCommentsModalProps {
  reel: ReelItem;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (reelId: string, newComment: ReelComment) => Promise<ReelComment>;
}

function getCurrentUserProfile(): { name: string; avatar: string } {
  if (typeof window === "undefined") {
    return { name: "GULI mijozi", avatar: "" };
  }

  // 1. Check authenticated user profile in localStorage
  try {
    const raw = localStorage.getItem("guli_auth_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        const name = parsed.full_name || parsed.name || parsed.username || parsed.telegram_username || parsed.email?.split("@")[0] || "";
        const avatar = parsed.avatar_url || parsed.avatar || "";
        if (name) return { name, avatar };
      }
    }
  } catch {}

  // 2. Check Telegram WebApp user
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  if (tgUser) {
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
    const avatar = tgUser.photo_url || "";
    if (name) return { name, avatar };
  }

  // 3. Check custom localStorage fields
  const firstName = localStorage.getItem("guli_first_name") || "";
  const lastName = localStorage.getItem("guli_last_name") || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const customAvatar =
    localStorage.getItem("guli_custom_avatar") ||
    localStorage.getItem("guli_avatar_url") ||
    "";

  if (fullName) {
    return { name: fullName, avatar: customAvatar };
  }

  return { name: "GULI mijozi", avatar: customAvatar };
}

export const ReelsCommentsModal: React.FC<ReelsCommentsModalProps> = ({
  reel,
  isOpen,
  onClose,
  onAddComment,
}) => {
  const [inputText, setInputText] = useState("");
  const [comments, setComments] = useState<ReelComment[]>(reel.comments || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});
  const [heightState, setHeightState] = useState<CommentsSheetHeight>("collapsed");
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const commentsListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartYRef = useRef<number>(0);

  useEffect(() => { setComments(reel.comments || []); }, [reel.id, reel.comments]);

  // Pull shared comments from the server while the sheet is open.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const refresh = async () => {
      try {
        const latest = await fetchServerReelComments(reel.id);
        if (active) setComments(latest);
      } catch (error) {
        console.warn("[Reels] Could not refresh shared comments:", error);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isOpen, reel.id]);

  // Lock background body scrolling while comments bottom sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset sheet state on modal open without auto-focusing keyboard
  useEffect(() => {
    if (isOpen) {
      setHeightState("collapsed");
      setDragOffsetY(0);
      setIsDraggingHandle(false);
    }
  }, [isOpen]);

  // Touch gesture handling on the handle
  const handleHandleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    dragStartYRef.current = e.touches[0].clientY;
    setIsDraggingHandle(true);
  };

  const handleHandleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDraggingHandle) return;
    const currentY = e.touches[0].clientY;
    const diffY = currentY - dragStartYRef.current;
    // Allow slight drag visual feedback
    setDragOffsetY(diffY);
  };

  const handleHandleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDraggingHandle) return;
    setIsDraggingHandle(false);
    const deltaY = -dragOffsetY; // Positive = dragged UP
    const decision = evaluateCommentsSheetDrag(heightState, deltaY);

    if (decision === "expanded") {
      setHeightState("expanded");
    } else if (decision === "collapsed") {
      setHeightState("collapsed");
    } else if (decision === "close") {
      onClose();
    }
    setDragOffsetY(0);
    dragStartYRef.current = 0;
  };

  // Toggle between collapsed (60vh) and expanded (92vh) by clicking handle
  const toggleHeightState = useCallback(() => {
    setHeightState((prev) => (prev === "collapsed" ? "expanded" : "collapsed"));
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const userProfile = getCurrentUserProfile();
      const pending: ReelComment = {
        id: "pending_" + Date.now(),
        authorName: userProfile.name,
        authorAvatar: userProfile.avatar || "",
        text: trimmed,
        createdAt: "Hozirgina",
        likesCount: 0,
        isLiked: false,
      };
      const saved = await onAddComment(reel.id, pending);
      setComments((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setInputText("");
      setTimeout(() => commentsListRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 80);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Izoh yuborilmadi. Qayta urinib ko‘ring.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const quickEmojis = ["😍", "❤️", "🔥", "✨", "👏", "👍", "🌸"];

  return (
    <div
      className="reelsModalOverlay"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Izohlar"
    >
      <div
        className={`reelsCommentsSheet ${heightState === "expanded" ? "expanded" : "collapsed"}`}
        style={
          isDraggingHandle
            ? {
                transform: `translate3d(0, ${Math.max(-80, Math.min(140, dragOffsetY))}px, 0)`,
                transition: "none",
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Top Header & Drag Handle Area */}
        <div
          className="reelsSheetHeader"
          onTouchStart={handleHandleTouchStart}
          onTouchMove={handleHandleTouchMove}
          onTouchEnd={handleHandleTouchEnd}
          onTouchCancel={handleHandleTouchEnd}
        >
          {/* Visual Drag Handle: Tap to toggle height, drag to expand / collapse */}
          <div
            className="reelsSheetHandleTouchArea"
            onClick={toggleHeightState}
            title={
              heightState === "collapsed"
                ? "Yuqoriga tortib to‘liq ochish"
                : "Pastga tortib kichraytirish"
            }
          >
            <div className="reelsSheetHandle" />
          </div>

          <div className="reelsSheetTitleRow">
            <div className="reelsSheetTitleLeft">
              <span className="reelsSheetTitle">
                Izohlar ({comments.length})
              </span>
            </div>

            <button
              type="button"
              className="reelsCloseBtn"
              onClick={onClose}
              aria-label="Yopish"
              title="Yopish"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Comments List: Only this section scrolls */}
        <div
          className="reelsCommentsList"
          ref={commentsListRef}
          tabIndex={0}
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {comments.length === 0 ? (
            <div className="reelsEmptyComments">
              <span className="reelsEmptyEmoji">💬</span>
              <p className="reelsEmptyText">Hozircha izohlar yo‘q</p>
              <small className="reelsEmptySub">
                Birinchi bo‘lib fikringizni bildiring!
              </small>
            </div>
          ) : (
            comments.map((comment) => {
              const isLiked = likedComments[comment.id] || comment.isLiked;
              const likes = comment.likesCount + (likedComments[comment.id] ? 1 : 0);
              const isOfficial =
                comment.authorName.toLowerCase().includes("guli market") ||
                comment.authorName.toLowerCase().includes("support");

              return (
                <div key={comment.id} className="reelsCommentItem">
                  {comment.authorAvatar ? (
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      className="reelsCommentAvatar"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div
                      className="reelsCommentAvatar"
                      aria-label={comment.authorName}
                      style={{ display: "grid", placeItems: "center", background: "linear-gradient(135deg, #ff4d79, #f43f5e)", color: "#fff", fontWeight: 800 }}
                    >
                      {(comment.authorName.trim()[0] || "G").toUpperCase()}
                    </div>
                  )}
                  <div className="reelsCommentContent">
                    <div className="reelsCommentAuthorRow">
                      <span className="reelsCommentAuthor">
                        {comment.authorName}
                      </span>
                      {isOfficial && (
                        <span
                          className="reelsCommentVerifiedBadge"
                          title="Rasmiy qo‘llab-quvvatlash"
                        >
                          ✓
                        </span>
                      )}
                      {comment.createdAt && (
                        <span className="reelsCommentTime">
                          {formatCommentDateTime(comment.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="reelsCommentBody">{comment.text}</p>
                  </div>
                  <button
                    type="button"
                    className={`reelsCommentLikeBtn ${isLiked ? "active" : ""}`}
                    onClick={() => toggleCommentLike(comment.id)}
                    aria-label={isLiked ? "Like bekor qilish" : "Like bosish"}
                    title={isLiked ? "Yoqdi" : "Yoqtirish"}
                  >
                    <span className="reelsCommentHeartIcon">
                      {isLiked ? "❤️" : "🤍"}
                    </span>
                    {likes > 0 && (
                      <span className="reelsCommentLikeCount">{likes}</span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Pinned Bottom Composer Section */}
        <div
          className="reelsComposerWrapper"
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Quick Reaction Emojis */}
          <div className="reelsEmojiBar" aria-label="Tezkor emojilar">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="reelsEmojiBtn"
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  inputRef.current?.focus();
                }}
                aria-label={`${emoji} reaksiyasi`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Comment Form */}
          <form className="reelsCommentForm" onSubmit={handleSubmit}>
            <div className="reelsUserAvatarMini">
              {getCurrentUserProfile().avatar ? (
                <img
                  src={getCurrentUserProfile().avatar}
                  alt={getCurrentUserProfile().name}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ff4d79, #f43f5e)",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "13px",
                  }}
                >
                  {(getCurrentUserProfile().name[0] || "G").toUpperCase()}
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              className="reelsCommentInput"
              placeholder="Izoh qoldiring..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={300}
              aria-label="Izoh matni"
            />

            <button
              type="submit"
              className="reelsCommentSubmit"
              disabled={!inputText.trim() || isSubmitting}
              aria-label="Yuborish"
            >
              {isSubmitting ? "Yuborilmoqda..." : "Yuborish"}
            </button>
          </form>
          {submitError && <div className="reelsCommentSubmitError" role="alert">{submitError}</div>}
        </div>
      </div>
    </div>
  );
};
