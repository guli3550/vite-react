/* GULI admin chat image download runtime (debounced on navigation/chat updates; no 2s polling). */
(() => {
  'use strict';
  const API = String(window.__GULI_API_URL || sessionStorage.getItem('guli_custom_api_url') || '').replace(/\/$/, '');
  const selector = `img[src*="/api/chat/"]`;
  let scheduled = null;

  async function download(url, fileName) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName || 'guli-chat-media';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function scan() {
    if (!location.pathname.toLowerCase().startsWith('/admin')) return;
    document.querySelectorAll(selector).forEach((img) => {
      if (img.dataset.guliDownloadReady === '1') return;
      img.dataset.guliDownloadReady = '1';
      const wrap = img.parentElement;
      if (!wrap || wrap.querySelector('[data-guli-chat-download]')) return;
      const box = document.createElement('div');
      box.dataset.guliChatDownload = '1';
      box.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px;gap:6px';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '⬇️ Yuklab olish';
      button.style.cssText = 'border:1px solid #eadde1;background:#fff;border-radius:10px;padding:6px 10px;font:700 11px system-ui;cursor:pointer';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        const old = button.textContent;
        button.textContent = '⏳ Yuklanmoqda…';
        try {
          const src = String(img.currentSrc || img.src || '');
          const name = img.closest('[data-file-name]')?.getAttribute('data-file-name') || 'guli-chat-media';
          const resolved = src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:') ? src : `${API}${src.startsWith('/') ? '' : '/'}${src}`;
          await download(resolved, name);
          button.textContent = '✓ Saqlandi';
        } catch (e) {
          console.error('[GULI chat media download]', e);
          button.textContent = '⚠️ Qayta urinib ko‘ring';
        } finally {
          setTimeout(() => { button.disabled = false; button.textContent = old; }, 1800);
        }
      });
      box.appendChild(button);
      wrap.appendChild(box);
    });
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      scan();
    }, 200);
  }

  window.addEventListener('guli_chat_updated', scheduleScan);
  window.addEventListener('click', scheduleScan);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
  } else {
    scheduleScan();
  }
})();
