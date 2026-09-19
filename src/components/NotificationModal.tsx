import { useState, useMemo, useEffect, useCallback } from "react";
import { type Language, getTranslation } from "../utils/translations";
import {
  type ChatMessage,
  markMessagesAsRead,
  markSingleMessageAsRead,
  getStoredChatMessages,
} from "../utils/chatSync";

type NotificationModalProps = {
  language: Language;
  unreadMessages: ChatMessage[];
  userId?: string | number;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenOrders: () => void;
};

type NotifCategory = "all" | "messages" | "orders";

export function NotificationModal({
  language,
  unreadMessages,
  userId,
  onClose,
  onOpenChat,
  onOpenOrders,
}: NotificationModalProps) {
  const t = useCallback((key: any) => getTranslation(key, language), [language]);

  const [activeCategory, setActiveCategory] = useState<NotifCategory>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("guli_dismissed_notifs");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return getStoredChatMessages(userId);
  });

  type OrderNotificationItem = {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    previousStatus?: string;
    previousPaymentStatus?: string;
    timestamp: string;
    read: boolean;
  };

  const orderNotificationStorageKey = `guli_order_notifications_v2_${String(userId || "guest-user")}`;
  const [orderNotifications, setOrderNotifications] = useState<OrderNotificationItem[]>(() => {
    try {
      const raw = localStorage.getItem(orderNotificationStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncOrderNotifications = () => {
      try {
        const raw = localStorage.getItem(orderNotificationStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        setOrderNotifications(Array.isArray(parsed) ? parsed : []);
      } catch {}
    };
    window.addEventListener("guli_order_notifications_updated", syncOrderNotifications);
    return () => window.removeEventListener("guli_order_notifications_updated", syncOrderNotifications);
  }, [orderNotificationStorageKey]);

  // Keep chat messages reactive
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const msgs = Array.isArray(e.detail) ? e.detail : getStoredChatMessages(userId);
      setChatMessages(msgs);
    };
    window.addEventListener("guli_chat_updated", handleUpdate);
    return () => window.removeEventListener("guli_chat_updated", handleUpdate);
  }, [userId]);

  const dismissItem = (id: string) => {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem("guli_dismissed_notifs", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isOrderStatusText = (text: string) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes("buyurtm") ||
      lower.includes("holat") ||
      lower.includes("status") ||
      lower.includes("tavar") ||
      lower.includes("tayyorlanmoqda") ||
      lower.includes("yo‘lda") ||
      lower.includes("yolda") ||
      lower.includes("qabul qilindi") ||
      lower.includes("yetkazildi") ||
      lower.includes("bekor qilindi")
    );
  };

  // Build the complete notification feed list
  const allFeedItems = useMemo(() => {
    const list: any[] = [];

    // 1. Chat messages from Admin / Support
    chatMessages.forEach((msg) => {
      if (msg.sender !== "admin" || msg.id === "welcome-msg-1") return;
      const isStatus = isOrderStatusText(msg.text);
      const isUnread = !msg.read;

      list.push({
        id: `chat-${msg.id}`,
        rawId: msg.id,
        category: isStatus ? "orders" : "messages",
        title: isStatus
          ? language === "ru"
            ? "Buyurtma holati"
            : language === "en"
            ? "Order Status"
            : "Buyurtma holati"
          : language === "ru"
          ? "GULI Qo‘llab-quvvatlash"
          : language === "en"
          ? "GULI Support"
          : "GULI Qo‘llab-quvvatlash",
        text: msg.text || (msg.mediaUrl ? "📷 Rasm biriktirildi" : ""),
        timestamp: msg.timestamp,
        read: !isUnread,
        icon: isStatus ? "📦" : "💬",
        badgeBg: isStatus ? "#e0f2fe" : "#fce7f3",
        badgeColor: isStatus ? "#0284c7" : "#c9526b",
        actionText: isStatus ? `${t("my_orders")} →` : `${t("view_chat")} →`,
        type: "msg",
      });
    });

    // 2. Real order state-change notifications.
    orderNotifications.forEach((notification) => {
      const paymentLabel =
        notification.paymentStatus === "verified"
          ? "To‘lov tasdiqlandi"
          : notification.paymentStatus === "rejected"
          ? "To‘lov rad etildi"
          : notification.paymentStatus === "receipt_uploaded"
          ? "Chek yuklandi — tekshirilmoqda"
          : "To‘lov kutilmoqda";

      const statusChanged =
        Boolean(notification.previousStatus) &&
        notification.previousStatus !== notification.status;
      const paymentChanged =
        Boolean(notification.previousPaymentStatus) &&
        notification.previousPaymentStatus !== notification.paymentStatus;

      let text = `Buyurtma №${notification.orderNumber}`;
      if (statusChanged) text += ` • Holat: ${notification.status}`;
      if (paymentChanged) text += ` • ${paymentLabel}`;
      if (!statusChanged && !paymentChanged) text += ` • ${notification.status}`;

      list.push({
        id: notification.id,
        rawId: notification.orderNumber,
        category: "orders",
        title: `Guli Market — Buyurtma №${notification.orderNumber}`,
        text,
        timestamp: notification.timestamp,
        read: notification.read,
        icon: notification.paymentStatus === "rejected" ? "❌" : "📦",
        badgeBg: notification.paymentStatus === "rejected" ? "#fee2e2" : "#e0f2fe",
        badgeColor: notification.paymentStatus === "rejected" ? "#dc2626" : "#0284c7",
        actionText: `${t("my_orders")} →`,
        type: "order",
      });
    });

    // Filter out dismissed items
    const filtered = list.filter((item) => !dismissedIds.includes(item.id));

    // Deduplicate identical items
    const uniqueMap = new Map();
    filtered.forEach((item) => {
      const key = `${item.category}-${item.rawId || item.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    // Sort newest first
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tB - tA;
    });
  }, [chatMessages, orderNotifications, language, dismissedIds, t]);

  // Counts per category
  const counts = useMemo(() => {
    let all = 0;
    let messages = 0;
    let ordersCount = 0;
    let unreadTotal = 0;

    allFeedItems.forEach((item) => {
      all++;
      if (item.category === "messages") messages++;
      if (item.category === "orders") ordersCount++;
      if (!item.read) unreadTotal++;
    });

    return { all, messages, orders: ordersCount, unreadTotal };
  }, [allFeedItems]);

  // Filtered by Category and Search Query
  const displayedFeedItems = useMemo(() => {
    let result = allFeedItems;

    if (activeCategory !== "all") {
      result = result.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.text?.toLowerCase().includes(q) ||
          String(item.rawId || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [allFeedItems, activeCategory, searchQuery]);

  const handleItemClick = (item: any) => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    // Immediately dismiss this item so it disappears from notification feed
    dismissItem(item.id);

    if (item.type === "msg" && item.rawId) {
      markSingleMessageAsRead(item.rawId, userId);
    } else if (item.category === "orders") {
      try {
        const raw = localStorage.getItem(orderNotificationStorageKey);
        const items: OrderNotificationItem[] = raw ? JSON.parse(raw) : [];
        const updated = items.map((n) => n.id === item.id ? { ...n, read: true } : n);
        localStorage.setItem(orderNotificationStorageKey, JSON.stringify(updated));
        setOrderNotifications(updated);
        window.dispatchEvent(new Event("guli_order_notifications_updated"));
      } catch {}
    }

    onClose();

    if (item.category === "orders") {
      onOpenOrders();
    } else {
      onOpenChat();
    }
  };

  const handleMarkAllRead = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    allFeedItems.forEach((item) => dismissItem(item.id));
    markMessagesAsRead(userId, "user");
    try {
      const updated = orderNotifications.map((n) => ({ ...n, read: true }));
      localStorage.setItem(orderNotificationStorageKey, JSON.stringify(updated));
      setOrderNotifications(updated);
      window.dispatchEvent(new Event("guli_order_notifications_updated"));
    } catch {}
    onClose();
  };

  return (
    <div
      className="modalShade modalShadeHasNotif"
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
        {/* Compact Header */}
        <div className="notifHeaderCompact">
          <div className="notifHeaderLeft">
            <span className="notifHeaderIcon">🔔</span>
            <div>
              <h2 className="notifHeaderTitle">{t("notifications")}</h2>
              <span className="notifHeaderSubtitle">
                {counts.unreadTotal > 0
                  ? `${counts.unreadTotal} ta yangi bildirishnoma`
                  : "Barcha xabarlar o‘qilgan"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modalCloseBtn notifCloseBtnCompact"
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

        {/* Habarlarni Qidirish (Search Bar) */}
        <div className="notifSearchWrapCompact">
          <span className="notifSearchIconCompact">🔍</span>
          <input
            type="text"
            className="notifSearchInputCompact"
            placeholder={
              language === "ru"
                ? "Bildirishnomalarni qidirish..."
                : language === "en"
                ? "Search notifications..."
                : "Bildirishnomalarni qidirish..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="notif-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="notifSearchClearBtn"
              onClick={() => setSearchQuery("")}
              aria-label="Tozalash"
            >
              ✕
            </button>
          )}
        </div>

        {/* Kategoriyalar (Category Filter Tabs) */}
        <div className="notifCategoryTabsCompact">
          <button
            type="button"
            className={`notifCategoryTabItem ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => {
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
              setActiveCategory("all");
            }}
            id="notif-tab-all"
          >
            <span>{language === "ru" ? "Barchasi" : language === "en" ? "All" : "Barchasi"}</span>
            <span className="notifCategoryCount">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`notifCategoryTabItem ${activeCategory === "messages" ? "active" : ""}`}
            onClick={() => {
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
              setActiveCategory("messages");
            }}
            id="notif-tab-messages"
          >
            <span>💬 {language === "ru" ? "Xabarlar" : language === "en" ? "Messages" : "Xabarlar"}</span>
            <span className="notifCategoryCount">{counts.messages}</span>
          </button>
          <button
            type="button"
            className={`notifCategoryTabItem ${activeCategory === "orders" ? "active" : ""}`}
            onClick={() => {
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
              setActiveCategory("orders");
            }}
            id="notif-tab-orders"
          >
            <span>📦 {language === "ru" ? "Buyurtmalar" : language === "en" ? "Orders" : "Buyurtmalar"}</span>
            <span className="notifCategoryCount">{counts.orders}</span>
          </button>
        </div>

        {/* Habarlar Lentasi Body */}
        <div className="notifFeedContainer">
          {displayedFeedItems.length > 0 ? (
            <div className="notifFeedList">
              {displayedFeedItems.map((item) => (
                <div
                  key={item.id}
                  className={`notifFeedCard ${!item.read ? "unread" : ""}`}
                  onClick={() => handleItemClick(item)}
                  id={`notif-card-${item.id}`}
                >
                  <div
                    className="notifFeedIcon"
                    style={{ background: item.badgeBg, color: item.badgeColor }}
                  >
                    <span>{item.icon}</span>
                  </div>
                  <div className="notifContent" style={{ flex: 1, minWidth: 0 }}>
                    <div className="notifFeedHeader">
                      <div className="notifFeedTitle">
                        <span className="truncate">{item.title}</span>
                        {!item.read && <span className="notifUnreadDot" title="Yangi" />}
                      </div>
                      <div className="notifTimeActionWrap">
                        <span className="notifFeedTime">
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                        <button
                          type="button"
                          className="notifCardDeleteBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
                            } catch {}
                            dismissItem(item.id);
                            if (item.type === "msg" && item.rawId) {
                              markSingleMessageAsRead(item.rawId, userId);
                            } else if (item.category === "orders") {
                              try {
                                const raw = localStorage.getItem(orderNotificationStorageKey);
                                const items: OrderNotificationItem[] = raw ? JSON.parse(raw) : [];
                                const updated = items.map((n) => n.id === item.id ? { ...n, read: true } : n);
                                localStorage.setItem(orderNotificationStorageKey, JSON.stringify(updated));
                                setOrderNotifications(updated);
                                window.dispatchEvent(new Event("guli_order_notifications_updated"));
                              } catch {}
                            }
                          }}
                          title="O‘chirish"
                          id={`delete-notif-${item.id}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <p className="notifFeedText">{item.text}</p>
                    <div className="notifFeedAction">{item.actionText}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyNotifBoxCompact">
              <div className="emptyNotifIconCompact">
                {searchQuery ? "🔍" : "✨"}
              </div>
              <h3 className="emptyNotifTitleCompact">
                {searchQuery ? "Natija topilmadi" : t("no_notifications")}
              </h3>
              <p className="emptyNotifDescCompact">
                {searchQuery
                  ? `"${searchQuery}" bo‘yicha bildirishnoma topilmadi.`
                  : "Hozircha ushbu bo‘limda yangi bildirishnomalar mavjud emas."}
              </p>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="notifShortcutsCompact">
            <button
              type="button"
              className="notifShortcutBtnCompact"
              onClick={() => {
                onClose();
                onOpenChat();
              }}
              id="notif-open-chat-btn"
            >
              <span>💬</span>
              <span>{t("online_chat")}</span>
            </button>
            <button
              type="button"
              className="notifShortcutBtnCompact"
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

        {/* Compact Footer (No redundant close button, only Mark All As Read when unread exist) */}
        {counts.unreadTotal > 0 && (
          <div className="notifFooterCompact">
            <button
              type="button"
              className="markAllReadBtnCompact"
              onClick={handleMarkAllRead}
              id="mark-all-read-btn"
            >
              ✓ {t("mark_all_read")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
