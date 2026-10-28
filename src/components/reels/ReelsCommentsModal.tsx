import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ReelItem, ReelComment } from "../../types/reels";
import {
  evaluateCommentsSheetDrag,
  type CommentsSheetHeight,
} from "../../utils/reelsEngine";

interface ReelsCommentsModalProps {
  reel: ReelItem;
  isOpen: boolean;
  onClose: () => void;
  onAddComment: (reelId: string, newComment: ReelComment) => void;
}

export const ReelsCommentsModal: React.FC<ReelsCommentsModalProps> = ({
  reel,
  isOpen,
  onClose,
  onAddComment,
}) => {
  const [inputText, setInputText] = useState("");
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});
  const [heightState, setHeightState] = useState<CommentsSheetHeight>("collapsed");
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const commentsListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartYRef = useRef<number>(0);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const newComment: ReelComment = {
      id: `c_${Date.now()}`,
      authorName: "Siz (Mehmon)",
      authorAvatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
      text: trimmed,
      createdAt: "Hozirgina",
      likesCount: 0,
      isLiked: false,
    };

    onAddComment(reel.id, newComment);
    setInputText("");

    // Scroll to top where the newly prepended comment is displayed
    setTimeout(() => {
      commentsListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
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
                Izohlar ({reel.comments.length})
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
          {reel.comments.length === 0 ? (
            <div className="reelsEmptyComments">
              <span className="reelsEmptyEmoji">💬</span>
              <p className="reelsEmptyText">Hozircha izohlar yo‘q</p>
              <small className="reelsEmptySub">
                Birinchi bo‘lib fikringizni bildiring!
              </small>
            </div>
          ) : (
            reel.comments.map((comment) => {
              const isLiked = likedComments[comment.id] || comment.isLiked;
              const likes = comment.likesCount + (likedComments[comment.id] ? 1 : 0);
              const isOfficial =
                comment.authorName.toLowerCase().includes("guli market") ||
                comment.authorName.toLowerCase().includes("support");

              return (
                <div key={comment.id} className="reelsCommentItem">
                  <img
                    src={comment.authorAvatar}
                    alt={comment.authorName}
                    className="reelsCommentAvatar"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        isOfficial
                          ? "/guli-logo.png"
                          : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80";
                    }}
                  />
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
                          {comment.createdAt}
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
              <img
                src="/guli-logo.png"
                alt="Foydalanuvchi"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/icons/icon-192.png";
                }}
              />
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
              disabled={!inputText.trim()}
              aria-label="Yuborish"
            >
              Yuborish
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
