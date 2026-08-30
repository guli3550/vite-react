import { useState, useMemo } from "react";
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
  orders?: any[];
  userId?: string | number;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenOrders: () => void;
};

type FeedTab = "all" | "orders" | "messages" | "promos";

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
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("guli_dismissed_notifs");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

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

  const allChatMessages = useMemo(() => {
    return getStoredChatMessages(userId);
  }, [userId]);

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

  // Build unified feed items list (Habarlar lentasi)
  const feedItems = useMemo(() => {
    const list: any[] = [];

    // 1. Chat messages (admin and support)
    allChatMessages.forEach((msg) => {
      const isStatus = isOrderStatusText(msg.text);
      list.push({
        id: `chat-${msg.id}`,
        rawId: msg.id,
        category: isStatus ? "orders" : "messages",
        title: isStatus
          ? (language === "ru" ? "Статус заказа" : language === "en" ? "Order Status" : "Buyurtma holati")
          : (language === "ru" ? "Сообщение от GULI" : language === "en" ? "Message from GULI" : "GULI Qo‘llab-quvvatlash"),
        text: msg.text,
        timestamp: msg.timestamp,
        read: !!msg.read,
        icon: isStatus ? "📦" : "💬",
        badgeStyle: isStatus
          ? { background: "linear-gradient(135deg, #e0f2fe, #bae6fd)", color: "#0284c7" }
          : { background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", color: "#c9526b" },
        actionText: isStatus ? `${t("my_orders")} →` : `${t("view_chat")} →`,
        type: "msg",
        msgObj: msg,
      });
    });

    // 2. Orders updates
    orders.forEach((ord) => {
      const isNewOrActive = ord.status === "Qabul qilindi" || ord.status === "Tayyorlanmoqda" || ord.status === "Yo‘lda";
      list.push({
        id: `order-${ord.id}`,
        rawId: ord.id,
        category: "orders",
        title: `Buyurtma #${ord.id} • ${ord.status || "Jarayonda"}`,
        text: `${ord.items?.length || 1} ta tovar • Jami: ${Number(ord.total || 0).toLocaleString()} so‘m`,
        timestamp: ord.createdAt || new Date().toISOString(),
        read: !isNewOrActive,
        icon: "📦",
        badgeStyle: { background: "linear-gradient(135deg, #e0f2fe, #bae6fd)", color: "#0284c7" },
        actionText: `${t("my_orders")} →`,
        type: "order",
        orderObj: ord,
      });
    });

    // 3. Official Store Promos / News Feed
    list.push({
      id: "promo-spring-2026",
      category: "promos",
      title: language === "ru" ? "🎁 Акция: Весенняя коллекция" : language === "en" ? "🎁 Special Offer: Spring Collection" : "🎁 Maxsus Taklif: Bahorgi Kolleksiya",
      text: language === "ru" ? "В магазине GULI Premium действуют скидки на косметику и аксессуары!" : language === "en" ? "Special discounts on all cosmetics and accessories at GULI Premium!" : "GULI Premium do‘konida barcha kosmetika va eksklyuziv aksessuarlar uchun maxsus chegirmalar davom etmoqda!",
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      read: true,
      icon: "✨",
      badgeStyle: { background: "linear-gradient(135deg, #fef3c7, #fde68a)", color: "#d97706" },
      actionText: "Aksiyani ko‘rish →",
      type: "promo",
    });

    // Deduplicate and filter out dismissed items
    const uniqueMap = new Map();
    list.forEach((item) => {
      if (dismissedIds.includes(item.id)) return;
      const key = `${item.category}-${item.title}-${item.text.slice(0, 25)}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tB - tA;
    });
  }, [allChatMessages, orders, language, t, dismissedIds]);

  // Filter feed by active tab and search query
  const filteredFeed = useMemo(() => {
    return feedItems.filter((item) => {
      if (activeTab === "orders" && item.category !== "orders") return false;
      if (activeTab === "messages" && item.category !== "messages") return false;
      if (activeTab === "promos" && item.category !== "promos") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
      }
      return true;
    });
  }, [feedItems, activeTab, searchQuery]);

  const totalUnreadCount = unreadMessages.length;

  const handleItemClick = (item: any) => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    // Auto-remove notification from list on click
    dismissItem(item.id);

    if (item.type === "msg" && item.rawId) {
      markSingleMessageAsRead(item.rawId, userId);
    } else if (item.category === "orders") {
      unreadMessages.forEach((m) => {
        if (m.id && isOrderStatusText(m.text)) {
          markSingleMessageAsRead(m.id, userId);
        }
      });
    }

    onClose();

    if (item.category === "orders") {
      onOpenOrders();
    } else if (item.category === "messages") {
      onOpenChat();
    } else {
      onOpenChat();
    }
  };

  const handleMarkAllRead = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    feedItems.forEach((item) => dismissItem(item.id));
    markMessagesAsRead(userId, "user");
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
        {/* Header */}
        <div className="modalHead" style={{ marginBottom: "14px" }}>
          <div>
            <span className="proEyebrow">GULI FEED</span>
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

        {/* Feed Search Input */}
        <div className="notifSearchWrap">
          <span className="notifSearchIcon">🔍</span>
          <input
            type="text"
            className="notifSearchInput"
            placeholder={language === "ru" ? "Поиск в ленте..." : language === "en" ? "Search notifications feed..." : "Habarlardan qidirish..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="notif-search-input"
          />
        </div>

        {/* Avalsimon Feed Filter Tabs */}
        <div className="notifFeedTabs">
          <button
            type="button"
            className={`notifTabPill ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
            id="notif-tab-all"
          >
            <span>✨ Barchasi</span>
            {totalUnreadCount > 0 && <span className="notifBadgePill">{totalUnreadCount}</span>}
          </button>
          <button
            type="button"
            className={`notifTabPill ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
            id="notif-tab-orders"
          >
            <span>📦 Buyurtmalar</span>
          </button>
          <button
            type="button"
            className={`notifTabPill ${activeTab === "messages" ? "active" : ""}`}
            onClick={() => setActiveTab("messages")}
            id="notif-tab-messages"
          >
            <span>💬 Xabarlar</span>
          </button>
          <button
            type="button"
            className={`notifTabPill ${activeTab === "promos" ? "active" : ""}`}
            onClick={() => setActiveTab("promos")}
            id="notif-tab-promos"
          >
            <span>🎁 Aksiyalar</span>
          </button>
        </div>

        {/* Habarlar Lenta Body */}
        <div className="notificationBody">
          {filteredFeed.length > 0 ? (
            <div className="notifFeedList">
              {filteredFeed.map((item) => (
                <div
                  key={item.id}
                  className={`notifFeedCard ${!item.read ? "unread" : ""}`}
                  onClick={() => handleItemClick(item)}
                  id={`notif-card-${item.id}`}
                >
                  <div className="notifFeedIcon" style={item.badgeStyle}>
                    <span>{item.icon}</span>
                  </div>
                  <div className="notifContent" style={{ flex: 1 }}>
                    <div className="notifFeedHeader">
                      <div className="notifFeedTitle">
                        <span>{item.title}</span>
                        {!item.read && <span className="notifUnreadDot" title="Yangi" />}
                      </div>
                      <div className="notifFeedTimeWrap" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
                            }
                          }}
                          title="Yo‘qotish"
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
            <div className="emptyNotifBox">
              <div className="emptyNotifIcon">🔔</div>
              <h3>{t("no_notifications")}</h3>
              <p>Hozircha hech qanday bildirishnoma topilmadi.</p>
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="notifShortcuts">
            <button
              type="button"
              className="notifShortcutBtn"
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

        {/* Footer */}
        <div
          className="notificationFooter"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          {totalUnreadCount > 0 ? (
            <button
              type="button"
              className="markAllReadBtn"
              onClick={handleMarkAllRead}
              id="mark-all-read-btn"
            >
              {t("mark_all_read")}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            className="primaryButton"
            style={{
              padding: "10px 22px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: "800",
            }}
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

