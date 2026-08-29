import { useState, useEffect, useRef, FormEvent } from "react";
import {
  type ChatMessage,
  type ConversationSummary,
  getAllConversations,
  getStoredChatMessages,
  sendAdminReply,
  subscribeToChat,
  saveChatMessages,
} from "../utils/chatSync";

type AdminChatTabProps = {
  token?: string;
};

// Pre-seed sample chats if empty for instant previewing
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
        text: "Salom admin, buyurtmam qachon yetkaziladi?",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        read: false,
        userId: "telegram-88392",
        userName: "Dilnoza (Telegram)",
      },
    ];
    saveChatMessages([...current, ...samples]);
  }
}

export default function AdminChatTab({ token }: AdminChatTabProps) {
  // token reserved for authenticated admin backend push
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
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages()
  );
  // Mobile UI view toggle: "list" or "chat"
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
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
  }, [currentMessages, mobileView]);

  const handleSelectUser = (uId: string) => {
    setSelectedUserId(uId);
    setMobileView("chat");
  };

  const handleSendReply = (e?: FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || replyText).trim();
    if (!textToSend || !selectedUserId) return;

    sendAdminReply(selectedUserId, textToSend);
    setReplyText("");
  };

  const quickReplies = [
    "Assalomu alaykum! GULI do‘koniga xush kelibsiz 🌷 Sizga qanday yordam bera olamiz?",
    "Buyurtmangiz tekshirilmoqda, 5 daqiqa ichida tasdiqlaymiz ⏳",
    "Buyurtmangiz yo‘lda, kuryerimiz 1-2 soat ichida bog‘lanadi 🚚",
    "Mahsulot o‘lchami to‘liq mos keladi, qulaylik uchun 1 o‘lcham kattaroq tanlashni tavsiya qilamiz.",
    "Biz bilan bog‘langaningiz uchun rahmat! Yana qanday savollaringiz bor? 🌸",
  ];

  return (
    <section className="proPanel chatAdminPanel" id="admin-chat-panel">
      <div className="panelHead chatTabHeader">
        <div>
          <span className="proEyebrow">REAL-TIME MULTI-PLATFORM CHAT</span>
          <h2>Mijozlar bilan onlayn chat ({conversations.length})</h2>
        </div>
        <div className="chatPlatformIndicator">
          <span className="liveBadge">● LIVE SYNC</span>
        </div>
      </div>

      <div className={`adminChatContainer mobile-view-${mobileView}`}>
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
                  tabIndex={0}
                  className={`convCard ${isSelected ? "active" : ""} ${
                    conv.unreadCount > 0 ? "hasUnread" : ""
                  }`}
                  onClick={() => handleSelectUser(conv.userId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectUser(conv.userId);
                    }
                  }}
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
              <button
                type="button"
                className="mobileBackToConvBtn"
                onClick={() => setMobileView("list")}
                title="Ro'yxatga qaytish"
              >
                ← Ro'yxat
              </button>
              <div className="avatarLargeMini">
                {selectedConv?.userPhoto ? (
                  <img src={selectedConv.userPhoto} alt="User" />
                ) : (
                  <span>{(selectedConv?.userName || "M").slice(0, 1)}</span>
                )}
              </div>
              <div>
                <b>{selectedConv?.userName || "Mijoz"}</b>
                <small>ID: {selectedUserId} · Onlayn</small>
              </div>
            </div>
            <a
              href="tel:+998905811117"
              className="chatPhoneShortcut"
              title="Call Center bilan bog'lanish"
              tabIndex={0}
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
                tabIndex={0}
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
              tabIndex={0}
            >
              Yuborish ➤
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

