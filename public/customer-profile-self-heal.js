// Canonical browser profile self-heal + UI boundary.
// Telegram is the only customer auth provider; email is never created, used, or displayed.
(function () {
  'use strict';

  var API = (window.__GULI_API_URL__ || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  var token = localStorage.getItem('guli_access_token');
  if (!token) return;

  function cleanUsername(value) {
    var v = String(value || '').trim().replace(/^@+/, '');
    return v || '';
  }

  function canonicalize(next) {
    if (!next || !next.id) return null;
    var username = cleanUsername(next.telegram_username || next.username);
    var avatar = next.telegram_photo_url || next.avatar_url || '';
    return {
      id: String(next.id),
      provider: 'telegram',
      phone: next.phone_number || null,
      username: username || null,
      full_name: next.full_name || null,
      avatar_url: avatar || null,
      telegram_id: next.telegram_id || null,
      telegram_username: username || null,
      telegram_photo_url: avatar || null,
      created_at: next.created_at
    };
  }

  function removeEmailArtifacts(root) {
    if (!root) return;
    root.querySelectorAll('[data-guli-email], .guli-email, [class*="email"]').forEach(function (el) {
      if (el && el.parentElement) el.remove();
    });
    root.querySelectorAll('*').forEach(function (el) {
      var text = String(el.textContent || '').trim();
      if (!text) return;
      if (/^[✉📧]\s*(email|e-mail)?\s*$/i.test(text) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        if (el.parentElement && el.children.length <= 1) el.remove();
      }
    });
  }

  function applyProfileUI(user) {
    var root = document.querySelector('.modernProfilePage');
    if (!root) return;
    var card = root.querySelector('section');
    if (!card) return;

    removeEmailArtifacts(card);

    var name = String(user.full_name || '').trim();
    var username = cleanUsername(user.telegram_username || user.username);
    var phone = String(user.phone || '').trim();
    var avatar = String(user.telegram_photo_url || user.avatar_url || '').trim();

    // Replace the avatar initials with the real Telegram photo when available.
    if (avatar) {
      var candidates = card.querySelectorAll('div');
      for (var i = 0; i < candidates.length; i += 1) {
        var el = candidates[i];
        var text = String(el.textContent || '').trim();
        var rect = el.getBoundingClientRect();
        var radius = String(el.style.borderRadius || '');
        if (text === (name ? name.charAt(0).toUpperCase() : '') && rect.width >= 45 && rect.width <= 120 && rect.height >= 45 && rect.height <= 120 && (radius.indexOf('50%') >= 0 || el.querySelector('img'))) {
          el.innerHTML = '';
          var img = document.createElement('img');
          img.src = avatar;
          img.alt = name || 'Telegram profile';
          img.referrerPolicy = 'no-referrer';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '50%';
          img.style.display = 'block';
          el.appendChild(img);
          break;
        }
      }
    }

    // Add the canonical Telegram username directly below the name.
    if (username && !card.querySelector('.guli-canonical-telegram-username')) {
      var headings = card.querySelectorAll('h1,h2,h3,h4,strong,b');
      var nameNode = null;
      for (var j = 0; j < headings.length; j += 1) {
        if (String(headings[j].textContent || '').trim() === name) { nameNode = headings[j]; break; }
      }
      if (nameNode && nameNode.parentElement) {
        var row = document.createElement('div');
        row.className = 'guli-canonical-telegram-username';
        row.textContent = '@' + username;
        row.style.cssText = 'font-size:13px;line-height:18px;opacity:.72;margin-top:2px;';
        nameNode.parentElement.insertBefore(row, nameNode.nextSibling);
      }
    }

    // Keep phone as the only contact field; never render an email placeholder.
    if (phone) {
      card.querySelectorAll('*').forEach(function (el) {
        if (String(el.textContent || '').trim() === phone) el.setAttribute('data-guli-phone', '1');
      });
    }
  }

  fetch(API + '/api/v1/auth/me', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
    cache: 'no-store'
  }).then(function (r) {
    if (!r.ok) throw new Error('profile ' + r.status);
    return r.json();
  }).then(function (j) {
    var next = j && j.success && j.data && j.data.user;
    var user = canonicalize(next);
    if (!user) return;

    var current = null;
    try { current = JSON.parse(localStorage.getItem('guli_auth_user') || 'null'); } catch (_) {}
    current = current || {};

    var identityChanged = String(current.id || '') !== user.id ||
      String(current.telegram_id || '') !== String(user.telegram_id || '') ||
      String(current.username || '') !== String(user.username || '') ||
      String(current.avatar_url || '') !== String(user.avatar_url || '') ||
      String(current.full_name || '') !== String(user.full_name || '') ||
      String(current.phone || '') !== String(user.phone || '');

    localStorage.setItem('guli_auth_user', JSON.stringify(user));
    if (user.full_name) localStorage.setItem('guli_name_' + user.id, user.full_name);
    if (user.phone) localStorage.setItem('guli_phone_' + user.id, user.phone);
    if (user.avatar_url) localStorage.setItem('guli_avatar_' + user.id, user.avatar_url);

    ['guli_custom_avatar', 'guli_avatar_url', 'guli_customer_photo', 'guli_user_photo', 'guli_telegram_user', 'guli_email_' + user.id].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_) {}
    });

    applyProfileUI(user);
    window.setTimeout(function () { applyProfileUI(user); }, 300);
    window.setTimeout(function () { applyProfileUI(user); }, 1200);

    if (identityChanged) window.location.reload();
  }).catch(function () {});
})();
