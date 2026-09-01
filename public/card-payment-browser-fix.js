(() => {
  'use strict';

  const API = (location.hostname.includes('vercel.app') || location.hostname.includes('guli'))
    ? 'https://guli-lingerie-api.onrender.com'
    : '';
  let busy = false;

  const getGuestToken = () => localStorage.getItem('guli_guest_token') || '';

  async function ensureGuestSession() {
    const current = getGuestToken();
    if (current) return current;
    const r = await fetch(`${API}/api/guest-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success || !j.data?.token) {
      throw new Error(j.message || 'Brauzer sessiyasini yaratib bo‘lmadi');
    }
    localStorage.setItem('guli_guest_token', j.data.token);
    return j.data.token;
  }

  const headers = (token) => ({
    'Content-Type': 'application/json',
    'X-Guli-Guest-Token': token,
  });

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const cart = () => {
    try {
      const value = JSON.parse(localStorage.getItem('cart') || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };

  const address = () => {
    try { return JSON.parse(localStorage.getItem('guli_address') || 'null'); }
    catch { return null; }
  };

  const promo = () => {
    const success = document.querySelector('.promoSuccess');
    const match = success?.textContent?.match(/✓\s*([A-Z0-9_-]+)\s+promo/i);
    return match?.[1] || '';
  };

  const toast = (message) => {
    let el = document.querySelector('[data-guli-browser-card-fix-toast]');
    if (!el) {
      el = document.createElement('div');
      el.dataset.guliBrowserCardFixToast = '1';
      el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100000;background:#261e20;color:#fff;padding:12px 16px;border-radius:14px;font:700 13px system-ui;max-width:calc(100vw - 32px);text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.22)';
      document.body.appendChild(el);
    }
    el.textContent = message;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.remove(), 3500);
  };

  function findPaymentButton() {
    const modal = [...document.querySelectorAll('.modalCard, [role="dialog"]')]
      .find(el => /Karta orqali to.?lov/i.test(el.textContent || ''));
    if (!modal) return null;
    return [...modal.querySelectorAll('button')]
      .find(btn => /to.?lov qildim/i.test(btn.textContent || '')) || null;
  }

  async function submitBrowserCardOrder(button) {
    if (busy) return;
    const phone = document.querySelector('.checkoutPage input[type="tel"]')?.value?.trim() || localStorage.getItem('guli_phone') || '';
    const items = cart();
    const addr = address();
    const fileInput = document.querySelector('.modalCard input[type="file"], [role="dialog"] input[type="file"]');
    const file = fileInput?.files?.[0] || null;

    if (!phone) return toast('Avval telefon raqamini kiriting.');
    if (!items.length) return toast('Savat bo‘sh.');
    if (!addr?.latitude || !addr?.longitude) return toast('Yetkazib berish joylashuvini belgilang.');
    if (!file) return toast('Iltimos to‘lov cheki rasmini yuklang.');
    if (file.size > 6 * 1024 * 1024) return toast('Chek 6 MB dan kichik bo‘lishi kerak.');

    busy = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Buyurtma saqlanmoqda…';

    try {
      const token = await ensureGuestSession();
      const orderResponse = await fetch(`${API}/api/guest/orders`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({
          phone,
          items,
          address: addr,
          payment: 'card_manual',
          status: 'Qabul qilindi',
          promo_code: promo() || null,
        }),
      });
      const orderResult = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !orderResult.success) {
        throw new Error(orderResult.message || 'Buyurtmani yaratishda xatolik');
      }

      const order = Array.isArray(orderResult.data) ? orderResult.data[0] : orderResult.data;
      if (!order?.order_number) throw new Error('Buyurtma raqami qaytmadi.');

      button.textContent = '⏳ Chek yuborilmoqda…';
      const data = await readFile(file);
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const receiptResponse = await fetch(`${API}/api/orders/${encodeURIComponent(order.order_number)}/receipt`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ data, mimeType: file.type, extension }),
      });
      const receiptResult = await receiptResponse.json().catch(() => ({}));
      if (!receiptResponse.ok || !receiptResult.success) {
        throw new Error(receiptResult.message || 'Chekni yuborishda xatolik');
      }

      button.textContent = '✓ Qabul qilindi';
      localStorage.removeItem('cart');
      localStorage.setItem('guli_last_order_number', order.order_number);
      toast(`✓ ${order.order_number} buyurtma yaratildi va chek yuborildi`);
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      toast(error instanceof Error ? error.message : 'Buyurtma yaratishda xatolik');
    } finally {
      busy = false;
    }
  }

  function scan() {
    const button = findPaymentButton();
    if (!button || button.dataset.guliBrowserCardFix === '1') return;
    button.dataset.guliBrowserCardFix = '1';
    button.addEventListener('click', (event) => {
      // Only replace the browser flow. Telegram has verified initData and keeps the native flow.
      if (window.Telegram?.WebApp?.initData) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void submitBrowserCardOrder(button);
    }, true);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 700);
  scan();
})();