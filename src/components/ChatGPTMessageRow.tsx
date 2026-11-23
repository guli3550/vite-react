import React, { useEffect, useRef, useState } from "react";
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
  Download,
  FileText,
  MapPin,
  RotateCcw,
  Clock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { ChatGPTMarkdown } from "./ChatGPTMarkdown";
import { CircleVideoNotePlayer } from "./CircleVideoNote";
import {
  type ChatMessage,
  resolveQueuedMediaUrl,
  votePollOption,
} from "../utils/chatSync";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";

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
  onRetry?: (msg: ChatMessage) => void;
  onVotePoll?: (messageId: string, optionIndex: number) => void;
  playingAudioId?: string | null;
  onTogglePlayAudio?: (id: string, url: string) => void;
  onImageClick?: (url: string) => void;
  senderName?: string;
  senderAvatar?: string;
}

function formatDuration(sec?: number): string {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem}`;
}

function getFileBadge(fileName?: string, mimeType?: string): { label: string; color: string; bg: string } {
  const probe = `${fileName || ""} ${mimeType || ""}`.toLowerCase();
  if (probe.includes("pdf")) return { label: "PDF", color: "#DC2626", bg: "#FEE2E2" };
  if (probe.includes("doc")) return { label: "DOC", color: "#2563EB", bg: "#DBEAFE" };
  if (probe.includes("xls") || probe.includes("sheet")) return { label: "XLS", color: "#059669", bg: "#D1FAE5" };
  if (probe.includes("txt") || probe.includes("text/plain")) return { label: "TXT", color: "#475569", bg: "#E2E8F0" };
  if (probe.includes("zip")) return { label: "ZIP", color: "#D97706", bg: "#FEF3C7" };
  return { label: "FAYL", color: "#6D28D9", bg: "#EDE9FE" };
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
  onRetry,
  onVotePoll,
  playingAudioId,
  onTogglePlayAudio,
  onImageClick,
  senderName = "GULI Support",
  senderAvatar = GULI_LOGO_BASE64,
}) => {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [hydratedMediaUrl, setHydratedMediaUrl] = useState<string | undefined>(undefined);
  const [localAudioPlaying, setLocalAudioPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!msg.mediaUrl && msg.offlineMediaKey) {
      void resolveQueuedMediaUrl(msg.offlineMediaKey).then((url) => {
        if (alive && url) setHydratedMediaUrl(url);
      });
    } else {
      setHydratedMediaUrl(undefined);
    }
    return () => {
      alive = false;
    };
  }, [msg.mediaUrl, msg.offlineMediaKey]);

  useEffect(() => {
    return () => {
      if (localAudioRef.current) {
        localAudioRef.current.pause();
        localAudioRef.current = null;
      }
      if (previewDocUrl && previewDocUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewDocUrl);
      }
    };
  }, [previewDocUrl]);

  const effectiveMediaUrl = msg.mediaUrl || hydratedMediaUrl;

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
      } catch {}
    } else {
      handleCopy();
    }
  };

  const handleDownloadMedia = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!effectiveMediaUrl || downloading) return;
    setDownloading(true);
    try {
      const downloadUrl =
        effectiveMediaUrl.includes("/api/chat/media-file/") && !effectiveMediaUrl.includes("download=")
          ? `${effectiveMediaUrl}${effectiveMediaUrl.includes("?") ? "&" : "?"}download=1`
          : effectiveMediaUrl;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = msg.fileName || `guli-chat-${msg.type || "media"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      const a = document.createElement("a");
      a.href = effectiveMediaUrl;
      a.download = msg.fileName || "guli-chat-media";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  };

  const handlePreviewDoc = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveMediaUrl) return;
    try {
      const res = await fetch(effectiveMediaUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewDocUrl(blobUrl);
    } catch {
      await handleDownloadMedia();
    }
  };

  const handlePlayAudio = () => {
    if (!effectiveMediaUrl) return;
    if (onTogglePlayAudio) {
      onTogglePlayAudio(msg.id, effectiveMediaUrl);
      return;
    }
    if (!localAudioRef.current) {
      localAudioRef.current = new Audio();
      localAudioRef.current.onended = () => setLocalAudioPlaying(false);
    }
    if (localAudioPlaying) {
      localAudioRef.current.pause();
      setLocalAudioPlaying(false);
    } else {
      localAudioRef.current.src = effectiveMediaUrl;
      localAudioRef.current.play().catch(() => setLocalAudioPlaying(false));
      setLocalAudioPlaying(true);
    }
  };

  const isAudioPlaying = onTogglePlayAudio ? playingAudioId === msg.id : localAudioPlaying;

  // Determine whether text is just a redundant auto-generated placeholder for an attached media card
  const trimmedText = (msg.text || "").trim();
  const isMediaPlaceholder =
    Boolean(effectiveMediaUrl) &&
    (!trimmedText ||
      trimmedText === msg.fileName ||
      /^(\u{1F4F8}|\u{1F4F7}|\u{1F4F9}|\u{1F3AC}|\u{1F399}\uFE0F?|\u{1F4C1}|\u{1F4C4})?\s*(rasm|photo|image|biriktirilgan|file|fayl|hujjat|video|dumaloq video|ovozli xabar|screenshot|img|pic)/iu.test(
        trimmedText
      ) ||
      (msg.type === "file" && (/^(📁|📄)\s*/u.test(trimmedText) || /\.(pdf|docx?|xlsx?|txt|zip)$/i.test(trimmedText))) ||
      (msg.type === "image" && /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(trimmedText)) ||
      (msg.type === "video" && /\.(mp4|mov|webm|m4v|3gp)$/i.test(trimmedText)) ||
      /^Screenshot_[\d_-]+/i.test(trimmedText) ||
      /^IMG_[\d_-]+/i.test(trimmedText));

  const isLocationDuplicateText =
    msg.type === "location" && Boolean(msg.location?.lat && msg.location?.lng);

  const hasGenuineText = Boolean(trimmedText && !isMediaPlaceholder && !isLocationDuplicateText && msg.type !== "poll");

  const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderDeliveryStatus = () => {
    if (msg.deliveryStatus === "queued") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            color: "#D97706",
            fontSize: "11px",
            fontWeight: 600,
          }}
          title={msg.deliveryError || "Internet tiklanganda avtomatik yuboriladi"}
        >
          <Clock size={12} />
          <span>Navbatda</span>
        </span>
      );
    }
    if (msg.deliveryStatus === "sending") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            color: "#64748B",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          <Clock size={12} />
          <span>Yuborilmoqda...</span>
        </span>
      );
    }
    if (msg.deliveryStatus === "failed") {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              color: "#DC2626",
              fontSize: "11px",
              fontWeight: 600,
            }}
            title={msg.deliveryError || "Xabar yuborilmadi"}
          >
            <AlertCircle size={12} />
            <span>Yuborilmadi</span>
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(msg)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                border: "1px solid #FCA5A5",
                background: "#FEF2F2",
                color: "#B91C1C",
                borderRadius: "8px",
                padding: "2px 7px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={11} />
              <span>Qayta</span>
            </button>
          )}
        </span>
      );
    }
    return null;
  };

  const renderAttachments = (accentColor: string, softBg: string) => (
    <>
      {/* Image */}
      {effectiveMediaUrl && msg.type === "image" && (
        <div
          style={{
            margin: "4px 0",
            cursor: "pointer",
            borderRadius: "12px",
            overflow: "hidden",
            position: "relative",
          }}
          data-file-name={msg.fileName || "rasm.jpg"}
          onClick={() => onImageClick?.(effectiveMediaUrl)}
        >
          <img
            src={effectiveMediaUrl}
            alt={msg.fileName || "Rasm"}
            style={{
              maxWidth: "100%",
              maxHeight: isUser ? "260px" : "320px",
              objectFit: "contain",
              borderRadius: "12px",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Circular Selfie Video Note */}
      {effectiveMediaUrl && msg.type === "video_note" && (
        <div style={{ margin: "6px 0" }}>
          <CircleVideoNotePlayer
            mediaUrl={effectiveMediaUrl}
            duration={msg.videoDuration || 5}
            size={isUser ? 150 : 164}
          />
        </div>
      )}

      {/* Standard Rectangular Video */}
      {effectiveMediaUrl && msg.type === "video" && (
        <div
          style={{
            margin: "6px 0",
            borderRadius: "12px",
            overflow: "hidden",
            background: "#0F172A",
            maxWidth: isUser ? "280px" : "340px",
          }}
        >
          <video
            src={effectiveMediaUrl}
            controls
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              maxHeight: "260px",
              display: "block",
              borderRadius: "12px 12px 0 0",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              padding: "6px 10px",
              background: "rgba(15, 23, 42, 0.92)",
              color: "#E2E8F0",
              fontSize: "11.5px",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {msg.fileName || "Video xabar"}
              {msg.videoDuration ? ` · ${formatDuration(msg.videoDuration)}` : ""}
            </span>
            <button
              type="button"
              onClick={handleDownloadMedia}
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Download size={12} />
              <span>Saqlash</span>
            </button>
          </div>
        </div>
      )}

      {/* Voice / Audio */}
      {effectiveMediaUrl && msg.type === "audio" && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "7px 12px",
            background: softBg,
            borderRadius: "16px",
            margin: "4px 0",
          }}
        >
          <button
            type="button"
            onClick={handlePlayAudio}
            style={{
              background: accentColor,
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
            title={isAudioPlaying ? "To'xtatish" : "Tinglash"}
          >
            {isAudioPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <div style={{ display: "flex", flexDirection: "column", minWidth: "70px" }}>
            <span style={{ fontSize: "12px", color: accentColor, fontWeight: 700 }}>
              {isAudioPlaying ? "Ijro etilmoqda..." : "Ovozli xabar"}
            </span>
            <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
              {formatDuration(msg.audioDuration ?? 5)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownloadMedia}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              cursor: "pointer",
              padding: "2px",
              display: "grid",
              placeItems: "center",
            }}
            title="Yuklab olish"
          >
            <Download size={14} />
          </button>
        </div>
      )}

      {/* Document / PDF / DOC / XLS / TXT File */}
      {effectiveMediaUrl && msg.type === "file" && (() => {
        const badge = getFileBadge(msg.fileName, msg.mimeType);
        const canPreviewInline = badge.label === "PDF";
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              background: isUser ? "rgba(255,255,255,0.75)" : "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              margin: "4px 0",
              maxWidth: "300px",
              minWidth: "210px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: badge.bg,
                color: badge.color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              <FileText size={15} />
              <span style={{ marginTop: "1px", lineHeight: 1 }}>{badge.label}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 650,
                  color: "#0F172A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={msg.fileName || "Hujjat"}
              >
                {msg.fileName || trimmedText.replace(/^(📁|📄)\s*(Hujjat:\s*)?/u, "") || "Biriktirilgan hujjat"}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                {badge.label} hujjat
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              {canPreviewInline && (
                <button
                  type="button"
                  onClick={handlePreviewDoc}
                  style={{
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#0F172A",
                    borderRadius: "8px",
                    padding: "6px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Ochib ko'rish"
                >
                  Ochish
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadMedia}
                disabled={downloading}
                style={{
                  border: "none",
                  background: accentColor,
                  color: "#FFFFFF",
                  borderRadius: "8px",
                  width: "30px",
                  height: "30px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                title="Yuklab olish"
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Location Card */}
      {msg.type === "location" && msg.location?.lat && msg.location?.lng && (
        <a
          href={
            msg.location.mapUrl ||
            `https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`
          }
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "10px 12px",
            background: isUser ? "rgba(255,255,255,0.78)" : "#F8FAFC",
            border: "1px solid #CBD5E1",
            borderRadius: "12px",
            margin: "4px 0",
            textDecoration: "none",
            color: "#0F172A",
            maxWidth: "300px",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "#DBEAFE",
              color: "#2563EB",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <MapPin size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
              Geolokatsiya
            </div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px", wordBreak: "break-word" }}>
              {msg.location.address || `${msg.location.lat.toFixed(4)}, ${msg.location.lng.toFixed(4)}`}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "5px",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#2563EB",
              }}
            >
              <span>Xaritada ochish</span>
              <ExternalLink size={11} />
            </div>
          </div>
        </a>
      )}

      {/* Interactive Poll Card */}
      {msg.type === "poll" && Array.isArray(msg.pollOptions) && msg.pollOptions.length > 0 && (() => {
        const totalVotes = msg.pollOptions.reduce((sum, o) => sum + (o.votes || 0), 0);
        return (
          <div
            style={{
              background: isUser ? "rgba(255,255,255,0.85)" : "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "12px 14px",
              margin: "4px 0",
              minWidth: "220px",
              maxWidth: "320px",
            }}
          >
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
              📊 {msg.pollQuestion || msg.text}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {msg.pollOptions.map((opt, idx) => {
                const selected = msg.userVotedOption === idx;
                const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                return (
                  <button
                    key={opt.id ?? idx}
                    type="button"
                    onClick={() => (onVotePoll ? onVotePoll(msg.id, idx) : votePollOption(msg.id, idx))}
                    style={{
                      position: "relative",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "9px",
                      border: selected ? `1.5px solid ${accentColor}` : "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        background: selected ? "rgba(190, 18, 60, 0.14)" : "rgba(37, 99, 235, 0.08)",
                        transition: "width 0.2s ease",
                      }}
                    />
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12.5px",
                        fontWeight: selected ? 700 : 500,
                        color: "#0F172A",
                      }}
                    >
                      <span>{selected ? `✓ ${opt.text}` : opt.text}</span>
                      <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
                        {opt.votes || 0}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "6px" }}>
              Jami ovozlar: {totalVotes}
            </div>
          </div>
        );
      })()}

      {/* Inline PDF Preview Modal */}
      {previewDocUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.78)",
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            padding: "16px",
          }}
          onClick={() => setPreviewDocUrl(null)}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: "#FFFFFF",
              borderRadius: "12px 12px 0 0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <strong style={{ fontSize: "14px", color: "#0F172A" }}>{msg.fileName || "Hujjat"}</strong>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleDownloadMedia}
                style={{
                  border: "none",
                  background: "#BE123C",
                  color: "#FFFFFF",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Yuklab olish
              </button>
              <button
                type="button"
                onClick={() => setPreviewDocUrl(null)}
                style={{
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Yopish
              </button>
            </div>
          </div>
          <iframe
            src={previewDocUrl}
            title={msg.fileName || "PDF Hujjat"}
            style={{
              flex: 1,
              width: "100%",
              border: "none",
              background: "#FFFFFF",
              borderRadius: "0 0 12px 12px",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );

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

          {renderAttachments("#2563EB", "rgba(37, 99, 235, 0.1)")}

          {hasGenuineText && (
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.text}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "3px",
            paddingRight: "4px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
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

          {renderDeliveryStatus()}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: "#94A3B8",
              marginLeft: "2px",
              fontWeight: 500,
            }}
          >
            <span>{formattedTime}</span>
            {(!msg.deliveryStatus || msg.deliveryStatus === "sent") && (
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
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. ASSISTANT / ADMIN TURN
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
            (e.currentTarget as HTMLImageElement).src = GULI_LOGO_BASE64;
          }}
        />
        <span style={{ fontWeight: 650, fontSize: "13.5px", color: "#09090B" }}>
          {senderName}
        </span>
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

      {renderAttachments("#BE123C", "rgba(190, 18, 60, 0.08)")}

      {hasGenuineText && (
        <div style={{ width: "100%", maxWidth: "800px" }}>
          <ChatGPTMarkdown
            content={msg.text}
            isStreaming={isStreaming}
            onStreamComplete={onStreamComplete}
          />
        </div>
      )}

      <div
        className="chatgpt-actions-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "2px",
          paddingTop: "0px",
          flexWrap: "wrap",
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

        {renderDeliveryStatus()}

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
