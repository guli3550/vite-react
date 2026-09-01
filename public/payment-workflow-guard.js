(() => {
  'use strict';

  // GULI payment workflow guard.
  // Keep customer/admin runtime on the same API origin as the active app.
  const getApiBase = () => {
    try {
      const configured = sessionStorage.getItem('guli_custom_api_url') || '';
      if (configured.trim()) return configured.trim().replace(/\/$/, '');
    } catch {}
    return (window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  };
  const tg = () => window.Telegram?.WebApp;
  const isTelegram = () => Boolean(tg()?.initData);
  const isAdminContext = () => {
    const path = String(window.location?.pathname || '').toLowerCase();
    if (path === '/admin' || path.startsWith('/admin/')) return true;
    const bodyText = String(document.body?.textContent || '');
    return /GULI CONTROL CENTER|CARD PAYMENTS & RECEIPTS|Bosh sahifa\s+Bosh sahifa/i.test(bodyText);
  };
  const normalize = (v) => String(v || '').replace(/[’‘]/g, "'").trim().toLowerCase();
  const customerHeaders = () => {
    const h = { 'Content-Type': 'application/json' };
    if (tg()?.initData) h['X-Telegram-Init-Data'] = tg().initData;
    else {
      const guest = localStorage.getItem('guli_guest_token');
      if (guest) h['X-Guli-Guest-Token'] = guest;
    }
    return h;
  };

  const orderNumberFrom = (root) => {
    const text = String(root?.textContent || '');
    const m = text.match(/(?:№|No\.?|#)\s*(GULI-\d{4,})/i);
    return m?.[1] || '';
  };

  const paymentIsCard = (root) => /card_manual|karta\s*(?:orqali|\(|—|-)|uzcard|humo/i.test(String(root?.textContent || ''));

  const readFile = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  async function paymentState(orderNumber) {
    const API = getApiBase();
    const r = await fetch(`${API}/api/orders/${encodeURIComponent(orderNumber)}/payment-state`, { headers: customerHeaders(), cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(j.message || 'To‘lov holatini olishda xatolik');
    return j.data;
  }

  async function uploadReceipt(orderNumber, file, statusEl, button) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) && file.type !== 'application/pdf') {
      statusEl.textContent = 'JPG, PNG, WEBP yoki PDF yuklang.';
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      statusEl.textContent = 'Chek 6 MB dan kichik bo‘lishi kerak.';
      return;
    }
    button.disabled = true;
    statusEl.textContent = '⏳ Chek serverga yuborilmoqda…';
    try {
      const data = await readFile(file);
      const extension = (file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase();
      const API = getApiBase();
      const r = await fetch(`${API}/api/orders/${encodeURIComponent(orderNumber)}/receipt`, {
        method: 'POST',
        headers: customerHeaders(),
        body: JSON.stringify({ data, mimeType: file.type, extension }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.message || 'Chekni yuborishda xatolik');
      statusEl.textContent = '✓ Chek saqlandi. Admin tekshiradi.';
      button.textContent = '✓ Chek yuborildi';
      button.disabled = true;
    } catch (e) {
      statusEl.textContent = e instanceof Error ? e.message : 'Chekni yuborishda xatolik';
      button.disabled = false;
    }
  }

  function addCustomerReceiptRecovery(root, orderNumber) {
    if (isAdminContext()) return;
    if (root.querySelector('[data-guli-receipt-recovery]')) return;
    const nativeReceipt = /Mijoz yuborgan to‘lov cheki|Mijoz yuborgan to'lov cheki|Yuklangan chek|Chek haqiqiy/i.test(String(root?.textContent || ''));
    if (nativeReceipt) return;
    const box = document.createElement('div');
    box.dataset.guliReceiptRecovery = '1';
    box.style.cssText = 'margin-top:12px;padding:12px 14px;border:1px solid #eadde1;border-radius:16px;background:#fff8f9;display:grid;gap:8px';
    box.innerHTML = `<div style="font-weight:800;font-size:12px;color:#5f4c53">🧾 To‘lov cheki</div><div data-guli-receipt-status style="font-size:11px;color:#796970">Chek hali serverda topilmadi.</div><label style="display:flex;align-items:center;justify-content:center;min-height:42px;border-radius:12px;background:#f3e1e6;color:#9c4b63;font-size:12px;font-weight:800;cursor:pointer">📎 Chekni yuborish / qayta yuborish<input data-guli-receipt-input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" style="display:none"></label>`;
    const anchor = root.querySelector('.guli-live-order-status') || root.lastElementChild;
    (anchor || root).insertAdjacentElement('afterend', box);
    const input = box.querySelector('[data-guli-receipt-input]');
    const status = box.querySelector('[data-guli-receipt-status]');
    input.addEventListener('change', () => uploadReceipt(orderNumber, input.files?.[0], status, box.querySelector('label')));
  }

  async function syncCustomerCard(root, orderNumber) {
    if (isAdminContext()) return;
    try {
      const state = await paymentState(orderNumber);
      if (state.payment_status === 'verified') {
        root.querySelector('[data-guli-receipt-recovery]')?.remove();
        return;
      }
      const box = root.querySelector('[data-guli-receipt-recovery]');
      if (box) {
        const status = box.querySelector('[data-guli-receipt-status]');
        if (state.receipt_path || state.payment_status === 'receipt_uploaded') {
          status.textContent = '✓ Chek serverda saqlangan — admin tekshiruvida.';
        } else if (state.payment_status === 'rejected') {
          status.textContent = '⚠️ Oldingi chek rad etilgan. Yangi chek yuboring.';
        } else {
          status.textContent = 'Chek hali yuborilmagan. To‘lovdan keyin chekni yuboring.';
        }
      }
    } catch {}
  }

  function normalizeCustomerPaymentText() {
    if (!isTelegram() || isAdminContext()) return;
    document.querySelectorAll('body *').forEach((el) => {
      if (el.children.length) return;
      const t = String(el.textContent || '').trim();
      if (t === 'card_manual') el.textContent = '💳 Karta (Uzcard / Humo)';
    });
  }

  function scanCustomer() {
    if (!isTelegram() || isAdminContext()) return;
    normalizeCustomerPaymentText();
    const nodes = [...document.querySelectorAll('body *')].filter((el) => el.children.length > 0);
    for (const node of nodes) {
      const text = String(node.textContent || '');
      if (!/GULI-\d{4,}/i.test(text) || !paymentIsCard(node)) continue;
      if (text.length < 250 || text.length > 5000) continue;
      const orderNumber = orderNumberFrom(node);
      if (!orderNumber) continue;
      addCustomerReceiptRecovery(node, orderNumber);
      void syncCustomerCard(node, orderNumber);
    }
  }

  function scanAdmin() {
    if (isTelegram() && !isAdminContext()) return;
    const tables = [...document.querySelectorAll('table')];
    for (const table of tables) {
      if (!/Kartadan to‘lovlar va Cheklar|CARD PAYMENTS & RECEIPTS/i.test(table.parentElement?.textContent || '')) continue;
      [...table.querySelectorAll('tbody tr')].forEach((row) => {
        const cells = [...row.children];
        if (cells.length < 9) return;
        const receiptButton = cells[0]?.querySelector('button');
        const hasImage = Boolean(receiptButton?.querySelector('img'));
        const statusCell = cells[6];
        const actionButtons = [...cells[8].querySelectorAll('button')];
        const confirm = actionButtons.find((b) => /Tasdiqlash/i.test(b.textContent || ''));
        if (!hasImage && confirm) {
          confirm.disabled = true;
          confirm.title = 'Avval haqiqiy to‘lov chekini yuklang yoki mijoz chek yuborishini kuting.';
          confirm.style.opacity = '0.5';
          confirm.style.cursor = 'not-allowed';
          const pill = statusCell?.querySelector('.pill');
          if (pill && !/Rad etilgan|Tasdiqlangan/i.test(pill.textContent || '')) {
            pill.textContent = '🧾 Chek yuklanmagan';
          }
        }
      });
    }
  }

  const scan = () => { try { scanCustomer(); scanAdmin(); } catch {} };
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(scan, 900);
  setTimeout(scan, 2200);
  setInterval(scan, 8000);
})();
