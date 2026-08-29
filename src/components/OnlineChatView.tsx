import { useState, useEffect, useRef, FormEvent } from "react";
import { type Language, getTranslation } from "../utils/translations";
import {
  type ChatMessage,
  getStoredChatMessages,
  sendUserMessage,
  markMessagesAsRead,
  subscribeToChat,
} from "../utils/chatSync";

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
  language,
  onBack,
  user,
  onShowToast,
}: OnlineChatViewProps) {
  const t = (key: any) => getTranslation(key, language);
  const userId = user?.id ? String(user.id) : "guest-user";
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages(userId)
  );
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const timerIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mark all messages as read when user enters chat
  useEffect(() => {
    markMessagesAsRead(userId);
  }, [userId]);

  // Subscribe to live chat sync
  useEffect(() => {
    const unsubscribe = subscribeToChat((all) => {
      const filtered = all.filter(
        (m) =>
          !m.userId ||
          String(m.userId) === String(userId) ||
          m.id === "welcome-msg-1"
      );
      setMessages(filtered);
      markMessagesAsRead(userId);
    });
    return unsubscribe;
  }, [userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e?: FormEvent, customText?: string, media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string }) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputText).trim();
    if (!textToSend && !media) return;

    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      }
    } catch {}

    sendUserMessage(textToSend || (media?.type === "image" ? "📷 Rasm" : media?.type === "audio" ? "🎙️ Ovozli xabar" : "📁 Fayl"), user, media);
    setInputText("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleSendMessage(undefined, "📷 Rasm", { type: "image", mediaUrl: base64, fileName: file.name });
      onShowToast?.("Rasm yuborildi ✓");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleSendMessage(undefined, `📁 ${file.name}`, { type: "file", mediaUrl: base64, fileName: file.name });
      onShowToast?.("Fayl yuborildi ✓");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage(undefined, "🎙️ Ovozli xabar", { type: "audio", mediaUrl: base64Audio, fileName: "voice.webm" });
          onShowToast?.("Ovozli xabar yuborildi ✓");
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordTimer((prev) => prev + 1);
      }, 1000);

      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
      } catch {}
    } catch {
      onShowToast?.("Mikrofondan foydalanishga ruxsat berilmadi");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
      setRecordTimer(0);
    }
  };

  const formatMessageTime = (isoString: string) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const quickQuestions = [
    t("quick_q1"),
    t("quick_q2"),
    t("quick_q3"),
    t("quick_q4"),
  ];

  return (
    <div className="chatPageContainer" id="online-chat-view">
      {/* Hidden inputs */}
      <input
        type="file"
        ref={imageInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleImageSelect}
      />
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* Chat Topbar */}
      <header className="chatHeader">
        <button
          type="button"
          className="chatBackBtn"
          onClick={onBack}
          id="chat-back-btn"
          aria-label={t("back")}
        >
          ←
        </button>

        <div className="chatHeaderInfo">
          <div className="chatSupportAvatar">
            <img src="/guli_logo.jpg" alt="Guli Support" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            <span className="onlineDot" />
          </div>
          <div>
            <b>{t("chat_welcome_title")}</b>
            <small className="chatOnlineLabel">{t("online_status")}</small>
          </div>
        </div>

        <a
          href="tel:+998905811117"
          className="chatCallShortcutBtn"
          title="Call Center: +998905811117"
          id="chat-header-call-btn"
        >
          📞
        </a>
      </header>

      {/* Messages Scroll Area */}
      <div className="chatMessagesArea" id="chat-messages-scroll">
        <div className="chatNoticePill">
          <span>🔒 {t("online_chat_desc")} · Rasm, fayl va ovozli xabarlar qo‘llab-quvvatlanadi</span>
        </div>

        {messages.map((msg, index) => {
          const isAdmin = msg.sender === "admin";
          return (
            <div
              key={msg.id || index}
              className={`chatBubbleRow ${isAdmin ? "fromAdmin" : "fromUser"}`}
              id={`chat-bubble-${msg.id || index}`}
            >
              {isAdmin && (
                <div className="bubbleAvatar adminAvatar">
                  <img src="/guli_logo.jpg" alt="Guli Admin" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                </div>
              )}

              <div className="bubbleContentWrap">
                <div className="bubbleSenderName">
                  {isAdmin ? t("admin_tag") : t("you_tag")}
                </div>
                <div className="bubbleBox">
                  {msg.type === "image" && msg.mediaUrl ? (
                    <div className="chatMediaImage">
                      <img src={msg.mediaUrl} alt="Uploaded attachment" />
                      {msg.text && msg.text !== "📷 Rasm" && <p className="bubbleText">{msg.text}</p>}
                    </div>
                  ) : msg.type === "audio" && msg.mediaUrl ? (
                    <div className="chatMediaAudio">
                      <audio controls src={msg.mediaUrl} style={{ width: "100%", maxHeight: "40px" }} />
                      <span className="audioLabel">🎙️ Ovozli xabar</span>
                    </div>
                  ) : msg.type === "file" && msg.mediaUrl ? (
                    <div className="chatMediaFile">
                      <a href={msg.mediaUrl} download={msg.fileName || "file"} className="fileDownloadLink">
                        📁 {msg.fileName || "Hujjatni yuklab olish"}
                      </a>
                    </div>
                  ) : (
                    <p className="bubbleText">{msg.text}</p>
                  )}

                  <span className="bubbleTime">
                    {formatMessageTime(msg.timestamp)}
                    {!isAdmin && (
                      <span className="readCheck">
                        {msg.read ? " ✓✓" : " ✓"}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {!isAdmin && (
                <div className="bubbleAvatar userAvatar">
                  {user?.photo_url ? (
                    <img src={user.photo_url} alt="Profile" />
                  ) : (
                    <span>{(user?.first_name || "M").slice(0, 1)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="chatQuickChipsScroll">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            type="button"
            className="quickChipBtn"
            onClick={() => handleSendMessage(undefined, q)}
            id={`quick-chip-${i}`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Recording status bar if recording */}
      {isRecording && (
        <div className="recordingStatusBar">
          <span className="pulsingDot" />
          <span>Ovoz yozilmoqda... 0:</span>
          <span>{recordTimer < 10 ? `0${recordTimer}` : recordTimer}</span>
          <button type="button" className="stopRecordBtn" onClick={stopRecording}>
            Tugatish va yuborish ✓
          </button>
        </div>
      )}

      {/* Message Input Box */}
      <form
        className="chatInputBar"
        onSubmit={(e) => handleSendMessage(e)}
        id="chat-message-form"
      >
        <button
          type="button"
          className="chatAttachBtn"
          onClick={() => imageInputRef.current?.click()}
          title="Rasm yuborish"
          id="chat-img-btn"
        >
          📷
        </button>
        <button
          type="button"
          className="chatAttachBtn"
          onClick={() => fileInputRef.current?.click()}
          title="Fayl yuborish"
          id="chat-file-btn"
        >
          📎
        </button>
        <button
          type="button"
          className={`chatAttachBtn ${isRecording ? "recordingActive" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Ovoz yozishni to'xtatish" : "Ovozli xabar yuborish"}
          id="chat-mic-btn"
        >
          🎙️
        </button>

        <input
          type="text"
          className="chatInputField"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t("type_message")}
          id="chat-input-text"
        />
        <button
          type="submit"
          className="chatSendBtn"
          disabled={!inputText.trim()}
          id="chat-send-button"
          aria-label={t("send")}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
