(() => {
  'use strict';

  // Safety fix: this runtime observes the React DOM, but must never run
  // synchronously for every mutation. The previous implementation called
  // scan() from MutationObserver while scan() itself could mutate the DOM,
  // creating a high-frequency feedback loop and freezing checkout on open.
  let scanTimer = 0;
  let scanning = false;

  function isCheckoutPage() {
    return Boolean(document.querySelector('.checkoutPage'));
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function moveCheckoutTotalAbovePayment() {
    const page = document.querySelector('.checkoutPage');
    const paymentButton = page?.querySelector('.paymentOptionVibrant');
    const total = page?.querySelector('.checkoutTotal');
    if (!page || !paymentButton || !total) return;

    const parent = paymentButton.parentElement;
    if (!parent) return;
    if (total.nextElementSibling !== paymentButton) {
      parent.insertBefore(total, paymentButton);
    }
  }

  function removeDuplicatePaymentAction() {
    const page = document.querySelector('.checkoutPage');
    if (!page) return;

    const keep = page.querySelector('.paymentOptionVibrant');
    const buttons = [...page.querySelectorAll('button')];
    for (const button of buttons) {
      if (button === keep || keep?.contains(button)) continue;
      const text = normalizeText(button.textContent);
      if (!text) continue;
      if (!/(to.?lov|payment)/i.test(text)) continue;
      if (!/(qilish|qilaman|pay|checkout)/i.test(text)) continue;
      button.remove();
    }
  }

  function normalizeAdminOrderAddress() {
    const roots = document.querySelectorAll('.drawer, .modalCard, [role="dialog"]');
    for (const root of roots) {
      const heading = [...root.querySelectorAll('h3,h2')].find((el) => /Yetkazib berish manzili/i.test(el.textContent || ''));
      if (!heading) continue;
      const section = heading.closest('.detailSection') || heading.parentElement;
      if (!section) continue;
      const text = String(section.textContent || '');
      if (!/Manzil ko.?rsatilmagan/i.test(text)) continue;

      const order = window.__GULI_LAST_ADMIN_ORDER;
      const address = order?.address || order?.delivery_address || order?.deliveryAddress;
      if (!address) continue;
      const values = [address.region, address.district, address.street, address.house, address.apartment, address.landmark, address.address, address.formatted_address].filter(Boolean);
      if (!values.length) continue;
      const p = section.querySelector('.addressText');
      if (p && p.textContent !== `📍 ${values.join(', ')}`) {
        p.textContent = `📍 ${values.join(', ')}`;
      }
    }
  }

  function scan() {
    if (scanning) return;
    scanning = true;
    try {
      if (isCheckoutPage()) {
        moveCheckoutTotalAbovePayment();
        removeDuplicatePaymentAction();
      }
      normalizeAdminOrderAddress();
    } finally {
      scanning = false;
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      scan();
    }, 120);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(scan, 250);
  setTimeout(scan, 1000);
  setTimeout(scan, 2500);
  setInterval(scheduleScan, 3000);
})();
