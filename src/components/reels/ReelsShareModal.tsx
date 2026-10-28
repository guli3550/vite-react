import React, { useState } from "react";
import type { ReelItem } from "../../types/reels";

interface ReelsShareModalProps {
  reel: ReelItem;
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const ReelsShareModal: React.FC<ReelsShareModalProps> = ({
  reel,
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/reels?id=${reel.id}`
    : `https://gulii.uz/reels?id=${reel.id}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      onShowToast("✓ Reels havolasi nusxalandi!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast("Havolani nusxalab bo‘lmadi");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Guli Market Reels",
          text: reel.caption,
          url: shareUrl,
        });
        onClose();
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const shareTargets = [
    {
      name: "Telegram",
      icon: "✈️",
      color: "#229ED9",
      action: () => {
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(reel.caption)}`,
          "_blank"
        );
      },
    },
    {
      name: "WhatsApp",
      icon: "💬",
      color: "#25D366",
      action: () => {
        window.open(
          `https://api.whatsapp.com/send?text=${encodeURIComponent(reel.caption + " " + shareUrl)}`,
          "_blank"
        );
      },
    },
    {
      name: "Instagram",
      icon: "📸",
      color: "#E1306C",
      action: () => {
        handleCopyLink();
        onShowToast("Havola nusxalandi! Instagram Stories yoki Direct'da ulashing");
      },
    },
    {
      name: "Boshqa...",
      icon: "📱",
      color: "#6b7280",
      action: handleNativeShare,
    },
  ];

  return (
    <div
      className="reelsModalOverlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ulashish paneli"
    >
      <div
        className="reelsShareSheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reelsSheetHeader">
          <div className="reelsSheetHandle" />
          <div className="reelsSheetTitleRow">
            <span className="reelsSheetTitle">Ulashish</span>
            <button
              type="button"
              className="reelsCloseBtn"
              onClick={onClose}
              aria-label="Yopish"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Reel Quick Summary */}
        <div className="reelsShareSummary">
          <img
            src={reel.posterUrl}
            alt="Reels poster"
            className="reelsShareThumb"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80";
            }}
          />
          <div className="reelsShareMeta">
            <span className="reelsShareAuthor">@{reel.author.username}</span>
            <p className="reelsShareCaption">{reel.caption}</p>
          </div>
        </div>

        {/* Share Options Row */}
        <div className="reelsShareTargetsRow">
          {shareTargets.map((item) => (
            <button
              key={item.name}
              type="button"
              className="reelsShareTargetBtn"
              onClick={item.action}
            >
              <div
                className="reelsShareTargetIconWrap"
                style={{ background: item.color }}
              >
                <span>{item.icon}</span>
              </div>
              <span className="reelsShareTargetLabel">{item.name}</span>
            </button>
          ))}
        </div>

        {/* Copy Link Input Box */}
        <div className="reelsCopyLinkBox">
          <span className="reelsCopyLinkText">{shareUrl}</span>
          <button
            type="button"
            className={`reelsCopyLinkBtn ${copied ? "copied" : ""}`}
            onClick={handleCopyLink}
          >
            {copied ? "✓ Nusxalandi" : "Havolani nusxalash"}
          </button>
        </div>
      </div>
    </div>
  );
};
