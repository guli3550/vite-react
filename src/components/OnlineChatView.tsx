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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Mark all messages as read when user enters chat
  useEffect(() => {
    markMessagesAsRead(userId);
    if (onShowToast) {
      // toast callback ready
    }
  }, [userId, onShowToast]);

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

  const handleSendMessage = (e?: FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputText).trim();
    if (!textToSend) return;

    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      }
    } catch {}

    sendUserMessage(textToSend, user);
    setInputText("");
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
            <span>🌷</span>
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
          <span>🔒 {t("online_chat_desc")} · Ma'lumotlaringiz profilingizda saqlanadi</span>
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
                  <span>🌷</span>
                </div>
              )}

              <div className="bubbleContentWrap">
                <div className="bubbleSenderName">
                  {isAdmin ? t("admin_tag") : t("you_tag")}
                </div>
                <div className="bubbleBox">
                  <p className="bubbleText">{msg.text}</p>
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

      {/* Message Input Box */}
      <form
        className="chatInputBar"
        onSubmit={(e) => handleSendMessage(e)}
        id="chat-message-form"
      >
        <input
          type="text"
          className="chatInputField"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t("type_message")}
          id="chat-input-text"
          autoFocus
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
