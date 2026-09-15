// GULI unified customer identity bridge.
// Telegram: identity is derived from signed WebApp initData (no registration).
// Browser: identity is the canonical GULI JWT user, including Telegram profile data.
(() => {
  'use strict';
  if (window.__GULI_UNIFIED_IDENTITY_RUNTIME__) return;
  window.__GULI_UNIFIED_IDENTITY_RUNTIME__ = true;

  const nativeFetch = window.fetch.bind(window);
  const apiOrder = (url) => /\/api\/(customer\/orders|orders|auth\/orders)(?:[/?]|$)/i.test(String(url || ''));

  function supabaseToken() {
    const direct = String(localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('guli_supabase_auth_token');
      const j = raw ? JSON.parse(raw) : null;
      return String(j?.access_token || j?.currentSession?.access_token || j?.session?.access_token || j?.data?.session?.access_token || '').trim();
    } catch { return ''; }
  }

  function identityHeaders(init) {
    const h = new Headers((init && init.headers) || {});
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      h.set('X-Telegram-Init-Data', tg.initData);
      h.delete('Authorization');
    } else {
      const token = supabaseToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
    }
    return h;
  }

  window.fetch = async (input, init) => {
    if (!apiOrder(typeof input === 'string' ? input : input?.url)) return nativeFetch(input, init);
    const options = Object.assign({}, init || {});
    options.headers = identityHeaders(options);
    options.cache = 'no-store';
    return nativeFetch(input, options);
  };

  // Chat avatar bridge: the canonical auth exchange stores Telegram avatar_url
  // in guli_auth_user. OnlineChatView may receive only the Telegram WebApp user
  // object in browser mode, so hydrate the rendered customer avatar from the
  // canonical user record. This is DOM-only and does not change authorization.
  function canonicalAvatar() {
    try {
      const raw = localStorage.getItem('guli_auth_user');
      const user = raw ? JSON.parse(raw) : null;
      return String(user?.avatar_url || '').trim();
    } catch { return ''; }
  }

  function hydrateChatAvatars() {
    const avatar = canonicalAvatar();
    if (!avatar) return;
    document.querySelectorAll('.bubbleAvatar.userAvatar').forEach((node) => {
      const box = node;
      let img = box.querySelector('img');
      if (!img) {
        box.textContent = '';
        img = document.createElement('img');
        img.alt = 'Profile';
        box.appendChild(img);
      }
      if (img.getAttribute('src') !== avatar) img.setAttribute('src', avatar);
    });
  }

  const observer = new MutationObserver(hydrateChatAvatars);
  const startAvatarBridge = () => {
    hydrateChatAvatars();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAvatarBridge, { once: true });
  else startAvatarBridge();
  window.addEventListener('storage', hydrateChatAvatars);
})();
