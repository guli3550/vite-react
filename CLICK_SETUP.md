# GULI + Click SHOP API

GULI now has a production-oriented Click checkout adapter. Card data is entered on Click's hosted payment page; GULI does not receive or store card number, expiry or CVV.

## What is implemented

- Checkout payment selector: Naqd / Click / Payme (coming soon) / Bank kartasi (coming soon).
- Click payment link creation from GULI checkout.
- Server-side order total calculation from current product prices and stock.
- Promo-code validation is repeated on the server.
- Click `prepare` and `complete` callbacks.
- MD5 signature verification with the different prepare/complete formulas.
- 32-bit-safe deterministic `merchant_prepare_id`.
- Amount verification and duplicate-payment protection.
- Payment states: `click_pending`, `click_paid`, `click_failed`.
- Existing `/api/orders` UUID=BIGINT RPC failure is bypassed by a direct server-side order insert path.

## Render environment variables

Set these in the backend service, never in Vercel/frontend code:

- `CLICK_SERVICE_ID`
- `CLICK_MERCHANT_ID`
- `CLICK_SECRET_KEY`
- `FRONTEND_URL`
- `CLICK_RETURN_URL` (optional; defaults to `${FRONTEND_URL}/?payment=click`)

Do not commit real values to GitHub.

## Click cabinet configuration

The Click merchant account must be configured with these HTTPS callbacks:

- Prepare: `https://YOUR-BACKEND-DOMAIN/api/payments/click/prepare`
- Complete: `https://YOUR-BACKEND-DOMAIN/api/payments/click/complete`

Click's SHOP API uses form-encoded callbacks and MD5 signatures. Prepare and Complete use different signature inputs; the backend implements both.

## Current limitation

The code is ready for merchant credentials, but a real Click transaction cannot be completed until GULI has a Click merchant/service account and the corresponding `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, and `CLICK_SECRET_KEY` are configured in Render. No payment provider credentials are hard-coded.

## Safety

Never add card number, expiry or CVV fields to GULI's backend or Supabase. Click's hosted checkout should remain the payment-data boundary.
