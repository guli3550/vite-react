(() => {
  const API = (location.hostname.includes("vercel.app") ? "https://guli-lingerie-api.onrender.com" : "").replace(/\/$/, "");
  let selectedProvider = "cash";
  let busy = false;

  const tg = () => window.Telegram?.WebApp;
  const toast = (message) => {
    let el = document.querySelector(".guli-payment-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "guli-payment-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
  };

  const formatPrice = (n) => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
  const getCart = () => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  };
  const getAddress = () => {
    try { return JSON.parse(localStorage.getItem("guli_address") || "null"); } catch { return null; }
  };
  const getPromo = () => {
    const el = document.querySelector(".promoSuccess");
    if (!el) return "";
    const match = el.textContent?.match(/✓\s*([A-Z0-9_-]+)\s+promo/i);
    return match?.[1] || "";
  };

  function mountPaymentUI(card) {
    if (card.dataset.paymentEnhanced === "1") return;
    card.dataset.paymentEnhanced = "1";
    const oldOptions = [...card.querySelectorAll(".paymentOption")];
    oldOptions.forEach((el) => { el.style.display = "none"; });

    const box = document.createElement("div");
    box.className = "guli-payment-methods";
    box.innerHTML = `
      <button type="button" class="guli-payment-method active" data-provider="cash">
        <span class="guli-payment-icon">💵</span><span><b>Naqd</b><small>Yetkazib berishda</small></span><i>✓</i>
      </button>
      <button type="button" class="guli-payment-method" data-provider="click">
        <span class="guli-payment-icon click-mark">C</span><span><b>Click</b><small>Click orqali xavfsiz to‘lash</small></span><i>✓</i>
      </button>
      <button type="button" class="guli-payment-method disabled" data-provider="payme" aria-disabled="true">
        <span class="guli-payment-icon">P</span><span><b>Payme</b><small>Tez orada</small></span><em>Tez orada</em>
      </button>
      <button type="button" class="guli-payment-method disabled" data-provider="bankcard" aria-disabled="true">
        <span class="guli-payment-icon">💳</span><span><b>Bank kartasi</b><small>Uzcard · Humo · Visa · Mastercard</small></span><em>Tez orada</em>
      </button>`;
    card.appendChild(box);

    box.querySelectorAll(".guli-payment-method").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.classList.contains("disabled")) {
          toast("Bu to‘lov usuli keyingi bosqichda ulanadi.");
          return;
        }
        selectedProvider = button.dataset.provider || "cash";
        box.querySelectorAll(".guli-payment-method").forEach((x) => x.classList.toggle("active", x === button));
        const radio = oldOptions.find((label) => label.querySelector('input[type="radio"]'))?.querySelector('input[type="radio"]');
        const cardRadio = oldOptions.find((label) => label.textContent?.includes("Karta"))?.querySelector('input[type="radio"]');
        if (selectedProvider === "cash") radio?.click();
        if (selectedProvider === "click") cardRadio?.click();
      });
    });
  }

  async function startClickPayment(button) {
    if (busy) return;
    const phone = document.querySelector('.checkoutPage input[type="tel"]')?.value?.trim() || "";
    const address = getAddress();
    const items = getCart();
    if (!phone) return toast("Avval telefon raqamini kiriting.");
    if (!items.length) return toast("Savat bo‘sh.");
    if (!address?.latitude || !address?.longitude) return toast("Yetkazib berish joylashuvini belgilang.");
    if (!tg()?.initData) return toast("Telegram sessiyasi topilmadi. Mini App'ni Telegram ichidan oching.");

    busy = true;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "⏳ Click to‘loviga tayyorlanmoqda…";
    try {
      const response = await fetch(`${API}/api/payments/click/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": tg().initData },
        body: JSON.stringify({ phone, items, address, promo_code: getPromo() || null })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.payment_url) throw new Error(result.message || "Click to‘lovini boshlashda xatolik");
      toast("Click sahifasiga o‘tilmoqda…");
      window.location.href = result.data.payment_url;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Click to‘lovini boshlashda xatolik");
      button.disabled = false;
      button.textContent = original;
      busy = false;
    }
  }

  function scan() {
    const page = document.querySelector(".checkoutPage");
    if (!page) { selectedProvider = "cash"; busy = false; return; }
    const cards = [...page.querySelectorAll(".checkoutCard")];
    const paymentCard = cards.find((card) => card.querySelector(".paymentOption"));
    if (paymentCard) mountPaymentUI(paymentCard);
    const confirm = page.querySelector(".primaryButton.large:last-of-type");
    if (confirm && confirm.dataset.clickInterceptor !== "1") {
      confirm.dataset.clickInterceptor = "1";
      confirm.addEventListener("click", (event) => {
        if (selectedProvider !== "click") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        startClickPayment(confirm);
      }, true);
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .guli-payment-methods{display:grid;gap:10px;margin-top:8px}
    .guli-payment-method{width:100%;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;text-align:left;padding:14px 15px;border:1px solid #eadde1;border-radius:18px;background:#fff9fa;color:#251d20;cursor:pointer;transition:.2s;box-shadow:0 4px 18px rgba(80,35,45,.04)}
    .guli-payment-method.active{border-color:#c35c75;background:#fff4f6;box-shadow:0 8px 24px rgba(183,74,102,.12)}
    .guli-payment-method.disabled{opacity:.62;cursor:pointer}
    .guli-payment-method span:not(.guli-payment-icon){display:flex;flex-direction:column;gap:3px}
    .guli-payment-method b{font-size:16px}.guli-payment-method small{font-size:12px;color:#8b7b80}.guli-payment-method i{font-style:normal;color:#c45a73;font-weight:800}.guli-payment-method em{font-style:normal;font-size:10px;color:#a38e95;background:#f2e9eb;padding:5px 7px;border-radius:999px}
    .guli-payment-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#f8e5e9;font-size:20px;font-weight:900;color:#b44f68}.click-mark{font-size:25px;background:#fff0c7;color:#111}
    .guli-payment-toast{position:fixed;left:50%;bottom:92px;transform:translate(-50%,16px);z-index:99999;opacity:0;pointer-events:none;background:#271e21;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 12px 35px rgba(0,0,0,.2);font-size:13px;font-weight:700;transition:.22s;max-width:calc(100vw - 32px);text-align:center}.guli-payment-toast.show{opacity:1;transform:translate(-50%,0)}
    @media(min-width:760px){.guli-payment-methods{grid-template-columns:1fr 1fr}.guli-payment-method{min-height:82px}}
  `;
  document.head.appendChild(style);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  setTimeout(scan, 400);
  setInterval(scan, 1000);
})();
