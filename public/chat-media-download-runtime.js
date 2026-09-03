(() => {
  'use strict';
  const API = String(window.__GULI_API_URL || sessionStorage.getItem('guli_custom_api_url') || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  const selector = `img[src*="/api/chat/"]`;

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
          await download(src.startsWith('http') ? src : `${API}${src.startsWith('/') ? '' : '/'}${src}`, name);
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

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 2000);
  scan();
})();
