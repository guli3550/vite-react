// Compatibility shim only.
// Legacy email/password, reset, and Supabase-auth customer sync routes were
// intentionally removed from the active runtime. Telegram-only canonical auth
// is enforced by canonicalAuthOnlyGuard and the canonical Telegram auth flow.
// Keep this file so older deployment references do not fail at startup.
module.exports = {};
