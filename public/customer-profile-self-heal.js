// Browser profile self-heal: refresh the authenticated customer's canonical
// Telegram identity from the GULI JWT session. Never merge identity fields
// from stale localStorage when the server has a newer canonical value.
(function () {
  'use strict';
  var API = (window.__GULI_API_URL__ || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  var token = localStorage.getItem('guli_access_token');
  if (!token) return;

  fetch(API + '/api/v1/auth/me', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
    cache: 'no-store'
  }).then(function (r) {
    if (!r.ok) throw new Error('profile ' + r.status);
    return r.json();
  }).then(function (j) {
    var next = j && j.success && j.data && j.data.user;
    if (!next || !next.id) return;

    var current = null;
    try { current = JSON.parse(localStorage.getItem('guli_auth_user') || 'null'); } catch (_) {}
    current = current || {};

    var canonicalUsername = next.telegram_username || next.username || null;
    var canonicalAvatar = next.telegram_photo_url || next.avatar_url || null;
    var canonicalName = next.full_name || null;
    var canonicalPhone = next.phone_number || null;
    var canonicalTelegramId = next.telegram_id || null;

    var user = {
      id: String(next.id),
      provider: 'telegram',
      phone: canonicalPhone,
      username: canonicalUsername,
      full_name: canonicalName,
      avatar_url: canonicalAvatar,
      telegram_id: canonicalTelegramId,
      telegram_username: canonicalUsername,
      telegram_photo_url: canonicalAvatar,
      email: canonicalUsername ? ('@' + String(canonicalUsername).replace(/^@+/, '')) : null
    };

    var identityChanged = String(current.id || '') !== user.id ||
      String(current.telegram_id || '') !== String(user.telegram_id || '') ||
      String(current.username || '') !== String(user.username || '') ||
      String(current.avatar_url || '') !== String(user.avatar_url || '') ||
      String(current.full_name || '') !== String(user.full_name || '');

    localStorage.setItem('guli_auth_user', JSON.stringify(user));

    // All persistent display state is scoped to the canonical user id.
    if (user.full_name) localStorage.setItem('guli_name_' + user.id, user.full_name);
    if (user.phone) localStorage.setItem('guli_phone_' + user.id, user.phone);
    if (user.avatar_url) localStorage.setItem('guli_avatar_' + user.id, user.avatar_url);

    // Remove legacy global identity caches that could leak another customer's data.
    ['guli_custom_avatar', 'guli_avatar_url', 'guli_customer_photo', 'guli_user_photo', 'guli_telegram_user'].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_) {}
    });

    if (identityChanged) window.location.reload();
  }).catch(function () {});
})();
