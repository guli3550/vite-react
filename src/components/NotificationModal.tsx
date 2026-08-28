import { type Language, getTranslation } from "../utils/translations";
import { type ChatMessage, markMessagesAsRead } from "../utils/chatSync";

type NotificationModalProps = {
  language: Language;
  unreadMessages: ChatMessage[];
  userId?: string | number;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenOrders: () => void;
};

export function NotificationModal({
  language,
  unreadMessages,
  userId,
  onClose,
  onOpenChat,
  onOpenOrders,
}: NotificationModalProps) {
  const t = (key: any) => getTranslation(key, language);

  const handleOpenChat = () => {
    markMessagesAsRead(userId);
    onClose();
    onOpenChat();
  };

  const handleMarkAllRead = () => {
    markMessagesAsRead(userId);
    onClose();
  };

  return (
    <div className="modalShade" onMouseDown={onClose} id="notification-modal-overlay">
      <div
        className="notificationModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="notification-modal-card"
      >
        <div className="modalHead">
          <div>
            <span className="proEyebrow">GULI ALERTS</span>
            <h2>{t("notifications")}</h2>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
            aria-label={t("close")}
            id="notif-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="notificationBody">
          {unreadMessages.length > 0 ? (
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
              onClick={() => {
                onClose();
                onOpenOrders();
              }}
              id="notif-open-orders-btn"
            >
              <span>📦</span>
              <span>{t("my_orders")}</span>
            </button>
          </div>
        </div>

        <div className="notificationFooter">
          {unreadMessages.length > 0 && (
            <button
              type="button"
              className="markAllReadBtn"
              onClick={handleMarkAllRead}
              id="mark-all-read-btn"
            >
              {t("mark_all_read")}
            </button>
          )}
          <button
            type="button"
            className="primaryButton"
            onClick={onClose}
            id="notif-dismiss-btn"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
