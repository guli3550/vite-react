import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Search,
  X,
  Info,
  MoreVertical,
  Trash2,
  Plus,
  Mic,
  Video,
  ArrowUp,
  Image as ImageIcon,
  ArrowDown,
  FileText,
  MapPin,
  HelpCircle,
  CreditCard,
  Truck,
  Percent,
  Reply,
  Film,
  WifiOff,
} from "lucide-react";
import { type Language } from "../utils/translations";
import {
  type ChatMessage,
  getStoredChatMessages,
  sendUserMessage,
  markMessagesAsRead,
  subscribeToChat,
  toggleBookmarkMessage,
  clearChatMessages,
  matchesCustomerChatScope,
  retryQueuedChatMessage,
  flushOfflineOutbox,
  votePollOption,
} from "../utils/chatSync";
import { copyToClipboard } from "../utils/clipboard";
import { ChatGPTMessageRow } from "./ChatGPTMessageRow";
import { TelegramCircularVideoRecorderOverlay } from "./CircleVideoNote";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";
import "../admin/components/AdminGuliChat.css";

const MAX_CHAT_MEDIA_BYTES = 20 * 1024 * 1024;

function pickSupportedAudioMime(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
}

const CUSTOMER_SUGGESTIONS = [
  {
    icon: Truck,
    title: "Yetkazib berish muddati",
    desc: "Qo'qon, Toshkent va viloyatlar bo'yicha tezkor yetkazib berish",
    prompt: "Yetkazib berish shartlari va muddatlari qanday?",
  },
  {
    icon: CreditCard,
    title: "To'lov usullari",
    desc: "Click, Payme, Uzum va naqd to'lov",
    prompt: "To'lovni qaysi usullarda amalga oshirish mumkin?",
  },
  {
    icon: HelpCircle,
    title: "O'lcham tanlashda yordam",
    desc: "Byustgalter va ichki kiyim o'lchamini aniqlash",
    prompt: "Menga to'g'ri o'lcham tanlashda maslahat bera olasizmi?",
  },
  {
    icon: Percent,
    title: "Chegirma va aksiyalar",
    desc: "Hozirda amal qilayotgan maxsus promo-kodlar",
    prompt: "Hozirda qanday chegirmalar yoki aksiyalar mavjud?",
  },
];

type OnlineChatViewProps = {
  language: Language;
  onBack: () => void;
  user?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    phone?: string;
  };
  onShowToast?: (msg: string) => void;
};

export function OnlineChatView({
  onBack,
  user,
  onShowToast,
}: OnlineChatViewProps) {
  const userId = user?.id ? String(user.id) : "guest-user";
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages(userId)
  );

  const [inputText, setInputText] = useState("");
  const [replyingToMsg, setReplyingToMsg] = useState<ChatMessage | null>(null);
  const [activeToast, setActiveToast] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  // Horizontal Swipe to exit chat (swiping like flipping photos/tabs)
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isSwipingChat = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("textarea") ||
      target.closest("input") ||
      target.closest("button") ||
      target.closest(".chatgpt-input-capsule") ||
      target.closest(".circle-video-recorder-container") ||
      target.closest("audio")
    ) {
      isSwipingChat.current = false;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isSwipingChat.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isSwipingChat.current) return;
    isSwipingChat.current = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartX.current;
    const diffY = endY - touchStartY.current;
    const timeDiff = Date.now() - touchStartTime.current;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Swipe threshold: swipe right or left horizontally
    if (absX >= 48 && absX > absY * 1.25 && timeDiff < 800) {
      onBack();
    }
  };

  // Lock body scroll while in full screen chat
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Attachments & recording
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordSecondsRef = useRef<number>(0);
  const voiceCancelledRef = useRef<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  // Toast trigger
  const triggerToast = (msgStr: string) => {
    if (onShowToast) onShowToast(msgStr);
    setActiveToast(msgStr);
    setTimeout(() => setActiveToast(null), 2400);
  };

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void flushOfflineOutbox();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // Subscribe to real-time chat updates
  useEffect(() => {
    markMessagesAsRead(userId, "user");
    const unsubscribe = subscribeToChat((updatedMsgs) => {
      const filtered = updatedMsgs.filter(
        (m) => m.id === "welcome-msg-1" || matchesCustomerChatScope(m.userId, userId)
      );
      setMessages((prevMsgs) => {
        const lastMsg = filtered[filtered.length - 1];
        const prevLast = prevMsgs[prevMsgs.length - 1];
        if (lastMsg && (!prevLast || prevLast.id !== lastMsg.id) && lastMsg.sender === "admin") {
          setStreamingMsgId(lastMsg.id);
        }
        return filtered;
      });
      markMessagesAsRead(userId, "user");
    });
    return () => unsubscribe();
  }, [userId]);

  // Scroll to bottom on load / new message
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, []);

  // Realtime/history updates must never yank the user away from a message
  // they are reading. Auto-scroll only when the viewport is already near the
  // bottom (or the user has just reached the bottom).
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 160;

    if (isNearBottom) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    const isScrollingDown = scrollTop > lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // Show button when scrolling down towards the bottom from higher up, or when deeply scrolled up
    if (distFromBottom <= 80) {
      setShowScrollBottom(false);
    } else if (distFromBottom > 140 && isScrollingDown) {
      setShowScrollBottom(true);
    } else if (distFromBottom > 400) {
      setShowScrollBottom(true);
    }
  };

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (attachMenuRef.current && !attachMenuRef.current.contains(target)) {
        setShowAttachMenu(false);
      }
      if (topMenuRef.current && !topMenuRef.current.contains(target)) {
        setTopMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("touchstart", handleOutsideClick);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);

  // Audio playback handler
  const togglePlayAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
        audioPlayerRef.current.onended = () => setPlayingAudioId(null);
      }
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play().catch(() => {});
      setPlayingAudioId(id);
    }
  };

  // Image attachment
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      triggerToast("Iltimos, rasm faylini tanlang (PNG, JPG, WEBP)");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_CHAT_MEDIA_BYTES) {
      triggerToast("Rasm hajmi 20 MB dan oshmasligi kerak");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setSelectedImage({
          url: event.target.result,
          name: file.name,
        });
        setShowAttachMenu(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Standard video attachment
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name)) {
      triggerToast("Iltimos, video fayl tanlang (MP4, WebM, MOV)");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_CHAT_MEDIA_BYTES) {
      triggerToast("Video hajmi 20 MB dan oshmasligi kerak");
      e.target.value = "";
      return;
    }
    const replyParam = replyingToMsg
      ? {
          id: replyingToMsg.id,
          sender: replyingToMsg.sender,
          text: replyingToMsg.text || "Biriktirilgan fayl",
        }
      : undefined;
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === "string") {
        const sent = await sendUserMessage(
          "",
          user,
          {
            type: "video",
            mediaUrl: event.target.result,
            fileName: file.name,
            mimeType: file.type || "video/mp4",
          },
          replyParam
        );
        setShowAttachMenu(false);
        setReplyingToMsg(null);
        if (!sent) triggerToast("❌ Video yuborilmadi");
        else if (sent.deliveryStatus === "queued") triggerToast("⏳ Internet yo‘q: video navbatga qo‘yildi");
        else triggerToast("Video yuborildi 🎬");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Document attachment (PDF, DOC, DOCX, XLS, XLSX, TXT)
  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CHAT_MEDIA_BYTES) {
      triggerToast("Hujjat hajmi 20 MB dan oshmasligi kerak");
      e.target.value = "";
      return;
    }
    const replyParam = replyingToMsg
      ? {
          id: replyingToMsg.id,
          sender: replyingToMsg.sender,
          text: replyingToMsg.text || "Biriktirilgan fayl",
        }
      : undefined;
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === "string") {
        const sent = await sendUserMessage(
          `📄 ${file.name}`,
          user,
          {
            type: "file",
            mediaUrl: event.target.result,
            fileName: file.name,
            mimeType: file.type || undefined,
          },
          replyParam
        );
        setShowAttachMenu(false);
        setReplyingToMsg(null);
        if (!sent) triggerToast("❌ Hujjat yuborilmadi");
        else if (sent.deliveryStatus === "queued") triggerToast("⏳ Internet yo‘q: hujjat navbatga qo‘yildi");
        else triggerToast("Hujjat yuborildi 📄");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Voice recording (encoded as persistent data URL so offline queue & Supabase upload work cleanly)
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        triggerToast("Brauzeringizda mikrofondan foydalanish qo'llab-quvvatlanmaydi.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mimeType = pickSupportedAudioMime();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      voiceCancelledRef.current = false;
      recordSecondsRef.current = 0;

      const replySnapshot = replyingToMsg
        ? {
            id: replyingToMsg.id,
            sender: replyingToMsg.sender,
            text: replyingToMsg.text || "Biriktirilgan fayl",
          }
        : undefined;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        if (voiceCancelledRef.current || audioChunksRef.current.length === 0) return;

        const duration = Math.max(1, recordSecondsRef.current);
        const outputMime = (mimeType || mediaRecorder.mimeType || "audio/webm").split(";")[0];
        const ext = outputMime.includes("ogg") ? "ogg" : outputMime.includes("mp4") ? "m4a" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: outputMime });

        if (audioBlob.size > MAX_CHAT_MEDIA_BYTES) {
          triggerToast("Ovozli xabar hajmi juda katta (maks 20 MB)");
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          if (typeof reader.result === "string") {
            const sent = await sendUserMessage(
              "",
              user,
              {
                type: "audio",
                mediaUrl: reader.result,
                fileName: `voice-${Date.now()}.${ext}`,
                mimeType: outputMime,
                audioDuration: duration,
              },
              replySnapshot
            );
            setReplyingToMsg(null);
            if (!sent) triggerToast("❌ Ovozli xabar yuborilmadi");
            else if (sent.deliveryStatus === "queued") triggerToast("⏳ Internet yo‘q: ovozli xabar navbatda");
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          recordSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch {
      triggerToast("Mikrofonga ruxsat berilmadi yoki xatolik yuz berdi.");
    }
  };

  const stopVoiceRecording = () => {
    voiceCancelledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  const cancelVoiceRecording = () => {
    voiceCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    recordSecondsRef.current = 0;
    setRecordSeconds(0);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  // Send message
  const handleSend = (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : inputText.trim();
    if (!textToSend && !selectedImage) return;

    const imageSnapshot = selectedImage;
    const replySnapshot = replyingToMsg
      ? {
          id: replyingToMsg.id,
          sender: replyingToMsg.sender,
          text: replyingToMsg.text || "Biriktirilgan fayl",
        }
      : undefined;

    if (overrideText === undefined) setInputText("");
    setSelectedImage(null);
    setReplyingToMsg(null);
    setShowAttachMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    void sendUserMessage(
      textToSend,
      user,
      imageSnapshot
        ? {
            type: "image",
            mediaUrl: imageSnapshot.url,
            fileName: imageSnapshot.name,
          }
        : undefined,
      replySnapshot
    ).then((sent) => {
      if (!sent) {
        triggerToast("❌ Xabar yuborilmadi. Fayl formati yoki ulanishni tekshiring.");
      } else if (sent.deliveryStatus === "queued") {
        triggerToast("⏳ Internet yo‘q: xabar navbatga qo‘yildi va tarmoq tiklanganda yuboriladi");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only send on Ctrl+Enter or Cmd+Enter; regular Enter adds a new line freely
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filtered messages by search
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div
      className="guli-chat-fullscreen-wrapper is-fullscreen"
      style={{ zIndex: 90 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Toast */}
      {activeToast && <div className="guli-floating-toast">{activeToast}</div>}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{
          position: "fixed",
          left: "-10000px",
          top: "0",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        onChange={handleImageSelect}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/mp4,video/webm,video/quicktime,video/*"
        style={{
          position: "fixed",
          left: "-10000px",
          top: "0",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        onChange={handleVideoSelect}
      />
      <input
        type="file"
        ref={docInputRef}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{
          position: "fixed",
          left: "-10000px",
          top: "0",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        onChange={handleDocSelect}
      />

      {/* ==========================================================================
          HEADER: Clean Top Header with Verified Checkmark
          ========================================================================== */}
      <div className="chatgpt-clean-header">
        <div className="chatgpt-header-left">
          <button
            type="button"
            className="chatgpt-header-icon-btn"
            onClick={onBack}
            title="Orqaga"
          >
            <ArrowLeft size={19} />
          </button>

          <div
            className="chatgpt-header-brand-logo guli-brand-circle-logo"
            onClick={() => setInfoModalOpen(true)}
            style={{ cursor: "pointer" }}
            title="Do'kon ma'lumotlari"
          >
            <img
              src={GULI_LOGO_BASE64}
              alt="GULI Lingerie"
              style={{ width: "44px", height: "44px", minWidth: "44px", minHeight: "44px", aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "contain", display: "block" }}
            />
          </div>

          <div
            className="chatgpt-header-title-box"
            onClick={() => setInfoModalOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h1 className="chatgpt-header-title" style={{ fontSize: 15.5, margin: 0 }}>
                GULI Lingerie
              </h1>
              {/* Real Verified Blue Checkmark Badge */}
              <span style={{ display: "inline-flex", alignItems: "center" }} title="Rasmiy tasdiqlangan do'kon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle" }}>
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
            <div className="chatgpt-header-online-indicator">
              {isOnline ? (
                <>
                  <span className="chatgpt-indicator-dot" />
                  <span>Online · Qo'llab-quvvatlash xizmati</span>
                </>
              ) : (
                <>
                  <WifiOff size={12} color="#D97706" />
                  <span style={{ color: "#B45309" }}>Offline · Xabarlar navbatda saqlanadi</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="chatgpt-header-right" ref={topMenuRef}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              className="chatgpt-header-icon-btn"
              onClick={() => setSearchOpen(!searchOpen)}
              title="Xabarlardan qidirish"
            >
              <Search size={18} />
            </button>

            <button
              type="button"
              className="chatgpt-header-icon-btn"
              onClick={() => setInfoModalOpen(true)}
              title="Do'kon ma'lumotlari"
            >
              <Info size={18} />
            </button>

            <button
              type="button"
              className="chatgpt-header-icon-btn"
              onClick={() => setTopMenuOpen(!topMenuOpen)}
              title="Qo'shimcha amallar"
            >
              <MoreVertical size={18} />
            </button>
          </div>

          {topMenuOpen && (
            <div className="chatgpt-dropdown-menu">
              <button
                type="button"
                className="chatgpt-menu-item"
                onClick={() => {
                  setTopMenuOpen(false);
                  setInfoModalOpen(true);
                }}
              >
                <Info size={14} color="#BE123C" />
                <span>Do'kon ma'lumotlari</span>
              </button>
              <button
                type="button"
                className="chatgpt-menu-item"
                onClick={() => {
                  setTopMenuOpen(false);
                  setSearchOpen(true);
                }}
              >
                <Search size={14} />
                <span>Xabarlardan qidirish</span>
              </button>
              <div style={{ height: 1, background: "#F0F0F0", margin: "3px 0" }} />
              <button
                type="button"
                className="chatgpt-menu-item danger"
                onClick={() => {
                  setTopMenuOpen(false);
                  if (confirm("Chatdagi barcha xabarlarni tozalashni tasdiqlaysizmi?")) {
                    clearChatMessages(userId);
                    triggerToast("Chat tarixi tozalandi");
                  }
                }}
              >
                <Trash2 size={14} />
                <span>Chatni tozalash</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Search Bar */}
      {searchOpen && (
        <div
          className="chatgpt-inline-search"
          style={{
            border: "none",
            borderBottom: "1px solid #E4E4E7",
            outline: "none",
            boxShadow: "none",
            background: "#F4F4F5",
          }}
        >
          <Search size={16} color="#71717A" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Xabarlardan qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              boxShadow: "none",
              background: "transparent",
              color: "#18181B",
            }}
            autoFocus
          />
          {searchQuery && (
            <span className="chatgpt-search-count-pill">
              {filteredMessages.length} ta xabar
            </span>
          )}
          <button
            type="button"
            className="chatgpt-icon-btn"
            onClick={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
            title="Qidiruvni yopish"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ==========================================================================
          MESSAGE STREAM (CANVAS)
          ========================================================================== */}
      <div
        className="chatgpt-canvas-stream"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {filteredMessages.length === 0 ? (
          searchQuery.trim() ? (
            /* Search yielded no results */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 20px",
                textAlign: "center",
                color: "#71717A",
                margin: "auto",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "#F4F4F5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                }}
              >
                <Search size={22} color="#A1A1AA" />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#18181B", margin: "0 0 6px 0" }}>
                Xabarlar topilmadi
              </h3>
              <p style={{ fontSize: "13px", margin: 0, maxWidth: "280px", lineHeight: 1.4 }}>
                "{searchQuery}" so'rovi bo'yicha hech qanday xabar topilmadi
              </p>
            </div>
          ) : (
            /* Empty / Initial State: Clean ChatGPT Welcome */
            <div className="chatgpt-empty-stage">
              <div className="chatgpt-empty-hero">
                <div className="chatgpt-empty-icon-capsule guli-brand-circle-logo">
                  <img
                    src={GULI_LOGO_BASE64}
                    alt="GULI Lingerie"
                    style={{ width: "100%", height: "100%", aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "contain", display: "block" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <h2 className="chatgpt-empty-title" style={{ margin: 0 }}>GULI Lingerie</h2>
                  <span style={{ display: "inline-flex", alignItems: "center" }} title="Rasmiy tasdiqlangan do'kon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle" }}>
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
                <p className="chatgpt-empty-subtitle">
                  Assalomu alaykum! GULI Lingerie do'koni rasmiy qo'llab-quvvatlash xizmatiga xush kelibsiz. Sizga qanday yordam bera olamiz?
                </p>
              </div>

              {/* Quick Prompt Cards */}
              <div className="chatgpt-suggestions-grid">
                {CUSTOMER_SUGGESTIONS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="chatgpt-suggestion-card"
                      onClick={() => handleSend(item.prompt)}
                    >
                      <div className="chatgpt-suggestion-top">
                        <Icon size={16} color="#BE123C" />
                        <b>{item.title}</b>
                      </div>
                      <span>{item.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          filteredMessages.map((msg, idx) => {
            const isUser = msg.sender === "user";
            const isLatest = idx === filteredMessages.length - 1;

            return (
              <ChatGPTMessageRow
                key={msg.id}
                msg={msg}
                isUser={isUser}
                isStreaming={streamingMsgId === msg.id && isLatest}
                onStreamComplete={() => setStreamingMsgId(null)}
                onCopy={(txt) => {
                  copyToClipboard(txt);
                  triggerToast("Nusxa olindi 📋");
                }}
                onReply={(m) => setReplyingToMsg(m)}
                onToggleBookmark={(id) => {
                  toggleBookmarkMessage(id);
                  triggerToast(msg.isBookmarked ? "Xatcho'p olib tashlandi" : "Xatcho'pga saqlandi ⭐");
                }}
                onRetry={(m) => {
                  void retryQueuedChatMessage(m.clientMessageId || m.id).then((res) => {
                    if (res) triggerToast("Xabar yuborildi ✓");
                    else triggerToast("Qayta yuborish navbatga qo'yildi");
                  });
                }}
                onVotePoll={(messageId, optionIndex) => votePollOption(messageId, optionIndex)}
                playingAudioId={playingAudioId}
                onTogglePlayAudio={togglePlayAudio}
                onImageClick={(url) => setLightboxImageUrl(url)}
                senderName="GULI Support"
                senderAvatar={GULI_LOGO_BASE64}
              />
            );
          })
        )}
      </div>

      {/* Floating Scroll-To-Bottom Button (↓) */}
      {showScrollBottom && (
        <button
          type="button"
          className="chatgpt-floating-bottom-btn"
          onClick={() => scrollToBottom(true)}
          title="Pastga tushish"
        >
          <ArrowDown size={18} />
        </button>
      )}

      {/* ==========================================================================
          BOTTOM COMMAND DOCK: ➕ Capsule Matn kiritish... ⬆
          ========================================================================== */}
      <div className="chatgpt-input-dock-container">
        {/* Replying-To preview bar (distinct separate card above input capsule) */}
        {replyingToMsg && (
          <div
            className="chatgpt-reply-preview-dock"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#FFFFFF",
              border: "1px solid #E4E4E7",
              borderLeft: "4px solid #BE123C",
              borderRadius: "12px",
              padding: "8px 12px",
              marginBottom: "8px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <Reply size={14} color="#BE123C" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#BE123C",
                  }}
                >
                  {replyingToMsg.sender === "admin" ? "GULI Support" : "Siz"}ga javob:
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "12.5px",
                    color: "#475569",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {replyingToMsg.text || "Biriktirilgan fayl"}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="chatgpt-icon-btn"
              onClick={() => setReplyingToMsg(null)}
              title="Javobni bekor qilish"
              style={{ flexShrink: 0, marginLeft: "8px" }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Selected Image Preview Chip */}
        {selectedImage && (
          <div className="chatgpt-input-preview-card">
            <img src={selectedImage.url} alt="Tanlangan rasm" className="chatgpt-preview-thumb" />
            <div className="chatgpt-preview-info">
              <span className="chatgpt-preview-name">{selectedImage.name}</span>
              <span className="chatgpt-preview-tag">Rasm biriktirildi</span>
            </div>
            <button
              type="button"
              className="chatgpt-preview-remove"
              onClick={() => setSelectedImage(null)}
              title="Rasmni o'chirish"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input Capsule Box */}
        <div className="chatgpt-input-capsule">
          {isRecording ? (
            /* Voice Recording Bar */
            <div className="chatgpt-recording-bar">
              <div className="chatgpt-recording-tag">
                <span className="chatgpt-rec-pulse" />
                <span>Ovoz yozilmoqda...</span>
              </div>
              <div className="chatgpt-rec-wave">
                {[4, 14, 8, 18, 12, 16, 9, 15, 6, 17, 10, 14].map((h, i) => (
                  <div
                    key={i}
                    className="chatgpt-rec-wave-line"
                    style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
              <span className="chatgpt-rec-timer">
                0:{recordSeconds < 10 ? "0" : ""}{recordSeconds}
              </span>
              <button
                type="button"
                className="chatgpt-rec-cancel"
                onClick={cancelVoiceRecording}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="chatgpt-send-btn active"
                onClick={stopVoiceRecording}
                title="Yuborish"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          ) : (
            <>
              {/* Left Action: Plus button with attachment menu (without round video) */}
              <div className="chatgpt-input-left" ref={attachMenuRef}>
                <button
                  type="button"
                  className={`chatgpt-dock-btn plus-btn ${showAttachMenu ? "open" : ""}`}
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  title="Fayl yoki media biriktirish"
                >
                  <Plus size={20} />
                </button>

                {showAttachMenu && (
                  <div className="chatgpt-attach-popover">
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowAttachMenu(false);
                      }}
                    >
                      <ImageIcon size={16} className="chatgpt-attach-icon" />
                      <span>Rasm / Galereya</span>
                    </button>
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        videoInputRef.current?.click();
                        setShowAttachMenu(false);
                      }}
                    >
                      <Film size={16} className="chatgpt-attach-icon" />
                      <span>Video fayl</span>
                    </button>
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        docInputRef.current?.click();
                        setShowAttachMenu(false);
                      }}
                    >
                      <FileText size={16} className="chatgpt-attach-icon" />
                      <span>Hujjat (PDF, DOC, XLS)</span>
                    </button>
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        setShowAttachMenu(false);
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              void sendUserMessage(
                                `📍 Mening joylashuvim:\nhttps://maps.google.com/?q=${lat},${lng}`,
                                user
                              );
                              triggerToast("Joylashuv yuborildi 📍");
                            },
                            () => triggerToast("Joylashuvni aniqlab bo'lmadi")
                          );
                        }
                      }}
                    >
                      <MapPin size={16} className="chatgpt-attach-icon" />
                      <span>Mening joylashuvim</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Text Input allowing multi-line text input */}
              <textarea
                ref={textareaRef}
                className="chatgpt-dock-textarea"
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={replyingToMsg ? "Javob yozing..." : "Xabar yozing..."}
              />

              {/* Right Action: Send Button OR Voice Note & Circular Selfie Video */}
              {inputText.trim() || selectedImage ? (
                <button
                  type="button"
                  className="chatgpt-send-btn active"
                  onClick={() => handleSend()}
                  title="Yuborish"
                >
                  <ArrowUp size={18} />
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <button
                    type="button"
                    className="chatgpt-dock-btn"
                    onClick={startVoiceRecording}
                    title="Ovozli xabar yozish"
                  >
                    <Mic size={19} />
                  </button>
                  <button
                    type="button"
                    className="chatgpt-dock-btn"
                    onClick={() => setShowVideoRecorder(true)}
                    title="Yumaloq video (selfi) yozish"
                  >
                    <Video size={19} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Store Information Modal */}
      {infoModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setInfoModalOpen(false)}
        >
          <div
            style={{
              background: "#FFFFFF",
              width: "100%",
              maxWidth: 420,
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="guli-brand-circle-logo" style={{ width: "46px", height: "46px", minWidth: "46px", minHeight: "46px", borderRadius: "50%", overflow: "hidden" }}>
                  <img
                    src={GULI_LOGO_BASE64}
                    alt="GULI"
                    style={{ width: "100%", height: "100%", aspectRatio: "1 / 1", objectFit: "contain", display: "block" }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#18181B" }}>
                      GULI Lingerie
                    </h3>
                    <span style={{ display: "inline-flex", alignItems: "center" }} title="Rasmiy tasdiqlangan do'kon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle" }}>
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
                  <span style={{ fontSize: 12.5, color: "#10B981", fontWeight: 600 }}>
                    ● Qo'llab-quvvatlash xizmati
                  </span>
                </div>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", fontSize: 18, color: "#71717A", cursor: "pointer" }}
                onClick={() => setInfoModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ background: "#F4F4F5", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#27272A" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>📞 Telefon / Call-markaz:</span>
                <a href="tel:+998905811117" style={{ fontWeight: 700, color: "#BE123C", textDecoration: "none" }}>
                  +998 90 581 11 17
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>💬 Telegram Bot:</span>
                <a
                  href="https://t.me/Guli_MARKET_bot"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontWeight: 600, color: "#0284C7", textDecoration: "none" }}
                >
                  @Guli_MARKET_bot
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>⏰ Ish tartibi:</span>
                <span style={{ fontWeight: 600 }}>Har kuni 09:00 - 21:00</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>📍 Manzil:</span>
                <span style={{ fontWeight: 600, color: "#18181B" }}>Qo'qon shahar, O'zbekiston</span>
              </div>
            </div>

            <button
              type="button"
              style={{
                width: "100%",
                padding: "11px",
                background: "#18181B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
              onClick={() => setInfoModalOpen(false)}
            >
              Yopish
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.86)",
            display: "grid",
            placeItems: "center",
            zIndex: 999999,
            padding: 16,
          }}
          onClick={() => setLightboxImageUrl(null)}
        >
          <img
            src={lightboxImageUrl}
            alt="Rasm"
            style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 12, objectFit: "contain" }}
          />
        </div>
      )}

      {/* Telegram Circular Video Note (Selfie) Overlay */}
      {showVideoRecorder && (
        <TelegramCircularVideoRecorderOverlay
          onCancel={() => setShowVideoRecorder(false)}
          onSend={async (base64Video, durationSec) => {
            setShowVideoRecorder(false);
            const mimeMatch = base64Video.match(/^data:([^;]+);/i);
            const mimeType = mimeMatch?.[1] || "video/webm";
            const sent = await sendUserMessage(
              "",
              user,
              {
                type: "video_note",
                mediaUrl: base64Video,
                fileName: `video_note-${Date.now()}.webm`,
                mimeType,
                videoDuration: durationSec,
              },
              replyingToMsg
                ? {
                    id: replyingToMsg.id,
                    sender: replyingToMsg.sender,
                    text: replyingToMsg.text || "Biriktirilgan fayl",
                  }
                : undefined
            );
            setReplyingToMsg(null);
            if (!sent) triggerToast("❌ Dumaloq video yuborilmadi");
            else if (sent.deliveryStatus === "queued") triggerToast("⏳ Internet yo‘q: video navbatga qo‘yildi");
            else triggerToast("Yumaloq video xabar yuborildi 📹");
          }}
          onShowToast={triggerToast}
        />
      )}
    </div>
  );
}
