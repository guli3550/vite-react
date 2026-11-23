export type AdminNotificationEventType =
  | "new_order"
  | "status_change"
  | "payment_update"
  | "order_snapshot";

export type AdminStreamFilter = "all" | "new" | "unread";

export interface AdminOrderLike {
  id?: string | number;
  order_number?: string;
  telegram_id?: number | string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  total?: number | string | null;
  status?: string | null;
  payment?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  customer_photo_url?: string | null;
  telegram_photo?: string | null;
  photo_url?: string | null;
  items?: unknown;
  [key: string]: unknown;
}

export interface AdminStreamNotificationItem {
  streamKey: string;
  orderId: string;
  orderNumber: string;
  eventType: AdminNotificationEventType;
  customerName: string;
  phone: string;
  avatarUrl: string;
  total: number;
  itemsCount: number;
  firstProductTitle: string;
  firstProductImage: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  timestampMs: number;
  read: boolean;
  isRealtimeArrival: boolean;
  rawOrder: AdminOrderLike;
}

export const ADMIN_STREAM_READ_STORAGE_KEY = "guli_admin_notif_read_ids_v1";
export const ADMIN_STREAM_PAGE_SIZE = 15;
export const ADMIN_STREAM_MAX_CACHED_ITEMS = 220;

export function getOrderCanonicalId(order: AdminOrderLike | null | undefined): string {
  if (!order) return "";
  if (order.id !== undefined && order.id !== null && String(order.id).trim() !== "") {
    return String(order.id).trim();
  }
  if (order.order_number && String(order.order_number).trim() !== "") {
    return String(order.order_number).trim();
  }
  return "";
}

function parseOrderItemsSafe(rawItems: unknown): Array<Record<string, any>> {
  if (Array.isArray(rawItems)) return rawItems.filter((x) => x && typeof x === "object");
  if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === "object") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolveCustomerName(order: AdminOrderLike): string {
  const full = [order.first_name, order.last_name]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ");
  if (full) return full;
  if (order.customer_name && String(order.customer_name).trim()) {
    return String(order.customer_name).trim();
  }
  if (order.username && String(order.username).trim()) {
    const clean = String(order.username).trim().replace(/^@/, "");
    return `@${clean}`;
  }
  if (order.phone && String(order.phone).trim()) {
    return String(order.phone).trim();
  }
  return "Mijoz";
}

export function inferOrderEventType(
  order: AdminOrderLike,
  explicit?: AdminNotificationEventType,
): AdminNotificationEventType {
  if (explicit) return explicit;
  const paymentStatus = String(order.payment_status || "").toLowerCase();
  if (paymentStatus === "receipt_uploaded") return "payment_update";
  const status = String(order.status || "").toLowerCase();
  if (!status || status.includes("qabul") || status.includes("yangi")) {
    return "new_order";
  }
  return "order_snapshot";
}

export function mapOrderToStreamItem(
  order: AdminOrderLike,
  opts?: {
    readIds?: Set<string>;
    eventType?: AdminNotificationEventType;
    isRealtimeArrival?: boolean;
  },
): AdminStreamNotificationItem | null {
  const orderId = getOrderCanonicalId(order);
  if (!orderId) return null;

  const orderNumber = String(order.order_number || orderId);
  const parsedItems = parseOrderItemsSafe(order.items);
  const itemsCount = parsedItems.reduce((sum, item) => {
    const qty = Number(item?.qty ?? item?.quantity ?? 1);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);

  const firstItem = parsedItems[0] || {};
  const firstProductTitle = String(
    firstItem?.product?.name ||
      firstItem?.name ||
      firstItem?.title ||
      (itemsCount > 0 ? `${itemsCount} ta mahsulot` : "Buyurtma"),
  ).trim();

  const firstProductImage = String(
    firstItem?.product?.image ||
      firstItem?.image ||
      firstItem?.photo ||
      "",
  ).trim();

  const createdAt = String(order.created_at || order.updated_at || new Date().toISOString());
  const parsedTs = new Date(createdAt).getTime();
  const timestampMs = Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : Date.now();

  const isRead = opts?.readIds ? opts.readIds.has(orderId) || opts.readIds.has(orderNumber) : false;

  return {
    streamKey: `admin-order-${orderId}`,
    orderId,
    orderNumber,
    eventType: inferOrderEventType(order, opts?.eventType),
    customerName: resolveCustomerName(order),
    phone: String(order.phone || "").trim(),
    avatarUrl: String(
      order.customer_photo_url || order.telegram_photo || order.photo_url || "",
    ).trim(),
    total: Number(order.total || 0) || 0,
    itemsCount: itemsCount || parsedItems.length || 1,
    firstProductTitle,
    firstProductImage,
    paymentMethod: String(order.payment || "Naqd").trim(),
    paymentStatus: String(order.payment_status || "").trim(),
    status: String(order.status || "Qabul qilindi").trim(),
    createdAt,
    timestampMs,
    read: isRead,
    isRealtimeArrival: Boolean(opts?.isRealtimeArrival),
    rawOrder: order,
  };
}

export function mergePaginatedOrderItems(
  existingItems: AdminStreamNotificationItem[],
  incomingOrders: AdminOrderLike[],
  opts: {
    mode: "append" | "prepend" | "replace";
    readIds?: Set<string>;
    eventType?: AdminNotificationEventType;
    isRealtimeArrival?: boolean;
    maxItems?: number;
  },
): {
  items: AdminStreamNotificationItem[];
  addedCount: number;
  updatedCount: number;
} {
  const maxItems = opts.maxItems ?? ADMIN_STREAM_MAX_CACHED_ITEMS;
  const map = new Map<string, AdminStreamNotificationItem>();

  if (opts.mode !== "replace") {
    for (const item of existingItems) {
      map.set(item.orderId, item);
    }
  }

  let addedCount = 0;
  let updatedCount = 0;
  const freshPrepends: AdminStreamNotificationItem[] = [];

  for (const raw of incomingOrders) {
    const mapped = mapOrderToStreamItem(raw, {
      readIds: opts.readIds,
      eventType: opts.eventType,
      isRealtimeArrival: opts.isRealtimeArrival,
    });
    if (!mapped) continue;

    const existing = map.get(mapped.orderId);
    if (!existing) {
      addedCount += 1;
      map.set(mapped.orderId, mapped);
      if (opts.mode === "prepend") {
        freshPrepends.push(mapped);
      }
    } else {
      const statusChanged = existing.status !== mapped.status;
      const paymentChanged = existing.paymentStatus !== mapped.paymentStatus;
      const receiptUploadedNow =
        existing.paymentStatus !== "receipt_uploaded" &&
        mapped.paymentStatus === "receipt_uploaded";

      const nextRead =
        opts.isRealtimeArrival && (statusChanged || receiptUploadedNow)
          ? false
          : existing.read || mapped.read;

      const nextEventType: AdminNotificationEventType = receiptUploadedNow
        ? "payment_update"
        : statusChanged && opts.isRealtimeArrival
        ? "status_change"
        : existing.eventType === "new_order" && !statusChanged
        ? "new_order"
        : mapped.eventType;

      const updated: AdminStreamNotificationItem = {
        ...mapped,
        avatarUrl: mapped.avatarUrl || existing.avatarUrl,
        firstProductImage: mapped.firstProductImage || existing.firstProductImage,
        firstProductTitle:
          mapped.firstProductTitle !== "Buyurtma"
            ? mapped.firstProductTitle
            : existing.firstProductTitle,
        read: nextRead,
        eventType: nextEventType,
        isRealtimeArrival: opts.isRealtimeArrival
          ? statusChanged || paymentChanged || existing.isRealtimeArrival
          : existing.isRealtimeArrival,
      };
      map.set(mapped.orderId, updated);
      if (statusChanged || paymentChanged) {
        updatedCount += 1;
      }
    }
  }

  let result: AdminStreamNotificationItem[];
  if (opts.mode === "append") {
    const existingOrder = existingItems.map((i) => map.get(i.orderId)!).filter(Boolean);
    const existingIdSet = new Set(existingOrder.map((i) => i.orderId));
    const newlyAppended = Array.from(map.values())
      .filter((i) => !existingIdSet.has(i.orderId))
      .sort((a, b) => b.timestampMs - a.timestampMs);
    result = [...existingOrder, ...newlyAppended];
  } else {
    result = Array.from(map.values()).sort((a, b) => b.timestampMs - a.timestampMs);
  }

  if (result.length > maxItems) {
    result = result.slice(0, maxItems);
  }

  void freshPrepends;
  return { items: result, addedCount, updatedCount };
}

export function computeNextPaginationState(params: {
  pageSize: number;
  currentOffset: number;
  fetchedCount: number;
  addedCount: number;
  serverHasMore?: boolean;
}): {
  nextOffset: number;
  hasMore: boolean;
  paginationExhausted: boolean;
} {
  const { pageSize, currentOffset, fetchedCount, addedCount, serverHasMore } = params;
  const nextOffset = currentOffset + fetchedCount;

  // If the backend ignored offset and returned already-loaded rows on page >= 2,
  // stop immediately so intersection observer / scroll never loops requests.
  if (currentOffset > 0 && fetchedCount > 0 && addedCount === 0) {
    return {
      nextOffset: currentOffset,
      hasMore: false,
      paginationExhausted: true,
    };
  }

  if (serverHasMore === false || fetchedCount < pageSize) {
    return {
      nextOffset,
      hasMore: false,
      paginationExhausted: true,
    };
  }

  return {
    nextOffset,
    hasMore: true,
    paginationExhausted: false,
  };
}

export function shouldFetchStreamPage(opts: {
  now?: number;
  lastFetchAt: number;
  inFlight: boolean;
  cooldownMs?: number;
  force?: boolean;
  visibilityState?: string;
}): boolean {
  if (opts.inFlight) return false;
  if (opts.visibilityState === "hidden" && !opts.force) return false;
  const now = opts.now ?? Date.now();
  const elapsed = now - (opts.lastFetchAt || 0);
  const minGap = opts.force ? 2_500 : opts.cooldownMs ?? 15_000;
  return elapsed >= minGap;
}

export function filterStreamItems(
  items: AdminStreamNotificationItem[],
  opts: {
    filter: AdminStreamFilter;
    searchQuery?: string;
  },
): AdminStreamNotificationItem[] {
  const q = (opts.searchQuery || "").trim().toLowerCase();
  return items.filter((item) => {
    if (opts.filter === "unread" && item.read) return false;
    if (opts.filter === "new") {
      const isNewOrder =
        item.eventType === "new_order" ||
        item.eventType === "payment_update" ||
        item.isRealtimeArrival ||
        item.status.toLowerCase().includes("qabul");
      if (!isNewOrder) return false;
    }
    if (!q) return true;
    const haystack = `${item.orderNumber} ${item.customerName} ${item.phone} ${item.firstProductTitle} ${item.status} ${item.paymentMethod}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function readAdminStreamReadIds(storage?: Pick<Storage, "getItem"> | null): Set<string> {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return new Set();
  try {
    const raw = store.getItem(ADMIN_STREAM_READ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

export function markAdminStreamReadIds(
  ids: string[],
  maxKeep = 300,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): Set<string> {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  const existing = readAdminStreamReadIds(store);
  for (const id of ids) {
    const clean = String(id || "").trim();
    if (clean) existing.add(clean);
  }
  const arr = Array.from(existing);
  const trimmed = arr.length > maxKeep ? arr.slice(arr.length - maxKeep) : arr;
  if (store) {
    try {
      store.setItem(ADMIN_STREAM_READ_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }
  return new Set(trimmed);
}

export function formatStreamTimestamp(timestamp: string, nowMs = Date.now()): string {
  const ts = new Date(timestamp).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const diff = nowMs - ts;
  if (diff >= 0 && diff < 60_000) return "Hozirgina";
  if (diff >= 60_000 && diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)} daq oldin`;
  }
  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  const now = new Date(nowMs);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return hhmm;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm} · ${hhmm}`;
}
