import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../../lib/supabaseClient";
import {
  ADMIN_STREAM_PAGE_SIZE,
  computeNextPaginationState,
  filterStreamItems,
  formatStreamTimestamp,
  markAdminStreamReadIds,
  mergePaginatedOrderItems,
  readAdminStreamReadIds,
  shouldFetchStreamPage,
  type AdminOrderLike,
  type AdminStreamFilter,
  type AdminStreamNotificationItem,
} from "../utils/adminNotificationStreamLogic";

export interface RealtimeAdminNotificationStreamProps {
  apiBase: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: any) => void;
  seedOrders?: AdminOrderLike[];
  onUnreadCountChange?: (count: number) => void;
  onRealtimeOrder?: (order: any, eventType: "INSERT" | "UPDATE") => void;
  playSound?: () => void;
  mode?: "drawer" | "inline";
}

function formatMoneyUZ(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
}

function statusToneClass(status: string, paymentStatus: string): string {
  const s = (status || "").toLowerCase();
  const p = (paymentStatus || "").toLowerCase();
  if (p === "rejected" || s.includes("bekor")) return "streamStatusDanger";
  if (s.includes("yetkazildi") || p === "verified") return "streamStatusSuccess";
  if (s.includes("yo‘lda") || s.includes("yolda") || s.includes("tayyor")) return "streamStatusInfo";
  return "streamStatusNew";
}

function eventLabel(item: AdminStreamNotificationItem): string {
  if (item.eventType === "payment_update" || item.paymentStatus === "receipt_uploaded") {
    return "To‘lov cheki yuklandi";
  }
  if (item.eventType === "status_change") {
    return `Holat: ${item.status}`;
  }
  if (item.eventType === "new_order") {
    return "Yangi buyurtma";
  }
  return item.status || "Buyurtma";
}

export function RealtimeAdminNotificationStream({
  apiBase,
  token,
  isOpen,
  onClose,
  onSelectOrder,
  seedOrders,
  onUnreadCountChange,
  onRealtimeOrder,
  playSound,
  mode = "drawer",
}: RealtimeAdminNotificationStreamProps) {
  const [items, setItems] = useState<AdminStreamNotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => readAdminStreamReadIds());
  const [filter, setFilter] = useState<AdminStreamFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("guli_notif_sound_enabled") !== "false";
    } catch {
      return true;
    }
  });
  const [inlineVisible, setInlineVisible] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const inFlightRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const hasLoadedInitialRef = useRef(false);
  const readIdsRef = useRef(readIds);
  readIdsRef.current = readIds;

  const isActiveView = mode === "inline" ? inlineVisible : isOpen;

  // Periodic subtle timestamp refresh while visible (no network calls)
  useEffect(() => {
    if (!isActiveView) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isActiveView]);

  // Seed lightweight recent orders from dashboard payload without issuing extra requests
  useEffect(() => {
    if (!Array.isArray(seedOrders) || seedOrders.length === 0) return;
    setItems((prev) => {
      const merged = mergePaginatedOrderItems(prev, seedOrders, {
        mode: "prepend",
        readIds: readIdsRef.current,
      });
      return merged.items;
    });
  }, [seedOrders]);

  // Report unread count upstream to AdminHeader badge
  const unreadCount = useMemo(
    () => items.reduce((acc, item) => acc + (item.read ? 0 : 1), 0),
    [items],
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const fetchOrdersPage = useCallback(
    async (
      targetOffset: number,
      mergeMode: "append" | "prepend",
      force = false,
    ) => {
      if (!token) return;
      const canFetch = shouldFetchStreamPage({
        lastFetchAt: mergeMode === "append" && !force ? 0 : lastFetchAtRef.current,
        inFlight: inFlightRef.current,
        cooldownMs: 12_000,
        force: force || mergeMode === "append",
        visibilityState: typeof document !== "undefined" ? document.visibilityState : "visible",
      });
      if (!canFetch) return;

      inFlightRef.current = true;
      if (targetOffset === 0 && items.length === 0) {
        setLoadingInitial(true);
      } else if (mergeMode === "append") {
        setLoadingMore(true);
      }
      setError("");

      try {
        const base = apiBase.replace(/\/$/, "");
        const res = await fetch(
          `${base}/api/admin/orders?limit=${ADMIN_STREAM_PAGE_SIZE}&offset=${targetOffset}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || `Server xatosi (${res.status})`);
        }

        const rows: AdminOrderLike[] = Array.isArray(json?.data) ? json.data : [];
        const serverHasMore =
          typeof json?.pagination?.hasMore === "boolean"
            ? json.pagination.hasMore
            : undefined;

        lastFetchAtRef.current = Date.now();
        hasLoadedInitialRef.current = true;

        setItems((prev) => {
          const merged = mergePaginatedOrderItems(prev, rows, {
            mode: mergeMode,
            readIds: readIdsRef.current,
          });
          const nextPage = computeNextPaginationState({
            pageSize: ADMIN_STREAM_PAGE_SIZE,
            currentOffset: targetOffset,
            fetchedCount: rows.length,
            addedCount: merged.addedCount,
            serverHasMore,
          });
          setHasMore(nextPage.hasMore);
          if (mergeMode === "append") {
            setOffset(nextPage.nextOffset);
          } else if (targetOffset === 0) {
            setOffset((curr) => Math.max(curr, rows.length));
          }
          return merged.items;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Bildirishnomalar lentasini yuklashda xatolik",
        );
      } finally {
        inFlightRef.current = false;
        setLoadingInitial(false);
        setLoadingMore(false);
      }
    },
    [apiBase, token, items.length],
  );

  // Lazy-load page 1 when drawer opens OR when inline panel enters viewport
  useEffect(() => {
    if (mode !== "inline") return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInlineVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInlineVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    if (!isActiveView || !token) return;
    if (!hasLoadedInitialRef.current) {
      void fetchOrdersPage(0, "prepend", true);
    }
  }, [isActiveView, token, fetchOrdersPage]);

  // Infinite lazy-load pagination via IntersectionObserver on scroll sentinel
  useEffect(() => {
    if (!isActiveView || !hasMore || loadingInitial || loadingMore || error) return;
    const sentinel = sentinelRef.current;
    const root = feedScrollRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !inFlightRef.current && hasMore) {
          void fetchOrdersPage(offset, "append", true);
        }
      },
      {
        root: root || null,
        rootMargin: "140px",
        threshold: 0.05,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isActiveView, hasMore, loadingInitial, loadingMore, error, offset, fetchOrdersPage]);

  // Supabase Realtime postgres_changes listener for instant order arrivals without polling
  useEffect(() => {
    if (!token) return;
    const client = getSupabase();
    if (!client) {
      setRealtimeStatus("polling");
      return;
    }

    setRealtimeStatus("connecting");
    const channel = client
      .channel("guli-admin-realtime-orders-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = (payload.new || null) as AdminOrderLike | null;
          if (!newOrder) return;
          setItems((prev) => {
            const merged = mergePaginatedOrderItems(prev, [newOrder], {
              mode: "prepend",
              readIds: readIdsRef.current,
              eventType: "new_order",
              isRealtimeArrival: true,
            });
            return merged.items;
          });
          playSound?.();
          onRealtimeOrder?.(newOrder, "INSERT");
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updatedOrder = (payload.new || null) as AdminOrderLike | null;
          if (!updatedOrder) return;
          setItems((prev) => {
            const merged = mergePaginatedOrderItems(prev, [updatedOrder], {
              mode: "prepend",
              readIds: readIdsRef.current,
              eventType: "status_change",
              isRealtimeArrival: true,
            });
            return merged.items;
          });
          onRealtimeOrder?.(updatedOrder, "UPDATE");
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("polling");
        }
      });

    return () => {
      try {
        void client.removeChannel(channel);
      } catch {}
    };
  }, [token, playSound, onRealtimeOrder]);

  // Low-frequency fallback refresh ONLY when drawer is open AND Realtime is unavailable
  useEffect(() => {
    if (!isActiveView || !token || realtimeStatus === "live") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !inFlightRef.current) {
        void fetchOrdersPage(0, "prepend", false);
      }
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [isActiveView, token, realtimeStatus, fetchOrdersPage]);

  // Escape key closes drawer
  useEffect(() => {
    if (mode !== "drawer" || !isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, isOpen, onClose]);

  const markItemRead = useCallback((orderId: string, orderNumber?: string) => {
    const idsToMark = [orderId, orderNumber || ""].filter(Boolean);
    const updated = markAdminStreamReadIds(idsToMark);
    setReadIds(updated);
    setItems((prev) =>
      prev.map((item) =>
        item.orderId === orderId ? { ...item, read: true, isRealtimeArrival: false } : item,
      ),
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    const allIds = items.flatMap((i) => [i.orderId, i.orderNumber]).filter(Boolean);
    if (!allIds.length) return;
    const updated = markAdminStreamReadIds(allIds);
    setReadIds(updated);
    setItems((prev) => prev.map((i) => ({ ...i, read: true, isRealtimeArrival: false })));
  }, [items]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("guli_notif_sound_enabled", String(next));
      } catch {}
      return next;
    });
  }, []);

  const filteredItems = useMemo(
    () => filterStreamItems(items, { filter, searchQuery }),
    [items, filter, searchQuery],
  );

  if (mode === "drawer" && !isOpen) return null;

  const streamContent = (
    <div
      ref={containerRef}
      className={mode === "drawer" ? "adminStreamPanel drawerMode" : "adminStreamPanel inlineMode"}
      role={mode === "drawer" ? "dialog" : "region"}
      aria-label="Buyurtmalar jonli bildirishnomalar lentasi"
    >
      {/* Header */}
      <div className="adminStreamHeader">
        <div className="adminStreamTitleRow">
          <div className="adminStreamEyebrowWrap">
            <span
              className={`adminStreamLiveDot ${realtimeStatus === "live" ? "isLive" : "isSync"}`}
              aria-hidden="true"
            />
            <span className="proEyebrow">
              {realtimeStatus === "live" ? "JONLI LENTA" : "SINXRON LENTA"}
            </span>
          </div>
          <h2>Buyurtma bildirishnomalari</h2>
        </div>

        <div className="adminStreamHeaderActions">
          <button
            type="button"
            className="adminStreamIconBtn"
            onClick={toggleSound}
            title={soundEnabled ? "Ovozni o‘chirish" : "Ovozni yoqish"}
            aria-label={soundEnabled ? "Ovozni o‘chirish" : "Ovozni yoqish"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>

          <button
            type="button"
            className="adminStreamIconBtn"
            onClick={() => void fetchOrdersPage(0, "prepend", true)}
            title="Yangilash"
            aria-label="Lentani yangilash"
            disabled={loadingInitial}
          >
            ↻
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              className="adminStreamTextBtn"
              onClick={handleMarkAllRead}
            >
              Hammasini o‘qish
            </button>
          )}

          {mode === "drawer" && (
            <button
              type="button"
              className="adminStreamCloseBtn"
              onClick={onClose}
              aria-label="Yopish"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Controls: Search & Filter Tabs */}
      <div className="adminStreamControls">
        <div className="adminStreamSearchWrap">
          <span className="adminStreamSearchIcon" aria-hidden="true">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buyurtma №, mijoz, telefon..."
            aria-label="Bildirishnomalardan qidirish"
          />
          {searchQuery && (
            <button
              type="button"
              className="adminStreamClearBtn"
              onClick={() => setSearchQuery("")}
              aria-label="Qidiruvni tozalash"
            >
              ×
            </button>
          )}
        </div>

        <div className="adminStreamFilters" role="tablist" aria-label="Lenta filtrlari">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Barchasi <span className="streamCountNum">{items.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "new"}
            className={filter === "new" ? "active" : ""}
            onClick={() => setFilter("new")}
          >
            Yangi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unread"}
            className={filter === "unread" ? "active" : ""}
            onClick={() => setFilter("unread")}
          >
            O‘qilmagan
            {unreadCount > 0 && <span className="streamUnreadCount">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="adminStreamErrorBanner" role="alert">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => void fetchOrdersPage(items.length ? offset : 0, items.length ? "append" : "prepend", true)}
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Smooth Scrollable Feed */}
      <div className="adminStreamFeedScroll" ref={feedScrollRef}>
        {loadingInitial && items.length === 0 ? (
          <div className="adminStreamSkeletonList" aria-busy="true" aria-label="Yuklanmoqda">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div key={idx} className="adminStreamSkeletonCard">
                <div className="skAvatar" />
                <div className="skBody">
                  <div className="skLine short" />
                  <div className="skLine long" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="adminStreamEmpty">
            <span className="adminStreamEmptyIcon" aria-hidden="true">
              {filter === "unread" ? "✓" : "📭"}
            </span>
            <b>
              {filter === "unread"
                ? "O‘qilmagan bildirishnomalar yo‘q"
                : searchQuery
                ? "Mos buyurtma topilmadi"
                : "Hozircha bildirishnomalar yo‘q"}
            </b>
            <p>
              {filter === "unread"
                ? "Barcha kiruvchi buyurtmalar ko‘rib chiqilgan."
                : "Yangi buyurtma tushishi bilan ushbu lentada avtomatik paydo bo‘ladi."}
            </p>
            {(filter !== "all" || searchQuery) && (
              <button
                type="button"
                className="adminStreamResetBtn"
                onClick={() => {
                  setFilter("all");
                  setSearchQuery("");
                }}
              >
                Barchasini ko‘rsatish
              </button>
            )}
          </div>
        ) : (
          <div className="adminStreamFeedList">
            {filteredItems.map((item) => {
              const initialLetter = (item.customerName || "M").charAt(0).toUpperCase();
              const toneClass = statusToneClass(item.status, item.paymentStatus);
              return (
                <button
                  key={item.streamKey}
                  type="button"
                  className={`adminStreamCard ${!item.read ? "isUnread" : ""} ${
                    item.isRealtimeArrival ? "isRealtimeNew" : ""
                  }`}
                  onClick={() => {
                    markItemRead(item.orderId, item.orderNumber);
                    onSelectOrder(item.rawOrder);
                    if (mode === "drawer") onClose();
                  }}
                >
                  <div className="adminStreamAvatarWrap">
                    {item.avatarUrl || item.firstProductImage ? (
                      <img
                        src={item.avatarUrl || item.firstProductImage}
                        alt={item.customerName}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="adminStreamAvatarLetter">{initialLetter}</span>
                    )}
                    {!item.read && <span className="adminStreamUnreadDot" aria-hidden="true" />}
                  </div>

                  <div className="adminStreamCardBody">
                    <div className="adminStreamCardTop">
                      <div className="adminStreamOrderMeta">
                        <strong className="adminStreamOrderNum">#{item.orderNumber}</strong>
                        <span className="adminStreamCustomerName">{item.customerName}</span>
                      </div>
                      <span className="adminStreamTime">
                        {formatStreamTimestamp(item.createdAt, nowTick)}
                      </span>
                    </div>

                    <div className="adminStreamCardSub">
                      <span className="adminStreamSummary">
                        {item.firstProductTitle}
                        {item.itemsCount > 1 ? ` (+${item.itemsCount - 1})` : ""}
                        {item.paymentMethod ? ` · ${item.paymentMethod}` : ""}
                      </span>
                    </div>

                    <div className="adminStreamCardBottom">
                      <span className={`adminStreamStatusText ${toneClass}`}>
                        {eventLabel(item)}
                      </span>
                      <span className="adminStreamPrice">
                        {formatMoneyUZ(item.total)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Pagination Lazy-Load Sentinel & Footer */}
            <div ref={sentinelRef} className="adminStreamSentinel" aria-hidden={!loadingMore}>
              {loadingMore ? (
                <div className="adminStreamLoadingMore">
                  <span className="streamSpinner" />
                  <span>Keyingi buyurtmalar yuklanmoqda...</span>
                </div>
              ) : hasMore ? (
                <button
                  type="button"
                  className="adminStreamLoadMoreBtn"
                  onClick={() => void fetchOrdersPage(offset, "append", true)}
                >
                  Yana {ADMIN_STREAM_PAGE_SIZE} ta yuklash
                </button>
              ) : items.length > 0 ? (
                <span className="adminStreamEndNote">
                  Barcha so‘nggi buyurtmalar yuklandi ({items.length} ta)
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "inline") {
    return streamContent;
  }

  return (
    <div
      className="drawerShade adminStreamDrawerShade"
      onClick={onClose}
    >
      <aside
        className="drawer adminStreamDrawer"
        onClick={(e) => e.stopPropagation()}
      >
        {streamContent}
      </aside>
    </div>
  );
}

export default RealtimeAdminNotificationStream;
