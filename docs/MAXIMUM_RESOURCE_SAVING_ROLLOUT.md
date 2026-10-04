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

## Rollback
- Revert the runtime flag or disable the low-resource environment setting.
- No database migration or destructive cleanup is part of this plan.
