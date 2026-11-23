export type NotificationLanguage = "uz" | "ru" | "en";

export type NotificationCategory = "messages" | "orders";

export type NotificationFilterTab = "all" | "unread" | "orders" | "messages";

export type NotificationTimeGroup = "today" | "yesterday" | "earlier";

export interface RawChatMessageLike {
  id: string;
  sender: "user" | "admin";
  text?: string;
  timestamp: string;
  read?: boolean;
  type?: string;
  fileName?: string;
  mediaUrl?: string;
  pollQuestion?: string;
  location?: { address?: string };
}

export interface OrderNotificationRecord {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  previousStatus?: string;
  previousPaymentStatus?: string;
  timestamp: string;
  read: boolean;
}

export interface UnifiedNotificationItem {
  id: string;
  rawId: string;
  dedupKey: string;
  category: NotificationCategory;
  sourceType: "msg" | "order";
  title: string;
  text: string;
  timestamp: string;
  timestampMs: number;
  read: boolean;
  icon: string;
  tone: "info" | "success" | "danger" | "brand";
  actionText: string;
  statusBadge?: string;
}

export const DISMISSED_NOTIFS_KEY = "guli_dismissed_notifs";

export function orderNotificationStorageKey(userId?: string | number): string {
  return `guli_order_notifications_v2_${String(userId || "guest-user")}`;
}

export function getDismissedNotificationIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_NOTIFS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function dismissNotificationIdsStorage(ids: string[], maxKeep = 250): string[] {
  const cleanNew = ids.map(String).filter(Boolean);
  if (!cleanNew.length) return getDismissedNotificationIds();
  const current = getDismissedNotificationIds();
  const merged = Array.from(new Set([...current, ...cleanNew]));
  const trimmed = merged.length > maxKeep ? merged.slice(merged.length - maxKeep) : merged;
  try {
    localStorage.setItem(DISMISSED_NOTIFS_KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

export function readOrderNotificationsStorage(userId?: string | number): OrderNotificationRecord[] {
  try {
    const raw = localStorage.getItem(orderNotificationStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markOrderNotificationsAsReadStorage(
  userId?: string | number,
  targetIds?: string[],
): OrderNotificationRecord[] {
  const key = orderNotificationStorageKey(userId);
  const current = readOrderNotificationsStorage(userId);
  if (!current.length) return current;

  const targetSet = targetIds ? new Set(targetIds.map(String)) : null;
  let changed = false;
  const updated = current.map((item) => {
    if (!item.read && (!targetSet || targetSet.has(String(item.id)))) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });

  if (changed) {
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("guli_order_notifications_updated"));
    }
  }
  return updated;
}

export function isOrderStatusMessageText(text: string): boolean {
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
    lower.includes("bekor qilindi") ||
    lower.includes("заказ") ||
    lower.includes("order #")
  );
}

export function getNotifLocaleStrings(language: NotificationLanguage) {
  if (language === "ru") {
    return {
      orderStatusTitle: "Статус заказа",
      supportTitle: "Поддержка GULI",
      orderTitlePrefix: "Guli Market — Заказ №",
      orderPrefix: "Заказ №",
      statusWord: "Статус",
      payVerified: "Оплата подтверждена",
      payRejected: "Оплата отклонена",
      payUploaded: "Чек загружен — проверяется",
      payPending: "Ожидается оплата",
      unreadSubtitle: (n: number) => `${n} новых уведомлений`,
      allReadSubtitle: "Все уведомления прочитаны",
      searchPlaceholder: "Поиск уведомлений...",
      clearSearch: "Очистить поиск",
      tabAll: "Все",
      tabUnread: "Новые",
      tabOrders: "Заказы",
      tabMessages: "Сообщения",
      emptySearchTitle: "Ничего не найдено",
      emptySearchDesc: (q: string) => `По запросу «${q}» уведомлений не найдено.`,
      emptyUnreadDesc: "У вас нет непрочитанных уведомлений.",
      emptySectionDesc: "В этом разделе пока нет новых уведомлений.",
      clearHistory: "Очистить ленту",
      resetFilters: "Показать все",
      deleteItem: "Удалить",
      newBadge: "Новое",
      groupToday: "Сегодня",
      groupYesterday: "Вчера",
      groupEarlier: "Ранее",
      justNow: "Только что",
      minsAgo: (m: number) => `${m} мин назад`,
      videoNote: "Видеосообщение",
      video: "Видео",
      audio: "Голосовое сообщение",
      file: "Документ",
      location: "Геолокация",
      poll: "Опрос",
      image: "Изображение",
    };
  }

  if (language === "en") {
    return {
      orderStatusTitle: "Order Status",
      supportTitle: "GULI Support",
      orderTitlePrefix: "Guli Market — Order #",
      orderPrefix: "Order #",
      statusWord: "Status",
      payVerified: "Payment verified",
      payRejected: "Payment rejected",
      payUploaded: "Receipt uploaded — verifying",
      payPending: "Awaiting payment",
      unreadSubtitle: (n: number) => `${n} unread notifications`,
      allReadSubtitle: "All notifications caught up",
      searchPlaceholder: "Search notifications...",
      clearSearch: "Clear search",
      tabAll: "All",
      tabUnread: "Unread",
      tabOrders: "Orders",
      tabMessages: "Messages",
      emptySearchTitle: "No results found",
      emptySearchDesc: (q: string) => `No notifications matched "${q}".`,
      emptyUnreadDesc: "You have no unread notifications.",
      emptySectionDesc: "No notifications in this section yet.",
      clearHistory: "Clear feed",
      resetFilters: "Show all",
      deleteItem: "Delete",
      newBadge: "New",
      groupToday: "Today",
      groupYesterday: "Yesterday",
      groupEarlier: "Earlier",
      justNow: "Just now",
      minsAgo: (m: number) => `${m}m ago`,
      videoNote: "Video note",
      video: "Video message",
      audio: "Voice message",
      file: "Document",
      location: "Location",
      poll: "Poll",
      image: "Photo attached",
    };
  }

  return {
    orderStatusTitle: "Buyurtma holati",
    supportTitle: "GULI Qo‘llab-quvvatlash",
    orderTitlePrefix: "Guli Market — Buyurtma №",
    orderPrefix: "Buyurtma №",
    statusWord: "Holat",
    payVerified: "To‘lov tasdiqlandi",
    payRejected: "To‘lov rad etildi",
    payUploaded: "Chek yuklandi — tekshirilmoqda",
    payPending: "To‘lov kutilmoqda",
    unreadSubtitle: (n: number) => `${n} ta yangi bildirishnoma`,
    allReadSubtitle: "Barcha bildirishnomalar o‘qilgan",
    searchPlaceholder: "Bildirishnomalarni qidirish...",
    clearSearch: "Qidiruvni tozalash",
    tabAll: "Barchasi",
    tabUnread: "Yangi",
    tabOrders: "Buyurtmalar",
    tabMessages: "Xabarlar",
    emptySearchTitle: "Natija topilmadi",
    emptySearchDesc: (q: string) => `«${q}» bo‘yicha bildirishnoma topilmadi.`,
    emptyUnreadDesc: "O‘qilmagan bildirishnomalar qolmadi.",
    emptySectionDesc: "Hozircha ushbu bo‘limda bildirishnomalar mavjud emas.",
    clearHistory: "Tarixni tozalash",
    resetFilters: "Barchasini ko‘rsatish",
    deleteItem: "O‘chirish",
    newBadge: "Yangi",
    groupToday: "Bugun",
    groupYesterday: "Kecha",
    groupEarlier: "Oldingi",
    justNow: "Hozirgina",
    minsAgo: (m: number) => `${m} daq oldin`,
    videoNote: "Dumaloq video",
    video: "Video xabar",
    audio: "Ovozli xabar",
    file: "Hujjat",
    location: "Geolokatsiya",
    poll: "So‘rovnoma",
    image: "Rasm biriktirildi",
  };
}

export function getNotificationTimeGroup(
  timestamp: string | number,
  nowMs = Date.now(),
): NotificationTimeGroup {
  const ts = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return "earlier";
  const now = new Date(nowMs);
  const target = new Date(ts);

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

  if (targetDay >= startToday) return "today";
  if (targetDay >= startYesterday) return "yesterday";
  return "earlier";
}

export function formatNotificationTimestamp(
  timestamp: string,
  language: NotificationLanguage,
  nowMs = Date.now(),
): string {
  const ts = new Date(timestamp).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const s = getNotifLocaleStrings(language);
  const diffMs = nowMs - ts;

  if (diffMs >= 0 && diffMs < 60_000) {
    return s.justNow;
  }
  if (diffMs >= 60_000 && diffMs < 3_600_000) {
    return s.minsAgo(Math.floor(diffMs / 60_000));
  }

  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const group = getNotificationTimeGroup(ts, nowMs);
  if (group === "today") return hhmm;
  if (group === "yesterday") return `${s.groupYesterday}, ${hhmm}`;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm} · ${hhmm}`;
}

export function buildNotificationFeed(params: {
  chatMessages: RawChatMessageLike[];
  orderNotifications: OrderNotificationRecord[];
  dismissedIds: string[];
  language: NotificationLanguage;
  myOrdersLabel: string;
  viewChatLabel: string;
}): UnifiedNotificationItem[] {
  const {
    chatMessages,
    orderNotifications,
    dismissedIds,
    language,
    myOrdersLabel,
    viewChatLabel,
  } = params;

  const s = getNotifLocaleStrings(language);
  const dismissedSet = new Set(dismissedIds.map(String));
  const rawItems: UnifiedNotificationItem[] = [];

  for (const msg of chatMessages) {
    if (!msg || msg.sender !== "admin" || msg.id === "welcome-msg-1") continue;
    const id = `chat-${msg.id}`;
    if (dismissedSet.has(id)) continue;

    const textStr = String(msg.text || "").trim();
    const isStatus = isOrderStatusMessageText(textStr);
    const mediaSnippet =
      msg.type === "video_note"
        ? `📹 ${s.videoNote}`
        : msg.type === "video"
        ? `🎬 ${s.video}`
        : msg.type === "audio"
        ? `🎙️ ${s.audio}`
        : msg.type === "file"
        ? `📄 ${msg.fileName || s.file}`
        : msg.type === "location"
        ? `📍 ${msg.location?.address || s.location}`
        : msg.type === "poll"
        ? `📊 ${msg.pollQuestion || s.poll}`
        : msg.mediaUrl
        ? `📷 ${s.image}`
        : "";

    const tsMs = new Date(msg.timestamp || 0).getTime() || 0;
    rawItems.push({
      id,
      rawId: String(msg.id),
      dedupKey: `${isStatus ? "orders" : "messages"}-chat-${msg.id}`,
      category: isStatus ? "orders" : "messages",
      sourceType: "msg",
      title: isStatus ? s.orderStatusTitle : s.supportTitle,
      text: textStr || mediaSnippet,
      timestamp: msg.timestamp,
      timestampMs: tsMs,
      read: Boolean(msg.read),
      icon: isStatus ? "📦" : "💬",
      tone: isStatus ? "info" : "brand",
      actionText: `${isStatus ? myOrdersLabel : viewChatLabel} →`,
    });
  }

  for (const n of orderNotifications) {
    if (!n || !n.id) continue;
    if (dismissedSet.has(n.id)) continue;

    const paymentLabel =
      n.paymentStatus === "verified"
        ? s.payVerified
        : n.paymentStatus === "rejected"
        ? s.payRejected
        : n.paymentStatus === "receipt_uploaded"
        ? s.payUploaded
        : s.payPending;

    const statusChanged = Boolean(n.previousStatus) && n.previousStatus !== n.status;
    const paymentChanged =
      Boolean(n.previousPaymentStatus) && n.previousPaymentStatus !== n.paymentStatus;

    let text = `${s.orderPrefix}${n.orderNumber}`;
    if (statusChanged && n.status) text += ` · ${s.statusWord}: ${n.status}`;
    if (paymentChanged) text += ` · ${paymentLabel}`;
    if (!statusChanged && !paymentChanged && n.status) text += ` · ${n.status}`;

    const isRejected = n.paymentStatus === "rejected" || /bekor|cancel/i.test(n.status || "");
    const isVerified = n.paymentStatus === "verified" || /yetkazildi|delivered/i.test(n.status || "");
    const tsMs = new Date(n.timestamp || 0).getTime() || 0;

    rawItems.push({
      id: n.id,
      rawId: String(n.orderNumber),
      dedupKey: `orders-${n.orderNumber}`,
      category: "orders",
      sourceType: "order",
      title: `${s.orderTitlePrefix}${n.orderNumber}`,
      text,
      timestamp: n.timestamp,
      timestampMs: tsMs,
      read: Boolean(n.read),
      icon: isRejected ? "⚠️" : isVerified ? "✅" : "📦",
      tone: isRejected ? "danger" : isVerified ? "success" : "info",
      actionText: `${myOrdersLabel} →`,
      statusBadge: n.status || paymentLabel,
    });
  }

  // Sort newest first BEFORE deduplicating so newest state for an order always wins!
  rawItems.sort((a, b) => b.timestampMs - a.timestampMs);

  const deduped: UnifiedNotificationItem[] = [];
  const seenKeys = new Set<string>();
  for (const item of rawItems) {
    if (seenKeys.has(item.dedupKey)) continue;
    seenKeys.add(item.dedupKey);
    deduped.push(item);
  }

  return deduped;
}

export function hasActivePendingOrders(
  orders: Array<{ status?: string; payment_status?: string }>,
): boolean {
  if (!Array.isArray(orders) || orders.length === 0) return false;
  return orders.some((o) => {
    const status = String(o?.status || "").toLowerCase();
    const payment = String(o?.payment_status || "").toLowerCase();
    const isTerminal =
      status.includes("yetkazildi") ||
      status.includes("delivered") ||
      status.includes("bekor") ||
      status.includes("cancel") ||
      status.includes("yakunlan") ||
      status.includes("completed");
    if (!isTerminal) return true;
    return payment === "pending" || payment === "receipt_uploaded";
  });
}

export function shouldPollOrders(opts: {
  now?: number;
  lastPollAt: number;
  realtimeConnected: boolean;
  hasPendingOrders: boolean;
  visibilityState?: string;
  force?: boolean;
  minForceGapMs?: number;
  minBackgroundGapMs?: number;
}): boolean {
  const now = opts.now ?? Date.now();
  const elapsed = now - (opts.lastPollAt || 0);

  if (opts.visibilityState === "hidden" && !opts.force) {
    return false;
  }

  if (opts.force) {
    return elapsed >= (opts.minForceGapMs ?? 8_000);
  }

  if (!opts.realtimeConnected) {
    return elapsed >= (opts.minBackgroundGapMs ?? 45_000);
  }

  // When Supabase Realtime is healthy, keep background polling light to protect rate limits.
  if (opts.hasPendingOrders) {
    return elapsed >= 90_000;
  }
  return elapsed >= 180_000;
}
