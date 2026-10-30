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
      onShowToast("✓ Havola nusxalandi!");
      setTimeout(() => setCopied(false), 2200);
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
      id: "telegram",
      name: "Telegram",
      gradient: "linear-gradient(135deg, #2AABEE, #229ED9)",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="#ffffff" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z" />
        </svg>
      ),
      action: () => {
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(reel.caption)}`,
          "_blank"
        );
      },
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      gradient: "linear-gradient(135deg, #25D366, #128C7E)",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="#ffffff" aria-hidden="true">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm0 18.15c-1.49 0-2.94-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c.02 4.54-3.68 8.23-8.22 8.23zm4.51-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.17 1.73 2.64 4.19 3.7.59.25 1.05.4 1.41.51.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z" />
        </svg>
      ),
      action: () => {
        window.open(
          `https://api.whatsapp.com/send?text=${encodeURIComponent(reel.caption + " " + shareUrl)}`,
          "_blank"
        );
      },
    },
    {
      id: "instagram",
      name: "Instagram",
      gradient: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="#ffffff" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
      action: () => {
        handleCopyLink();
        onShowToast("Havola nusxalandi! Instagram Stories yoki Direct'da ulashing");
      },
    },
    {
      id: "copy",
      name: "Nusxalash",
      gradient: "linear-gradient(135deg, #374151, #1f2937)",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      ),
      action: handleCopyLink,
    },
    {
      id: "more",
      name: "Boshqa...",
      gradient: "linear-gradient(135deg, #4b5563, #374151)",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
      action: handleNativeShare,
    },
  ];

  return (
    <div
      className="reelsModalOverlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Instagram uslubidagi ulashish paneli"
    >
      <div
        className="reelsShareSheet instagramShareSheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Instagram Sheet Handle */}
        <div className="reelsSheetHandle" />

        {/* Header */}
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

        {/* Reel Quick Summary Card (Instagram Direct Style) */}
        <div className="reelsShareSummary">
          <div className="reelsShareThumbWrap">
            <img
              src={reel.posterUrl}
              alt="Reels poster"
              className="reelsShareThumb"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80";
              }}
            />
            <div className="reelsSharePlayIconBadge">▶</div>
          </div>
          <div className="reelsShareMeta">
            <div className="reelsShareAuthorBadge">
              <span className="reelsShareAuthor">Guli Market</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#0095f6" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.8-4.2-4.2 1.41-1.41 2.79 2.79 6.29-6.29 1.41 1.41-7.7 7.7z" />
              </svg>
            </div>
            <p className="reelsShareCaption">{reel.caption}</p>
          </div>
        </div>

        {/* Share Options Row */}
        <div className="reelsShareTargetsRow">
          {shareTargets.map((item) => (
            <button
              key={item.id}
              type="button"
              className="reelsShareTargetBtn"
              onClick={item.action}
              aria-label={item.name}
            >
              <div
                className="reelsShareTargetIconWrap"
                style={{ background: item.gradient }}
              >
                {item.icon}
              </div>
              <span className="reelsShareTargetLabel">{item.name}</span>
            </button>
          ))}
        </div>

        {/* Instagram Copy Link Bar */}
        <div className="reelsCopyLinkBox" onClick={handleCopyLink}>
          <div className="reelsCopyLinkLeft">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            <span className="reelsCopyLinkText">{shareUrl}</span>
          </div>
          <button
            type="button"
            className={`reelsCopyLinkBtn ${copied ? "copied" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            {copied ? "✓ Nusxalandi" : "Nusxalash"}
          </button>
        </div>
      </div>
    </div>
  );
};
