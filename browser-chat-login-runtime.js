(() => {
  const API = 'https://guli-lingerie-api.onrender.com';
  const LINKED_ID_KEY = 'guli_chat_linked_telegram_id';
  const LINKED_TOKEN_KEY = 'guli_chat_linked_token';
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const authDate = params.get('auth_date');
  const hash = params.get('hash');
  if (!id || !authDate || !hash) return;

  // LoginUrl adds Telegram authorization fields to the browser URL.
  // Exchange them immediately for a short-lived signed backend token.
  const payload = {};
  for (const [key, value] of params.entries()) {
    if (key === 'hash' || key === 'id' || key === 'auth_date' || key === 'first_name' || key === 'last_name' || key === 'username' || key === 'photo_url') {
      payload[key] = value;
    }
  }

  fetch(`${API}/api/chat/browser-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
    .then(response => response.json().then(json => ({ response, json })))
    .then(({ response, json }) => {
      if (!response.ok || !json?.success || !json?.data?.token) {
        console.warn('[GULI browser chat] Telegram login failed:', json?.message || response.status);
        return;
      }
      localStorage.setItem(LINKED_ID_KEY, String(json.data.telegram_id));
      localStorage.setItem(LINKED_TOKEN_KEY, String(json.data.token));
      localStorage.setItem('guli_chat_linked_profile', JSON.stringify({
        id: json.data.telegram_id,
        username: json.data.username || '',
        first_name: json.data.first_name || '',
        last_name: json.data.last_name || '',
        photo_url: json.data.photo_url || '',
      }));
      // Remove only Telegram login fields; preserve product=<code> so the existing
      // product deep-link bridge still opens the exact product.
      const clean = new URL(window.location.href);
      ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].forEach(key => clean.searchParams.delete(key));
      window.history.replaceState(window.history.state, document.title, `${clean.pathname}${clean.search}${clean.hash}`);
      // Restart the realtime bridge so the browser immediately connects as the
      // same positive Telegram ID instead of the old negative guest ID.
      window.location.reload();
    })
    .catch(error => console.warn('[GULI browser chat] Telegram login request failed:', error));
})();
