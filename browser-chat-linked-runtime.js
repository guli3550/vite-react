(() => {
  const API = 'https://guli-lingerie-api.onrender.com';
  const ID_KEY = 'guli_chat_linked_telegram_id';
  const TOKEN_KEY = 'guli_chat_linked_token';
  const STORAGE_KEY = 'guli_chat_messages';
  const linkedId = String(localStorage.getItem(ID_KEY) || '').trim();
  const linkedToken = String(localStorage.getItem(TOKEN_KEY) || '').trim();
  const telegramInitData = window.Telegram?.WebApp?.initData || '';
  if (!/^\d+$/.test(linkedId) || !linkedToken || telegramInitData) return;

  function normalizeLocalMessages() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const messages = JSON.parse(raw);
      if (!Array.isArray(messages)) return;
      let changed = false;
      const normalized = messages.map(message => {
        if (message && String(message.userId ?? '') === linkedId) {
          changed = true;
          return { ...message, userId: 'guest-user' };
        }
        return message;
      });
      if (!changed) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('guli_chat_updated', { detail: normalized }));
    } catch {}
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(API) && url.endsWith('/api/chat/messages') && String(init?.method || 'GET').toUpperCase() === 'POST' && typeof init?.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        body.telegram_id = linkedId;
        init = { ...init, body: JSON.stringify(body) };
      } catch {}
    }
    return originalFetch(input, init);
  };

  const sync = () => normalizeLocalMessages();
  window.addEventListener('guli_chat_updated', sync);
  setTimeout(sync, 50);
  setTimeout(sync, 300);
  setTimeout(sync, 1000);
})();
