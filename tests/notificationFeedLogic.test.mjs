import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationFeed,
  formatNotificationTimestamp,
  getNotifLocaleStrings,
  getNotificationTimeGroup,
  hasActivePendingOrders,
  shouldPollOrders,
} from "../src/utils/notificationFeed.ts";

test("NotificationFeed: sorts newest first before deduplication so latest order transition always wins", () => {
  const feed = buildNotificationFeed({
    chatMessages: [],
    orderNotifications: [
      {
        id: "order-state-101-old",
        orderNumber: "GULI-101",
        status: "Tayyorlanmoqda",
        paymentStatus: "receipt_uploaded",
        previousStatus: "Qabul qilindi",
        timestamp: "2026-11-23T08:00:00.000Z",
        read: true,
      },
      {
        id: "order-state-101-new",
        orderNumber: "GULI-101",
        status: "Yo‘lda",
        paymentStatus: "verified",
        previousStatus: "Tayyorlanmoqda",
        previousPaymentStatus: "receipt_uploaded",
        timestamp: "2026-11-23T10:30:00.000Z",
        read: false,
      },
    ],
    dismissedIds: [],
    language: "uz",
    myOrdersLabel: "Buyurtmalarim",
    viewChatLabel: "Chatni ochish",
  });

  assert.equal(feed.length, 1);
  assert.equal(feed[0].id, "order-state-101-new");
  assert.equal(feed[0].read, false);
  assert.match(feed[0].text, /Yo‘lda/);
  assert.match(feed[0].text, /To‘lov tasdiqlandi/);
});

test("NotificationFeed: filters dismissed items and separates support chat messages vs order messages", () => {
  const feed = buildNotificationFeed({
    chatMessages: [
      {
        id: "welcome-msg-1",
        sender: "admin",
        text: "Welcome",
        timestamp: "2026-11-23T07:00:00.000Z",
        read: true,
      },
      {
        id: "m1",
        sender: "admin",
        text: "Buyurtma №55 yo‘lda",
        timestamp: "2026-11-23T09:00:00.000Z",
        read: false,
      },
      {
        id: "m2",
        sender: "admin",
        text: "Assalomu alaykum, razmerlar mavjud",
        timestamp: "2026-11-23T10:00:00.000Z",
        read: false,
      },
      {
        id: "m3",
        sender: "admin",
        text: "Yashirilgan xabar",
        timestamp: "2026-11-23T11:00:00.000Z",
        read: false,
      },
    ],
    orderNotifications: [],
    dismissedIds: ["chat-m3"],
    language: "uz",
    myOrdersLabel: "Buyurtmalarim",
    viewChatLabel: "Chatni ochish",
  });

  assert.equal(feed.length, 2);
  assert.equal(feed[0].id, "chat-m2");
  assert.equal(feed[0].category, "messages");
  assert.equal(feed[1].id, "chat-m1");
  assert.equal(feed[1].category, "orders");
});

test("NotificationFeed: localizes strings cleanly across uz, ru, en", () => {
  assert.equal(getNotifLocaleStrings("uz").tabUnread, "Yangi");
  assert.equal(getNotifLocaleStrings("ru").orderStatusTitle, "Статус заказа");
  assert.equal(getNotifLocaleStrings("en").clearHistory, "Clear feed");
});

test("NotificationFeed: formats relative timestamps and groups today / yesterday / earlier", () => {
  const now = new Date("2026-11-23T12:00:00.000Z").getTime();
  assert.equal(
    formatNotificationTimestamp("2026-11-23T11:59:40.000Z", "uz", now),
    "Hozirgina",
  );
  assert.equal(
    formatNotificationTimestamp("2026-11-23T11:45:00.000Z", "en", now),
    "15m ago",
  );
  assert.equal(getNotificationTimeGroup("2026-11-23T09:00:00.000Z", now), "today");
  assert.equal(getNotificationTimeGroup("2026-11-22T15:00:00.000Z", now), "yesterday");
  assert.equal(getNotificationTimeGroup("2026-11-10T10:00:00.000Z", now), "earlier");
});

test("Orders polling rate-limit guard: avoids redundant fetches when Realtime is healthy or cooldown active", () => {
  const baseNow = 1_000_000;

  // Hidden tab never polls in background
  assert.equal(
    shouldPollOrders({
      now: baseNow,
      lastPollAt: 0,
      realtimeConnected: false,
      hasPendingOrders: true,
      visibilityState: "hidden",
    }),
    false,
  );

  // Realtime healthy with no active pending orders backs off until 180s
  assert.equal(
    shouldPollOrders({
      now: baseNow,
      lastPollAt: baseNow - 60_000,
      realtimeConnected: true,
      hasPendingOrders: false,
      visibilityState: "visible",
    }),
    false,
  );
  assert.equal(
    shouldPollOrders({
      now: baseNow,
      lastPollAt: baseNow - 190_000,
      realtimeConnected: true,
      hasPendingOrders: false,
      visibilityState: "visible",
    }),
    true,
  );

  // Realtime healthy with active pending order backs off until 90s
  assert.equal(
    shouldPollOrders({
      now: baseNow,
      lastPollAt: baseNow - 45_000,
      realtimeConnected: true,
      hasPendingOrders: true,
      visibilityState: "visible",
    }),
    false,
  );

  // Explicit navigation/visibility force respects cooldown
  assert.equal(
    shouldPollOrders({
      now: baseNow,
      lastPollAt: baseNow - 5_000,
      realtimeConnected: true,
      hasPendingOrders: true,
      force: true,
      minForceGapMs: 10_000,
    }),
    false,
  );
  assert.equal(
    shouldPollOrders({
      now: baseNow,
      lastPollAt: baseNow - 12_000,
      realtimeConnected: true,
      hasPendingOrders: true,
      force: true,
      minForceGapMs: 10_000,
    }),
    true,
  );
});

test("hasActivePendingOrders: detects active vs terminal orders accurately", () => {
  assert.equal(hasActivePendingOrders([]), false);
  assert.equal(
    hasActivePendingOrders([
      { status: "Yetkazildi", payment_status: "verified" },
      { status: "Bekor qilindi", payment_status: "rejected" },
    ]),
    false,
  );
  assert.equal(
    hasActivePendingOrders([
      { status: "Yetkazildi", payment_status: "verified" },
      { status: "Yo‘lda", payment_status: "verified" },
    ]),
    true,
  );
});
