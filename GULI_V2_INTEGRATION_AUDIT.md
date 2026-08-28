# GULI V2 integration audit

## Scope

Compared the uploaded `guli-app.zip` scaffold with the existing production repository before merging any V2 code.

## Decision

Do **not** replace the production backend or Supabase schema with the ZIP migrations yet. The ZIP defines a new normalized commerce model (`profiles`, `categories`, `product_variants`, `orders`, `order_items`, etc.) while the current production repository still contains legacy-compatible tables, RPCs and runtime patches. A blind migration would risk checkout, admin and existing orders.

## Safe Stage 1 changes in this branch

1. Public `/api/categories` now merges the live `categories/category_images` source with the older `category_settings` source.
2. Existing uploaded category images are converted to a correct public Storage URL even when older records contain the bucket name twice in `storage_path`.
3. Category API responses are explicitly `Cache-Control: no-store`.
4. Stage 1 storefront runtime now renders category labels **below** the image instead of over the image.
5. Bottom navigation now uses elevated emoji/sticker-style controls with a dedicated active state and preserves the live cart badge.
6. Category media refresh remains no-cache on focus/visibility changes.

## ZIP features to integrate later, not blindly replace

- React Router + React Query page architecture
- UZ/RU/EN localization
- Theme and Colour Palette provider
- Manual card payment receipt workflow
- Admin order/payment review UI
- Telegram bot skeleton
- Normalized profile/cart/favorites/address models
- Automated tests

## Important incompatibilities found

- ZIP frontend expects `/api/home`, `/api/cart`, `/api/favorites`, `/api/profile`, `/api/payment-methods`, `/api/payments/receipt` and normalized response shapes. Current production frontend/backend use a different legacy-compatible API contract.
- ZIP SQL uses UUID product/variant IDs and `price_cents`; current production checkout has a UUID/bigint-safe `create_secure_order` path and six-digit `product_code` compatibility that must be preserved.
- ZIP uses `payment_receipts` and an enum status machine that cannot be applied to the current database without a controlled migration.
- ZIP's 3D sticker icons are still placeholders, so they are not treated as final visual assets.

## Production safety rule

Only the safe Stage 1 runtime/media fixes are proposed for merge first. V2 application and database migration must be introduced incrementally behind the existing production contracts, with CI and production smoke verification after each step.
