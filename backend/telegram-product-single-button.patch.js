// Product announcement keyboard policy: one CTA only.
// Import this helper from telegramProductPublisherRuntime.js and use
// buildProductAnnouncementKeyboard(url) for every new-product announcement.
function buildProductAnnouncementKeyboard(url) {
  return {
    inline_keyboard: [[
      { text: '🛍️ Online Market', web_app: { url } }
    ]]
  };
}

module.exports = { buildProductAnnouncementKeyboard };
