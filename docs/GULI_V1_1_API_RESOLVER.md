# V1.1 Canonical API Routing

The frontend/admin runtime loads the canonical API configuration and Telegram auth fetch bridge before application code.

Target: Vercel -> Cloudflare Gateway -> Render -> Supabase.

Protected order/auth writes remain Gateway-only. Public catalog/geocode GET requests retain the controlled Render fallback implemented by the auth runtime.
