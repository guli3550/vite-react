import { useState, useEffect, useRef, FormEvent } from "react";
import {
  type ChatMessage,
  type ConversationSummary,
  getAllConversations,
  getStoredChatMessages,
  sendAdminReply,
  subscribeToChat,
} from "../utils/chatSync";

type AdminChatTabProps = {
  token?: string;
  onShowToast?: (msg: string) => void;
};

export default function AdminChatTab({ token, onShowToast }: AdminChatTabProps) {
  void token;
  const [conversations, setConversations] = useState<ConversationSummary[]>(() => getAllConversations());
  const [selectedUserId, setSelectedUserId] = useState<string>("guest-user");
  const [replyText, setReplyText] = useState("");
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() => getStoredChatMessages());
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const timerIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToChat((updated) => {
      setAllMessages(updated);
      setConversations(getAllConversations());
    });
    return unsubscribe;
  }, []);

  // Filter messages for currently selected customer
  const currentMessages = allMessages.filter(
    (m) =>
      !m.userId ||
      String(m.userId) === String(selectedUserId) ||
      m.id === "welcome-msg-1"
  );

  const selectedConv = conversations.find((c) => c.userId === selectedUserId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  const handleSendReply = (
    e?: FormEvent,
    customText?: string,
    media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string }
  ) => {
    if (e) e.preventDefault();
    const textToSend = (customText || replyText).trim();
    if (!textToSend && !media) return;
    if (!selectedUserId) return;

    sendAdminReply(
      selectedUserId,
      textToSend || (media?.type === "image" ? "📷 Rasm" : media?.type === "audio" ? "🎙️ Ovozli xabar" : "📁 Fayl"),
      media
    );
    setReplyText("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleSendReply(undefined, "📷 Rasm", { type: "image", mediaUrl: base64, fileName: file.name });
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
      handleSendReply(undefined, `📁 ${file.name}`, { type: "file", mediaUrl: base64, fileName: file.name });
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
          handleSendReply(undefined, "🎙️ Ovozli xabar", { type: "audio", mediaUrl: base64Audio, fileName: "voice.webm" });
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

  const quickReplies = [
    "Assalomu alaykum! GULI do‘koniga xush kelibsiz 🌷 Sizga qanday yordam bera olamiz?",
    "Buyurtmangiz tekshirilmoqda, 5 daqiqa ichida operatorimiz tasdiqlaydi ⏳",
    "Buyurtmangiz yo‘lda, kuryerimiz 1-2 soat ichida siz bilan bog‘lanadi 🚚",
    "Mahsulot o‘lchami to‘liq mos keladi, qulaylik uchun 1 o‘lcham kattaroq tanlashni tavsiya qilamiz.",
    "Biz bilan bog‘langaningiz uchun rahmat! Yana qanday savollaringiz bor? 🌸",
  ];

  return (
    <section className="proPanel chatAdminPanel" id="admin-chat-panel">
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

      <div className="panelHead">
        <div>
          <span className="proEyebrow">REAL-TIME SUPPORT</span>
          <h2>Mijozlar bilan onlayn chat ({conversations.length})</h2>
        </div>
      </div>

      <div className="adminChatContainer">
        {/* Left column: Conversation list */}
        <div className="convSidebar">
          <div className="convListHead">
            <b>Mijozlar ro‘yxati</b>
            <small>{conversations.length} ta suhbat</small>
          </div>
          <div className="convListScroll">
            {conversations.map((conv) => {
              const isSelected = conv.userId === selectedUserId;
              return (
                <div
                  key={conv.userId}
                  className={`convCard ${isSelected ? "active" : ""} ${
                    conv.unreadCount > 0 ? "hasUnread" : ""
                  }`}
                  onClick={() => setSelectedUserId(conv.userId)}
                  id={`admin-conv-user-${conv.userId}`}
                >
                  <div className="convAvatar">
                    {conv.userPhoto ? (
                      <img src={conv.userPhoto} alt={conv.userName} />
                    ) : (
                      <span>{(conv.userName || "M").slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="convInfo">
                    <div className="convTopRow">
                      <b>{conv.userName}</b>
                      <small>
                        {new Date(conv.lastTimestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <p className="convLastText">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="convUnreadBadge">{conv.unreadCount}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Chat conversation window */}
        <div className="chatConversationWindow">
          {/* Header */}
          <div className="chatConvHeader">
            <div className="chatConvUser">
              <div className="avatarLargeMini">
                {selectedConv?.userPhoto ? (
                  <img src={selectedConv.userPhoto} alt="User" />
                ) : (
                  <span>{(selectedConv?.userName || "M").slice(0, 1)}</span>
                )}
              </div>
              <div>
                <b>{selectedConv?.userName || "Mijoz"}</b>
                <small>Telegram ID: {selectedUserId} · Onlayn</small>
              </div>
            </div>
            <a
              href="tel:+998905811117"
              className="chatPhoneShortcut"
              title="Call Center"
            >
              📞 +998905811117
            </a>
          </div>

          {/* Messages */}
          <div className="adminChatMessagesScroll">
            {currentMessages.map((msg, i) => {
              const isAdmin = msg.sender === "admin";
              return (
                <div
                  key={msg.id || i}
                  className={`adminChatBubbleRow ${
                    isAdmin ? "adminBubble" : "userBubble"
                  }`}
                >
                  <div className="adminBubbleWrap">
                    <div className="adminBubbleSender">
                      {isAdmin ? "Admin (Siz)" : msg.userName || "Mijoz"}
                    </div>
                    <div className="adminBubbleText">
                      {msg.type === "image" && msg.mediaUrl ? (
                        <div className="chatMediaImage">
                          <img src={msg.mediaUrl} alt="Attachment" />
                          {msg.text && msg.text !== "📷 Rasm" && <p>{msg.text}</p>}
                        </div>
                      ) : msg.type === "audio" && msg.mediaUrl ? (
                        <div className="chatMediaAudio">
                          <audio controls src={msg.mediaUrl} style={{ width: "100%", maxHeight: "40px" }} />
                          <span>🎙️ Ovozli xabar</span>
                        </div>
                      ) : msg.type === "file" && msg.mediaUrl ? (
                        <div className="chatMediaFile">
                          <a href={msg.mediaUrl} download={msg.fileName || "file"}>
                            📁 {msg.fileName || "Hujjat"}
                          </a>
                        </div>
                      ) : (
                        <p>{msg.text}</p>
                      )}

                      <span className="adminBubbleTime">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick presets */}
          <div className="adminQuickRepliesScroll">
            {quickReplies.map((qr, idx) => (
              <button
                key={idx}
                type="button"
                className="adminQuickChip"
                onClick={() => handleSendReply(undefined, qr)}
                title="Tezkor javobni yuborish"
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Recording status bar */}
          {isRecording && (
            <div className="recordingStatusBar adminRecordingBar">
              <span className="pulsingDot" />
              <span>Ovoz yozilmoqda... 0:{recordTimer < 10 ? `0${recordTimer}` : recordTimer}</span>
              <button type="button" className="stopRecordBtn" onClick={stopRecording}>
                Tugatish va yuborish ✓
              </button>
            </div>
          )}

          {/* Input form */}
          <form className="adminChatInputForm" onSubmit={(e) => handleSendReply(e)}>
            <button
              type="button"
              className="chatAttachBtn"
              onClick={() => imageInputRef.current?.click()}
              title="Rasm yuborish"
            >
              📷
            </button>
            <button
              type="button"
              className="chatAttachBtn"
              onClick={() => fileInputRef.current?.click()}
              title="Fayl yuborish"
            >
              📎
            </button>
            <button
              type="button"
              className={`chatAttachBtn ${isRecording ? "recordingActive" : ""}`}
              onClick={isRecording ? stopRecording : startRecording}
              title="Ovozli xabar"
            >
              🎙️
            </button>

            <input
              type="text"
              className="adminChatInput"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Mijozga javob xabarini yozing..."
              id="admin-chat-reply-input"
            />
            <button
              type="submit"
              className="proPrimary adminSendBtn"
              disabled={!replyText.trim()}
              id="admin-send-reply-btn"
            >
              Yuborish ➤
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
