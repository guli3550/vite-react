const TYPE_KEY = "guli_promo_discount_type";
let promoType: "percent" | "fixed" = sessionStorage.getItem(TYPE_KEY) === "fixed" ? "fixed" : "percent";

function findPromoModal(): HTMLElement | null {
  const modals = Array.from(document.querySelectorAll<HTMLElement>(".proModal"));
  return modals.find((m) => /Promo (tahrirlash|Yangi promo)/i.test(m.innerText)) || null;
}

function setType(type: "percent" | "fixed") {
  promoType = type;
  sessionStorage.setItem(TYPE_KEY, type);
}

function bindNewPromoButton() {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".proToolbar .proPrimary"))
    .find((b) => b.textContent?.includes("Promo kod"));
  if (!button || button.dataset.promoTypeBound === "1") return;
  button.dataset.promoTypeBound = "1";
  button.addEventListener("click", () => setType("percent"), true);
}

function updateDiscountField(modal: HTMLElement) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>("label"));
  const discountLabel = labels.find((l) => l.textContent?.includes("Chegirma") && !l.dataset.promoTypeWrap);
  const input = discountLabel?.querySelector<HTMLInputElement>("input[type=number]");
  const select = modal.querySelector<HTMLSelectElement>("select[data-promo-type]");
  if (!discountLabel || !input || !select) return;

  const fixed = select.value === "fixed";
  setType(fixed ? "fixed" : "percent");
  discountLabel.firstChild!.textContent = fixed ? "Chegirma (so'm)" : "Chegirma (%)";
  input.min = "1";
  input.max = fixed ? "" : "100";
  input.placeholder = fixed ? "Masalan: 10000" : "Masalan: 10";
  const help = discountLabel.querySelector("small");
  if (help) help.textContent = fixed
    ? "Mijoz savatidan aynan shu so'm miqdori chegiriladi."
    : "Mijoz savatidan shu foiz chegiriladi.";

  if (input.dataset.promoEnhanced !== "1") {
    input.dataset.promoEnhanced = "1";
    input.addEventListener("input", (event) => {
      // AdminPro currently validates the percentage value before sending.
      // In fixed mode keep React's internal value valid and use the real DOM
      // value in the fetch interceptor below.
      if (promoType === "fixed") event.stopPropagation();
    }, true);
  }
}

function applyPromoUI(modal: HTMLElement) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>("label"));
  const discountLabel = labels.find((l) => l.textContent?.includes("Chegirma") && !l.dataset.promoTypeWrap);
  if (!discountLabel) return;

  let select = modal.querySelector<HTMLSelectElement>("select[data-promo-type]");
  if (!select) {
    const wrap = document.createElement("label");
    wrap.dataset.promoTypeWrap = "1";
    wrap.innerHTML = `<span>Chegirma turi</span><select data-promo-type><option value="percent">Foiz (%)</option><option value="fixed">So'm miqdori</option></select><small>Foizli yoki aynan bitta so'm miqdorida chegirma tanlang.</small>`;
    discountLabel.parentElement?.insertBefore(wrap, discountLabel);
    select = wrap.querySelector("select");
    if (!select) return;
    select.value = promoType;
    select.addEventListener("change", () => updateDiscountField(modal));
  }
  updateDiscountField(modal);
}

function capturePromoEditType() {
  document.querySelectorAll<HTMLElement>(".tableScroll tr").forEach((row) => {
    if (row.dataset.promoTypeBound === "1") return;
    const button = row.querySelector<HTMLButtonElement>("button");
    const cells = row.querySelectorAll("td");
    if (!button || cells.length < 2) return;
    row.dataset.promoTypeBound = "1";
    button.addEventListener("click", () => {
      const text = cells[1].textContent || "";
      setType(text.includes("%") ? "percent" : "fixed");
    }, true);
  });
}

const originalFetch = window.fetch.bind(window);
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (/\/api\/admin\/promos(?:\/\d+)?$/.test(url) && init?.body && promoType === "fixed") {
    try {
      const body = JSON.parse(String(init.body));
      const modal = findPromoModal();
      const inputEl = modal?.querySelector<HTMLInputElement>('input[type="number"]');
      const fixedValue = Number(inputEl?.value);
      if (Number.isFinite(fixedValue) && fixedValue > 0) {
        body.discount_type = "fixed";
        body.discount_value = fixedValue;
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {}
  }
  return originalFetch(input, init);
};

try {
  window.fetch = customFetch;
} catch {
  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      (globalThis as any).fetch = customFetch;
    } catch (err) {
      console.warn('Could not intercept fetch:', err);
    }
  }
}

const observer = new MutationObserver(() => {
  bindNewPromoButton();
  capturePromoEditType();
  const modal = findPromoModal();
  if (modal) applyPromoUI(modal);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
bindNewPromoButton();
capturePromoEditType();
