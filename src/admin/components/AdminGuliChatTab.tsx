import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  ArrowDown,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Share2,
  ChevronRight,
  Plus,
  Mic,
  ArrowUp,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  X,
  FileText,
  TrendingUp,
  Package,
  History,
  MessageSquare,
  RotateCcw,
  Edit3,
  Search,
  Bookmark,
} from "lucide-react";
import "./AdminGuliChat.css";
import { copyToClipboard } from "../../utils/clipboard";

export type AdminGuliChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  audioUrl?: string;
  audioDuration?: string;
  imageUrl?: string;
  imageName?: string;
  feedback?: "like" | "dislike" | null;
  processingTime?: string;
  sources?: { name: string; icon?: string }[];
  model?: string;
  fallback?: boolean;
  fallbackFrom?: string;
  requestId?: string;
};

export const AVAILABLE_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tag: "Asosiy / Tavsiya etiladi",
    tier: "Free Tier",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    tag: "Tezkor / Yengil",
    tier: "Free Tier",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tag: "Zaxira / Fallback",
    tier: "Free Tier",
  },
];


export type AdminChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AdminGuliChatMessage[];
};

type AdminGuliChatTabProps = {
  orders?: any[];
  products?: any[];
  dashboardData?: any;
  promos?: any[];
  users?: any[];
  token?: string;
};

// Initial welcome suggestions
const DEFAULT_SUGGESTIONS = [
  {
    icon: TrendingUp,
    title: "Savdo va tushum tahlili",
    desc: "Bugungi buyurtmalar, kutilayotganlar va sof tushum",
    prompt: "Guli do'konidagi buyurtmalar, to'lovlar va umumiy savdo holati bo'yicha qisqacha hisobot ber.",
  },
  {
    icon: Sparkles,
    title: "Nafis mahsulot tavsifi",
    desc: "Yangi ipak xalat to'plami uchun jozibali post",
    prompt: "GULI Premium yangi ipak xalat (Silk Robe) to'plami uchun Instagram va Telegram post matnini yozib ber.",
  },
  {
    icon: Package,
    title: "Ombor va qoldiqlar nazorati",
    desc: "Qaysi mahsulotlar tugash arafasida va zaxira kerak?",
    prompt: "Omborda qaysi mahsulotlar kam qolgan yoki tugash arafasida? Qaysi o'lchamlarni buyurtma qilish kerak?",
  },
  {
    icon: FileText,
    title: "Dam olish kunlari aksiyasi",
    desc: "Mijozlarni xursand qiluvchi 15% chegirma rejasi",
    prompt: "Dam olish kunlari mijozlarni faollashtirish uchun 15% lik promo aksiya va SMS xabarnoma shablonini tuzib ber.",
  },
];

export default function AdminGuliChatTab({
  token,
}: AdminGuliChatTabProps) {
  // Sessions state (ChatGPT & Gemini Style history)
  const [sessions, setSessions] = useState<AdminChatSession[]>(() => {
    try {
      const saved = localStorage.getItem("guli_admin_chat_sessions_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    const now = Date.now();
    return [
      {
        id: "session-active",
        title: "Yangi suhbat",
        createdAt: now,
        updatedAt: now,
        messages: [],
      },
      {
        id: "session-seed-1",
        title: "Bugungi buyurtmalar va tushum tahlili",
        createdAt: now - 3600 * 1000 * 3,
        updatedAt: now - 3600 * 1000 * 3,
        messages: [
          {
            id: "seed-msg-1",
            sender: "user",
            text: "Guli do'konidagi buyurtmalar, to'lovlar va umumiy savdo holati bo'yicha qisqacha hisobot ber.",
            timestamp: "10:30",
          },
          {
            id: "seed-msg-2",
            sender: "ai",
            text: "📊 **GULI Do'koni Savdo Ko'rsatkichlari:**\n\n- **Jami buyurtmalar:** 14 ta\n- **Kutilayotgan:** 3 ta\n- **Yetkazilgan:** 11 ta\n- **Umumiy savdo tushumi:** 4 850 000 so'm\n\n💡 Barcha jarayonlar barqaror sur'atda davom etmoqda.",
            timestamp: "10:30",
            processingTime: "Обработка заняла 1s",
          },
        ],
      },
      {
        id: "session-seed-2",
        title: "Ipak xalat kolleksiyasi reklama posti",
        createdAt: now - 86400 * 1000 * 1,
        updatedAt: now - 86400 * 1000 * 1,
        messages: [
          {
            id: "seed-msg-3",
            sender: "user",
            text: "GULI Premium yangi ipak xalat to'plami uchun Instagram va Telegram post matnini yozib ber.",
            timestamp: "Kecha 16:45",
          },
          {
            id: "seed-msg-4",
            sender: "ai",
            text: "✨ **GULI Premium uchun tayyor Telegram / Instagram posti:**\n\n*Har bir ayol o‘zini betakror his qilishga loyiq.*\n\nNafis ipak va yumshoq paxtadan ishlangan yangi to‘plam — sizning ichki ishonchingiz va qulayligingiz ramzidir.",
            timestamp: "Kecha 16:45",
            processingTime: "Обработка заняla 2s",
          },
        ],
      },
    ];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem("guli_admin_active_session_id") || "session-active";
  });

  const [messages, setMessages] = useState<AdminGuliChatMessage[]>(() => {
    try {
      const activeId = localStorage.getItem("guli_admin_active_session_id") || "session-active";
      const savedSessions = localStorage.getItem("guli_admin_chat_sessions_v2");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        const cur = parsed.find((s: AdminChatSession) => s.id === activeId);
        if (cur && Array.isArray(cur.messages)) return cur.messages;
      }
      const saved = localStorage.getItem("guli_admin_chat_gpt_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: AdminGuliChatMessage) => {
          if (m.audioUrl && m.text === "🎤 Ovozli xabar") {
            return { ...m, text: "" };
          }
          return m;
        });
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // Chat History Drawer state
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  // Message 3-dots actions popup state
  const [activeMsgMenuId, setActiveMsgMenuId] = useState<string | null>(null);

  // Attachment and Popover states
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Gemini AI Model state (Free Tier models)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("guli_admin_ai_model") || "gemini-3.8-flash";
  });

  // Audio Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  // Audio Playback state (User audio)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Text to speech state (AI voice read aloud)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Scroll container and textarea refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Show temporary toast
  const triggerToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => {
      setActiveToast(null);
    }, 2200);
  };

  // Sync active session when messages change
  useEffect(() => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSessionId) {
          let updatedTitle = s.title;
          if ((s.title === "Yangi suhbat" || !s.title) && messages.length > 0) {
            const firstUserMsg = messages.find((m) => m.sender === "user" && m.text);
            if (firstUserMsg) {
              updatedTitle = firstUserMsg.text.slice(0, 34) + (firstUserMsg.text.length > 34 ? "..." : "");
            }
          }
          return {
            ...s,
            title: updatedTitle,
            updatedAt: Date.now(),
            messages,
          };
        }
        return s;
      })
    );
  }, [messages, currentSessionId]);

  // Save messages & sessions to local storage
  useEffect(() => {
    try {
      localStorage.setItem("guli_admin_chat_gpt_messages", JSON.stringify(messages));
      localStorage.setItem("guli_admin_chat_sessions_v2", JSON.stringify(sessions));
      localStorage.setItem("guli_admin_active_session_id", currentSessionId);
    } catch (e) {
      console.error(e);
    }
  }, [messages, sessions, currentSessionId]);

  // Click outside to close menus and message actions popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target as Node)
      ) {
        setIsAttachMenuOpen(false);
      }
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(e.target as Node)
      ) {
        setIsOptionsMenuOpen(false);
      }
      // Close active message menu if clicked outside
      const target = e.target as HTMLElement;
      if (!target.closest(".chatgpt-msg-more-wrap")) {
        setActiveMsgMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Track scroll position to show / hide floating jump-to-bottom arrow button
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 120;
    setShowScrollBottom(isScrolledUp);
  };

  // Auto-scroll to bottom smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Process image file
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerToast("Iltimos, faqat rasm faylini tanlang (PNG, JPG, WEBP).");
      return;
    }

    const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
    if (file.size > MAX_IMAGE_BYTES) {
      triggerToast("Rasm hajmi 8 MB dan oshmasligi kerak. Iltimos, kichikroq rasm tanlang.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setSelectedImage({
          url: event.target.result,
          name: file.name,
        });
        setIsAttachMenuOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Image File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = "";
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file);
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Brauzeringizda mikrofondan foydalanish qo'llab-quvvatlanmaydi.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        const durationStr = `0:${recordSeconds < 10 ? "0" : ""}${recordSeconds}`;

        // Only send the voice note with raw audioBlob for transcription & multimodal analysis
        sendUserMessage({
          text: "",
          audioUrl,
          audioDuration: durationStr,
          audioBlob,
        });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Mikrofon xatosi:", err);
      alert("Mikrofondan foydalanishga ruxsat berilmadi yoki xatolik yuz berdi.");
    }
  };

  // Stop Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    audioChunksRef.current = [];
    setRecordSeconds(0);
  };

  // Audio Playback handler (User voice)
  const togglePlayAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play().catch(console.error);
      setPlayingAudioId(id);
    }
  };

  // Text-To-Speech handler for AI reply
  const toggleSpeakAI = (id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Brauzeringizda ovozli o'qish imkoniyati mavjud emas.");
      return;
    }

    if (speakingMessageId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#`_>-]/g, "").trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(id);
    }
  };

  // Copy AI response with animation
  const copyText = async (id: string, text: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    triggerToast("Matndan nusxa olindi");
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Toggle feedback (like / dislike)
  const toggleFeedback = (id: string, type: "like" | "dislike") => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === id) {
          const next = msg.feedback === type ? null : type;
          return { ...msg, feedback: next };
        }
        return msg;
      })
    );
    triggerToast(type === "like" ? "Fikr bildirganingiz uchun rahmat!" : "Fikr qabul qilindi");
  };

  // Share message
  const handleShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Guli AI Javobi",
          text: text,
        });
      } catch {
        await copyToClipboard(text);
        triggerToast("Xabar nusxalandi");
      }
    } else {
      await copyToClipboard(text);
      triggerToast("Xabar nusxalandi");
    }
  };

  // Helper for Admin Token
  const getAdminToken = (): string => {
    return (
      token ||
      sessionStorage.getItem("guli_admin_token") ||
      localStorage.getItem("guli_admin_token") ||
      ""
    );
  };

  // Real Gemini AI Chat API caller
  const callAdminAiChatApi = async (params: {
    message: string;
    history: { sender: string; text: string }[];
    model: string;
    image?: { data: string; mimeType: string } | null;
    audio?: { data: string; mimeType: string } | null;
  }): Promise<{
    success: boolean;
    message: string;
    model?: string;
    fallback?: boolean;
    fallbackFrom?: string;
    requestId?: string;
    sources?: { name: string; icon?: string }[];
  }> => {
    const customBase = (sessionStorage.getItem("guli_custom_api_url") || "").replace(/\/$/, "");
    const endpoint = customBase ? `${customBase}/api/admin/ai/chat` : "/api/admin/ai/chat";
    const currentToken = getAdminToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (currentToken) {
      headers["Authorization"] = `Bearer ${currentToken}`;
    }

    const payload = {
      sessionId: currentSessionId,
      message: params.message,
      history: params.history,
      model: params.model,
      image: params.image,
      audio: params.audio,
    };

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      // If custom remote endpoint failed with 404/502, try relative dev/local endpoint
      if (!res.ok && customBase && (res.status === 404 || res.status >= 500)) {
        res = await fetch("/api/admin/ai/chat", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      }
    } catch (netErr) {
      if (customBase) {
        res = await fetch("/api/admin/ai/chat", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        throw netErr;
      }
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Server xatosi (${res.status})`);
    }
    return data;
  };

  // Audio transcription API caller
  const callAdminAiTranscribeApi = async (params: {
    audioBase64: string;
    mimeType: string;
  }): Promise<string> => {
    const customBase = (sessionStorage.getItem("guli_custom_api_url") || "").replace(/\/$/, "");
    const endpoint = customBase ? `${customBase}/api/admin/ai/transcribe` : "/api/admin/ai/transcribe";
    const currentToken = getAdminToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (currentToken) {
      headers["Authorization"] = `Bearer ${currentToken}`;
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      if (!res.ok && customBase && (res.status === 404 || res.status >= 500)) {
        res = await fetch("/api/admin/ai/transcribe", {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });
      }
    } catch (netErr) {
      if (customBase) {
        res = await fetch("/api/admin/ai/transcribe", {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });
      } else {
        throw netErr;
      }
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Ovozni matnga aylantirishda xatolik");
    }
    return data.text || "";
  };

  // Send message handler (Integrated with Gemini AI)
  const sendUserMessage = async (options: {
    text?: string;
    audioUrl?: string;
    audioDuration?: string;
    audioBlob?: Blob;
    image?: { url: string; name: string } | null;
  }) => {
    const textToSend = options.text !== undefined ? options.text : inputText.trim();
    const imageToSend = options.image !== undefined ? options.image : selectedImage;
    const isVoice = !!options.audioUrl;

    if (!textToSend && !imageToSend && !isVoice) return;

    const startTime = Date.now();
    let effectiveUserText = textToSend;
    let audioPayload: { data: string; mimeType: string } | null = null;

    // Handle voice note and transcription
    if (isVoice && options.audioBlob) {
      try {
        const base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            const commaIdx = res.indexOf(",");
            resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(options.audioBlob!);
        });

        audioPayload = {
          data: base64Audio,
          mimeType: options.audioBlob.type || "audio/webm",
        };

        // Attempt speech-to-text transcription with Gemini
        try {
          const transcribed = await callAdminAiTranscribeApi({
            audioBase64: base64Audio,
            mimeType: options.audioBlob.type || "audio/webm",
          });
          if (transcribed && transcribed.trim()) {
            effectiveUserText = transcribed.trim();
          }
        } catch (trErr) {
          console.warn("Transcription note:", trErr);
        }
      } catch (voiceErr) {
        console.error("Audio encoding error:", voiceErr);
      }
    }

    // Handle image payload
    let imagePayload: { data: string; mimeType: string } | null = null;
    if (imageToSend?.url) {
      const commaIdx = imageToSend.url.indexOf(",");
      const rawBase64 = commaIdx >= 0 ? imageToSend.url.slice(commaIdx + 1) : imageToSend.url;
      const mimeMatch = imageToSend.url.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
      imagePayload = {
        data: rawBase64,
        mimeType: mimeMatch ? mimeMatch[1] : "image/jpeg",
      };
    }

    const userMessage: AdminGuliChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: effectiveUserText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      audioUrl: options.audioUrl,
      audioDuration: options.audioDuration,
      imageUrl: imageToSend?.url,
      imageName: imageToSend?.name,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setSelectedImage(null);
    setIsAttachMenuOpen(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Show thinking indicator
    setIsThinking(true);

    try {
      const historyPayload = messages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const aiData = await callAdminAiChatApi({
        message: effectiveUserText,
        history: historyPayload,
        model: selectedModel,
        image: imagePayload,
        audio: audioPayload,
      });

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      if (aiData.fallback) {
        triggerToast(`ℹ️ Limit sababli avtomatik ${aiData.model} modeliga o'tildi.`);
      }

      const aiMessage: AdminGuliChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiData.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingTime: `Tahlil: ${elapsedSeconds}s`,
        sources: aiData.sources || [{ name: "GULI Gemini AI" }],
        model: aiData.model || selectedModel,
        fallback: aiData.fallback,
        fallbackFrom: aiData.fallbackFrom,
        requestId: aiData.requestId,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      const errText = err?.message || "Aloqa uzildi";
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      const errorAiMsg: AdminGuliChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: `⚠️ **GULI AI xabari:**\n\n${errText}\n\n*Iltimos, qaytadan urinib ko‘ring yoki boshqa savol bering.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingTime: `${elapsedSeconds}s`,
        sources: [{ name: "Xatolik" }],
        model: selectedModel,
      };

      setMessages((prev) => [...prev, errorAiMsg]);
      triggerToast("GULI AI xatolik berdi ⚠️");
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage({});
    }
  };

  // Session & History Management (ChatGPT & Gemini Style)
  const handleStartNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: AdminChatSession = {
      id: newId,
      title: "Yangi suhbat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setMessages([]);
    setInputText("");
    setSelectedImage(null);
    setIsOptionsMenuOpen(false);
    setIsHistoryDrawerOpen(false);
    triggerToast("Yangi suhbat boshlandi ✨");
  };

  const handleSelectSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setCurrentSessionId(target.id);
      setMessages(target.messages || []);
      setIsHistoryDrawerOpen(false);
      setIsOptionsMenuOpen(false);
      triggerToast(`"${target.title}" suhbati ochildi`);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Ushbu suhbatni tarixdan o'chirmoqchimisiz?")) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (currentSessionId === sessionId) {
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
          setMessages(remaining[0].messages || []);
        } else {
          handleStartNewChat();
        }
      }
      triggerToast("Suhbat tarixdan o'chirildi");
    }
  };

  const saveRenameSession = (sessionId: string) => {
    if (!editingTitleText.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitleText.trim() } : s))
    );
    setEditingSessionId(null);
    triggerToast("Suhbat nomi yangilandi");
  };

  const handleClearAllHistory = () => {
    if (confirm("Barcha suhbatlar tarixini tozalashni tasdiqlaysizmi?")) {
      const freshId = `session-${Date.now()}`;
      const freshSession: AdminChatSession = {
        id: freshId,
        title: "Yangi suhbat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setSessions([freshSession]);
      setCurrentSessionId(freshId);
      setMessages([]);
      setIsHistoryDrawerOpen(false);
      triggerToast("Barcha suhbatlar tarixi tozalandi");
    }
  };

  const clearChatHistory = () => {
    if (confirm("Joriy suhbatni tozalashni xohlaysizmi?")) {
      setMessages([]);
      setIsOptionsMenuOpen(false);
      triggerToast("Joriy suhbat tozalandi");
    }
  };

  const formatSessionTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const date = new Date(timestamp);
    if (diff < 86400 * 1000 && date.getDate() === new Date().getDate()) {
      return `Bugun, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diff < 86400 * 1000 * 2) {
      return `Kecha, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const filteredSessions = useMemo(() => {
    if (!historySearchQuery.trim()) return sessions;
    const q = historySearchQuery.toLowerCase();
    return sessions.filter((s) => {
      const titleMatch = s.title.toLowerCase().includes(q);
      const textMatch = s.messages?.some((m) => m.text?.toLowerCase().includes(q));
      return titleMatch || textMatch;
    });
  }, [sessions, historySearchQuery]);

  // Message 3-Dots Small but Useful Action Handlers
  const handleRegenerate = async (msgId: string) => {
    setActiveMsgMenuId(null);
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;
    const prevUserMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.sender === "user");

    const promptText = prevUserMsg?.text || "Guli do'koni uchun yangilangan tavsiya ber.";
    setIsThinking(true);
    triggerToast("Yangi variant tayyorlanmoqda...");
    const startTime = Date.now();

    try {
      const historyPayload = messages.slice(0, msgIndex).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const aiData = await callAdminAiChatApi({
        message: promptText + " (yangi muqobil variant ber)",
        history: historyPayload,
        model: selectedModel,
      });

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      if (aiData.fallback) {
        triggerToast(`ℹ️ Limit sababli avtomatik ${aiData.model} modeliga o'tildi.`);
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            return {
              ...m,
              text: aiData.message,
              processingTime: `Tahlil: ${elapsedSeconds}s`,
              sources: aiData.sources || [{ name: "GULI Gemini AI" }],
              model: aiData.model || selectedModel,
              fallback: aiData.fallback,
              fallbackFrom: aiData.fallbackFrom,
              requestId: aiData.requestId,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
          }
          return m;
        })
      );
      triggerToast("Javob yangilandi ✓");
    } catch (err: any) {
      triggerToast(`Xatolik: ${err?.message || "Yangilab bo'lmadi"}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSummarizeMessage = async (msg: AdminGuliChatMessage) => {
    setActiveMsgMenuId(null);
    setIsThinking(true);
    triggerToast("Qisqa xulosa tayyorlanmoqda...");
    const startTime = Date.now();

    try {
      const aiData = await callAdminAiChatApi({
        message: `Ushbu ma'lumotni do'kon boshqaruvi uchun 3 ta asosiy punktda qisqa va tushunarli qilib umumlashtirib ber:\n\n${msg.text}`,
        history: [],
        model: selectedModel,
      });

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      const summaryAiMsg: AdminGuliChatMessage = {
        id: `ai-summary-${Date.now()}`,
        sender: "ai",
        text: aiData.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingTime: `Xulosa: ${elapsedSeconds}s`,
        sources: [{ name: "GULI AI Xulosa" }],
        model: aiData.model || selectedModel,
        fallback: aiData.fallback,
      };
      setMessages((prev) => [...prev, summaryAiMsg]);
    } catch (err: any) {
      triggerToast(`Xatolik: ${err?.message || "Xulosa tayyorlab bo'lmadi"}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleExpandMessage = async (msg: AdminGuliChatMessage) => {
    setActiveMsgMenuId(null);
    setIsThinking(true);
    triggerToast("Batafsil ma'lumot tayyorlanmoqda...");
    const startTime = Date.now();

    try {
      const aiData = await callAdminAiChatApi({
        message: `Ushbu mavzuni do'kon administratori uchun amaliy qadamlar va professional tavsiyalar bilan batafsilroq yoritib ber:\n\n${msg.text}`,
        history: [],
        model: selectedModel,
      });

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      const expandedAiMsg: AdminGuliChatMessage = {
        id: `ai-expand-${Date.now()}`,
        sender: "ai",
        text: aiData.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingTime: `Batafsil: ${elapsedSeconds}s`,
        sources: [{ name: "Kengaytirilgan Tahlil" }],
        model: aiData.model || selectedModel,
        fallback: aiData.fallback,
      };
      setMessages((prev) => [...prev, expandedAiMsg]);
    } catch (err: any) {
      triggerToast(`Xatolik: ${err?.message || "Kengaytirib bo'lmadi"}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleConvertToTelegram = async (msg: AdminGuliChatMessage) => {
    setActiveMsgMenuId(null);
    setIsThinking(true);
    triggerToast("Telegram post formatiga o'tkazilmoqda...");
    const startTime = Date.now();

    try {
      const aiData = await callAdminAiChatApi({
        message: `Ushbu matn asosida GULI Lingerie (@guli_premium_bot) rasmiy Telegram kanali uchun jozibali, professional va emojilar bilan bezatilgan post matnini yozib ber:\n\n${msg.text}`,
        history: [],
        model: selectedModel,
      });

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      const tgMsg: AdminGuliChatMessage = {
        id: `ai-tg-${Date.now()}`,
        sender: "ai",
        text: aiData.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        processingTime: `Post: ${elapsedSeconds}s`,
        sources: [{ name: "Telegram Bot Post" }],
        model: aiData.model || selectedModel,
        fallback: aiData.fallback,
      };
      setMessages((prev) => [...prev, tgMsg]);
    } catch (err: any) {
      triggerToast(`Xatolik: ${err?.message || "Post yaratib bo'lmadi"}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleBookmarkMessage = (msg: AdminGuliChatMessage) => {
    setActiveMsgMenuId(null);
    try {
      const saved = localStorage.getItem("guli_saved_notes") || "[]";
      const parsed = JSON.parse(saved);
      parsed.unshift({
        id: msg.id,
        text: msg.text,
        savedAt: new Date().toLocaleString(),
      });
      localStorage.setItem("guli_saved_notes", JSON.stringify(parsed.slice(0, 50)));
      triggerToast("Xabar eslatmalarga saqlandi ⭐");
    } catch {
      triggerToast("Xabar saqlandi");
    }
  };

  const handleDeleteSingleMessage = (msgId: string) => {
    setActiveMsgMenuId(null);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    triggerToast("Xabar o'chirildi");
  };

  // Custom Formatter for AI text (ChatGPT / Gemini style)
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Check for bullet lists
      const isBullet = line.trim().startsWith("●") || line.trim().startsWith("•") || line.trim().startsWith("- ") || line.trim().startsWith("* ");
      const cleanLine = isBullet ? line.trim().replace(/^[●•\-*]\s*/, "") : line;

      // Inline code token replacement
      const parseInlineTokens = (str: string) => {
        const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return parts.map((part, pIdx) => {
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code key={pIdx} className="chatgpt-inline-code">
                {part.slice(1, -1)}
              </code>
            );
          }
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="chatgpt-strong">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*")) {
            return <em key={pIdx}>{part.slice(1, -1)}</em>;
          }
          return part;
        });
      };

      if (isBullet) {
        return (
          <div key={idx} className="chatgpt-bullet-item">
            <span className="chatgpt-bullet-dot">●</span>
            <span className="chatgpt-bullet-text">{parseInlineTokens(cleanLine)}</span>
          </div>
        );
      }

      if (line.trim().startsWith(">")) {
        return (
          <blockquote key={idx} className="chatgpt-quote">
            {parseInlineTokens(line.replace(/^>\s*/, ""))}
          </blockquote>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="chatgpt-spacer" />;
      }

      return (
        <p key={idx} className="chatgpt-paragraph">
          {parseInlineTokens(line)}
        </p>
      );
    });
  };

  return (
    <div
      className={`guli-chat-fullscreen-wrapper ${isFullscreen ? "is-fullscreen" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toast Notification */}
      {activeToast && <div className="guli-floating-toast">{activeToast}</div>}

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="guli-chat-drop-overlay">
          <div className="guli-chat-drop-icon">
            <ImageIcon size={30} />
          </div>
          <h3>Rasmni shu yerga tashlang</h3>
          <p>Guli AI mahsulot tasvirini darhol tahlil qiladi</p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: "none" }}
      />

      {/* ==========================================================================
          HEADER: Exactly matching ChatGPT screenshot style with Guli brand logo
          [←] Logo + Title: Guli web app audit bo'limi  [🕒] [⋮]
          ========================================================================== */}
      <header className="chatgpt-clean-header">
        <div className="chatgpt-header-left">
          <button
            type="button"
            className="chatgpt-header-icon-btn"
            onClick={() => {
              if (isFullscreen) setIsFullscreen(false);
            }}
            title="Ortga"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="chatgpt-header-brand-logo">
            <img src="/guli-logo-compact.svg" alt="Guli Logo" />
          </div>
          <div className="chatgpt-header-title-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 className="chatgpt-header-title" style={{ margin: 0 }}>GULI AI</h2>
              <div className="chatgpt-model-selector-wrapper">
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedModel(val);
                    localStorage.setItem("guli_admin_ai_model", val);
                    triggerToast(`Model tanlandi: ${val}`);
                  }}
                  className="chatgpt-model-select"
                  title="Gemini AI modelini tanlang (Free Tier)"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.tag})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="chatgpt-header-online-indicator">
              <span className="chatgpt-indicator-dot" />
              <span>Gemini Free Tier • Faol</span>
            </div>
          </div>
        </div>

        <div className="chatgpt-header-right" ref={optionsMenuRef}>
          {/* Direct Chat History Button (ChatGPT & Gemini style) */}
          <button
            type="button"
            className={`chatgpt-header-icon-btn ${isHistoryDrawerOpen ? "active" : ""}`}
            onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            title="Suhbatlar tarixi (ChatGPT / Gemini)"
          >
            <History size={19} />
          </button>

          {/* 3-dots Menu Button */}
          <button
            type="button"
            className="chatgpt-header-icon-btn"
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            title="Qo'shimcha sozlamalar"
          >
            <MoreVertical size={20} />
          </button>

          {/* More Menu Dropdown */}
          {isOptionsMenuOpen && (
            <div className="chatgpt-dropdown-menu">
              <button
                type="button"
                onClick={() => {
                  setIsHistoryDrawerOpen(true);
                  setIsOptionsMenuOpen(false);
                }}
                className="chatgpt-menu-item"
              >
                <History size={16} />
                <span>Chat tarixi</span>
              </button>
              <button type="button" onClick={handleStartNewChat} className="chatgpt-menu-item">
                <Plus size={16} />
                <span>Yangi suhbat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFullscreen(!isFullscreen);
                  setIsOptionsMenuOpen(false);
                }}
                className="chatgpt-menu-item"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{isFullscreen ? "Oynaga qaytish" : "To'liq ekran"}</span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChatHistory}
                  className="chatgpt-menu-item danger"
                >
                  <Trash2 size={16} />
                  <span>Joriy suhbatni tozalash</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ==========================================================================
          CHAT HISTORY DRAWER (ChatGPT & Gemini Style)
          ========================================================================== */}
      {isHistoryDrawerOpen && (
        <div className="chatgpt-history-backdrop" onClick={() => setIsHistoryDrawerOpen(false)}>
          <div className="chatgpt-history-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="chatgpt-history-header">
              <div className="chatgpt-history-header-left">
                <History size={18} className="chatgpt-history-header-icon" />
                <h3>Suhbatlar tarixi</h3>
              </div>
              <button
                type="button"
                className="chatgpt-history-close-btn"
                onClick={() => setIsHistoryDrawerOpen(false)}
                title="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            <button
              type="button"
              className="chatgpt-history-new-btn"
              onClick={handleStartNewChat}
            >
              <Plus size={16} />
              <span>Yangi suhbat boshlash</span>
            </button>

            <div className="chatgpt-history-search">
              <Search size={14} className="chatgpt-history-search-icon" />
              <input
                type="text"
                placeholder="Suhbatlarni qidirish..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
              />
              {historySearchQuery && (
                <button
                  type="button"
                  className="chatgpt-history-search-clear"
                  onClick={() => setHistorySearchQuery("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="chatgpt-history-list">
              {filteredSessions.length === 0 ? (
                <div className="chatgpt-history-empty">
                  <MessageSquare size={28} />
                  <p>{historySearchQuery ? "Mos keluvchi suhbat topilmadi" : "Hozircha suhbatlar tarixi mavjud emas"}</p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const messageCount = session.messages?.length || 0;
                  const isEditingThis = editingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`chatgpt-history-item ${isActive ? "active" : ""}`}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      <div className="chatgpt-history-item-icon">
                        <MessageSquare size={15} />
                      </div>

                      <div className="chatgpt-history-item-body">
                        {isEditingThis ? (
                          <input
                            type="text"
                            className="chatgpt-history-rename-input"
                            value={editingTitleText}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingTitleText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveRenameSession(session.id);
                              } else if (e.key === "Escape") {
                                setEditingSessionId(null);
                              }
                            }}
                            onBlur={() => saveRenameSession(session.id)}
                          />
                        ) : (
                          <div className="chatgpt-history-item-title" title={session.title}>
                            {session.title || "Yangi suhbat"}
                          </div>
                        )}

                        <div className="chatgpt-history-item-meta">
                          <span>{formatSessionTime(session.updatedAt || session.createdAt)}</span>
                          {messageCount > 0 && <span>• {messageCount} ta xabar</span>}
                        </div>
                      </div>

                      <div className="chatgpt-history-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="chatgpt-history-action-btn"
                          title="Nomini o'zgartirish"
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setEditingTitleText(session.title || "Yangi suhbat");
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          className="chatgpt-history-action-btn danger"
                          title="O'chirish"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {sessions.length > 1 && (
              <div className="chatgpt-history-footer">
                <button
                  type="button"
                  className="chatgpt-history-clear-all-btn"
                  onClick={handleClearAllHistory}
                >
                  <Trash2 size={14} />
                  <span>Barcha suhbatlar tarixini tozalash</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          MESSAGES SCROLL AREA: Pure transparent background for all messages
          AI message sits directly on page canvas (NO CARD BACKGROUND).
          User message is subtle soft tinted pill on right ("Mainga morge qil").
          ========================================================================== */}
      <div
        className="chatgpt-messages-scrollview"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="guli-chat-empty-state">
            <div className="guli-chat-empty-logo">
              <img
                src="/guli-logo-compact.svg"
                alt="Guli Premium"
                className="guli-chat-brand-img"
              />
              <div className="guli-chat-empty-sparkle">
                <Sparkles size={13} />
              </div>
            </div>
            <h2>Xush kelibsiz! Bugun qanday vazifada yordam beray?</h2>
            <p>
              Do‘kon hisobotlarini ko‘rish, nafis reklama matnlarini yozish yoki rasm va ovozli topshiriqlarni tezkor bajarish uchun savol bering.
            </p>

            <div className="guli-chat-suggestions-grid">
              {DEFAULT_SUGGESTIONS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className="guli-chat-suggestion-chip"
                    onClick={() => {
                      sendUserMessage({ text: item.prompt });
                    }}
                  >
                    <b>
                      <IconComponent size={15} color="#BE123C" />
                      {item.title}
                    </b>
                    <span>{item.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chatgpt-turn-container ${msg.sender}`}>
              {/* USER TURN: Subtle soft pastel blue/gray pill on right */}
              {msg.sender === "user" ? (
                <div className="chatgpt-user-bubble">
                  {/* User image attachment if present */}
                  {msg.imageUrl && (
                    <div
                      className="chatgpt-user-image"
                      onClick={() => window.open(msg.imageUrl, "_blank")}
                      title="Rasmni ochish"
                    >
                      <img src={msg.imageUrl} alt={msg.imageName || "Rasm"} />
                    </div>
                  )}

                  {/* Audio voice message: ONLY the audio player (NO '🎤 Ovozli xabar' text) */}
                  {msg.audioUrl && (
                    <div className="chatgpt-voice-pill">
                      <button
                        type="button"
                        className="chatgpt-voice-play-btn"
                        onClick={() => togglePlayAudio(msg.id, msg.audioUrl!)}
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
                        {msg.audioDuration || "0:05"}
                      </span>
                    </div>
                  )}

                  {/* Regular user text (Filtered: never show '🎤 Ovozli xabar' even from old chats) */}
                  {msg.text && msg.text !== "🎤 Ovozli xabar" && (
                    <div className="chatgpt-user-text">{msg.text}</div>
                  )}
                </div>
              ) : (
                /* AI TURN: Completely transparent background, text directly on canvas */
                <div className="chatgpt-ai-response-block">
                  {/* Processing / Thinking time & Model badge */}
                  <div className="chatgpt-processing-badge">
                    <span>{msg.processingTime || "Tahlil: 1s"}</span>
                    {msg.model && (
                      <span style={{ marginLeft: "6px", fontSize: "11px", color: "#71717A", fontWeight: 500 }}>
                        • {msg.model}
                      </span>
                    )}
                    <ChevronRight size={13} />
                  </div>

                  {/* Fallback notification badge */}
                  {msg.fallback && (
                    <div className="chatgpt-fallback-badge">
                      <span>ℹ️ Limit sababli {msg.fallbackFrom || "asosiy model"}dan {msg.model || "muqobil model"}ga o‘tildi</span>
                    </div>
                  )}

                  {/* Main AI Body - pure clean typography */}
                  <div className="chatgpt-ai-body">
                    {renderFormattedMarkdown(msg.text)}
                  </div>

                  {/* Bottom Actions Row: Copy, Like, Dislike, Speaker, Share, More, Sources */}
                  <div className="chatgpt-actions-row">
                    <div className="chatgpt-actions-left">
                      {/* Copy */}
                      <button
                        type="button"
                        className={`chatgpt-icon-btn ${copiedId === msg.id ? "active-copy" : ""}`}
                        onClick={() => copyText(msg.id, msg.text)}
                        title="Nusxa olish"
                      >
                        {copiedId === msg.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>

                      {/* Thumbs Up (Like) */}
                      <button
                        type="button"
                        className={`chatgpt-icon-btn ${msg.feedback === "like" ? "active-like" : ""}`}
                        onClick={() => toggleFeedback(msg.id, "like")}
                        title="Foydali javob"
                      >
                        <ThumbsUp size={16} />
                      </button>

                      {/* Thumbs Down (Dislike) */}
                      <button
                        type="button"
                        className={`chatgpt-icon-btn ${msg.feedback === "dislike" ? "active-dislike" : ""}`}
                        onClick={() => toggleFeedback(msg.id, "dislike")}
                        title="Qoniqarsiz javob"
                      >
                        <ThumbsDown size={16} />
                      </button>

                      {/* Speaker (Read Aloud) */}
                      <button
                        type="button"
                        className={`chatgpt-icon-btn ${speakingMessageId === msg.id ? "active-speak" : ""}`}
                        onClick={() => toggleSpeakAI(msg.id, msg.text)}
                        title={speakingMessageId === msg.id ? "Ovozni to'xtatish" : "Ovozli o'qish"}
                      >
                        {speakingMessageId === msg.id ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>

                      {/* Share */}
                      <button
                        type="button"
                        className="chatgpt-icon-btn"
                        onClick={() => handleShare(msg.text)}
                        title="Ulashish"
                      >
                        <Share2 size={16} />
                      </button>

                      {/* Three Dots More (Small but useful functions) */}
                      <div className="chatgpt-msg-more-wrap">
                        <button
                          type="button"
                          className={`chatgpt-icon-btn ${activeMsgMenuId === msg.id ? "active-more" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMsgMenuId(activeMsgMenuId === msg.id ? null : msg.id);
                          }}
                          title="Qo'shimcha imkoniyatlar"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeMsgMenuId === msg.id && (
                          <div
                            className="chatgpt-msg-actions-popup"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => {
                                setActiveMsgMenuId(null);
                                copyText(msg.id, msg.text);
                              }}
                            >
                              <Copy size={14} />
                              <span>Nusxa olish</span>
                            </button>

                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => handleRegenerate(msg.id)}
                            >
                              <RotateCcw size={14} />
                              <span>Qaytadan javob olish</span>
                            </button>

                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => handleSummarizeMessage(msg)}
                            >
                              <FileText size={14} />
                              <span>Qisqacha xulosa (3 ta punkt)</span>
                            </button>

                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => handleExpandMessage(msg)}
                            >
                              <Sparkles size={14} />
                              <span>Batafsil tushuntirish</span>
                            </button>

                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => handleConvertToTelegram(msg)}
                            >
                              <Share2 size={14} />
                              <span>Telegram post shakliga keltirish</span>
                            </button>

                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => {
                                setActiveMsgMenuId(null);
                                toggleSpeakAI(msg.id, msg.text);
                              }}
                            >
                              <Volume2 size={14} />
                              <span>{speakingMessageId === msg.id ? "Ovozni to'xtatish" : "Ovoz chiqarib o'qish"}</span>
                            </button>

                            <button
                              type="button"
                              className="chatgpt-msg-action-item"
                              onClick={() => handleBookmarkMessage(msg)}
                            >
                              <Bookmark size={14} />
                              <span>Eslatmalarga saqlash</span>
                            </button>

                            <div className="chatgpt-msg-action-divider" />

                            <button
                              type="button"
                              className="chatgpt-msg-action-item danger"
                              onClick={() => handleDeleteSingleMessage(msg.id)}
                            >
                              <Trash2 size={14} />
                              <span>Ushbu xabarni o'chirish</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sources badge (e.g. ▲⚫ Источники / Manbalar) */}
                    <div className="chatgpt-sources-badge">
                      <span className="chatgpt-source-triangle">▲</span>
                      <span className="chatgpt-source-circle">●</span>
                      <span>Источники</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Thinking Indicator when waiting for AI */}
        {isThinking && (
          <div className="chatgpt-turn-container ai">
            <div className="chatgpt-ai-response-block">
              <div className="chatgpt-processing-badge thinking">
                <div className="chatgpt-thinking-dot-pulse" />
                <span>O'ylanmoqda...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ==========================================================================
          FLOATING JUMP-TO-BOTTOM BUTTON (↓)
          Appears when user scrolls up, exactly as seen in the screenshot
          ========================================================================== */}
      {showScrollBottom && (
        <button
          type="button"
          className="chatgpt-floating-bottom-btn"
          onClick={scrollToBottom}
          title="Pastga tushish"
        >
          <ArrowDown size={18} />
        </button>
      )}

      {/* ==========================================================================
          COMMAND DOCK: ➕ 🎤 Matn kiritish... ⬆
          Ultra-kamfort, sokin va toza
          ========================================================================== */}
      <div className="chatgpt-input-dock-container">
        {/* Selected Image Preview Badge */}
        {selectedImage && (
          <div className="chatgpt-input-preview-card">
            <img src={selectedImage.url} alt="Tanlangan rasm" className="chatgpt-preview-thumb" />
            <div className="chatgpt-preview-info">
              <span className="chatgpt-preview-name">{selectedImage.name}</span>
              <span className="chatgpt-preview-tag">Rasm tahlilga tayyor</span>
            </div>
            <button
              type="button"
              className="chatgpt-preview-remove"
              onClick={() => setSelectedImage(null)}
              title="O'chirish"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Floating Capsule Dock */}
        <div className="chatgpt-input-capsule">
          {/* Active Voice Recording Bar */}
          {isRecording ? (
            <div className="chatgpt-recording-bar">
              <div className="chatgpt-recording-tag">
                <div className="chatgpt-rec-pulse" />
                <span>Ovoz yozilmoqda</span>
              </div>

              {/* Dynamic Soundwave Visualizer */}
              <div className="chatgpt-rec-wave">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => (
                  <div
                    key={i}
                    className="chatgpt-rec-wave-line"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>

              <div className="chatgpt-rec-timer">
                0:{recordSeconds < 10 ? "0" : ""}{recordSeconds}
              </div>

              <button
                type="button"
                className="chatgpt-rec-cancel"
                onClick={cancelRecording}
              >
                Bekor qilish
              </button>

              <button
                type="button"
                className="chatgpt-send-btn active"
                onClick={stopRecording}
                title="Tugatish va yuborish"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          ) : (
            <>
              {/* Left Tools: [➕] and [🎤] */}
              <div className="chatgpt-input-left" ref={attachMenuRef}>
                {/* [➕] Plus Button */}
                <button
                  type="button"
                  className={`chatgpt-dock-btn plus-btn ${isAttachMenuOpen ? "open" : ""}`}
                  onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                  title="Biriktirish"
                >
                  <Plus size={19} />
                </button>

                {/* Attachment Menu Popover */}
                {isAttachMenuOpen && (
                  <div className="chatgpt-attach-popover">
                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsAttachMenuOpen(false);
                      }}
                    >
                      <div className="chatgpt-attach-icon">
                        <ImageIcon size={15} />
                      </div>
                      <span>Rasm yoki mahsulot surati</span>
                    </button>

                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        sendUserMessage({
                          text: "Bugungi savdo ko'rsatkichlari va yangi buyurtmalar holati bo'yicha hisobot ber.",
                        });
                        setIsAttachMenuOpen(false);
                      }}
                    >
                      <div className="chatgpt-attach-icon">
                        <TrendingUp size={15} />
                      </div>
                      <span>Savdo tahlili</span>
                    </button>

                    <button
                      type="button"
                      className="chatgpt-attach-item"
                      onClick={() => {
                        sendUserMessage({
                          text: "Dam olish kunlari uchun 15% chegirma va promo aksiya rejasini tuzib ber.",
                        });
                        setIsAttachMenuOpen(false);
                      }}
                    >
                      <div className="chatgpt-attach-icon">
                        <FileText size={15} />
                      </div>
                      <span>Aksiya shabloni</span>
                    </button>
                  </div>
                )}

                {/* [🎤] Microphone Button */}
                <button
                  type="button"
                  className="chatgpt-dock-btn"
                  onClick={startRecording}
                  title="Ovozli xabar yozish"
                >
                  <Mic size={19} />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="chatgpt-dock-textarea"
                placeholder="Guli AI'ga savol bering yoki topshiriq yozing..."
                rows={1}
                value={inputText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
              />

              {/* [⬆] Send Button */}
              <button
                type="button"
                className={`chatgpt-send-btn ${
                  inputText.trim() || selectedImage ? "active" : ""
                }`}
                disabled={!inputText.trim() && !selectedImage}
                onClick={() => sendUserMessage({})}
                title="Yuborish"
              >
                <ArrowUp size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
