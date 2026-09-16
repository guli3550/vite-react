// Compatibility shim only.
// Google OAuth is not part of GULI's canonical authentication architecture.
// The Telegram-only auth boundary blocks this legacy route at the application edge.
// Keep the file so existing preload references remain startup-safe during migration.
module.exports = {};
