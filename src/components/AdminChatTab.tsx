import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import {
  type ChatMessage,
  type ConversationSummary,
  getAllConversations,
  getStoredChatMessages,
  sendAdminReply,
  subscribeToChat,
  saveChatMessages,
  markMessagesAsRead,
  updateConversationMetadata,
  editChatMessage,
  deleteChatMessage,
  toggleMessageReaction,
  votePollOption,
} from "../utils/chatSync";
import { SwipeableChatBackground, SwipeableMessageRow } from "./SwipeChatHelpers";
import "../chat2.css";

type AdminChatTabProps = {
  token?: string;
  onOpenSidebar?: () => void;
  onViewOrderDetails?: (orderNumber: string) => void;
};

// Seed sample chats and CRM metadata if empty
function seedSampleChatsIfEmpty() {
  const current = getStoredChatMessages();
  if (current.length <= 1) {
    const samples: ChatMessage[] = [
      {
        id: "msg-sample-1",
        sender: "user",
        text: "Assalomu alaykum! Yangi kolleksiya byustgalterlarining 75B o‘lchami bormi?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        userId: "998901234567",
        userName: "Malika Rahimova",
        userPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
      },
      {
        id: "msg-sample-2",
        sender: "user",
        text: "Salom admin, buyurtmam qachon yetkaziladi? Kod: 104291",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        read: false,
        userId: "telegram-88392",
        userName: "Dilnoza (Telegram)",
      },
      {
        id: "msg-sample-3",
        sender: "user",
        text: "Kuryer yetib keldi, katta rahmat sizlarga! 🌷",
        timestamp: new Date(Date.now() - 900000).toISOString(),
        read: true,
        userId: "998935551234",
        userName: "Shahnoza Karimova",
      },
    ];
    saveChatMessages([...current, ...samples]);

    // Metadata seed
    updateConversationMetadata("998901234567", {
      source: "webapp",
      phone: "+998 90 123 45 67",
      telegramUsername: "@malika_rahimova",
      assignedOperator: "Operator #1 (Dilnoza)",
      status: "open",
      notes: "75B va 80C o'lchamlarni yoqtiradi. To'lovni Click orqali qilgan.",
      orderCount: 3,
      lastOrderNumber: "104291",
      lastOrderStatus: "Tayyorlanmoqda",
      lastOrderTotal: 185000,
    });

    updateConversationMetadata("telegram-88392", {
      source: "telegram",
      phone: "+998 93 888 39 21",
      telegramUsername: "@dilnoza_tg",
      telegramId: "88392101",
      assignedOperator: "Operator #2 (Malika)",
      status: "pending",
      notes: "Telegram Bot orqali buyurtma bergan. Toshkent shahar.",
      orderCount: 1,
      lastOrderNumber: "104291",
      lastOrderStatus: "Yo'lda",
      lastOrderTotal: 240000,
    });

    updateConversationMetadata("998935551234", {
      source: "callcenter",
      phone: "+998 93 555 12 34",
      assignedOperator: "GULI Call Center jamoasi",
      status: "closed",
      notes: "Qayta qo'ng'iroq orqali zakaz qilgan. Doimiy mijoz.",
      orderCount: 5,
      lastOrderNumber: "103810",
      lastOrderStatus: "Yetkazildi",
      lastOrderTotal: 310000,
    });
  }
}

const QUICK_REPLIES = [
  "🔎 Buyurtmani tekshirish",
  "👗 Mahsulotlar",
  "🚚 Yetkazib berish",
  "💳 To‘lov",
  "🌷 Qutlov",
  "📞 Qo‘ng‘iroq",
];

const TEMPLATE_MAP: Record<string, string> = {
  "🔎 Buyurtmani tekshirish": "Buyurtmangiz tekshirilmoqda, 5 daqiqa ichida holati haqida xabar beramiz ⏳",
  "👗 Mahsulotlar": "Bizdagi barcha o'lchamlar xalqaro standartlarga mos keladi. Sizga qaysi o'lcham mos kelishini aniqlashda yordam beraymi? 🌸",
  "🚚 Yetkazib berish": "Toshkent bo'ylab 1 kunda (20 000 so'm), 300 000 so'mdan yuqori xaridda BEPUL yetkaziladi 🚚",
  "💳 To‘lov": "To'lovni Click, Payme, Uzum Bank yoki kuryerga NAQD topshirishingiz mumkin 💳",
  "🌷 Qutlov": "Assalomu alaykum! GULI Lingerie brendiga xush kelibsiz. Sizga qanday yordam bera olamiz? ✨",
  "📞 Qo‘ng‘iroq": "Mutaxassisimiz siz bilan bog'lanishi uchun telefon raqamingizni qoldiring 📞",
};

const EMOJI_LIST = [
  "🌷", "✨", "🌸", "💖", "🛍️", "💳", "🚚", "⏳", "📦", "📞",
  "💯", "😊", "👍", "❤️", "🙏", "🔥", "💎", "👙", "🎁", "💬",
  "⚡", "✅", "📍", "🧾", "😍", "🎯", "⭐", "🎉",
];

const REACTION_EMOJIS = ["❤️", "👍", "😂", "😍", "😢", "😡"];

const OPERATORS_LIST = [
  "Operator #1 (Dilnoza Rahimova)",
  "Operator #2 (Malika Karimova)",
  "Operator #3 (Shahnoza Umarova)",
  "GULI Call Center jamoasi",
];

// Helper to format date groups
function formatDateGroup(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return "Bugun";
  if (isYesterday) return "Kechagi";

  const monthNames = [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"
  ];
  return `${date.getDate()}-${monthNames[date.getMonth()]}, ${date.getFullYear()}`;
}

// Custom Voice Audio Player component
function VoiceAudioPlayer({ mediaUrl, duration: defaultDuration }: { mediaUrl: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(defaultDuration || 0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="chat2-voice-player">
      <audio
        ref={audioRef}
        src={mediaUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        preload="metadata"
      />
      <button type="button" className="chat2-voice-play-btn" onClick={togglePlay}>
        {isPlaying ? "⏸" : "▶"}
      </button>
      <div className="chat2-voice-info">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="chat2-voice-slider"
        />
        <div className="chat2-voice-meta">
          <span>🎙️ Ovozli xabar</span>
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdminChatTab({
  token,
  onOpenSidebar,
  onViewOrderDetails,
}: AdminChatTabProps) {
  void token;

  useEffect(() => {
    seedSampleChatsIfEmpty();
  }, []);

  const [conversations, setConversations] = useState<ConversationSummary[]>(() =>
    getAllConversations()
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    const list = getAllConversations();
    return list[0]?.userId || "998901234567";
  });

  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "unread" | "pending" | "operators" | "telegram" | "webapp" | "callcenter"
  >("all");
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages()
  );

  // Mobile layout state: "list" | "chat" | "crm"
  const [mobileView, setMobileView] = useState<"list" | "chat" | "crm">("list");

  // Modals & Drawers state
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"emoji" | "sticker">("emoji");
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOption1, setPollOption1] = useState("");
  const [pollOption2, setPollOption2] = useState("");
  const [pollOption3, setPollOption3] = useState("");

  // Location Picker state
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locAddress, setLocAddress] = useState("GULI Showroom: Toshkent sh., Chilonzor 10-mavze, 45-uy");
  const [locLat, setLocLat] = useState(41.2825);
  const [locLng, setLocLng] = useState(69.2155);

  // Full Customer Profile Chat Modal state
  const [fullProfileModalOpen, setFullProfileModalOpen] = useState(false);

  const [replyingToMsg, setReplyingToMsg] = useState<ChatMessage | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [assignOperatorOpen, setAssignOperatorOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>("");

  // Customer Notes state
  const [customerNotesText, setCustomerNotesText] = useState("");

  // Voice Recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Separate File Input Refs: Gallery vs Camera vs Document
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Subscribe to real-time chat updates
  useEffect(() => {
    const unsubscribe = subscribeToChat((updatedMessages) => {
      setAllMessages(updatedMessages);
      setConversations(getAllConversations());
    });
    return () => unsubscribe();
  }, []);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedUserId) {
      markMessagesAsRead(selectedUserId);
      setConversations(getAllConversations());
    }
  }, [selectedUserId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, selectedUserId]);

  // Sync customer notes text on selectedUserId change
  const currentConversation = conversations.find((c) => c.userId === selectedUserId);
  useEffect(() => {
    if (currentConversation) {
      setCustomerNotesText(currentConversation.notes || "");
    }
  }, [selectedUserId, currentConversation]);

  // Category statistics breakdown
  const telegramConvs = conversations.filter((c) => c.source === "telegram");
  const webAppConvs = conversations.filter((c) => c.source === "webapp");
  const callCenterConvs = conversations.filter((c) => c.source === "callcenter");

  const telegramUnread = telegramConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const webAppUnread = webAppConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const callCenterUnread = callCenterConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.telegramUsername && c.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "unread") return c.unreadCount > 0;
    if (filterType === "pending") return c.status === "pending";
    if (filterType === "operators") return Boolean(c.assignedOperator);
    if (filterType === "telegram") return c.source === "telegram";
    if (filterType === "webapp") return c.source === "webapp";
    if (filterType === "callcenter") return c.source === "callcenter";

    return true;
  });

  // Current active chat messages
  const activeChatMessages = allMessages.filter(
    (m) => !m.userId || String(m.userId) === String(selectedUserId) || m.id === "welcome-msg-1"
  );

  // Synthesize Telegram-style message send audio feedback
  const playTelegramSendSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio block fallback
    }
  };

  // Send Admin Reply
  const handleSendReply = async (
    e?: FormEvent,
    overrideText?: string,
    media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string; audioDuration?: number }
  ) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : replyText;
    if (!textToSend.trim() && !media) return;

    const replyToParam = replyingToMsg
      ? { id: replyingToMsg.id, text: replyingToMsg.text, sender: replyingToMsg.userName || replyingToMsg.sender }
      : undefined;

    playTelegramSendSound();
    await sendAdminReply(selectedUserId, textToSend, media, replyToParam);

    setReplyText("");
    setReplyingToMsg(null);
    setEmojiPickerOpen(false);
    setAttachMenuOpen(false);
  };

  // Send Showroom / Custom Location
  const handleSendLocationPicker = (lat: number, lng: number, address: string) => {
    playTelegramSendSound();
    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const newMsg: ChatMessage = {
      id: `msg-loc-${Date.now()}`,
      sender: "admin",
      text: `📍 ${address}`,
      type: "location",
      location: { lat, lng, address, mapUrl },
      timestamp: new Date().toISOString(),
      read: false,
      userId: selectedUserId,
      userName: "GULI Admin",
    };
    saveChatMessages([...allMessages, newMsg]);
    setLocationPickerOpen(false);
    setAttachMenuOpen(false);
    showToast("📍 Geolokatsiya yuborildi!");
  };

  const handleFetchGPSLocation = () => {
    showToast("📡 GPS joylashuv aniqlanmoqda...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocLat(lat);
          setLocLng(lng);
          const addr = `Aniq GPS Manzilingiz: Toshkent sh. (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setLocAddress(addr);
          showToast("✓ Aniq GPS joylashuv aniqlandi!");
        },
        () => {
          showToast("⚠️ GPS aniqlashda xatolik. Standart showroom manzili tanlandi.");
        }
      );
    }
  };

  // Create & Send Interactive Poll
  const handleCreatePoll = () => {
    if (!pollQuestion.trim() || !pollOption1.trim() || !pollOption2.trim()) {
      showToast("Savol va kamida 2 ta variantni kiriting!");
      return;
    }
    const rawOptions = [pollOption1, pollOption2, pollOption3].filter((o) => o.trim());
    const pollOpts = rawOptions.map((optText, idx) => ({
      id: idx,
      text: optText.trim(),
      votes: 0,
    }));

    playTelegramSendSound();
    const newMsg: ChatMessage = {
      id: `msg-poll-${Date.now()}`,
      sender: "admin",
      text: pollQuestion.trim(),
      type: "poll",
      pollQuestion: pollQuestion.trim(),
      pollOptions: pollOpts,
      timestamp: new Date().toISOString(),
      read: false,
      userId: selectedUserId,
      userName: "GULI Admin",
    };
    saveChatMessages([...allMessages, newMsg]);

    setPollModalOpen(false);
    setPollQuestion("");
    setPollOption1("");
    setPollOption2("");
    setPollOption3("");
    setAttachMenuOpen(false);
    showToast("📊 Interaktiv So'rovnoma yuborildi!");
  };

  // Image & File attachment handlers
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleSendReply(undefined, "📷 Rasm biriktirildi", {
        type: "image",
        mediaUrl: dataUrl,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleSendReply(undefined, `📁 ${file.name}`, {
        type: "file",
        mediaUrl: dataUrl,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Voice recording controls
  const startVoiceRecording = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
    } catch {
      // Fallback timer simulation if mic permissions are constrained in iframe
    }
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const sendVoiceRecording = () => {
    const durationSec = recordingSeconds || 4;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          handleSendReply(undefined, "🎙️ Ovozli xabar", {
            type: "audio",
            mediaUrl: base64,
            fileName: `voice-${Date.now()}.webm`,
            audioDuration: durationSec,
          });
        };
        reader.readAsDataURL(blob);
        mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    } else {
      // Sample audio fallback if mic stream is blocked in sandbox
      handleSendReply(undefined, "🎙️ Ovozli xabar", {
        type: "audio",
        mediaUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        fileName: `voice-${Date.now()}.mp3`,
        audioDuration: durationSec,
      });
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  // Save CRM Customer Notes
  const handleSaveNotes = () => {
    updateConversationMetadata(selectedUserId, { notes: customerNotesText });
    setConversations(getAllConversations());
    showToast("Mijoz izohi saqlandi ✓");
  };

  // Assign Operator
  const handleAssignOperator = (opName: string) => {
    updateConversationMetadata(selectedUserId, { assignedOperator: opName });
    setConversations(getAllConversations());
    setAssignOperatorOpen(false);
    showToast(`${opName} biriktirildi ✓`);
  };

  // Copy message text
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Xabar matni nusxalandi! ✓");
  };

  // Delete message
  const handleDeleteMessage = (id: string) => {
    deleteChatMessage(id);
    showToast("Xabar o'chirildi");
  };

  // Edit message
  const handleStartEditMessage = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.text);
  };

  const handleSaveEditMessage = () => {
    if (editingMsgId && editingText.trim()) {
      editChatMessage(editingMsgId, editingText.trim());
      setEditingMsgId(null);
      setEditingText("");
      showToast("Xabar tahrirlandi ✓");
    }
  };

  return (
    <div className="chat2-container">
      {toastMessage && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#ffffff",
            padding: "8px 18px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 1. SIDEBAR / CONVERSATION LIST */}
      <aside className={`chat2-sidebar ${mobileView !== "list" ? "chat2-mobile-hide" : ""}`}>
        <div className="chat2-sidebar-head">
          <div className="chat2-sidebar-title">
            <h2>
              {onOpenSidebar && (
                <button
                  type="button"
                  onClick={onOpenSidebar}
                  style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}
                >
                  ☰
                </button>
              )}
              Online Chat
            </h2>
            <span className="chat2-badge">{conversations.length}</span>
          </div>
          <div className="chat2-search-box">
            <span className="chat2-search-icon">🔍</span>
            <input
              type="text"
              className="chat2-search-input"
              placeholder="Ism, telefon yoki username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="chat2-filters">
          <button
            type="button"
            className={`chat2-filter-btn ${filterType === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            Barcha
          </button>
          <button
            type="button"
            className={`chat2-filter-btn ${filterType === "unread" ? "active" : ""}`}
            onClick={() => setFilterType("unread")}
          >
            O‘qilmagan
          </button>
          <button
            type="button"
            className={`chat2-filter-btn ${filterType === "pending" ? "active" : ""}`}
            onClick={() => setFilterType("pending")}
          >
            Kutayotgan
          </button>
          <button
            type="button"
            className={`chat2-filter-btn ${filterType === "telegram" ? "active" : ""}`}
            onClick={() => setFilterType("telegram")}
          >
            ✈️ Telegram
          </button>
          <button
            type="button"
            className={`chat2-filter-btn ${filterType === "webapp" ? "active" : ""}`}
            onClick={() => setFilterType("webapp")}
          >
            🌐 Web App
          </button>
          <button
            type="button"
            className={`chat2-filter-btn ${filterType === "callcenter" ? "active" : ""}`}
            onClick={() => setFilterType("callcenter")}
          >
            ☎️ Call Center
          </button>
        </div>

        {/* Online Chat Category Breakdown */}
        <div
          style={{
            padding: "8px 12px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontSize: 11,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
          }}
        >
          <div
            onClick={() => setFilterType("telegram")}
            style={{
              background: filterType === "telegram" ? "#e0f2fe" : "#ffffff",
              border: filterType === "telegram" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "5px 6px",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#64748b", fontSize: 10 }}>✈️ Telegram</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0369a1" }}>
              {telegramConvs.length}{" "}
              {telegramUnread > 0 && <span style={{ color: "#e11d48", fontSize: 10 }}>({telegramUnread})</span>}
            </div>
          </div>

          <div
            onClick={() => setFilterType("webapp")}
            style={{
              background: filterType === "webapp" ? "#fcecef" : "#ffffff",
              border: filterType === "webapp" ? "1px solid #b6536b" : "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "5px 6px",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#64748b", fontSize: 10 }}>🌐 Web App</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#b6536b" }}>
              {webAppConvs.length}{" "}
              {webAppUnread > 0 && <span style={{ color: "#e11d48", fontSize: 10 }}>({webAppUnread})</span>}
            </div>
          </div>

          <div
            onClick={() => setFilterType("callcenter")}
            style={{
              background: filterType === "callcenter" ? "#f0fdf4" : "#ffffff",
              border: filterType === "callcenter" ? "1px solid #16a34a" : "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "5px 6px",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#64748b", fontSize: 10 }}>☎️ Call Center</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d" }}>
              {callCenterConvs.length}{" "}
              {callCenterUnread > 0 && <span style={{ color: "#e11d48", fontSize: 10 }}>({callCenterUnread})</span>}
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="chat2-conv-list">
          {filteredConversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              Suhbatlar topilmadi
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = c.userId === selectedUserId;
              return (
                <button
                  type="button"
                  key={c.userId}
                  className={`chat2-conv-item ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setSelectedUserId(c.userId);
                    setMobileView("chat");
                  }}
                >
                  <div className="chat2-avatar-wrap">
                    {c.userPhoto ? (
                      <img className="chat2-avatar" src={c.userPhoto} alt="" />
                    ) : (
                      <div className="chat2-avatar">{c.userName.slice(0, 1).toUpperCase()}</div>
                    )}
                    <span className="chat2-online-dot" />
                  </div>
                  <div className="chat2-conv-content">
                    <div className="chat2-conv-top">
                      <span className="chat2-conv-name">{c.userName}</span>
                      <span className="chat2-conv-time">
                        {c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <div className="chat2-conv-bottom">
                      <span className="chat2-conv-snippet">{c.lastMessage}</span>
                      <span className={`chat2-platform-badge ${c.source}`}>
                        {c.source === "telegram" ? "Telegram" : c.source === "webapp" ? "Web App" : "Call Center"}
                      </span>
                      {c.unreadCount > 0 && <span className="chat2-unread-badge">{c.unreadCount}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. MAIN ACTIVE CHAT WINDOW */}
      <main className={`chat2-main ${mobileView !== "chat" ? "chat2-mobile-hide" : ""}`}>
        <SwipeableChatBackground
          onExit={() => {
            setMobileView("list");
            if (onOpenSidebar) onOpenSidebar();
          }}
          id="admin-chat-swipe-bg"
        >
          {/* Chat Header */}
          <div className="chat2-header">
            <div className="chat2-header-info">
              <button
                type="button"
                className="chat2-action-btn"
                style={{ display: mobileView === "chat" ? "inline-flex" : "none" }}
                onClick={() => setMobileView("list")}
              >
                ← Orqaga
              </button>
              <div
                className="chat2-avatar-wrap"
                style={{ width: 42, height: 42, cursor: "pointer" }}
                title="Mijoz chat oynasini to'liq ekranda ochish"
                onClick={() => setFullProfileModalOpen(true)}
              >
                {currentConversation?.userPhoto ? (
                  <img className="chat2-avatar" style={{ width: 42, height: 42 }} src={currentConversation.userPhoto} alt="" />
                ) : (
                  <div className="chat2-avatar" style={{ width: 42, height: 42, fontSize: 18 }}>
                    {(currentConversation?.userName || "M").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="chat2-online-dot" />
              </div>
              <div
                className="chat2-header-title"
                style={{ cursor: "pointer" }}
                onClick={() => setFullProfileModalOpen(true)}
              >
                <span className="chat2-header-name">
                  {currentConversation?.userName || "Mijoz"}
                  <span className={`chat2-platform-badge ${currentConversation?.source || "webapp"}`}>
                    {currentConversation?.source === "telegram" ? "Telegram" : currentConversation?.source === "webapp" ? "Web App" : "Call Center"}
                  </span>
                </span>
                <span className="chat2-header-status" style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                  GULI Admin Web App - {currentConversation?.source === "telegram" ? "Telegram bot" : currentConversation?.source === "callcenter" ? "Call center" : "web app profilidagi"} online chatdan yozayotgan mijoz
                  <span style={{ marginLeft: 6, color: "#10b981", fontWeight: 700 }}>● Online</span>
                </span>
              </div>
            </div>

            <div className="chat2-header-actions">
              {currentConversation?.phone && (
                <a href={`tel:${currentConversation.phone.replace(/\s+/g, "")}`} className="chat2-action-btn">
                  📞 Tel
                </a>
              )}
              <button
                type="button"
                className="chat2-action-btn"
                onClick={() => setAssignOperatorOpen(!assignOperatorOpen)}
              >
                👤 Operator
              </button>
              <button
                type="button"
                className="chat2-action-btn primary"
                onClick={() => setMobileView("crm")}
              >
                ℹ️ CRM
              </button>
            </div>
          </div>

          {/* Operator Assignment Dropdown Modal */}
          {assignOperatorOpen && (
            <div
              style={{
                position: "absolute",
                top: 64,
                right: 16,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 12,
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                zIndex: 30,
                width: 260,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>
                Operator biriktirish
              </div>
              {OPERATORS_LIST.map((op) => (
                <button
                  key={op}
                  type="button"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: currentConversation?.assignedOperator === op ? "#fcecef" : "transparent",
                    color: currentConversation?.assignedOperator === op ? "#b6536b" : "#334155",
                    fontSize: 12,
                    fontWeight: currentConversation?.assignedOperator === op ? 600 : 400,
                    cursor: "pointer",
                    marginBottom: 2,
                  }}
                  onClick={() => handleAssignOperator(op)}
                >
                  {op}
                </button>
              ))}
            </div>
          )}

          {/* Messages Container */}
          <div className="chat2-messages">
            {activeChatMessages.map((msg, idx) => {
              const prevMsg = activeChatMessages[idx - 1];
              const currentDateGroup = formatDateGroup(msg.timestamp);
              const prevDateGroup = prevMsg ? formatDateGroup(prevMsg.timestamp) : "";
              const showDateSeparator = currentDateGroup !== prevDateGroup;

              return (
                <div key={msg.id} style={{ display: "contents" }}>
                  {showDateSeparator && (
                    <div className="chat2-date-separator">
                      <span className="chat2-date-pill">{currentDateGroup}</span>
                    </div>
                  )}

                  <SwipeableMessageRow
                    align={msg.sender === "user" ? "left" : "right"}
                    onReply={() => setReplyingToMsg(msg)}
                    id={`admin-swipe-row-${msg.id}`}
                  >
                    <div className={`chat2-bubble-wrap ${msg.sender}`}>
                      {/* Message Action Bar (Hover / Tap) */}
                      <div className="chat2-bubble-actions">
                        <div className="chat2-reaction-picker">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="chat2-action-icon"
                              onClick={() => toggleMessageReaction(msg.id, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="chat2-action-icon"
                          title="Javob berish"
                          onClick={() => setReplyingToMsg(msg)}
                        >
                          ↩️
                        </button>
                        <button
                          type="button"
                          className="chat2-action-icon"
                          title="Nusxalash"
                          onClick={() => handleCopyMessage(msg.text)}
                        >
                          📋
                        </button>
                        {msg.sender === "admin" && (
                          <>
                            <button
                              type="button"
                              className="chat2-action-icon"
                              title="Tahrirlash"
                              onClick={() => handleStartEditMessage(msg)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="chat2-action-icon"
                              title="O'chirish"
                              onClick={() => handleDeleteMessage(msg.id)}
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>

                      <div className="chat2-bubble">
                        {/* Quoted Reply if present */}
                        {msg.replyToText && (
                          <div className="chat2-reply-quote">
                            <div className="chat2-reply-quote-sender">{msg.replyToSender || "Xabar"}</div>
                            <div className="chat2-reply-quote-text">{msg.replyToText}</div>
                          </div>
                        )}

                        {/* Image Attachment */}
                        {msg.type === "image" && msg.mediaUrl && (
                          <img
                            className="chat2-media-img"
                            src={msg.mediaUrl}
                            alt="Rasm"
                            onClick={() => setLightboxImageUrl(msg.mediaUrl!)}
                          />
                        )}

                        {/* File Attachment */}
                        {msg.type === "file" && msg.mediaUrl && (
                          <a className="chat2-media-file" href={msg.mediaUrl} download={msg.fileName || "fayl"}>
                            📄 {msg.fileName || "Biriktirilgan fayl"}
                          </a>
                        )}

                        {/* Interactive Poll Card */}
                        {(msg.type === "poll" || msg.pollOptions) && (
                          <div className="chat2-poll-card">
                            <div className="chat2-poll-title">📊 {msg.pollQuestion || msg.text}</div>
                            <div className="chat2-poll-options">
                              {(msg.pollOptions || []).map((opt, oIdx) => {
                                const totalVotes = (msg.pollOptions || []).reduce((acc, curr) => acc + (curr.votes || 0), 0);
                                const percentage = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                                const isVoted = msg.userVotedOption === oIdx;
                                return (
                                  <button
                                    key={opt.id || oIdx}
                                    type="button"
                                    className={`chat2-poll-opt-btn ${isVoted ? "voted" : ""}`}
                                    onClick={() => {
                                      votePollOption(msg.id, oIdx);
                                      playTelegramSendSound();
                                    }}
                                  >
                                    <div className="chat2-poll-fill" style={{ width: `${percentage}%` }} />
                                    <div className="chat2-poll-opt-text">
                                      <span>{isVoted ? "☑️" : "⚪"}</span>
                                      <span>{opt.text}</span>
                                    </div>
                                    <div className="chat2-poll-opt-meta">
                                      {percentage}% ({opt.votes || 0})
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Geolocation Card */}
                        {(msg.type === "location" || msg.location) && (
                          <div className="chat2-location-card">
                            <div className="chat2-location-map-preview">
                              <div className="chat2-map-pin-badge">
                                📍 Pin Jo'natildi
                              </div>
                            </div>
                            <div className="chat2-location-info">
                              <div className="chat2-location-address">
                                {msg.location?.address || msg.text}
                              </div>
                              <a
                                href={msg.location?.mapUrl || `https://www.google.com/maps?q=${msg.location?.lat || 41.2825},${msg.location?.lng || 69.2155}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat2-location-btn"
                              >
                                🗺️ Kartada ochish (Google Maps)
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Voice Audio Message */}
                        {msg.type === "audio" && msg.mediaUrl ? (
                          <VoiceAudioPlayer mediaUrl={msg.mediaUrl} duration={msg.audioDuration} />
                        ) : (
                          !msg.pollOptions && !msg.location && <div>{msg.text}</div>
                        )}

                        {/* Bubble Footer Meta */}
                        <div className="chat2-bubble-meta">
                          {msg.isEdited && <span>(tahrirlandi)</span>}
                          <span>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                          {msg.sender === "admin" && (
                            <span>{msg.read ? "✓✓" : "✓"}</span>
                          )}
                        </div>

                        {/* Reactions Pill Counter */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="chat2-reactions-bar">
                            {Object.entries(msg.reactions).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                className="chat2-reaction-pill active"
                                onClick={() => toggleMessageReaction(msg.id, emoji)}
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </SwipeableMessageRow>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </SwipeableChatBackground>

        {/* Quick Reply Template Chips */}
        <div className="chat2-quick-replies">
          {QUICK_REPLIES.map((chip) => (
            <button
              key={chip}
              type="button"
              className="chat2-quick-chip"
              onClick={() => {
                const text = TEMPLATE_MAP[chip] || chip;
                setReplyText(text);
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Reply Preview Banner */}
        {replyingToMsg && (
          <div className="chat2-reply-banner">
            <div className="chat2-reply-banner-info">
              <span style={{ fontWeight: 700, color: "#b6536b" }}>
                ↩️ Javob berilmoqda: {replyingToMsg.userName || replyingToMsg.sender}
              </span>
              <span style={{ color: "#475569" }}>{replyingToMsg.text}</span>
            </div>
            <button
              type="button"
              className="chat2-reply-cancel"
              onClick={() => setReplyingToMsg(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Telegram Emoji & Sticker Drawer */}
        {emojiPickerOpen && (
          <div className="telegram-emoji-drawer">
            <div className="telegram-drawer-tabs">
              <button
                type="button"
                className={`telegram-drawer-tab ${drawerTab === "emoji" ? "active" : ""}`}
                onClick={() => setDrawerTab("emoji")}
              >
                😊 Emojilar
              </button>
              <button
                type="button"
                className={`telegram-drawer-tab ${drawerTab === "sticker" ? "active" : ""}`}
                onClick={() => setDrawerTab("sticker")}
              >
                🏷️ Stikerlar
              </button>
            </div>

            {drawerTab === "emoji" ? (
              <div className="telegram-emoji-grid">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="telegram-emoji-btn"
                    onClick={() => {
                      setReplyText((prev) => prev + emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="telegram-emoji-grid">
                {["🌸", "🎀", "👙", "💖", "✨", "🛍️", "💅", "💄", "🌷", "💃", "👑", "💌", "🎁", "🌹"].map((sticker) => (
                  <button
                    key={sticker}
                    type="button"
                    className="telegram-emoji-btn"
                    style={{ fontSize: 28 }}
                    onClick={() => {
                      handleSendReply(undefined, sticker);
                      setEmojiPickerOpen(false);
                    }}
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Telegram Attachment Popover Menu */}
        {attachMenuOpen && (
          <div className="telegram-attach-sheet">
            <button
              type="button"
              className="telegram-attach-item"
              onClick={() => {
                galleryInputRef.current?.click();
                setAttachMenuOpen(false);
              }}
            >
              <div className="telegram-attach-icon gallery">🖼️</div>
              <span>Galereya (Faqat Rasm)</span>
            </button>

            <button
              type="button"
              className="telegram-attach-item"
              onClick={() => {
                cameraInputRef.current?.click();
                setAttachMenuOpen(false);
              }}
            >
              <div className="telegram-attach-icon camera">📸</div>
              <span>Kamera</span>
            </button>

            <button
              type="button"
              className="telegram-attach-item"
              onClick={() => {
                fileInputRef.current?.click();
                setAttachMenuOpen(false);
              }}
            >
              <div className="telegram-attach-icon file">📁</div>
              <span>Fayl / Hujjat</span>
            </button>

            <button
              type="button"
              className="telegram-attach-item"
              onClick={() => {
                setLocationPickerOpen(true);
                setAttachMenuOpen(false);
              }}
            >
              <div className="telegram-attach-icon location">📍</div>
              <span>Lokatsiya / Kartada Geolokatsiya</span>
            </button>

            <button
              type="button"
              className="telegram-attach-item"
              onClick={() => {
                setPollModalOpen(true);
                setAttachMenuOpen(false);
              }}
            >
              <div className="telegram-attach-icon poll">📊</div>
              <span>So'rovnoma yaratish</span>
            </button>
          </div>
        )}

        {/* Telegram-style Composer Bar: [😊 Emoji] [Xabar yozing...][📎 Fayl/Kamera] [🎤 Voice / ➤ Send] */}
        <form className="chat2-composer" onSubmit={handleSendReply}>
          {/* Separate File Inputs for Gallery vs Camera vs File */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

          {isRecordingVoice ? (
            /* Voice Recording Active Bar */
            <div className="chat2-voice-recording-bar">
              <div>
                <span className="chat2-voice-pulse" />
                <span>Ovoz yozilmoqda... {recordingSeconds}s (qo'yib yuborsangiz yuboriladi)</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={cancelVoiceRecording}
                >
                  ✕ Bekor qilish
                </button>
                <button
                  type="button"
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 12,
                    padding: "4px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={sendVoiceRecording}
                >
                  ✔ Yuborish
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Capsule: [😊 Emoji] [Xabar yozing...] [📎 Clip] */}
              <div className="chat2-input-capsule">
                <button
                  type="button"
                  className={`chat2-capsule-btn ${emojiPickerOpen ? "active" : ""}`}
                  title="Emoji va Stikerlar"
                  onClick={() => {
                    setEmojiPickerOpen(!emojiPickerOpen);
                    setAttachMenuOpen(false);
                  }}
                >
                  😊
                </button>

                <textarea
                  className="chat2-composer-input"
                  placeholder="Xabar yozing..."
                  rows={1}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />

                <button
                  type="button"
                  className={`chat2-capsule-btn ${attachMenuOpen ? "active" : ""}`}
                  title="Fayl / Galereya / Kamera / Lokatsiya / So'rovnoma"
                  onClick={() => {
                    setAttachMenuOpen(!attachMenuOpen);
                    setEmojiPickerOpen(false);
                  }}
                >
                  📎
                </button>
              </div>

              {/* Dynamic Action Button: [🎤 Voice (Hold to record, release to send) / ➤ Send] */}
              {replyText.trim().length > 0 ? (
                <button type="submit" className="chat2-action-circle-btn" title="Yuborish">
                  ➤
                </button>
              ) : (
                <button
                  type="button"
                  className="chat2-action-circle-btn"
                  title="Bosib turing: Ovoz yozish, Qo'yib yuboring: Yuborish"
                  style={{ background: "#b6536b", userSelect: "none", touchAction: "none" }}
                  onMouseDown={startVoiceRecording}
                  onMouseUp={sendVoiceRecording}
                  onTouchStart={startVoiceRecording}
                  onTouchEnd={sendVoiceRecording}
                  onMouseLeave={() => {
                    if (isRecordingVoice) sendVoiceRecording();
                  }}
                >
                  🎤
                </button>
              )}
            </>
          )}
        </form>
      </main>

      {/* Telegram Poll Creator Modal */}
      {pollModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 20,
              width: "90%",
              maxWidth: 420,
              boxShadow: "0 12px 36px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>📊 Telegram So'rovnoma yaratish</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
                onClick={() => setPollModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                So'rovnoma savoli
              </label>
              <input
                type="text"
                placeholder="Masalan: Qaysi rangdagi to'plam ko'proq yoqadi?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                1-Variant
              </label>
              <input
                type="text"
                placeholder="Variant A (Masalan: Qizil ipak)"
                value={pollOption1}
                onChange={(e) => setPollOption1(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                2-Variant
              </label>
              <input
                type="text"
                placeholder="Variant B (Masalan: Qora krujevali)"
                value={pollOption2}
                onChange={(e) => setPollOption2(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                3-Variant (Ixtiyoriy)
              </label>
              <input
                type="text"
                placeholder="Variant C"
                value={pollOption3}
                onChange={(e) => setPollOption3(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="chat2-action-btn"
                onClick={() => setPollModalOpen(false)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="chat2-action-btn primary"
                onClick={handleCreatePoll}
              >
                🚀 So'rovnomani yuborish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MIJOZ CRM SIDEBAR PANEL */}
      <aside className={`chat2-crm-panel ${mobileView !== "crm" ? "chat2-mobile-hide" : ""}`}>
        <div className="chat2-crm-head">
          <span className="chat2-crm-title">Mijoz CRM Profili</span>
          <button
            type="button"
            className="chat2-action-btn"
            onClick={() => setMobileView("chat")}
          >
            ✕ Yopish
          </button>
        </div>

        {/* Customer Info */}
        <div className="chat2-crm-section">
          <div className="chat2-crm-label">Shaxsiy ma'lumotlar</div>
          <div className="chat2-crm-card">
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {currentConversation?.userName || "Noma'lum mijoz"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>
              📞 {currentConversation?.phone || "Telefon kiritilmagan"}
            </div>
            {currentConversation?.telegramUsername && (
              <div style={{ fontSize: 13, color: "#0284c7" }}>
                ✈️ {currentConversation.telegramUsername}
              </div>
            )}
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Platforma: {currentConversation?.source?.toUpperCase() || "WEB APP"}
            </div>
          </div>
        </div>

        {/* Order History */}
        <div className="chat2-crm-section">
          <div className="chat2-crm-label">Buyurtmalar Statistikasi</div>
          <div className="chat2-crm-card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Jami buyurtmalar:</span>
              <span style={{ fontWeight: 700 }}>{currentConversation?.orderCount || 0} dona</span>
            </div>
            {currentConversation?.lastOrderNumber && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Oxirgi buyurtma:</span>
                  <span style={{ fontWeight: 700 }}>№ {currentConversation.lastOrderNumber}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Holati / Summa:</span>
                  <span style={{ fontWeight: 700, color: "#b6536b" }}>
                    {currentConversation.lastOrderStatus} (
                    {currentConversation.lastOrderTotal?.toLocaleString()} so'm)
                  </span>
                </div>
                {onViewOrderDetails && (
                  <button
                    type="button"
                    className="chat2-action-btn primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => onViewOrderDetails(currentConversation.lastOrderNumber!)}
                  >
                    📦 Buyurtmani ochish
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Operator Assignment */}
        <div className="chat2-crm-section">
          <div className="chat2-crm-label">Biriktirilgan Operator</div>
          <div className="chat2-crm-card" style={{ fontWeight: 600, color: "#334155" }}>
            {currentConversation?.assignedOperator || "Operator biriktirilmagan"}
          </div>
        </div>

        {/* Customer Notes */}
        <div className="chat2-crm-section">
          <div className="chat2-crm-label">Mijoz Izohi & Eslatma</div>
          <textarea
            className="chat2-crm-textarea"
            placeholder="Mijoz haqida izoh yoki o'lcham afzalliklarini yozing..."
            value={customerNotesText}
            onChange={(e) => setCustomerNotesText(e.target.value)}
          />
          <button
            type="button"
            className="chat2-action-btn primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={handleSaveNotes}
          >
            💾 Izohni saqlash
          </button>
        </div>
      </aside>

      {/* Edit Message Inline Modal */}
      {editingMsgId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: 20,
              width: "90%",
              maxWidth: 400,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#0f172a" }}>Xabarni tahrirlash</h3>
            <textarea
              style={{
                width: "100%",
                height: 80,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                outline: "none",
                marginBottom: 12,
              }}
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="chat2-action-btn"
                onClick={() => setEditingMsgId(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="chat2-action-btn primary"
                onClick={handleSaveEditMessage}
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      {locationPickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 20,
              width: "90%",
              maxWidth: 460,
              boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>📍 Geolokatsiya & Manzil Tanlash</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
                onClick={() => setLocationPickerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="chat2-location-btn"
                style={{ background: "#2563eb", padding: 10, fontSize: 13, marginBottom: 12 }}
                onClick={handleFetchGPSLocation}
              >
                📡 Aniq Hozirgi GPS Joylashuvimni Aniqlash
              </button>

              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                Tayyor Manzillar (Showroom & Shoxshobcha):
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                <button
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    textAlign: "left",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setLocAddress("GULI Showroom: Toshkent sh., Chilonzor 10-mavze, 45-uy. (Metro M.Ulug'bek)");
                    setLocLat(41.2825);
                    setLocLng(69.2155);
                  }}
                >
                  📍 GULI Main Showroom (Chilonzor 10)
                </button>
                <button
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    textAlign: "left",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setLocAddress("GULI Store: Tashkent City Mall, 2-qavat");
                    setLocLat(41.3111);
                    setLocLng(69.2405);
                  }}
                >
                  📍 GULI Boutique (Tashkent City Mall)
                </button>
                <button
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    textAlign: "left",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setLocAddress("GULI Samarqand: Registon ko'chasi 12-uy");
                    setLocLat(39.6547);
                    setLocLng(66.9758);
                  }}
                >
                  📍 GULI Samarqand Filiali
                </button>
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                Manzil matni:
              </label>
              <input
                type="text"
                value={locAddress}
                onChange={(e) => setLocAddress(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className="chat2-action-btn"
                onClick={() => setLocationPickerOpen(false)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="chat2-action-btn primary"
                onClick={() => handleSendLocationPicker(locLat, locLng, locAddress)}
              >
                🚀 Geolokatsiyani Yuborish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN CUSTOMER PROFILE ONLINE CHAT MODAL */}
      {fullProfileModalOpen && (
        <div className="chat2-fullscreen-overlay">
          <div className="chat2-fullscreen-modal">
            <div className="chat2-fullscreen-head">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="chat2-avatar-wrap" style={{ width: 44, height: 44 }}>
                  {currentConversation?.userPhoto ? (
                    <img className="chat2-avatar" style={{ width: 44, height: 44 }} src={currentConversation.userPhoto} alt="" />
                  ) : (
                    <div className="chat2-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
                      {(currentConversation?.userName || "M").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="chat2-online-dot" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                    {currentConversation?.userName || "Mijoz profili"}
                    <span className={`chat2-platform-badge ${currentConversation?.source || "webapp"}`}>
                      {currentConversation?.source === "telegram" ? "Telegram" : currentConversation?.source === "webapp" ? "Web App" : "Call Center"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    GULI Admin Web App - Online Chat Fullscreen Modal ● Online
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {currentConversation?.phone && (
                  <a
                    href={`tel:${currentConversation.phone.replace(/\s+/g, "")}`}
                    className="chat2-action-btn"
                    style={{ background: "#334155", color: "#fff" }}
                  >
                    📞 Tel: {currentConversation.phone}
                  </a>
                )}
                <button
                  type="button"
                  className="chat2-action-btn"
                  style={{ background: "#dc2626", color: "#ffffff" }}
                  onClick={() => setFullProfileModalOpen(false)}
                >
                  ✕ Ekrandan Chiqish
                </button>
              </div>
            </div>

            <div className="chat2-fullscreen-body">
              {/* Left Column: Full height messages */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
                <div className="chat2-messages" style={{ flex: 1, padding: 20 }}>
                  {activeChatMessages.map((msg) => (
                    <div key={msg.id} className={`chat2-bubble-wrap ${msg.sender}`}>
                      <div className="chat2-bubble">
                        <div>{msg.text}</div>
                        <div className="chat2-bubble-meta">
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Customer Details & Order stats */}
              <div style={{ width: 340, background: "#ffffff", borderLeft: "1px solid #e2e8f0", padding: 20, overflowY: "auto" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#0f172a" }}>Mijoz Ma'lumotlari</h3>
                <div className="chat2-crm-card" style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{currentConversation?.userName}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>📞 {currentConversation?.phone}</div>
                  <div style={{ fontSize: 13, color: "#0284c7", marginTop: 2 }}>✈️ {currentConversation?.telegramUsername || "Telegram biriktirilmagan"}</div>
                </div>

                <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b" }}>BUYURTMALAR HISTORIYASI</h4>
                <div className="chat2-crm-card">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>Buyurtmalar soni:</span>
                    <span style={{ fontWeight: 700 }}>{currentConversation?.orderCount || 1} ta</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>Oxirgi buyurtma:</span>
                    <span style={{ fontWeight: 700, color: "#b6536b" }}>№ {currentConversation?.lastOrderNumber || "104291"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {lightboxImageUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "grid",
            placeItems: "center",
            zIndex: 99999,
          }}
          onClick={() => setLightboxImageUrl(null)}
        >
          <img
            src={lightboxImageUrl}
            alt="Full size"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}
