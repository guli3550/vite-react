# GULI PRODUCTION AUDIT v1.2 — Customer Identity, Orders, Telegram Admin Bot & Payment Notification

Date: 2026-09-13
Branch: `main`
Current main commit: `67a70ae401361ae9b37c7881fc2a0def8dbc7b86`
Canonical frontend: `https://vite-react-seven-inky-10.vercel.app`
Backend: `https://guli-lingerie-api.onrender.com`
Database/Auth: Supabase project `qttwufydrvdwmhxcpgjb`

> **Purpose of this revision:** record all work performed on 2026-09-13 and preserve the real production-audit status. The previous v1.1 launch verdict is historical; it is not reused as today's readiness verdict because today's end-to-end Telegram/browser tests exposed unresolved defects.

---

## 1. Historical v1.1 Baseline

The v1.1 audit established the following baseline:

- Free delivery threshold: free only above 600,000 UZS; standard 30,000 UZS below the threshold.
- Delivery timelines: Qo‘qon 1 working day; Tashkent/Andijon/Namangan/Farg‘ona 3 working days; other specified regions 5 working days.
- Payment policy: Uzcard/Humo bank-card transfer.
- Receipt review SLA: 2 hours with customer notification when delayed.
- Customer-facing profile menu uses `GULI Chat`.
- Hero banners and product-detail image ratios were standardized.
- Customer UI no longer exposes the admin portal.
- Product cards were normalized across Home/Catalog.
- Real reviews and customer profile photos were connected to persistence.
- Registration/Login visual hierarchy was unified.
- Production `customers` identity model and `orders.auth_user_id` bridge were established.
- Browser authenticated checkout/receipt routes were owner-scoped.
- Telegram/browser customer identity was unified around Supabase + verified Telegram identity.

The original v1.1 document remains the historical record; this file now adds the 2026-09-13 audit and supersedes its launch-readiness conclusion for the current state.

---

# 2. 2026-09-13 — Complete Work Audit

## 2.1 Browser customer authentication and order-history work

### Implemented

1. **Live Supabase session bridge for customer order/payment APIs**
   - Browser protected customer requests now prefer the live Supabase access token.
   - Telegram Mini App requests continue to prefer verified Telegram `initData`.
   - Stale legacy token mirrors are used only as a last fallback.
   - Customer order/payment requests are forced to `cache: no-store`.

2. **Browser session bootstrap before React order loading**
   - Added synchronous discovery of the Supabase access token from the persisted auth session.
   - Mirrors the active token for legacy order code compatibility.
   - Reload guard prevents an infinite bootstrap loop.

3. **Authenticated customer order-history fixes**
   - Customer order history is loaded with the live Supabase session instead of depending on Telegram identity or a stale legacy token.
   - Protected order routes are explicitly bridged to the active customer identity.

4. **Canonical order-number normalization**
   - Customer order cards normalize `order_number` as the display identifier.
   - UUID `id` values are no longer allowed to replace a real `GULI-######` order number when one exists.
   - Browser-side stale local order caches are normalized as well.

5. **Payment-method normalization in customer order responses**
   - Card orders with a receipt/payment state are prevented from being rendered as `Naqd` by the browser normalization layer.
   - `payment_status` and real order status are preserved.

6. **Browser payment-status synchronization**
   - Supabase-authenticated browsers can now discover the active access token for status polling.
   - Verified/rejected/receipt-uploaded changes can produce in-app notifications.
   - Customer-facing notification records are deduplicated by order/payment state.

### Audit result

- **Architecture:** implemented.
- **Code path:** present on `main`.
- **End-to-end browser result:** **NOT YET PASS**. Earlier production screenshots still showed `Buyurtmalarim = 0` in the browser while Telegram/admin views contained the order. The fix therefore requires a fresh deployed-build test before being marked production-ready.

---

## 2.2 Telegram customer/order identity work

### Implemented

1. Canonical Web App URL enforcement was added for the Telegram customer bot menu.
2. Old/stale Vercel aliases are no longer intended to be the canonical menu target.
3. Customer order display was changed to use `GULI-######` order numbers instead of UUIDs.
4. Browser/Telegram order synchronization paths were aligned around the same order identity.
5. Payment/status notification code now derives the canonical `order_number` before constructing customer messages.

### Audit result

- **Canonical order identifier:** code-level fix present.
- **Fresh Telegram Web App verification:** required after the latest deployment/cache refresh.

---

## 2.3 Telegram admin bot — new single-message order workflow

### Implemented

1. **Dedicated admin bot integration** using a separate admin-bot token environment variable; the secret itself is intentionally not recorded in this audit.
2. **Admin chat discovery/persistence** through `telegram_admin_bot_chats`.
3. **Durable admin-bot event records** through `telegram_admin_bot_events`.
4. **Durable order-message mapping** through `telegram_admin_bot_order_messages`.
5. **One durable admin order message per admin chat/order** with message ID persisted in Supabase.
6. **Order information composition** includes customer/order/payment/server/address information.
7. **Product media + customer receipt media** are assembled for the admin order presentation.
8. **Approve / reject inline buttons** are wired to the same production `admin_payment_decision` RPC used by the admin payment flow.
9. **Approval/rejection edits the existing Telegram message in place** instead of deleting it.
10. **Customer Telegram payment-status notification** is triggered after an admin decision.
11. **Online-chat admin notification** includes customer context and message information.
12. **Duplicate-notification hardening** was added for admin chat and customer payment notifications.
13. **Telegram media-edit repair** was added for Telegram `attach://` media references.
14. **Payment receipt history** was made durable so receipt information survives notification-worker restarts.
15. **Order totals/payment display normalization** was added to reduce inconsistent admin/customer representations.

### Important implementation note

Telegram does not provide inline buttons attached to a multi-message album in the same way as a single photo message. The current design therefore uses a single composed order image/message so the order can carry inline Approve/Reject controls. This is intentional.

### Audit result

- **Order notification:** implemented.
- **Durable message identity:** implemented.
- **Approval RPC:** implemented.
- **Customer notification:** implemented in code.
- **End-to-end Telegram approval:** **FAILED in the observed production test** with `Bad Request: can't parse InputMedia: media not found`.
- **Duplicate messages:** duplicate behavior was observed before the latest hardening and v2 changes. New dedupe layers are present, but a fresh order must be tested after the latest Render deployment.

Therefore this module remains **YELLOW / verification required**, not green.

---

## 2.4 Telegram admin bot duplicate-message and notification hardening

Today's work added several layers because the original worker stack had multiple notification paths:

- scoped chat dedupe by admin chat + minute + message hash;
- JSON notification dedupe;
- durable event claim/hotfix;
- customer payment notice dedupe;
- hardening wrapper loaded before the admin-bot worker;
- customer status notifier activation and subsequent disabling of the duplicate notifier path;
- v2 admin bridge activation;
- durable receipt-history storage.

### Current audit conclusion

The repository now explicitly contains defensive dedupe layers, but the final production state must be verified with **one newly created order**. Historical duplicate Telegram messages are not automatically proof that the latest worker is still duplicating; they can be remnants of earlier workers/deployments.

---

## 2.5 Admin payment/status → customer notification bridge

### Implemented

- Admin payment decisions are connected to customer Telegram notification handling.
- Admin order-status changes are connected to customer status notification handling.
- Notification events use durable Supabase event keys to avoid repeated sends.
- Browser notification synchronization was also updated to use the live Supabase session.
- Duplicate customer status notifier activation was subsequently disabled after identifying overlapping notification paths.

### Audit result

- **Code path:** implemented.
- **Observed behavior:** some later order-status notifications arrived, while payment approval propagation was still inconsistent in the earlier test.
- **Status:** **YELLOW — fresh end-to-end test required.**

---

## 2.6 Production database / identity infrastructure

Today's work continues to use the production identity model created in the previous audit:

- `public.customers` contains the canonical customer identity.
- `orders.auth_user_id` binds authenticated orders to Supabase Auth users.
- RLS is enabled for protected customer/order access.
- Browser card checkout is authenticated and owner-scoped.
- Receipt upload is owner-scoped and stored in private receipt storage.
- Telegram identity remains separately verified through Telegram init data.

### Audit result

- **Database identity architecture:** GREEN at code/schema level.
- **Historical-order backfill:** not performed blindly; orders are not linked solely from unverified matching data.

---

# 3. Today's Commit Register

The following 2026-09-13 commits were found on `main` during this audit, from the browser/auth fixes through the latest Telegram/admin-bot work:

| Time (UTC) | Commit | Work |
|---|---|---|
| 02:45 | `2f5f2d3` | Sync browser payment notifications from Supabase session |
| 02:45 | `31d6924` | Repair Telegram order media and customer payment notifications |
| 02:46 | `6c31da5` | Preload order-media repair worker |
| 02:46 | `8b39179` | Dedupe customer notices after bot decisions |
| 02:46 | `53a2bae` | Bust browser auth/payment sync script cache |
| 02:50 | `b03f401` | Expose active Supabase session to browser payment runtime |
| 02:51 | `e04371b` | Harden browser card-session token discovery |
| 02:51 | `70bc86f` | Refresh browser payment runtime cache |
| 03:34 | `7d95c5c` | Attach live Supabase session to customer order history |
| 03:35 | `f267279` | Load customer order history with live session |
| 03:46 | `076d579` | Force live Supabase identity for customer orders/card checkout |
| 03:47 | `527d46e` | Force live session for customer order APIs |
| 03:47 | `e3adf38` | Refresh customer order session bridge/cache |
| 04:14 | `84cc35a` | Bridge live Supabase session before customer order guard |
| 04:14 | `acfcfb8` | Initialize browser Supabase order session before app mount |
| 04:16 | `06d2a61` | Show canonical order number in browser payment notices |
| 04:26 | `42f6cd3` | Bootstrap browser order session before React loads |
| 04:27 | `f16714f` | Unify admin order messages and online-chat alerts |
| 04:28 | `017f802` | Force canonical Telegram Web App menu URL |
| 04:28 | `7ce7f0b` | Activate final admin bot and canonical Web App |
| 04:46 | `41e208a` | Stop duplicate admin chat notifications |
| 04:47 | `fa6c9ed` | Activate durable notification-claim hotfix |
| 04:47 | `258ec88` | Keep customer order numbers canonical |
| 04:47 | `08e32a8` | Bootstrap auth and canonicalize order cards |
| 05:12 | `52eb8bb` | Harden admin-bot media edits and chat dedupe |
| 05:12 | `9a38472` | Dedupe JSON chat notifications |
| 05:12 | `8fd60ff` | Scope chat dedupe by admin chat and minute |
| 05:12 | `5bb0604` | Normalize authenticated customer order responses |
| 05:13 | `a8be14b` | Normalize authenticated order responses |
| 05:13 | `0ab5a18` | Activate admin-bot hardening layer |
| 05:13 | `1678b67` | Notify customers on admin payment/order-status changes |
| 05:13 | `e91d0a6` | Activate customer status notifier |
| 05:14 | `316b3d8` | Load Telegram bot hardening before worker |
| 05:14 | `7570e6c` | Dedupe customer payment notices |
| 05:15 | `d34263b` | Trigger production deployment with final fixes |
| 09:56 | `70e2dc8` | Add durable payment receipt history |
| 09:57 | `92f9e20` | Add Telegram admin bot v2 album and receipt-history flow |
| 09:57 | `94f1c43` | Switch admin Telegram bridge to v2 album and receipt history |
| 09:57 | `457888a` | Normalize admin payment and order totals consistently |
| 09:57 | `67a70ae` | Disable duplicate customer status notifier |

**Current `main` HEAD:** `67a70ae401361ae9b37c7881fc2a0def8dbc7b86`. The GitHub branch currently points to this commit.

---

# 4. Files / Areas Touched by Today's Work

The audit scope includes, among others:

### Browser / customer runtime

- `public/customer-orders-session-bridge-v2.js`
- `public/customer-orders-bootstrap-fix.js`
- `public/customer-orders-hard-fix.js`
- `public/order-canonical-runtime.js`
- `public/browser-payment-status-sync.js`
- `public/browser-chat-linked-runtime.js`
- `index.html`
- customer order/profile/auth integration paths in `src/`

### Telegram / backend

- `backend/telegramAdminBotFinalPatch.js`
- `backend/telegramAdminBotHardeningPatch.js`
- `backend/telegramAdminBotClaimHotfix.js`
- `backend/telegramAdminBotSingleMessagePatch.js`
- `backend/telegramAdminBotConsolidatedPatch.js`
- `backend/telegramAdminBotRepairPatch.js`
- `backend/telegramChatBridgePatch.js`
- `backend/telegramCanonicalWebAppPatch.js`
- `backend/customerTelegramStatusNotifierPatch.js`
- `backend/paymentTelegramNotificationPatch.js`
- `backend/customerAuthRuntime.js`
- backend package/startup preload ordering

### Supabase / persistence

- `supabase/migrations/20260912_telegram_admin_bot_chats.sql`
- `supabase/migrations/20260912_telegram_admin_bot_events.sql`
- `supabase/migrations/20260912_telegram_admin_bot_order_messages.sql`
- durable receipt-history persistence
- customer/order identity bridge from the previous audit

---

# 5. Production Test Evidence Recorded on 2026-09-13

The following issues were directly observed during the user's production tests and are retained as audit evidence rather than being marked as solved prematurely:

1. **Admin Telegram bot:** the same order was delivered twice in earlier tests.
2. **Admin Telegram approval:** pressing Approve produced `Bad Request: can't parse InputMedia: media not found`.
3. **Browser customer Web App:** `Buyurtmalarim` showed 0 while the admin/Telegram side had the order.
4. **Telegram customer Web App:** one earlier build displayed a UUID after `№` instead of the canonical `GULI-######` identifier; later builds showed canonical `GULI-...`, so this requires a final cache/deployment verification.
5. **Payment display:** a card order was rendered as `Naqd` in a customer-facing order view despite backend card/payment state; normalization code was added.
6. **Customer payment notification:** payment approval propagation was inconsistent in the earlier test, while a later order-status notification path did work. This remains an end-to-end verification item.

These observations are intentionally kept in the audit because a code commit alone does not equal a production PASS.

---

# 6. Security Audit

- Admin signed-token verification must remain enabled.
- Unsigned admin tokens must never be accepted.
- Supabase Auth remains the source of truth for browser customer authentication.
- No plaintext customer passwords are stored by these fixes.
- Protected customer order/payment endpoints require verified identity.
- Receipt access remains owner/admin scoped.
- Telegram admin-bot token values are not written into source code or this audit.
- The admin bot token supplied during setup should be rotated after setup verification because it was exposed during the configuration process.
- Legacy/localStorage identity data must not override a valid live Supabase identity.

---

# 7. Current Readiness Verdict — 2026-09-13

## 🟡 VERDICT: NOT YET PRODUCTION-READY — FINAL E2E VERIFICATION REQUIRED

This is **not** a rollback of the implemented fixes. It is a truthful audit state: the repository contains the required fixes, but the observed production failures mean the complete customer → order → receipt → admin Telegram → approval → customer notification → customer order-history chain has not yet passed one clean end-to-end test after the latest deployment.

### PASS at code/schema level

- Supabase customer identity bridge
- Authenticated browser order API bridge
- Canonical `GULI-######` order identity normalization
- Durable admin Telegram event/message storage
- Admin payment decision RPC integration
- Duplicate-notification hardening layers
- Receipt-history persistence
- Canonical Telegram Web App URL enforcement

### OPEN / MUST VERIFY

- Admin Telegram Approve must edit the existing message without `InputMedia media not found`.
- One new order must produce exactly one new admin order notification.
- Product + receipt presentation must be correct and tied to the correct order.
- Customer must receive payment verification/rejection status after admin action.
- Customer Web App `Buyurtmalarim` must show the authenticated browser user's own orders.
- Customer Web App must show `GULI-######`, never a UUID in the order-number position.
- Card payment must not be shown as `Naqd` when backend state is `card_manual`.
- Order status changes must propagate without duplicate notifications.

---

# 8. Final Test Sequence for Closing v1.2

1. Deploy current `main` to Render and Vercel.
2. Open a fresh canonical Telegram Web App session; close/reopen the Mini App to remove stale cache.
3. Log in to the browser Web App with the same Supabase customer identity.
4. Create exactly **one** new card order and upload exactly **one** real receipt.
5. Confirm the browser customer sees the new order under `Buyurtmalarim`.
6. Confirm Telegram customer sees the same `GULI-######` number.
7. Confirm admin Telegram receives exactly **one** order message.
8. Confirm product image and receipt are associated with the same order and displayed correctly.
9. Press **Approve** in the Telegram admin bot.
10. Confirm the existing message is edited in place to approved state and does not disappear.
11. Confirm the database/admin panel state is `payment_status=verified` and `status=Qabul qilindi`.
12. Confirm customer Telegram/Web App receives the payment confirmation.
13. Change order status to `Tayyorlanmoqda` and confirm exactly one customer status notification.
14. Confirm browser/Telegram customer order history still shows the same `GULI-######` order and correct payment method.
15. Repeat the test only after a clean deployment if any step fails; do not mark the audit green from source-code inspection alone.

---

## 9. Audit Closure Rule

**v1.2 can be changed to GREEN only after the complete test sequence in §8 passes on the deployed production build.**

Until then, the correct state is **YELLOW / verification required**.
