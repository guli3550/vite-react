// Compatibility shim only.
// The legacy customer runtime (email/password, Google OAuth, Supabase Auth
// customer identity) is no longer part of the active GULI architecture.
// Canonical customer profile/sync routes now live in canonicalCustomerProfileRuntime.js
// and use Telegram-verified identity + the canonical public.users table.
// Keep this file so older deployment references remain startup-safe during migration.
module.exports = {};
