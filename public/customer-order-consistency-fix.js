(() => {
  'use strict';

  const API = () => {
    try {
      const configured = sessionStorage.getItem('guli_custom_api_url') || '';
      if (configured.trim()) return configured.trim().replace(/\/$/, '');
    } catch {}
    return (window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  };

  const customerHeaders = () => {
    const h = {};
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData;
    else {
      const guest = localStorage.getItem('guli_guest_token') || '';
      if (guest) h['X-Guli-Guest-Token'] = guest;
    }
    return h;
  };

  const orderNumberFrom = (root) => {
    const text = String(root?.textContent || '');
    return text.match(/(?:№|No\.?|#)\s*(GULI-\d{4,})/i)?.[1] || '';
  };

  async function paymentState(orderNumber) {
    if (!orderNumber) return null;
    try {
      const r = await fetch(`${API()}/api/orders/${encodeURIComponent(orderNumber)}/payment-state`, {
        headers: customerHeaders(),
        cache: 'no-store',
      });
      const j = await r.json().catch(() => null);
      return r.ok && j?.success ? j.data : null;
    } catch {
      return null;
    }
  }

  function setReceiptPreview(root, state) {
    if (!state?.receipt_url) return;
    const candidates = [...root.querySelectorAll('img')].filter((img) => {
      const alt = String(img.alt || '');
      const src = String(img.getAttribute('src') || '');
      return /chek|receipt|to.?lov/i.test(alt) || /placehold|unsplash|receipt/i.test(src);
    });
    const img = candidates[0] || [...root.querySelectorAll('img')][0];
    if (img) {
      img.src = state.receipt_url;
      img.removeAttribute('srcset');
      img.alt = 'Mijoz yuborgan to‘lov cheki';
      img.style.objectFit = 'cover';
    }

    const leaves = [...root.querySelectorAll('*')].filter((el) => el.children.length === 0);
    for (const el of leaves) {
      const text = String(el.textContent || '').trim();
      if (/Chek yuklanmagan|Chek hali serverda topilmadi|To‘lov cheki/i.test(text)) {
        if (!/to‘lov cheki/i.test(text.toLowerCase())) el.textContent = '✓ Mijoz yuborgan to‘lov cheki saqlangan';
      }
    }

    if (!root.querySelector('[data-guli-customer-receipt-preview]')) {
      const box = document.createElement('div');
      box.dataset.guliCustomerReceiptPreview = '1';
      box.style.cssText = 'margin-top:10px;padding:10px;border-radius:14px;background:#fff7f8;border:1px solid #eadde1;display:grid;gap:8px';
      box.innerHTML = '<b style="font-size:12px;color:#684f58">🧾 Mijoz yuborgan to‘lov cheki</b>';
      const preview = document.createElement('img');
      preview.src = state.receipt_url;
      preview.alt = 'Mijoz yuborgan to‘lov cheki';
      preview.style.cssText = 'width:100%;max-height:360px;object-fit:contain;border-radius:12px;background:#f4f1f2;cursor:pointer';
      preview.addEventListener('click', () => window.open(state.receipt_url, '_blank', 'noopener,noreferrer'));
      box.appendChild(preview);
      root.appendChild(box);
    }
  }

  async function scanCustomerOrders() {
    if (!window.Telegram?.WebApp?.initData) return;
    const roots = [...document.querySelectorAll('.modalCard, [role="dialog"], .orderDetail, .ordersPage')];
    for (const root of roots) {
      const orderNumber = orderNumberFrom(root);
      if (!orderNumber || !/karta|uzcard|humo|card_manual/i.test(root.textContent || '')) continue;
      if (root.dataset.guliPaymentStateOrder === orderNumber) continue;
      root.dataset.guliPaymentStateOrder = orderNumber;
      const state = await paymentState(orderNumber);
      if (state) setReceiptPreview(root, state);
    }
  }

  function checkoutFix() {
    const page = document.querySelector('.checkoutPage');
    if (!page) return;
    const payment = page.querySelector('.paymentOptionVibrant');
    const total = page.querySelector('.checkoutTotal');
    if (payment && total && payment.parentElement) {
      payment.parentElement.insertBefore(total, payment);
    }

    for (const button of [...page.querySelectorAll('button')]) {
      if (button === payment || payment?.contains(button)) continue;
      const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
      if (/(to.?lov|payment)/i.test(text) && /(qilish|qilaman|pay|checkout)/i.test(text)) {
        button.remove();
      }
    }
  }

  function scan() {
    checkoutFix();
    void scanCustomerOrders();
  }

  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(scan, 500);
  setTimeout(scan, 1800);
  setInterval(scan, 5000);
})();
