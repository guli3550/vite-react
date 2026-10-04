# GULI Market — Maximum Resource Saving rollout

## Safety boundary
This change is staged behind explicit runtime flags. It does not alter production, Supabase, Render, Vercel, data, or billing settings by itself.

## Phase 0 — Baseline and ownership
- Keep checkout, catalog, payment receipt, customer order history, and admin order/payment controls.
- Inventory every chat/realtime producer and every Telegram notification consumer before disabling shared modules.
- Capture Supabase egress and request metrics before/after; request counts are not byte attribution.

## Phase 1 — Telegram admin worker
- Add an explicit kill switch for the admin bot's long-running polling/sync loop.
- Do not remove the module from startup until customer status notifications and admin payment decisions have an approved replacement.
- When disabled, no getUpdates polling, 5-second order scan, event-claim RPC, or admin-bot command setup should run.

## Phase 2 — Support/chat
- Replace in-app realtime support with the approved COL-SENT contact destination.
- Only after confirming the canonical destination and UI entry points, disable chat polling, realtime subscriptions, and media signing/upload paths.
- Preserve order/payment receipts and any chat records unless separately authorized.

## Phase 3 — Read optimization
- Paginate product listing; select only required fields; lazy-load responsive thumbnails.
- Cache stable category/banner responses with explicit invalidation after admin edits.
- Add bounded retry/backoff and prevent retry loops on 402/429.

## Phase 4 — Validation and release
- Test checkout, order persistence, receipt upload/review, customer order history, product/category/banner admin, and Telegram customer flows.
- Verify multi-worker event claims remain safe where event delivery remains enabled.
- Compare measured egress bytes over comparable windows.
- Merge and production deploy only with separate approval.

## Confirmed runtime dependencies (repository inspection)
- `index.html` loads `public/browser-payment-status-sync.js`; it calls `GET /api/customer/orders` after 1.2 seconds and every 5 seconds while a session exists. It creates local payment-status notifications. Do not disable this loop until order-status notification behavior is replaced or intentionally removed.
- The customer-facing Help & Support modal opens the React `chat` page. A profile contact link currently points to `https://t.me/guli_lingerie_admin`; repository search did not find a literal `COL-SENT` destination. Confirm the intended COL-SENT handle/link with the owner before changing links.
- The backend startup preload chain includes `telegramAdminBotProduction.js`. Legacy files such as `telegramAdminBotNotificationPatch.js`, `telegramAdminBotSingleMessagePatch.js`, and `telegramAdminBotFinalPatch.js` appear in the repository, but are not in the current `backend/package.json` preload list. Avoid treating their timers as active production load without runtime evidence.
- The admin worker also owns order/payment actions and customer status-message updates. Its kill switch remains OFF until these flows are independently tested.
- Chat history endpoints currently select full rows and enrich messages; turning off SSE alone will not stop all chat REST/history traffic. The chat kill switch remains OFF pending complete route/UI fallback work.

## Rollback
- Revert the runtime flag or disable the low-resource environment setting.
- No database migration or destructive cleanup is part of this plan.
