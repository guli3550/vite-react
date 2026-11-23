import { useState, useMemo, useEffect, useCallback } from "react";
import { type Language, getTranslation } from "../utils/translations";
import {
  type ChatMessage,
  markMessagesAsRead,
  markSingleMessageAsRead,
  getStoredChatMessages,
} from "../utils/chatSync";
import {
  type NotificationFilterTab,
  type NotificationTimeGroup,
  type OrderNotificationRecord,
  type UnifiedNotificationItem,
  buildNotificationFeed,
  dismissNotificationIdsStorage,
  formatNotificationTimestamp,
  getDismissedNotificationIds,
  getNotifLocaleStrings,
  getNotificationTimeGroup,
  markOrderNotificationsAsReadStorage,
  readOrderNotificationsStorage,
} from "../utils/notificationFeed";

type NotificationModalProps = {
  language: Language;
  userId?: string | number;
  onClose: () => void;
  onOpenChat: () => void;
  onOpenOrders: () => void;
};

const triggerHaptic = (kind: "light" | "success" = "light") => {
  try {
    if (kind === "success") {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } else {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    }
  } catch {}
};

export function NotificationModal({
  language,
  userId,
  onClose,
  onOpenChat,
  onOpenOrders,
}: NotificationModalProps) {
  const t = useCallback((key: any) => getTranslation(key, language), [language]);
  const s = useMemo(() => getNotifLocaleStrings(language), [language]);

  const [activeTab, setActiveTab] = useState<NotificationFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dismissedIds, setDismissedIds] = useState<string[]>(() =>
    getDismissedNotificationIds(),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    getStoredChatMessages(userId),
  );
  const [orderNotifications, setOrderNotifications] = useState<
    OrderNotificationRecord[]
  >(() => readOrderNotificationsStorage(userId));

  // Sync live updates without firing extra network requests
  useEffect(() => {
    const syncOrderNotifications = () => {
      setOrderNotifications(readOrderNotificationsStorage(userId));
    };
    window.addEventListener("guli_order_notifications_updated", syncOrderNotifications);
    return () => {
      window.removeEventListener("guli_order_notifications_updated", syncOrderNotifications);
    };
  }, [userId]);

  useEffect(() => {
    const handleChatUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const msgs = Array.isArray(detail) ? detail : getStoredChatMessages(userId);
      setChatMessages(msgs);
    };
    window.addEventListener("guli_chat_updated", handleChatUpdate);
    return () => window.removeEventListener("guli_chat_updated", handleChatUpdate);
  }, [userId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const allFeedItems = useMemo(
    () =>
      buildNotificationFeed({
        chatMessages,
        orderNotifications,
        dismissedIds,
        language,
        myOrdersLabel: t("my_orders"),
        viewChatLabel: t("view_chat"),
      }),
    [chatMessages, orderNotifications, dismissedIds, language, t],
  );

  const counts = useMemo(() => {
    let all = 0;
    let messages = 0;
    let orders = 0;
    let unread = 0;
    for (const item of allFeedItems) {
      all++;
      if (item.category === "messages") messages++;
      if (item.category === "orders") orders++;
      if (!item.read) unread++;
    }
    return { all, messages, orders, unread };
  }, [allFeedItems]);

  const displayedFeedItems = useMemo(() => {
    let list = allFeedItems;
    if (activeTab === "unread") {
      list = list.filter((item) => !item.read);
    } else if (activeTab === "messages") {
      list = list.filter((item) => item.category === "messages");
    } else if (activeTab === "orders") {
      list = list.filter((item) => item.category === "orders");
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.text.toLowerCase().includes(q) ||
          item.rawId.toLowerCase().includes(q) ||
          (item.statusBadge || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [allFeedItems, activeTab, searchQuery]);

  const groupedFeed = useMemo(() => {
    const nowMs = Date.now();
    const groups: Record<NotificationTimeGroup, UnifiedNotificationItem[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const item of displayedFeedItems) {
      const g = getNotificationTimeGroup(item.timestampMs || item.timestamp, nowMs);
      groups[g].push(item);
    }
    const ordered: Array<{ key: NotificationTimeGroup; label: string; items: UnifiedNotificationItem[] }> = [];
    if (groups.today.length) ordered.push({ key: "today", label: s.groupToday, items: groups.today });
    if (groups.yesterday.length) ordered.push({ key: "yesterday", label: s.groupYesterday, items: groups.yesterday });
    if (groups.earlier.length) ordered.push({ key: "earlier", label: s.groupEarlier, items: groups.earlier });
    return { ordered, nowMs };
  }, [displayedFeedItems, s.groupToday, s.groupYesterday, s.groupEarlier]);

  const markItemRead = useCallback(
    (item: UnifiedNotificationItem) => {
      if (item.read) return;
      if (item.sourceType === "msg" && item.rawId) {
        markSingleMessageAsRead(item.rawId, userId);
        setChatMessages(getStoredChatMessages(userId));
      } else {
        const updated = markOrderNotificationsAsReadStorage(userId, [item.id]);
        setOrderNotifications(updated);
      }
    },
    [userId],
  );

  const handleDeleteItem = useCallback(
    (item: UnifiedNotificationItem) => {
      triggerHaptic("light");
      markItemRead(item);
      setDismissedIds(dismissNotificationIdsStorage([item.id]));
    },
    [markItemRead],
  );

  const handleItemClick = useCallback(
    (item: UnifiedNotificationItem) => {
      triggerHaptic("light");
      markItemRead(item);
      onClose();
      if (item.category === "orders") {
        onOpenOrders();
      } else {
        onOpenChat();
      }
    },
    [markItemRead, onClose, onOpenOrders, onOpenChat],
  );

  const handleMarkAllRead = useCallback(() => {
    triggerHaptic("success");
    markMessagesAsRead(userId, "user");
    setChatMessages(getStoredChatMessages(userId));
    const updated = markOrderNotificationsAsReadStorage(userId);
    setOrderNotifications(updated);
  }, [userId]);

  const handleClearFeed = useCallback(() => {
    triggerHaptic("light");
    markMessagesAsRead(userId, "user");
    setChatMessages(getStoredChatMessages(userId));
    const updated = markOrderNotificationsAsReadStorage(userId);
    setOrderNotifications(updated);
    const idsToDismiss = allFeedItems.map((i) => i.id);
    if (idsToDismiss.length) {
      setDismissedIds(dismissNotificationIdsStorage(idsToDismiss));
    }
  }, [userId, allFeedItems]);

  return (
    <div
      className="modalShade modalShadeHasNotif"
      onMouseDown={() => {
        triggerHaptic("light");
        onClose();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      id="notification-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("notifications")}
    >
      <div
        className="notificationModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="notification-modal-card"
      >
        {/* Mobile Sheet Handle */}
        <div className="notifSheetHandleBar" aria-hidden="true" />

        {/* Smart Header */}
        <div className="notifHeaderCompact">
          <div className="notifHeaderLeft">
            <div className={`notifHeaderBellBox ${counts.unread > 0 ? "hasUnread" : ""}`}>
              <span aria-hidden="true">🔔</span>
            </div>
            <div className="notifHeaderMeta">
              <h2 className="notifHeaderTitle">{t("notifications")}</h2>
              <span className="notifHeaderSubtitle">
                {counts.unread > 0
                  ? s.unreadSubtitle(counts.unread)
                  : s.allReadSubtitle}
              </span>
            </div>
          </div>

          <div className="notifHeaderActions">
            {allFeedItems.length > 0 && (
              <button
                type="button"
                className="notifClearAllIconBtn"
                onClick={handleClearFeed}
                title={s.clearHistory}
                aria-label={s.clearHistory}
                id="notif-clear-all-btn"
              >
                {s.clearHistory}
              </button>
            )}
            <button
              type="button"
              className="modalCloseBtn notifCloseBtnCompact"
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              aria-label={t("close")}
              id="notif-close-btn"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="notifSearchWrapCompact">
          <span className="notifSearchIconCompact" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            className="notifSearchInputCompact"
            placeholder={s.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="notif-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="notifSearchClearBtn"
              onClick={() => setSearchQuery("")}
              aria-label={s.clearSearch}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="notifCategoryTabsCompact" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={`notifCategoryTabItem ${activeTab === "all" ? "active" : ""}`}
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("all");
            }}
            id="notif-tab-all"
          >
            <span>{s.tabAll}</span>
            <span className="notifCategoryCount">{counts.all}</span>
          </button>

          {counts.unread > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "unread"}
              className={`notifCategoryTabItem ${activeTab === "unread" ? "active" : ""}`}
              onClick={() => {
                triggerHaptic("light");
                setActiveTab("unread");
              }}
              id="notif-tab-unread"
            >
              <span>{s.tabUnread}</span>
              <span className="notifCategoryCount notifCountAlert">{counts.unread}</span>
            </button>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "orders"}
            className={`notifCategoryTabItem ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("orders");
            }}
            id="notif-tab-orders"
          >
            <span>{s.tabOrders}</span>
            <span className="notifCategoryCount">{counts.orders}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "messages"}
            className={`notifCategoryTabItem ${activeTab === "messages" ? "active" : ""}`}
            onClick={() => {
              triggerHaptic("light");
              setActiveTab("messages");
            }}
            id="notif-tab-messages"
          >
            <span>{s.tabMessages}</span>
            <span className="notifCategoryCount">{counts.messages}</span>
          </button>
        </div>

        {/* Smooth Scrolling Feed */}
        <div className="notifFeedList" id="notif-feed-scroll">
          {groupedFeed.ordered.length > 0 ? (
            groupedFeed.ordered.map((group) => (
              <div key={group.key} className="notifGroupSection">
                <div className="notifGroupHeading">{group.label}</div>
                <div className="notifGroupItems">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      className={`notifFeedCard tone-${item.tone} ${!item.read ? "unread" : ""}`}
                      onClick={() => handleItemClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                      id={`notif-card-${item.id}`}
                    >
                      <div className={`notifFeedIcon tone-${item.tone}`} aria-hidden="true">
                        <span>{item.icon}</span>
                      </div>

                      <div className="notifContent">
                        <div className="notifFeedHeader">
                          <div className="notifFeedTitle">
                            <span className="notifTitleText">{item.title}</span>
                            {!item.read && (
                              <span
                                className="notifUnreadDot"
                                title={s.newBadge}
                                aria-label={s.newBadge}
                              />
                            )}
                          </div>
                          <div className="notifTimeActionWrap">
                            <span className="notifFeedTime">
                              {formatNotificationTimestamp(
                                item.timestamp,
                                language,
                                groupedFeed.nowMs,
                              )}
                            </span>
                            <button
                              type="button"
                              className="notifCardDeleteBtn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item);
                              }}
                              title={s.deleteItem}
                              aria-label={s.deleteItem}
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
              </div>
            ))
          ) : (
            <div className="emptyNotifBoxCompact">
              <div className="emptyNotifIconCompact" aria-hidden="true">
                {searchQuery ? "🔍" : activeTab === "unread" ? "✅" : "🔔"}
              </div>
              <h3 className="emptyNotifTitleCompact">
                {searchQuery ? s.emptySearchTitle : t("no_notifications")}
              </h3>
              <p className="emptyNotifDescCompact">
                {searchQuery
                  ? s.emptySearchDesc(searchQuery)
                  : activeTab === "unread"
                  ? s.emptyUnreadDesc
                  : s.emptySectionDesc}
              </p>
              {(searchQuery || activeTab !== "all") && (
                <button
                  type="button"
                  className="notifResetFilterBtn"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("all");
                  }}
                >
                  {s.resetFilters}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Footer (Shortcuts + Mark All Read) */}
        <div className="notifModalBottomArea">
          <div className="notifShortcutsCompact">
            <button
              type="button"
              className="notifShortcutBtnCompact"
              onClick={() => {
                triggerHaptic("light");
                onClose();
                onOpenChat();
              }}
              id="notif-open-chat-btn"
            >
              <span aria-hidden="true">💬</span>
              <span>{t("online_chat")}</span>
            </button>
            <button
              type="button"
              className="notifShortcutBtnCompact"
              onClick={() => {
                triggerHaptic("light");
                onClose();
                onOpenOrders();
              }}
              id="notif-open-orders-btn"
            >
              <span aria-hidden="true">📦</span>
              <span>{t("my_orders")}</span>
            </button>
          </div>

          {counts.unread > 0 && (
            <button
              type="button"
              className="markAllReadBtnCompact"
              onClick={handleMarkAllRead}
              id="mark-all-read-btn"
            >
              ✓ {t("mark_all_read")} ({counts.unread})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
