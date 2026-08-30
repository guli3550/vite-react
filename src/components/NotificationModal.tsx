import { type Language, getTranslation } from "../utils/translations";
import { type ChatMessage, markMessagesAsRead } from "../utils/chatSync";

type NotificationModalProps = {
  language: Language;
  unreadMessages: ChatMessage[];
  orders?: any[];
  userId?: string | number;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenOrders: () => void;
};

export function NotificationModal({
  language,
  unreadMessages,
  orders = [],
  userId,
  onClose,
  onOpenChat,
  onOpenOrders,
}: NotificationModalProps) {
  const t = (key: any) => getTranslation(key, language);

  const handleOpenChat = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
    markMessagesAsRead(userId, "user");
    onClose();
    onOpenChat();
  };

  const handleOpenOrders = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
    onClose();
    onOpenOrders();
  };

  const handleMarkAllRead = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    markMessagesAsRead(userId, "user");
    onClose();
  };

  const recentActiveOrders = orders.filter(
    (o) => o.status === "Qabul qilindi" || o.status === "Tayyorlanmoqda" || o.status === "Yo‘lda"
  ).slice(0, 3);

  const hasContent = unreadMessages.length > 0 || recentActiveOrders.length > 0;

  return (
    <div
      className="modalShade"
      onMouseDown={() => {
        try {
          window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
        } catch {}
        onClose();
      }}
      id="notification-modal-overlay"
    >
      <div
        className="notificationModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="notification-modal-card"
      >
        <div className="modalHead">
          <div>
            <span className="proEyebrow">GULI NOTIFICATIONS</span>
            <h2>{t("notifications")}</h2>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={() => {
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
              onClose();
            }}
            aria-label={t("close")}
            id="notif-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="notificationBody">
          {hasContent ? (
            <div className="notifList">
              {unreadMessages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className="notifItem clickable"
                  onClick={handleOpenChat}
                  id={`notif-item-${msg.id || index}`}
                >
                  <div className="notifIconBadge chatBadge">
                    <span>💬</span>
                  </div>
                  <div className="notifContent">
                    <div className="notifTitleRow">
                      <b>{t("new_message_from_admin")}</b>
                      <small>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <p className="notifPreviewText">{msg.text}</p>
                    <span className="notifActionLink">{t("view_chat")} →</span>
                  </div>
                </div>
              ))}

              {recentActiveOrders.map((ord, idx) => (
                <div
                  key={ord.id || idx}
                  className="notifItem clickable"
                  onClick={handleOpenOrders}
                  id={`notif-order-${ord.id || idx}`}
                >
                  <div className="notifIconBadge" style={{ background: "linear-gradient(135deg, #e0f2fe, #bae6fd)", color: "#0284c7" }}>
                    <span>📦</span>
                  </div>
                  <div className="notifContent">
                    <div className="notifTitleRow">
                      <b>Buyurtma #{ord.id} • {ord.status}</b>
                      <small>
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Yangi"}
                      </small>
                    </div>
                    <p className="notifPreviewText">
                      {ord.items?.length || 0} ta tovar • Jami: {Number(ord.total || 0).toLocaleString()} so‘m
                    </p>
                    <span className="notifActionLink">{t("my_orders")} →</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyNotifBox">
              <div className="emptyNotifIcon">🔔</div>
              <h3>{t("no_notifications")}</h3>
              <p>Yangi xabarlar yoki buyurtma yangilanishlari shu yerda ko‘rinadi.</p>
            </div>
          )}

          {/* Quick shortcuts */}
          <div className="notifShortcuts">
            <button
              type="button"
              className="notifShortcutBtn"
              onClick={handleOpenChat}
              id="notif-open-chat-btn"
            >
              <span>💬</span>
              <span>{t("online_chat")}</span>
            </button>
            <button
              type="button"
              className="notifShortcutBtn"
              onClick={handleOpenOrders}
              id="notif-open-orders-btn"
            >
              <span>📦</span>
              <span>{t("my_orders")}</span>
            </button>
          </div>
        </div>

        <div className="notificationFooter" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-color)" }}>
          {unreadMessages.length > 0 ? (
            <button
              type="button"
              className="markAllReadBtn"
              onClick={handleMarkAllRead}
              id="mark-all-read-btn"
            >
              {t("mark_all_read")}
            </button>
          ) : <div />}
          <button
            type="button"
            className="primaryButton"
            style={{ padding: "10px 20px", borderRadius: "14px", fontSize: "12px", fontWeight: "800" }}
            onClick={() => {
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
              onClose();
            }}
            id="notif-dismiss-btn"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
