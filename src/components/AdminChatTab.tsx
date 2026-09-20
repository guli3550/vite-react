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
  togglePinMessage,
  toggleBookmarkMessage,
  clearChatMessages,
} from "../utils/chatSync";
import { SwipeableChatBackground } from "./SwipeChatHelpers";
import { TelegramCircularVideoRecorderOverlay } from "./CircleVideoNote";
import { copyToClipboard } from "../utils/clipboard";
import { ChatGPTMessageRow } from "./ChatGPTMessageRow";
import {
  Search,
  Sparkles,
  Phone,
  User,
  UserCheck,
  Trash2,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Plus,
  Smile,
  Mic,
  X,
  Pin,
  ImageIcon,
  Video,
  FileText,
  MapPin,
  BarChart2,
} from "lucide-react";
import "../chat2.css";
import "../admin/components/AdminGuliChat.css";

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
  "🚚 Yetkazib berish": "Yetkazib berish muddatlari: Qo‘qon ichida 1 ish kuni, Toshkent, Andijon, Namangan, Farg‘onaga 3 ish kuni, Voha viloyatlariga 5 ish kuni. 600 000 so‘mdan oshgan orderlar uchun BEPUL yetkaziladi 🚚",
  "💳 To‘lov": "To‘lov Click, Payme, Beepul va barcha moliyaviy ilovalardan qat'i nazar faqat rasmiy Uzcard/Humo kartamizga amalga oshiriladi va chek yuklanadi. Chek 2 soat ichida admin tomonidan tasdiqlanadi 💳",
  "🌷 Qutlov": "Assalomu alaykum! GULI Lingerie brendiga xush kelibsiz. Sizga qanday yordam bera olamiz? ✨",
  "📞 Qo‘ng‘iroq": "Mutaxassisimiz siz bilan bog'lanishi uchun telefon raqamingizni qoldiring 📞",
};

const EMOJI_LIST = [
  "🌷", "✨", "🌸", "💖", "🛍️", "💳", "🚚", "⏳", "📦", "📞",
  "💯", "😊", "👍", "❤️", "🙏", "🔥", "💎", "👙", "🎁", "💬",
  "⚡", "✅", "📍", "🧾", "😍", "🎯", "⭐", "🎉",
];

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
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "unread" | "telegram" | "webapp" | "callcenter" | "orders"
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
  const [isVideoRecordingOpen, setIsVideoRecordingOpen] = useState(false);

  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(false);
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);

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

  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Handler to select conversation and immediately mark all user messages in it as read
  const handleSelectConversation = (userId: string) => {
    setSelectedUserId(userId);
    setMobileView("chat");
    markMessagesAsRead(userId, "admin");
    setAllMessages(getStoredChatMessages());
    setConversations(getAllConversations());
  };

  // Subscribe to real-time chat updates
  useEffect(() => {
    const unsubscribe = subscribeToChat((updatedMessages) => {
      setAllMessages(updatedMessages);
      if (selectedUserId && (mobileView === "chat" || typeof window !== "undefined" && window.innerWidth > 900)) {
        const hasUnreadInActive = updatedMessages.some(
          (m) => String(m.userId || "guest-user") === String(selectedUserId) && m.sender === "user" && !m.read
        );
        if (hasUnreadInActive) {
          markMessagesAsRead(selectedUserId, "admin");
        }
      }
      setConversations(getAllConversations());
    });
    return () => unsubscribe();
  }, [selectedUserId, mobileView]);

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

  // Telegram-style Category statistics breakdown
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const telegramConvs = conversations.filter((c) => c.source === "telegram");
  const webAppConvs = conversations.filter((c) => c.source === "webapp");
  const callCenterConvs = conversations.filter((c) => c.source === "callcenter");
  const ordersConvs = conversations.filter(
    (c) => (c.orderCount && c.orderCount > 0) || Boolean(c.lastOrderNumber)
  );

  const telegramUnread = telegramConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const webAppUnread = webAppConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const callCenterUnread = callCenterConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const ordersUnread = ordersConvs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.telegramUsername && c.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.lastOrderNumber && c.lastOrderNumber.includes(searchQuery));

    if (!matchesSearch) return false;

    if (filterType === "unread") return c.unreadCount > 0;
    if (filterType === "telegram") return c.source === "telegram";
    if (filterType === "webapp") return c.source === "webapp";
    if (filterType === "callcenter") return c.source === "callcenter";
    if (filterType === "orders") return (c.orderCount && c.orderCount > 0) || Boolean(c.lastOrderNumber);

    return true;
  });

  // Sort conversations: unread first, then newest timestamp first
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    return new Date(b.lastTimestamp || 0).getTime() - new Date(a.lastTimestamp || 0).getTime();
  });

  // Current active chat messages
  const rawActiveChatMessages = allMessages.filter(
    (m) =>
      (!m.userId || String(m.userId) === String(selectedUserId) || m.id === "welcome-msg-1") &&
      Boolean((m.text && m.text.trim()) || m.mediaUrl || m.pollOptions || m.location)
  );

  const activeChatMessages = rawActiveChatMessages.filter((m) => {
    if (!inChatSearchQuery.trim()) return true;
    const q = inChatSearchQuery.toLowerCase();
    return (
      m.text?.toLowerCase().includes(q) ||
      m.fileName?.toLowerCase().includes(q) ||
      m.userName?.toLowerCase().includes(q)
    );
  });

  const pinnedMessage = rawActiveChatMessages.find((m) => m.pinned);

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
    media?: {
      type?: "image" | "file" | "audio" | "video" | "video_note";
      mediaUrl?: string;
      fileName?: string;
      audioDuration?: number;
      videoDuration?: number;
    }
  ) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : replyText;
    if (!textToSend.trim() && !media) return;

    const replyToParam = replyingToMsg
      ? { id: replyingToMsg.id, text: replyingToMsg.text, sender: replyingToMsg.userName || replyingToMsg.sender }
      : undefined;

    playTelegramSendSound();
    const sentMsg = await sendAdminReply(selectedUserId, textToSend, media, replyToParam);
    if (sentMsg) {
      setStreamingMsgId(sentMsg.id);
    }

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

  const handleSendVideoNote = (base64Video: string, durationSec: number) => {
    handleSendReply(undefined, "📹 Dumaloq video", {
      type: "video_note",
      mediaUrl: base64Video,
      fileName: `video_note-${Date.now()}.webm`,
      videoDuration: durationSec,
    });
    setIsVideoRecordingOpen(false);
    showToast("Dumaloq video yuborildi ✓");
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

        {/* Telegram-style Folder Tabs */}
        <div className="chat2-folder-tabs-wrapper">
          <div className="chat2-folder-tabs">
            <button
              type="button"
              className={`chat2-folder-tab ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              <span>Barchasi</span>
              {totalUnread > 0 ? (
                <span className="chat2-tab-unread-pill highlight">{totalUnread}</span>
              ) : (
                <span className="chat2-tab-count-pill">{conversations.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`chat2-folder-tab ${filterType === "unread" ? "active" : ""}`}
              onClick={() => setFilterType("unread")}
            >
              <span>O‘qilmagan</span>
              {totalUnread > 0 && (
                <span className="chat2-tab-unread-pill highlight">{totalUnread}</span>
              )}
            </button>

            <button
              type="button"
              className={`chat2-folder-tab ${filterType === "telegram" ? "active" : ""}`}
              onClick={() => setFilterType("telegram")}
            >
              <span>✈️ Telegram</span>
              {telegramUnread > 0 ? (
                <span className="chat2-tab-unread-pill telegram">{telegramUnread}</span>
              ) : (
                <span className="chat2-tab-count-pill">{telegramConvs.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`chat2-folder-tab ${filterType === "webapp" ? "active" : ""}`}
              onClick={() => setFilterType("webapp")}
            >
              <span>🌐 Web App</span>
              {webAppUnread > 0 ? (
                <span className="chat2-tab-unread-pill webapp">{webAppUnread}</span>
              ) : (
                <span className="chat2-tab-count-pill">{webAppConvs.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`chat2-folder-tab ${filterType === "callcenter" ? "active" : ""}`}
              onClick={() => setFilterType("callcenter")}
            >
              <span>☎️ Call Center</span>
              {callCenterUnread > 0 ? (
                <span className="chat2-tab-unread-pill callcenter">{callCenterUnread}</span>
              ) : (
                <span className="chat2-tab-count-pill">{callCenterConvs.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`chat2-folder-tab ${filterType === "orders" ? "active" : ""}`}
              onClick={() => setFilterType("orders")}
            >
              <span>🛍️ Buyurtmali</span>
              {ordersUnread > 0 ? (
                <span className="chat2-tab-unread-pill orders">{ordersUnread}</span>
              ) : (
                <span className="chat2-tab-count-pill">{ordersConvs.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="chat2-conv-list">
          {sortedConversations.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📭</div>
              Suhbatlar topilmadi
            </div>
          ) : (
            sortedConversations.map((c) => {
              const isSelected = c.userId === selectedUserId;
              const isUnread = (c.unreadCount || 0) > 0;
              return (
                <button
                  type="button"
                  key={c.userId}
                  className={`chat2-conv-item ${isSelected ? "active" : ""} ${isUnread ? "unread" : "read"}`}
                  onClick={() => handleSelectConversation(c.userId)}
                >
                  <div className="chat2-avatar-wrap">
                    {c.userPhoto ? (
                      <img className="chat2-avatar" src={c.userPhoto} alt="" />
                    ) : (
                      <div className="chat2-avatar">{c.userName.slice(0, 1).toUpperCase()}</div>
                    )}
                    <span className="chat2-online-dot" />
                    {isUnread && <span className="chat2-unread-dot" />}
                  </div>
                  <div className="chat2-conv-content">
                    <div className="chat2-conv-top">
                      <div className="chat2-conv-name-wrap">
                        <span className={`chat2-conv-name ${isUnread ? "unread-name" : ""}`}>{c.userName}</span>
                        {c.orderCount && c.orderCount > 0 ? (
                          <span className="chat2-order-chip" title={`${c.orderCount} ta buyurtma`}>
                            🛍️ {c.orderCount}
                          </span>
                        ) : null}
                      </div>
                      <span className={`chat2-conv-time ${isUnread ? "unread-time" : ""}`}>
                        {c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <div className="chat2-conv-bottom">
                      <span className={`chat2-conv-snippet ${isUnread ? "unread-snippet" : ""}`}>{c.lastMessage}</span>
                      <div className="chat2-conv-badges">
                        {isUnread && (
                          <span className="chat2-unread-badge" title={`${c.unreadCount} ta yangi xabar`}>
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
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
        {!currentConversation ? (
          <div
            style={{
              flex: 1,
              height: "100%",
              minHeight: 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              textAlign: "center",
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                marginBottom: 16,
                boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
              }}
            >
              💬
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
              Mijoz suhbatini tanlang
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
              Xabarlarni o‘qish va javob yo‘llash uchun chap tarafdagi ro‘yxatdan kerakli mijoz kartochkasini bosing
            </p>
          </div>
        ) : (
          <>
            <SwipeableChatBackground
              onExit={() => {
                setMobileView("list");
                if (onOpenSidebar) onOpenSidebar();
              }}
              id="admin-chat-swipe-bg"
            >
          {/* Chat Header: 100% Guli AI / ChatGPT Header */}
          <div className="chatgpt-clean-header" style={{ padding: "10px 18px", borderBottom: "1px solid #F0F0F0" }}>
            <div className="chatgpt-header-left">
              {mobileView === "chat" && (
                <button
                  type="button"
                  className="chatgpt-header-icon-btn"
                  onClick={() => setMobileView("list")}
                  title="Orqaga"
                >
                  <ArrowLeft size={19} />
                </button>
              )}
              <div
                className="chat2-avatar-wrap"
                style={{ width: 40, height: 40, cursor: "pointer" }}
                title="Mijoz chat oynasini to'liq ekranda ochish"
                onClick={() => setFullProfileModalOpen(true)}
              >
                {currentConversation?.userPhoto ? (
                  <img className="chat2-avatar" style={{ width: 40, height: 40 }} src={currentConversation.userPhoto} alt="" />
                ) : (
                  <div className="chat2-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                    {(currentConversation?.userName || "M").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="chat2-online-dot" />
              </div>
              <div
                className="chatgpt-header-title-box"
                style={{ cursor: "pointer" }}
                onClick={() => setFullProfileModalOpen(true)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <h1 className="chatgpt-header-title" style={{ fontSize: 15, margin: 0 }}>
                    {currentConversation?.userName || "Mijoz"}
                  </h1>
                  <span className={`chat2-platform-badge ${currentConversation?.source || "webapp"}`}>
                    {currentConversation?.source === "telegram" ? "Telegram" : currentConversation?.source === "webapp" ? "Web App" : "Call Center"}
                  </span>
                </div>
                <div className="chatgpt-header-online-indicator">
                  <span className="chatgpt-indicator-dot" />
                  <span>Online · GULI Admin Web App mijoz aloqasi</span>
                </div>
              </div>
            </div>

            <div className="chatgpt-header-right" style={{ gap: 4 }}>
              <button
                type="button"
                className={`chatgpt-header-icon-btn ${inChatSearchOpen ? "active" : ""}`}
                onClick={() => {
                  setInChatSearchOpen(!inChatSearchOpen);
                  if (inChatSearchOpen) setInChatSearchQuery("");
                }}
                title="Xabarlarni qidirish"
              >
                <Search size={18} />
              </button>
              <button
                type="button"
                className="chatgpt-header-icon-btn"
                onClick={() => setAiSuggestionsOpen(true)}
                title="Admin uchun aqlli tezkor javoblar"
              >
                <Sparkles size={18} color="#BE123C" />
              </button>
              {currentConversation?.phone && (
                <a
                  href={`tel:${currentConversation.phone.replace(/\s+/g, "")}`}
                  className="chatgpt-header-icon-btn"
                  title="Qo'ng'iroq qilish"
                  style={{ display: "inline-flex", textDecoration: "none" }}
                >
                  <Phone size={18} />
                </a>
              )}
              <button
                type="button"
                className="chatgpt-header-icon-btn"
                onClick={() => setAssignOperatorOpen(!assignOperatorOpen)}
                title="Operator biriktirish"
              >
                <UserCheck size={18} />
              </button>
              <button
                type="button"
                className="chatgpt-header-icon-btn"
                onClick={() => setMobileView("crm")}
                title="Mijoz CRM kartochkasi"
              >
                <User size={18} />
              </button>
              <button
                type="button"
                className="chatgpt-header-icon-btn"
                onClick={() => setClearChatModalOpen(true)}
                title="Chat tarixini tozalash"
                style={{ color: "#E11D48" }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Inline In-Chat Search Bar */}
          {inChatSearchOpen && (
            <div className="chatgpt-inline-search" style={{ margin: "8px 18px", padding: "6px 14px", borderRadius: "10px", border: "none", outline: "none", boxShadow: "none" }}>
              <Search size={15} color="#71717A" />
              <input
                type="text"
                className="chatgpt-inline-search-input"
                placeholder="Ushbu chatdagi xabarlardan qidirish..."
                value={inChatSearchQuery}
                onChange={(e) => setInChatSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", boxShadow: "none" }}
                autoFocus
              />
              {inChatSearchQuery && (
                <span className="chat2-search-count-pill" style={{ background: "#E4E4E7", color: "#71717A", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                  {activeChatMessages.length} ta
                </span>
              )}
              <button
                type="button"
                className="chatgpt-icon-btn"
                onClick={() => {
                  setInChatSearchQuery("");
                  setInChatSearchOpen(false);
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Pinned Message Banner */}
          {pinnedMessage && (
            <div
              className="chatgpt-pinned-banner"
              style={{ margin: "6px 18px", cursor: "pointer" }}
              onClick={() => {
                const el = document.getElementById(`admin-swipe-row-${pinnedMessage.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              <div className="chatgpt-pinned-info">
                <Pin size={14} color="#BE123C" />
                <span style={{ fontWeight: 700 }}>Qadalgan xabar:</span>
                <span>{pinnedMessage.text || pinnedMessage.fileName || "Media birikma"}</span>
              </div>
              <button
                type="button"
                className="chatgpt-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePinMessage(pinnedMessage.id);
                  showToast("Qadash olib tashlandi");
                }}
                title="Qadashni bekor qilish"
              >
                <X size={14} />
              </button>
            </div>
          )}

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
          <div className="chatgpt-messages-scrollview" onScroll={handleScroll}>
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

                  <ChatGPTMessageRow
                    msg={msg}
                    isUser={msg.sender === "user"}
                    isStreaming={streamingMsgId === msg.id && idx === activeChatMessages.length - 1}
                    onStreamComplete={() => setStreamingMsgId(null)}
                    onCopy={(txt) => {
                      copyToClipboard(txt);
                      showToast("Nusxa olindi 📋");
                    }}
                    onReply={(m) => setReplyingToMsg(m)}
                    onToggleBookmark={(id) => {
                      toggleBookmarkMessage(id);
                      showToast(msg.isBookmarked ? "Xatcho'p olib tashlandi" : "Xatcho'pga saqlandi ⭐");
                    }}
                    onDelete={(id) => {
                      deleteChatMessage(id);
                      showToast("Xabar o'chirildi 🗑️");
                    }}
                    onEdit={(m) => handleStartEditMessage(m)}
                    onImageClick={(url) => setLightboxImageUrl(url)}
                    senderName={msg.sender === "admin" ? "GULI Operator (Siz)" : currentConversation?.userName || "Mijoz"}
                    senderAvatar={msg.sender === "admin" ? "/guli-logo.webp" : undefined}
                  />
                </div>
              );
            })}

            {/* Floating Jump to Bottom Button */}
            {showScrollBottom && (
              <button
                type="button"
                className="chatgpt-floating-bottom-btn"
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                title="Pastga tushish"
              >
                <ArrowDown size={18} />
              </button>
            )}

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
          <div className="chatgpt-reply-preview-dock" style={{ margin: "4px 18px" }}>
            <div className="chatgpt-reply-preview-left">
              <span className="chatgpt-reply-preview-sender">
                {replyingToMsg.userName || (replyingToMsg.sender === "admin" ? "Admin" : "Mijoz")}ga javob:
              </span>
              <span className="chatgpt-reply-preview-text">
                {replyingToMsg.text || (replyingToMsg.type === "audio" ? "Ovozli xabar" : "Fayl")}
              </span>
            </div>
            <button
              type="button"
              className="chatgpt-icon-btn"
              onClick={() => setReplyingToMsg(null)}
              title="Bekor qilish"
            >
              <X size={15} />
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
          <div className="chatgpt-attach-popover" style={{ bottom: 74, left: 24 }}>
            <button
              type="button"
              className="chatgpt-attach-item"
              onClick={() => {
                galleryInputRef.current?.click();
                setAttachMenuOpen(false);
              }}
            >
              <ImageIcon size={16} className="chatgpt-attach-icon" />
              <span>Galereya (Faqat Rasm)</span>
            </button>

            <button
              type="button"
              className="chatgpt-attach-item"
              onClick={() => {
                cameraInputRef.current?.click();
                setAttachMenuOpen(false);
              }}
            >
              <span style={{ fontSize: 16 }}>📸</span>
              <span>Kamera</span>
            </button>

            <button
              type="button"
              className="chatgpt-attach-item"
              onClick={() => {
                setIsVideoRecordingOpen(true);
                setAttachMenuOpen(false);
              }}
            >
              <Video size={16} className="chatgpt-attach-icon" />
              <span>Dumaloq video (Telegram)</span>
            </button>

            <button
              type="button"
              className="chatgpt-attach-item"
              onClick={() => {
                fileInputRef.current?.click();
                setAttachMenuOpen(false);
              }}
            >
              <FileText size={16} className="chatgpt-attach-icon" />
              <span>Fayl / Hujjat</span>
            </button>

            <button
              type="button"
              className="chatgpt-attach-item"
              onClick={() => {
                setLocationPickerOpen(true);
                setAttachMenuOpen(false);
              }}
            >
              <MapPin size={16} className="chatgpt-attach-icon" />
              <span>Lokatsiya / Kartada Geolokatsiya</span>
            </button>

            <button
              type="button"
              className="chatgpt-attach-item"
              onClick={() => {
                setPollModalOpen(true);
                setAttachMenuOpen(false);
              }}
            >
              <BarChart2 size={16} className="chatgpt-attach-icon" />
              <span>So'rovnoma yaratish</span>
            </button>
          </div>
        )}

        {/* Telegram-style Composer Bar: 100% Guli AI / ChatGPT Input Capsule */}
        <form className="chatgpt-input-dock-container" style={{ padding: "8px 18px 14px" }} onSubmit={handleSendReply}>
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

          <div className="chatgpt-input-capsule">
            {isRecordingVoice ? (
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
                  0:{recordingSeconds < 10 ? "0" : ""}{recordingSeconds}
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
                  onClick={sendVoiceRecording}
                  title="Yuborish"
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="chatgpt-dock-btn"
                  title="Fayl yoki media biriktirish"
                  onClick={() => {
                    setAttachMenuOpen(!attachMenuOpen);
                    setEmojiPickerOpen(false);
                  }}
                >
                  <Plus size={19} />
                </button>

                <button
                  type="button"
                  className={`chatgpt-dock-btn ${emojiPickerOpen ? "active" : ""}`}
                  title="Emoji va Stikerlar"
                  onClick={() => {
                    setEmojiPickerOpen(!emojiPickerOpen);
                    setAttachMenuOpen(false);
                  }}
                >
                  <Smile size={19} />
                </button>

                <textarea
                  className="chatgpt-dock-textarea"
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

                {replyText.trim().length > 0 ? (
                  <button
                    type="submit"
                    className="chatgpt-send-btn active"
                    title="Yuborish"
                  >
                    <ArrowUp size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="chatgpt-dock-btn mic-btn"
                    title="Bosib turing: Ovoz yozish, Qo'yib yuboring: Yuborish"
                    style={{ color: "#BE123C", touchAction: "none" }}
                    onMouseDown={startVoiceRecording}
                    onMouseUp={sendVoiceRecording}
                    onTouchStart={startVoiceRecording}
                    onTouchEnd={sendVoiceRecording}
                    onMouseLeave={() => {
                      if (isRecordingVoice) sendVoiceRecording();
                    }}
                  >
                    <Mic size={19} />
                  </button>
                )}
              </>
            )}
          </div>
        </form>
        </>
      )}
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

        {!currentConversation ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            Suhbat tanlanganda bu yerda mijoz CRM ma'lumotlari ko'rsatiladi
          </div>
        ) : (
          <>
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
        </>
      )}
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

      {/* Admin AI / Smart Suggestions Modal */}
      {aiSuggestionsOpen && (
        <div
          className="chat2-modal-overlay"
          onClick={() => setAiSuggestionsOpen(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="chat2-modal-card"
            style={{ maxWidth: 520, width: "92%", borderRadius: 20, padding: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>💡</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                    Admin uchun Aqlli Tezkor Javoblar
                  </h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Bir marta bosish orqali xabar matniga joylang yoki to'g'ridan-to'g'ri yuboring
                  </span>
                </div>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}
                onClick={() => setAiSuggestionsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
              {[
                {
                  title: "📦 Buyurtma tasdiqlandi",
                  badge: "Buyurtma",
                  text: "Assalomu alaykum! Buyurtmangiz muvaffaqiyatli qabul qilindi va tayyorlanmoqda. Kuryer yetkazishga chiqqanda SMS orqali xabar beramiz. GULI bilan ekanligingizdan mamnunmiz! 🌷",
                },
                {
                  title: "🚚 Yetkazib berish shartlari",
                  badge: "Logistika",
                  text: "Yetkazib berish Toshkent bo'yicha 24 soat ichida (30 000 so'm, 600 000 so'mdan yuqoriga bepul!), viloyatlarga BTS pochta orqali 2-3 ish kunida yetkaziladi. Kuryer yetkazishdan oldin qo'ng'iroq qiladi 🛵",
                },
                {
                  title: "💳 To'lov rekvizitlari",
                  badge: "Moliya",
                  text: "To'lovni Payme yoki Click orqali amalga oshirishingiz mumkin. Karta raqami: 8600 1234 5678 9012 (GULI Lingerie - Shoira M.). To'lov qilgach chek skrinshotini shu yerga yuborishingizni so'raymiz 💳",
                },
                {
                  title: "📏 O'lcham tanlash bo'yicha maslahat",
                  badge: "Konsultatsiya",
                  text: "Sizga ideal o'lchamni tanlashda yordam berishimiz uchun: ko'krak aylanasi va ko'krak osti aylanasi santimetrini aytsangiz kifoya. Mutaxassisimiz darhol eng mos model va o'lchamni tanlab beradi ✨",
                },
                {
                  title: "🔄 Almashtirish va qaytarish qoidalari",
                  badge: "Kafolat",
                  text: "Mahsulot o'lchami to'g'ri kelmasa, 3 kun ichida tovar ko'rinishi va yorliqlari saqlangan holda bepul almashtirib berish imkoniyati mavjud (gigiyenik talablar asosida). Biz mijozlarimiz mamnuniyatini birinchi o'ringa qo'yamiz 🌸",
                },
                {
                  title: "🎁 Maxsus 10% chegirma promo-kodi",
                  badge: "Chegirma",
                  text: "Siz bizning qadrli mijozimizsiz! Xaridingiz uchun maxsus 10% chegirma taqdim etamiz. Promo-kod: GULI10. Savatchada ushbu kodni kiritishingiz mumkin! 🎉",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 12,
                    background: "#f8fafc",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{item.title}</span>
                    <span
                      style={{
                        fontSize: 11,
                        background: "rgba(182, 83, 107, 0.1)",
                        color: "#b6536b",
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                    {item.text}
                  </p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="chat2-action-btn"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => {
                        setReplyText(item.text);
                        setAiSuggestionsOpen(false);
                        showToast("Matn kiritish maydoniga joylandi");
                      }}
                    >
                      ✏️ Matnga qo'yish
                    </button>
                    <button
                      type="button"
                      className="chat2-action-btn primary"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => {
                        handleSendReply(undefined, item.text);
                        setAiSuggestionsOpen(false);
                      }}
                    >
                      ➤ Yuborish
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat History Modal */}
      {clearChatModalOpen && (
        <div
          className="chat2-modal-overlay"
          onClick={() => setClearChatModalOpen(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="chat2-modal-card"
            style={{ maxWidth: 380, width: "90%", borderRadius: 18, padding: 22, textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🧹</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Chat tarixini tozalash
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Ushbu mijoz ({currentConversation?.userName || "Mijoz"}) bilan bo'lgan barcha xabarlar o'chirib tashlanadi. Rozimisiz?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                className="chat2-action-btn"
                onClick={() => setClearChatModalOpen(false)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="chat2-action-btn primary"
                style={{ background: "#e11d48", borderColor: "#e11d48" }}
                onClick={() => {
                  clearChatMessages(selectedUserId);
                  setClearChatModalOpen(false);
                  showToast("Chat tarixi tozalandi");
                }}
              >
                Ha, tozalash
              </button>
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

      {/* Fullscreen Telegram Circular Video Note Recorder Overlay */}
      {isVideoRecordingOpen && (
        <TelegramCircularVideoRecorderOverlay
          onCancel={() => setIsVideoRecordingOpen(false)}
          onSend={handleSendVideoNote}
          onShowToast={showToast}
        />
      )}
    </div>
  );
}
