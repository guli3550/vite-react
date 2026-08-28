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
};

export default function AdminChatTab({ token }: AdminChatTabProps) {
  // token reserved for authenticated admin backend push
  void token;
  const [conversations, setConversations] = useState<ConversationSummary[]>(() =>
    getAllConversations()
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    const list = getAllConversations();
    return list[0]?.userId || "guest-user";
  });
  const [replyText, setReplyText] = useState("");
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages()
  );
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

  const handleSendReply = (e?: FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || replyText).trim();
    if (!textToSend || !selectedUserId) return;

    sendAdminReply(selectedUserId, textToSend);
    setReplyText("");
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
                      <p>{msg.text}</p>
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

          {/* Input form */}
          <form className="adminChatInputForm" onSubmit={handleSendReply}>
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
