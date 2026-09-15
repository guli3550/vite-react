// Browser profile self-heal: refresh the cached auth user from the canonical
// GULI JWT session so stale/partial login payloads cannot leave the profile blank.
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
    var merged = Object.assign({}, current, next, {
      id: String(next.id),
      provider: 'telegram',
      phone: next.phone_number || current.phone || null,
      telegram_id: next.telegram_id || current.telegram_id || null
    });
    var changed = !current.full_name && !!merged.full_name ||
      !current.username && !!merged.username ||
      !current.avatar_url && !!merged.avatar_url ||
      current.telegram_id !== merged.telegram_id;
    localStorage.setItem('guli_auth_user', JSON.stringify(merged));
    if (merged.full_name) localStorage.setItem('guli_name_' + merged.id, merged.full_name);
    if (merged.phone) localStorage.setItem('guli_phone_' + merged.id, merged.phone);
    if (merged.avatar_url && !current.avatar_url) localStorage.setItem('guli_avatar_' + merged.id, merged.avatar_url);
    if (changed) window.location.reload();
  }).catch(function () {});
})();
