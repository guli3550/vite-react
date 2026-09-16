import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Search,
  X,
  Info,
  MoreVertical,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Bookmark,
  Trash2,
  Plus,
  Mic,
  Video,
  ArrowUp,
  Image as ImageIcon,
  Pin,
  Sparkles,
  Play,
  Pause,
  ArrowDown,
  FileText,
  MapPin,
  HelpCircle,
  CreditCard,
  Truck,
  Percent,
} from "lucide-react";
import { type Language } from "../utils/translations";
import {
  type ChatMessage,
  getStoredChatMessages,
  sendUserMessage,
  markMessagesAsRead,
  subscribeToChat,
  toggleMessageReaction,
  toggleBookmarkMessage,
  togglePinMessage,
  deleteChatMessage,
  clearChatMessages,
} from "../utils/chatSync";
import { CircleVideoNotePlayer, TelegramCircularVideoRecorderOverlay } from "./CircleVideoNote";
import { copyToClipboard } from "../utils/clipboard";
import "../admin/components/AdminGuliChat.css";

const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "😮", "🙏"];

const CUSTOMER_SUGGESTIONS = [
  {
    icon: Truck,
    title: "Yetkazib berish muddati",
    desc: "Toshkent va viloyatlar bo'yicha kuryerlik xizmati",
    prompt: "Yetkazib berish shartlari va muddatlari qanday?",
  },
  {
    icon: CreditCard,
    title: "To'lov usullari",
    desc: "Click, Payme, Uzum va naqd to'lov qabul qilinadimi?",
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
  const [activeMsgMenuId, setActiveMsgMenuId] = useState<string | null>(null);
  const [activeToast, setActiveToast] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Attachments & recording
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isVideoRecordingOpen, setIsVideoRecordingOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  // Toast trigger
  const triggerToast = (msgStr: string) => {
    if (onShowToast) onShowToast(msgStr);
    setActiveToast(msgStr);
    setTimeout(() => setActiveToast(null), 2200);
  };

  // Subscribe to real-time chat updates
  useEffect(() => {
    markMessagesAsRead(userId, "admin");
    const unsubscribe = subscribeToChat((updatedMsgs) => {
      const uId = String(userId);
      const filtered = updatedMsgs.filter(
        (m) => m.id === "welcome-msg-1" || (m.userId && String(m.userId) === uId)
      );
      setMessages(filtered);
      markMessagesAsRead(userId, "admin");
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

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distFromBottom > 160);
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
      if (!target.closest(".chatgpt-msg-actions-popup") && !target.closest(".chatgpt-msg-more-trigger")) {
        setActiveMsgMenuId(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("touchstart", handleOutsideClick);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);

  // Text-To-Speech (TTS)
  const toggleSpeak = (msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) {
      triggerToast("Brauzeringizda ovozli o'qish qo'llab-quvvatlanmaydi");
      return;
    }
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_>-]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "uz-UZ";
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Copy text handler
  const handleCopy = async (msgId: string, text: string) => {
    if (!text) return;
    await copyToClipboard(text);
    setCopiedId(msgId);
    triggerToast("Matndan nusxa olindi ✓");
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  // Voice recording
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        triggerToast("Brauzeringizda mikrofondan foydalanish qo'llab-quvvatlanmaydi.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        sendUserMessage(
          "",
          user,
          {
            type: "audio",
            mediaUrl: audioUrl,
            audioDuration: recordSeconds,
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
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      triggerToast("Mikrofonga ruxsat berilmadi yoki xatolik yuz berdi.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  // Video note complete
  const handleVideoRecorded = (videoUrl: string, durationSec: number) => {
    setIsVideoRecordingOpen(false);
    sendUserMessage(
      "",
      user,
      {
        type: "video_note",
        mediaUrl: videoUrl,
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
    triggerToast("Dumaloq video xabar yuborildi 📹");
  };

  // Send message
  const handleSend = (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : inputText.trim();
    if (!textToSend && !selectedImage) return;

    sendUserMessage(
      textToSend,
      user,
      selectedImage
        ? {
            type: "image",
            mediaUrl: selectedImage.url,
            fileName: selectedImage.name,
          }
        : undefined,
      replyingToMsg
        ? {
            id: replyingToMsg.id,
            sender: replyingToMsg.sender,
            text: replyingToMsg.text || "Biriktirilgan fayl",
          }
        : undefined
    );

    setInputText("");
    setSelectedImage(null);
    setReplyingToMsg(null);
    setShowAttachMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Pinned message
  const pinnedMessage = messages.find((m) => m.pinned);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`guli-chat-turn-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background-color 0.4s ease";
      el.style.backgroundColor = "rgba(190, 18, 60, 0.08)";
      setTimeout(() => {
        el.style.backgroundColor = "transparent";
      }, 1400);
    }
  };

  // Filtered messages by search
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="guli-chat-fullscreen-wrapper is-fullscreen" style={{ zIndex: 90 }}>
      {/* Floating Toast */}
      {activeToast && <div className="guli-floating-toast">{activeToast}</div>}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageSelect}
      />

      {/* ==========================================================================
          HEADER: 100% Guli AI / ChatGPT Header (← Logo Title Info ⋮)
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
            className="chatgpt-header-brand-logo"
            onClick={() => setInfoModalOpen(true)}
            style={{ cursor: "pointer" }}
            title="Do'kon ma'lumotlari"
          >
            <img src="/guli_logo.jpg" alt="GULI Lingerie" />
          </div>

          <div
            className="chatgpt-header-title-box"
            onClick={() => setInfoModalOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <h1 className="chatgpt-header-title" style={{ fontSize: 15.5 }}>
              GULI Lingerie
            </h1>
            <div className="chatgpt-header-online-indicator">
              <span className="chatgpt-indicator-dot" />
              <span>Online · Qo'llab-quvvatlash xizmati</span>
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

      {/* Pinned Message Top Banner */}
      {pinnedMessage && (
        <div
          className="chatgpt-pinned-banner"
          onClick={() => scrollToMessage(pinnedMessage.id)}
        >
          <div className="chatgpt-pinned-content">
            <Pin size={14} className="chatgpt-pinned-icon" />
            <span className="chatgpt-pinned-text">
              <b>Qadalgan xabar:</b> {pinnedMessage.text || "Biriktirilgan fayl"}
            </span>
          </div>
          <button
            type="button"
            className="chatgpt-pinned-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePinMessage(pinnedMessage.id);
              triggerToast("Qadalgan xabar olib tashlandi");
            }}
            title="Qadashni bekor qilish"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Inline Search Bar */}
      {searchOpen && (
        <div className="chatgpt-inline-search">
          <Search size={16} color="#71717A" />
          <input
            type="text"
            placeholder="Xabarlardan qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ==========================================================================
          MESSAGES SCROLL AREA: Pure Canvas (100% Guli AI typography & soft pills)
          ========================================================================== */}
      <div
        className="chatgpt-messages-scrollview"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {filteredMessages.length === 0 ? (
          <div className="guli-chat-empty-state">
            <div className="guli-chat-empty-logo">
              <img
                src="/guli_logo.jpg"
                alt="GULI Lingerie"
                className="guli-chat-brand-img"
              />
              <div className="guli-chat-empty-sparkle">
                <Sparkles size={13} />
              </div>
            </div>
            <h2>Xush kelibsiz! Qanday yordam bera olamiz?</h2>
            <p>
              GULI operatorlari sizga mahsulot tanlash, o'lchamlar, yetkazib berish va to'lovlar bo'yicha tezkor yordam berishadi.
            </p>

            <div className="guli-chat-suggestions-grid">
              {CUSTOMER_SUGGESTIONS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <div
                    key={idx}
                    className="guli-chat-suggestion-chip"
                    onClick={() => handleSend(item.prompt)}
                  >
                    <b>
                      <IconComp size={15} color="#BE123C" />
                      {item.title}
                    </b>
                    <span>{item.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isUser = msg.sender === "user";

            return (
              <div
                key={msg.id}
                id={`guli-chat-turn-${msg.id}`}
                className={`chatgpt-turn-container ${isUser ? "user" : "ai"}`}
              >
                {/* 1. USER TURN: Soft pastel pill on right */}
                {isUser ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "80%" }}>
                    <div className="chatgpt-user-bubble">
                      {/* Quoted reply snippet */}
                      {msg.replyToText && (
                        <div className="chatgpt-reply-quote-box user">
                          <div style={{ fontWeight: 700, fontSize: 11, color: "#2563eb", marginBottom: 1 }}>
                            {msg.replyToSender || "GULI Admin"}
                          </div>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11.5, opacity: 0.85 }}>
                            {msg.replyToText}
                          </div>
                        </div>
                      )}

                      {/* Image attachment */}
                      {msg.mediaUrl && msg.type === "image" && (
                        <div
                          className="chatgpt-user-image"
                          onClick={() => window.open(msg.mediaUrl, "_blank")}
                          title="Rasmni to'liq ko'rish"
                        >
                          <img src={msg.mediaUrl} alt="Yuklangan rasm" />
                        </div>
                      )}

                      {/* Video note player */}
                      {msg.mediaUrl && (msg.type === "video_note" || msg.type === "video") && (
                        <div style={{ margin: "4px 0" }}>
                          <CircleVideoNotePlayer
                            mediaUrl={msg.mediaUrl}
                            duration={msg.videoDuration || 5}
                            size={160}
                          />
                        </div>
                      )}

                      {/* Voice waveform pill */}
                      {msg.mediaUrl && msg.type === "audio" && (
                        <div className="chatgpt-voice-pill">
                          <button
                            type="button"
                            className="chatgpt-voice-play-btn"
                            onClick={() => togglePlayAudio(msg.id, msg.mediaUrl!)}
                            title={playingAudioId === msg.id ? "Pauza" : "Tinglash"}
                          >
                            {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                          </button>

                          <div className="chatgpt-voice-waveforms">
                            {[10, 20, 8, 24, 16, 12, 26, 18, 14, 22, 12, 18, 9, 21].map((h, i) => (
                              <div
                                key={i}
                                className={`chatgpt-wave-bar ${playingAudioId === msg.id ? "playing" : ""}`}
                                style={{
                                  height: `${h}px`,
                                  animationDelay: `${i * 0.06}s`,
                                }}
                              />
                            ))}
                          </div>

                          <span className="chatgpt-voice-duration">
                            {msg.audioDuration ? `0:${msg.audioDuration < 10 ? "0" : ""}${msg.audioDuration}` : "0:05"}
                          </span>
                        </div>
                      )}

                      {/* Text */}
                      {msg.text && msg.text !== "🎤 Ovozli xabar" && msg.text !== "📹 Dumaloq video" && (
                        <div className="chatgpt-user-text">{msg.text}</div>
                      )}

                      {/* Time meta */}
                      <div className="chatgpt-message-time-meta">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {msg.isBookmarked && <span title="Xatcho'p">⭐</span>}
                        {msg.pinned && <span title="Qadalgan">📌</span>}
                        <span>{msg.read ? "✓✓" : "✓"}</span>
                      </div>
                    </div>

                    {/* Signature Guli AI Action Bar underneath */}
                    <div className="chatgpt-actions-row" style={{ width: "100%", justifyContent: "flex-end", marginTop: 4 }}>
                      <div className="chatgpt-actions-left" style={{ gap: 8 }}>
                        {msg.text && (
                          <button
                            type="button"
                            className={`chatgpt-icon-btn ${copiedId === msg.id ? "active-copy" : ""}`}
                            onClick={() => handleCopy(msg.id, msg.text || "")}
                            title="Nusxa olish"
                          >
                            {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                        {msg.text && (
                          <button
                            type="button"
                            className={`chatgpt-icon-btn ${speakingMsgId === msg.id ? "active-speak" : ""}`}
                            onClick={() => toggleSpeak(msg.id, msg.text || "")}
                            title="Ovozli eshitish"
                          >
                            {speakingMsgId === msg.id ? <VolumeX size={14} color="#BE123C" /> : <Volume2 size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => setReplyingToMsg(msg)}
                          title="Javob qaytarish"
                        >
                          <span style={{ fontSize: 12 }}>↩️</span>
                        </button>
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => {
                            togglePinMessage(msg.id);
                            triggerToast(msg.pinned ? "Qadalgan xabar olib tashlandi" : "Xabar chat tepasiga qadaldi 📌");
                          }}
                          title={msg.pinned ? "Qadashni bekor qilish" : "Qadash"}
                        >
                          <Pin size={13} color={msg.pinned ? "#BE123C" : undefined} />
                        </button>
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => {
                            toggleBookmarkMessage(msg.id);
                            triggerToast(msg.isBookmarked ? "Xatcho'p olib tashlandi" : "Xatcho'pga saqlandi ⭐");
                          }}
                          title={msg.isBookmarked ? "Xatcho'pdan chiqarish" : "Xatcho'pga saqlash"}
                        >
                          <Bookmark size={13} color={msg.isBookmarked ? "#F59E0B" : undefined} />
                        </button>
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => {
                            deleteChatMessage(msg.id);
                            triggerToast("Xabar o'chirildi 🗑️");
                          }}
                          title="O'chirish"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. ADMIN TURN: Clean partner bubble with Guli avatar */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "82%" }}>
                    <div className="chatgpt-partner-bubble">
                      <div className="chatgpt-partner-header">
                        <img
                          src="/guli_logo.jpg"
                          alt="GULI Admin"
                          className="chatgpt-partner-avatar"
                        />
                        <span className="chatgpt-partner-name">GULI Admin</span>
                        <span className="chatgpt-partner-badge">Operator</span>
                      </div>

                      {/* Quoted reply */}
                      {msg.replyToText && (
                        <div className="chatgpt-reply-quote-box">
                          <div style={{ fontWeight: 700, fontSize: 11, color: "#BE123C", marginBottom: 1 }}>
                            {msg.replyToSender || "Siz"}
                          </div>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11.5, opacity: 0.85 }}>
                            {msg.replyToText}
                          </div>
                        </div>
                      )}

                      {/* Image */}
                      {msg.mediaUrl && msg.type === "image" && (
                        <div
                          className="chatgpt-user-image"
                          onClick={() => window.open(msg.mediaUrl, "_blank")}
                          title="Rasmni to'liq ko'rish"
                        >
                          <img src={msg.mediaUrl} alt="Biriktirilgan rasm" />
                        </div>
                      )}

                      {/* Video note player */}
                      {msg.mediaUrl && (msg.type === "video_note" || msg.type === "video") && (
                        <div style={{ margin: "4px 0" }}>
                          <CircleVideoNotePlayer
                            mediaUrl={msg.mediaUrl}
                            duration={msg.videoDuration || 5}
                            size={160}
                          />
                        </div>
                      )}

                      {/* Voice waveform pill */}
                      {msg.mediaUrl && msg.type === "audio" && (
                        <div className="chatgpt-voice-pill">
                          <button
                            type="button"
                            className="chatgpt-voice-play-btn"
                            onClick={() => togglePlayAudio(msg.id, msg.mediaUrl!)}
                            title={playingAudioId === msg.id ? "Pauza" : "Tinglash"}
                          >
                            {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                          </button>

                          <div className="chatgpt-voice-waveforms">
                            {[10, 20, 8, 24, 16, 12, 26, 18, 14, 22, 12, 18, 9, 21].map((h, i) => (
                              <div
                                key={i}
                                className={`chatgpt-wave-bar ${playingAudioId === msg.id ? "playing" : ""}`}
                                style={{
                                  height: `${h}px`,
                                  animationDelay: `${i * 0.06}s`,
                                }}
                              />
                            ))}
                          </div>

                          <span className="chatgpt-voice-duration">
                            {msg.audioDuration ? `0:${msg.audioDuration < 10 ? "0" : ""}${msg.audioDuration}` : "0:05"}
                          </span>
                        </div>
                      )}

                      {/* Text */}
                      {msg.text && (
                        <div className="chatgpt-user-text" style={{ whiteSpace: "pre-wrap" }}>
                          {msg.text}
                        </div>
                      )}

                      {/* Reactions bar */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="chatgpt-reactions-pill-bar">
                          {Object.entries(msg.reactions).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              type="button"
                              className="chatgpt-reaction-item"
                              onClick={() => toggleMessageReaction(msg.id, emoji)}
                            >
                              <span>{emoji}</span>
                              <span>{count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Time meta */}
                      <div className="chatgpt-message-time-meta" style={{ justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {msg.isBookmarked && <span title="Xatcho'p">⭐</span>}
                          {msg.pinned && <span title="Qadalgan">📌</span>}
                        </div>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    {/* Signature Guli AI Action Bar underneath */}
                    <div className="chatgpt-actions-row" style={{ width: "100%", justifyContent: "flex-start", marginTop: 4 }}>
                      <div className="chatgpt-actions-left" style={{ gap: 8 }}>
                        {msg.text && (
                          <button
                            type="button"
                            className={`chatgpt-icon-btn ${copiedId === msg.id ? "active-copy" : ""}`}
                            onClick={() => handleCopy(msg.id, msg.text || "")}
                            title="Nusxa olish"
                          >
                            {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                        {msg.text && (
                          <button
                            type="button"
                            className={`chatgpt-icon-btn ${speakingMsgId === msg.id ? "active-speak" : ""}`}
                            onClick={() => toggleSpeak(msg.id, msg.text || "")}
                            title="Ovozli eshitish"
                          >
                            {speakingMsgId === msg.id ? <VolumeX size={14} color="#BE123C" /> : <Volume2 size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => setReplyingToMsg(msg)}
                          title="Javob qaytarish"
                        >
                          <span style={{ fontSize: 12 }}>↩️</span>
                        </button>
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => {
                            togglePinMessage(msg.id);
                            triggerToast(msg.pinned ? "Qadalgan xabar olib tashlandi" : "Xabar chat tepasiga qadaldi 📌");
                          }}
                          title={msg.pinned ? "Qadashni bekor qilish" : "Qadash"}
                        >
                          <Pin size={13} color={msg.pinned ? "#BE123C" : undefined} />
                        </button>
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => {
                            toggleBookmarkMessage(msg.id);
                            triggerToast(msg.isBookmarked ? "Xatcho'p olib tashlandi" : "Xatcho'pga saqlandi ⭐");
                          }}
                          title={msg.isBookmarked ? "Xatcho'pdan chiqarish" : "Xatcho'pga saqlash"}
                        >
                          <Bookmark size={13} color={msg.isBookmarked ? "#F59E0B" : undefined} />
                        </button>

                        {/* Reaction popup trigger */}
                        <div className="chatgpt-msg-more-wrap">
                          <button
                            type="button"
                            className="chatgpt-icon-btn chatgpt-msg-more-trigger"
                            onClick={() => setActiveMsgMenuId(activeMsgMenuId === msg.id ? null : msg.id)}
                            title="Reaksiyalar"
                          >
                            <span style={{ fontSize: 12 }}>❤️</span>
                          </button>

                          {activeMsgMenuId === msg.id && (
                            <div className="chatgpt-msg-actions-popup" style={{ left: 0 }}>
                              <div style={{ display: "flex", gap: 4, padding: "4px", justifyContent: "space-between" }}>
                                {REACTION_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", padding: "2px 4px" }}
                                    onClick={() => {
                                      toggleMessageReaction(msg.id, emoji);
                                      setActiveMsgMenuId(null);
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
          BOTTOM COMMAND DOCK: ➕ 🎤 Capsule Matn kiritish... ⬆
          ========================================================================== */}
      <div className="chatgpt-input-dock-container">
        {/* Replying-To preview bar */}
        {replyingToMsg && (
          <div className="chatgpt-reply-preview-dock">
            <div className="chatgpt-reply-preview-left">
              <span className="chatgpt-reply-preview-sender">
                {replyingToMsg.sender === "admin" ? "GULI Admin" : "Siz"}ga javob:
              </span>
              <span className="chatgpt-reply-preview-text">
                {replyingToMsg.text || "Biriktirilgan fayl"}
              </span>
            </div>
            <button
              type="button"
              className="chatgpt-icon-btn"
              onClick={() => setReplyingToMsg(null)}
              title="Javobni bekor qilish"
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
              {/* Left Action: Plus button with attachment menu */}
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
                        setShowAttachMenu(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      <ImageIcon size={16} className="chatgpt-attach-icon" />
                      <span>Rasm / Galereya</span>
                    </button>
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        setShowAttachMenu(false);
                        setIsVideoRecordingOpen(true);
                      }}
                    >
                      <Video size={16} className="chatgpt-attach-icon" />
                      <span>Dumaloq video (Telegram)</span>
                    </button>
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        setShowAttachMenu(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      <FileText size={16} className="chatgpt-attach-icon" />
                      <span>Hujjat / Chek</span>
                    </button>
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        setShowAttachMenu(false);
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              sendUserMessage(
                                `📍 Mening joylashuvim:\nhttps://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`,
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

              {/* Text Input */}
              <textarea
                ref={textareaRef}
                className="chatgpt-dock-textarea"
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={replyingToMsg ? "Javob yozing..." : "Xabar yozing..."}
              />

              {/* Right Action: Send Button OR Voice / Video Notes */}
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
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
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
                    onClick={() => setIsVideoRecordingOpen(true)}
                    title="Dumaloq video yozish"
                  >
                    <Video size={19} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Telegram Circular Video Note Recorder Overlay */}
      {isVideoRecordingOpen && (
        <TelegramCircularVideoRecorderOverlay
          onSend={handleVideoRecorded}
          onCancel={() => setIsVideoRecordingOpen(false)}
          onShowToast={triggerToast}
        />
      )}

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
                <img
                  src="/guli_logo.jpg"
                  alt="GULI"
                  style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#18181B" }}>
                    GULI Lingerie
                  </h3>
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
                <span style={{ color: "#71717A" }}>📞 Call Center:</span>
                <a href="tel:+998905811117" style={{ fontWeight: 700, color: "#BE123C", textDecoration: "none" }}>
                  +998 90 581 11 17
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>💬 Telegram Bot:</span>
                <span style={{ fontWeight: 600, color: "#0284C7" }}>@guli_lingerie_bot</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>⏰ Ish tartibi:</span>
                <span style={{ fontWeight: 600 }}>Har kuni 09:00 - 21:00</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#71717A" }}>📍 Manzil:</span>
                <span style={{ fontWeight: 500 }}>Toshkent shahri, O'zbekiston</span>
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
    </div>
  );
}
