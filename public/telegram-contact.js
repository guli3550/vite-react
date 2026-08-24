(() => {
  const API_URL = "https://guli-lingerie-api.onrender.com";
  const BUTTON_ID = "guli-telegram-phone-button";

  function getTelegram() {
    return window.Telegram && window.Telegram.WebApp;
  }

  function addContactButton() {
    if (!location.href) return;

    const inputs = Array.from(document.querySelectorAll("input"));
    const phoneInput = inputs.find(
      (input) => input.getAttribute("placeholder") === "+998 90 123 45 67"
    );

    if (!phoneInput || document.getElementById(BUTTON_ID)) return;

    const tg = getTelegram();
    if (!tg || typeof tg.requestContact !== "function") return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "📱 Telegram raqamimni avtomatik olish";
    button.style.cssText = [
      "width:100%",
      "margin-top:10px",
      "padding:13px 16px",
      "border:0",
      "border-radius:14px",
      "background:#229ED9",
      "color:#fff",
      "font-size:15px",
      "font-weight:700",
      "cursor:pointer",
    ].join(";");

    button.addEventListener("click", () => {
      button.disabled = true;
      button.textContent = "📱 Telegramdan ruxsat so‘ralmoqda...";

      tg.requestContact((shared) => {
        if (shared) {
          button.textContent = "✅ Telegram raqami yuborildi";
          button.style.background = "#21a366";
        } else {
          button.disabled = false;
          button.textContent = "📱 Telegram raqamimni avtomatik olish";
        }
      });
    });

    phoneInput.insertAdjacentElement("afterend", button);
  }

  const observer = new MutationObserver(addContactButton);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  addContactButton();
})();
