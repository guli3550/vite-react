import { useState } from "react";
import { MetricCard } from "./AdminUIComponents";

export function AdminExtensionsTab({ notify }: { notify: (m: string) => void }) {
  const [sheetsSync, setSheetsSync] = useState(true);
  const [telegramWebhook, setTelegramWebhook] = useState(true);
  const [smsGateway, setSmsGateway] = useState(false);

  return (
    <div className="dash">
      <div className="metricGrid">
        <MetricCard label="Integratsiyalar" value="4 ta faol" icon="🧩" tone="rose" />
        <MetricCard label="Telegram Webhook" value={telegramWebhook ? "Aktiv ✓" : "O'chiq"} icon="✈️" />
        <MetricCard label="Google Sheets Sync" value={sheetsSync ? "Sinxron" : "Pauzada"} icon="📊" />
        <MetricCard label="SMS Gateway" value={smsGateway ? "Ulangan" : "Ulanmagan"} icon="💬" />
      </div>

      <section className="proPanel">
        <div className="panelHead">
          <div>
            <span className="proEyebrow">EXTRA MODULES & INTEGRATIONS</span>
            <h2>Qo‘shimcha Modullar va Tizim Servislari</h2>
          </div>
        </div>

        <div className="extensionsList">
          <div className="extensionCard">
            <div className="extInfo">
              <span className="extIcon">📊</span>
              <div>
                <b>Google Sheets Avto-Sinxronizatsiya</b>
                <p>Buyurtmalar va mijozlar ma'lumotlarini real-vaqtda Google Sheets jadvaliga uzatadi.</p>
              </div>
            </div>
            <button
              type="button"
              className={sheetsSync ? "proPrimary miniBtn" : "mgmtBtn"}
              onClick={() => {
                setSheetsSync(!sheetsSync);
                notify(sheetsSync ? "Google Sheets pauzaga qo'yildi" : "Google Sheets faollashtirildi ✓");
              }}
            >
              {sheetsSync ? "Faol ✓" : "Yoqish"}
            </button>
          </div>

          <div className="extensionCard">
            <div className="extInfo">
              <span className="extIcon">✈️</span>
              <div>
                <b>Telegram Webhook Bot Engine</b>
                <p>Telegram Bot orqali keladigan buyurtmalarni admin panel bilan sinxronlaydi.</p>
              </div>
            </div>
            <button
              type="button"
              className={telegramWebhook ? "proPrimary miniBtn" : "mgmtBtn"}
              onClick={() => {
                setTelegramWebhook(!telegramWebhook);
                notify(telegramWebhook ? "Webhook to'xtatildi" : "Webhook qayta yoqildi ✓");
              }}
            >
              {telegramWebhook ? "Faol ✓" : "Yoqish"}
            </button>
          </div>

          <div className="extensionCard">
            <div className="extInfo">
              <span className="extIcon">💬</span>
              <div>
                <b>SMS Bildirishnomalar Gateway</b>
                <p>Buyurtma holati o'zgarganda mijoz telefoniga SMS xabarnoma yuborish.</p>
              </div>
            </div>
            <button
              type="button"
              className={smsGateway ? "proPrimary miniBtn" : "mgmtBtn"}
              onClick={() => {
                setSmsGateway(!smsGateway);
                notify(smsGateway ? "SMS gateway o'chirildi" : "SMS gateway faollashtirildi ✓");
              }}
            >
              {smsGateway ? "Faol ✓" : "Yoqish"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
