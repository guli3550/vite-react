// Makes the custom Humo/Uzcard card option visible to the legacy interceptor as a real checked radio.
// This prevents the normal cash checkout handler from firing underneath the card flow.
(() => {
  const state = { selected: false };
  const ensureRadio = (page) => {
    let label = page.querySelector('.guli-card-selection-proxy');
    if (!label) {
      label = document.createElement('label');
      label.className = 'guli-card-selection-proxy';
      label.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      label.innerHTML = '<input type="radio" name="guli-payment-proxy" aria-label="Karta"> Karta';
      page.appendChild(label);
    }
    return label.querySelector('input');
  };
  const setSelected = (value) => {
    const page = document.querySelector('.checkoutPage');
    if (!page) return;
    const radio = ensureRadio(page);
    radio.checked = Boolean(value);
    state.selected = Boolean(value);
    page.dataset.guliPayment = value ? 'card' : 'cash';
  };
  const scan = () => {
    const page = document.querySelector('.checkoutPage');
    if (!page) return;
    ensureRadio(page);
    const selected = page.querySelector('[aria-checked="true"], .selected, .active, .chosen, input:checked');
    if (selected && /karta|card|humo|uzcard/i.test(selected.closest('label, .paymentOption, .payment-method, .checkoutCard, div')?.textContent || selected.textContent || '')) setSelected(true);
  };
  document.addEventListener('click', (event) => {
    const page = event.target?.closest?.('.checkoutPage');
    if (!page) return;
    const target = event.target.closest('label, button, [role="radio"], .paymentOption, .payment-method, .checkoutCard, div');
    const text = String(target?.textContent || '').replace(/\s+/g, ' ').trim();
    if (/^karta(?:\s|$)|karta\s+to.?lov|humo|uzcard/i.test(text) || /karta/i.test(text) && !/naqd/i.test(text)) setSelected(true);
    else if (/^naqd(?:\s|$)|naqd\s+to.?lov/i.test(text)) setSelected(false);
  }, true);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  setTimeout(scan, 250);
  setTimeout(scan, 1000);
})();