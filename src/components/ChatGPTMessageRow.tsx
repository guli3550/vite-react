import React, { useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  Trash2,
  Play,
  Pause,
  Pencil,
  Reply,
} from "lucide-react";
import { ChatGPTMarkdown } from "./ChatGPTMarkdown";
import { CircleVideoNotePlayer } from "./CircleVideoNote";
import type { ChatMessage } from "../utils/chatSync";

interface ChatGPTMessageRowProps {
  msg: ChatMessage;
  isUser: boolean;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
  onCopy: (text: string) => void;
  onReply: (msg: ChatMessage) => void;
  onToggleBookmark?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (msg: ChatMessage) => void;
  playingAudioId?: string | null;
  onTogglePlayAudio?: (id: string, url: string) => void;
  onImageClick?: (url: string) => void;
  senderName?: string;
  senderAvatar?: string;
}

export const ChatGPTMessageRow: React.FC<ChatGPTMessageRowProps> = ({
  msg,
  isUser,
  isStreaming = false,
  onStreamComplete,
  onCopy,
  onReply,
  onToggleBookmark,
  onDelete,
  onEdit,
  playingAudioId,
  onTogglePlayAudio,
  onImageClick,
  senderName = "GULI Support",
  senderAvatar = "/guli_logo.jpg",
}) => {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);

  const handleCopy = () => {
    onCopy(msg.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "GULI Lingerie Xabari",
          text: msg.text,
        });
      } catch {
        // Ignored
      }
    } else {
      handleCopy();
    }
  };

  // Check if text is just a generic image/media placeholder or raw filename like "Screenshot_2026-08...jpg"
  const isImagePlaceholder =
    Boolean(msg.mediaUrl) &&
    (!msg.text ||
      /^(\u{1F4F8}|\u{1F4F7}|\[|\(|📁|📄)?\s*(rasm|photo|image|biriktirilgan|file|fayl|screenshot|img|pic)/iu.test(
        msg.text.trim()
      ) ||
      /\.(jpg|jpeg|png|webp|gif|svg|bmp|mp4|mov|webm)$/i.test(msg.text.trim()) ||
      /^Screenshot_[\d_-]+/i.test(msg.text.trim()) ||
      /^IMG_[\d_-]+/i.test(msg.text.trim()));

  const hasGenuineText = Boolean(msg.text && !isImagePlaceholder);
  const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. USER TURN: Clean soft pill with bottom actions and status
  if (isUser) {
    return (
      <div
        id={`chat-msg-${msg.id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          width: "100%",
          margin: "8px 0",
        }}
      >
        <div
          className="chatgpt-user-bubble"
          style={{
            background: "#EBF3FE",
            color: "#0D0D0D",
            borderRadius: "18px",
            padding: "10px 14px",
            maxWidth: "85%",
            width: "fit-content",
            boxShadow: "none",
            border: "none",
            fontSize: "14.5px",
            lineHeight: 1.5,
          }}
        >
          {/* Quoted reply if any */}
          {msg.replyToText && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                background: "rgba(37, 99, 235, 0.09)",
                borderLeft: "3px solid #2563EB",
                borderRadius: "0 8px 8px 0",
                padding: "5px 9px",
                marginBottom: "7px",
                fontSize: "12px",
              }}
            >
              <Reply size={12} style={{ color: "#2563EB", flexShrink: 0, marginTop: "2px" }} />
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontWeight: 650, color: "#2563EB", fontSize: "11px" }}>
                  {msg.replyToSender || "GULI Support"}
                </div>
                <div style={{ color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {msg.replyToText}
                </div>
              </div>
            </div>
          )}

          {/* Media Attachments - Image */}
          {msg.mediaUrl && msg.type === "image" && (
            <div
              style={{ margin: "4px 0", cursor: "pointer", borderRadius: "12px", overflow: "hidden" }}
              onClick={() => onImageClick?.(msg.mediaUrl!)}
            >
              <img
                src={msg.mediaUrl}
                alt="Rasm"
                style={{
                  maxWidth: "100%",
                  maxHeight: "260px",
                  objectFit: "contain",
                  borderRadius: "12px",
                  display: "block",
                }}
              />
            </div>
          )}

          {/* Video Note */}
          {msg.mediaUrl && (msg.type === "video_note" || msg.type === "video") && (
            <div style={{ margin: "4px 0" }}>
              <CircleVideoNotePlayer mediaUrl={msg.mediaUrl} duration={msg.videoDuration || 5} size={150} />
            </div>
          )}

          {/* Audio */}
          {msg.mediaUrl && msg.type === "audio" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 12px",
                background: "rgba(37, 99, 235, 0.1)",
                borderRadius: "16px",
                margin: "4px 0",
              }}
            >
              <button
                type="button"
                onClick={() => onTogglePlayAudio?.(msg.id, msg.mediaUrl!)}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                {playingAudioId === msg.id ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <span style={{ fontSize: "12px", color: "#1e40af", fontWeight: 600 }}>
                {msg.audioDuration ? `0:${msg.audioDuration < 10 ? "0" : ""}${msg.audioDuration}` : "0:05"}
              </span>
            </div>
          )}

          {/* Genuine user message text (if not a redundant image placeholder) */}
          {hasGenuineText && (
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.text}
            </div>
          )}
        </div>

        {/* Minimal action & status row under user bubble */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "3px",
            paddingRight: "4px",
          }}
        >
          {hasGenuineText && (
            <button
              type="button"
              onClick={handleCopy}
              className="chatgpt-icon-btn"
              title="Nusxa olish"
            >
              {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onReply(msg)}
            className="chatgpt-icon-btn"
            title="Javob berish"
          >
            <Reply size={13} />
          </button>

          {onToggleBookmark && (
            <button
              type="button"
              onClick={() => onToggleBookmark(msg.id)}
              className="chatgpt-icon-btn"
              title={msg.isBookmarked ? "Xatcho'pdan chiqarish" : "Xatcho'p"}
            >
              <Bookmark size={12} color={msg.isBookmarked ? "#F59E0B" : undefined} />
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(msg)}
              className="chatgpt-icon-btn"
              title="Tahrirlash"
            >
              <Pencil size={12} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(msg.id)}
              className="chatgpt-icon-btn"
              title="O'chirish"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Timestamp and Delivery Checkmarks in function row */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: "#94A3B8",
              marginLeft: "4px",
              fontWeight: 500,
            }}
          >
            <span>{formattedTime}</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: msg.read ? "#2563EB" : "#94A3B8",
              }}
              title={msg.read ? "O'qildi" : "Yetkazildi"}
            >
              {msg.read ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L7 17l-5-5" />
                  <path d="M22 10l-7.5 7.5-1.5-1.5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. ASSISTANT / ADMIN TURN: ChatGPT & Gemini Style
  return (
    <div
      id={`chat-msg-${msg.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
        margin: "12px 0",
      }}
    >
      {/* Sender Header with Real Verified Blue Checkmark */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px" }}>
        <img
          src={senderAvatar}
          alt={senderName}
          style={{
            width: "24px",
            height: "24px",
            minWidth: "24px",
            minHeight: "24px",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            objectFit: "cover",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            flexShrink: 0,
            display: "block",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/guli_logo.jpg";
          }}
        />
        <span style={{ fontWeight: 650, fontSize: "13.5px", color: "#09090B" }}>
          {senderName}
        </span>
        {/* Genuine Verified Blue Badge */}
        <span style={{ display: "inline-flex", alignItems: "center" }} title="Rasmiy tasdiqlangan xizmat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle" }}>
            <path
              d="M22.5 12.5c0-1.58-.87-2.95-2.18-3.65.5-1.55.19-3.28-.93-4.4-1.12-1.12-2.85-1.43-4.4-.93C14.29 2.21 12.92 1.34 11.34 1.34s-2.95.87-3.65 2.18c-1.55-.5-3.28-.19-4.4.93-1.12 1.12-1.43 2.85-.93 4.4C1.05 9.55.18 10.92.18 12.5s.87 2.95 2.18 3.65c-.5 1.55-.19 3.28.93 4.4 1.12 1.12 2.85 1.43 4.4.93.7 1.31 2.07 2.18 3.65 2.18s2.95-.87 3.65-2.18c1.55.5 3.28.19 4.4-.93 1.12-1.12 1.43-2.85.93-4.4 1.31-.7 2.18-2.07 2.18-3.65z"
              fill="#1D9BF0"
            />
            <path
              d="M10.2 16.2L6.5 12.5L7.9 11.1L10.2 13.4L16.1 7.5L17.5 8.9L10.2 16.2Z"
              fill="#FFFFFF"
            />
          </svg>
        </span>
      </div>

      {/* Quoted reply preview if any */}
      {msg.replyToText && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            background: "#F4F4F5",
            borderLeft: "3px solid #BE123C",
            borderRadius: "0 8px 8px 0",
            padding: "5px 9px",
            marginBottom: "8px",
            fontSize: "12px",
            maxWidth: "90%",
          }}
        >
          <Reply size={12} style={{ color: "#BE123C", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontWeight: 650, color: "#BE123C", fontSize: "11px" }}>
              {msg.replyToSender || "Mijoz"}
            </div>
            <div style={{ color: "#52525B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {msg.replyToText}
            </div>
          </div>
        </div>
      )}

      {/* Media Attachments - Image */}
      {msg.mediaUrl && msg.type === "image" && (
        <div
          style={{ margin: "6px 0", cursor: "pointer", borderRadius: "12px", overflow: "hidden" }}
          onClick={() => onImageClick?.(msg.mediaUrl!)}
        >
          <img
            src={msg.mediaUrl}
            alt="Rasm"
            style={{
              maxWidth: "100%",
              maxHeight: "320px",
              objectFit: "contain",
              borderRadius: "12px",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Video Note */}
      {msg.mediaUrl && (msg.type === "video_note" || msg.type === "video") && (
        <div style={{ margin: "6px 0" }}>
          <CircleVideoNotePlayer mediaUrl={msg.mediaUrl} duration={msg.videoDuration || 5} size={160} />
        </div>
      )}

      {/* Audio */}
      {msg.mediaUrl && msg.type === "audio" && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 12px",
            background: "rgba(190, 18, 60, 0.08)",
            borderRadius: "16px",
            margin: "4px 0",
          }}
        >
          <button
            type="button"
            onClick={() => onTogglePlayAudio?.(msg.id, msg.mediaUrl!)}
            style={{
              background: "#BE123C",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            {playingAudioId === msg.id ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <span style={{ fontSize: "12px", color: "#BE123C", fontWeight: 600 }}>
            {msg.audioDuration ? `0:${msg.audioDuration < 10 ? "0" : ""}${msg.audioDuration}` : "0:05"}
          </span>
        </div>
      )}

      {/* Primary Message Content rendered with Typewriter Markdown */}
      {hasGenuineText && (
        <div style={{ width: "100%", maxWidth: "800px" }}>
          <ChatGPTMarkdown
            content={msg.text}
            isStreaming={isStreaming}
            onStreamComplete={onStreamComplete}
          />
        </div>
      )}

      {/* Action Bar with Copy, ThumbsUp/Down, Share, Reply and Timestamp */}
      <div
        className="chatgpt-actions-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "2px",
          paddingTop: "0px",
        }}
      >
        {hasGenuineText && (
          <button
            type="button"
            className="chatgpt-icon-btn"
            onClick={handleCopy}
            title="Nusxa olish"
          >
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
          </button>
        )}

        <button
          type="button"
          className="chatgpt-icon-btn"
          onClick={() => setReaction((prev) => (prev === "like" ? null : "like"))}
          title="Foydali javob"
          style={{ color: reaction === "like" ? "#0D0D0D" : undefined }}
        >
          <ThumbsUp size={14} fill={reaction === "like" ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          className="chatgpt-icon-btn"
          onClick={() => setReaction((prev) => (prev === "dislike" ? null : "dislike"))}
          title="Foydasiz javob"
          style={{ color: reaction === "dislike" ? "#E11D48" : undefined }}
        >
          <ThumbsDown size={14} fill={reaction === "dislike" ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          className="chatgpt-icon-btn"
          onClick={handleShare}
          title="Ulashish"
        >
          <Share2 size={14} />
        </button>

        <button
          type="button"
          className="chatgpt-icon-btn"
          onClick={() => onReply(msg)}
          title="Javob berish"
        >
          <Reply size={14} />
        </button>

        {onToggleBookmark && (
          <button
            type="button"
            className="chatgpt-icon-btn"
            onClick={() => onToggleBookmark(msg.id)}
            title={msg.isBookmarked ? "Xatcho'pdan chiqarish" : "Xatcho'p"}
          >
            <Bookmark size={13} color={msg.isBookmarked ? "#F59E0B" : undefined} />
          </button>
        )}

        {onEdit && (
          <button
            type="button"
            className="chatgpt-icon-btn"
            onClick={() => onEdit(msg)}
            title="Tahrirlash"
          >
            <Pencil size={13} />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="chatgpt-icon-btn"
            onClick={() => onDelete(msg.id)}
            title="O'chirish"
          >
            <Trash2 size={13} />
          </button>
        )}

        {/* Timestamp */}
        <span
          style={{
            fontSize: "11px",
            color: "#A1A1AA",
            marginLeft: "4px",
            fontWeight: 500,
          }}
        >
          {formattedTime}
        </span>
      </div>
    </div>
  );
};
