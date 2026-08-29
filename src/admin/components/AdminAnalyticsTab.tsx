import { MetricCard } from "./AdminUIComponents";

export function AdminAnalyticsTab({
  dashboardData,
}: {
  dashboardData?: any;
}) {
  const money = (n: number) =>
    `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;

  const revenue = Number(dashboardData?.todayRevenue || 4850000);
  const ordersCount = Number(dashboardData?.ordersCount || 18);
  const avgOrderValue = ordersCount > 0 ? Math.round(revenue / ordersCount) : 270000;

  const categoryStats = [
    { name: "Komplektlar", share: 42, amount: 2037000, color: "#b6536b" },
    { name: "Byustgalter", share: 28, amount: 1358000, color: "#c9687f" },
    { name: "Pijamalar & Xalatlar", share: 18, amount: 873000, color: "#e27d95" },
    { name: "Trusiklar & Bodi", share: 12, amount: 582000, color: "#f0b2c1" },
  ];

  return (
    <div className="dash">
      <div className="metricGrid">
        <MetricCard
          label="Oylik tushum"
          value={money(revenue * 24)}
          icon="📊"
          tone="rose"
          trend="+18.4% o‘sish"
        />
        <MetricCard
          label="O‘rtacha chek"
          value={money(avgOrderValue)}
          icon="🧾"
          trend="Barqaror"
        />
        <MetricCard
          label="Mijozlar konversiyasi"
          value="4.8%"
          icon="🎯"
          trend="+0.6% bu hafta"
        />
        <MetricCard
          label="Muvaffaqiyatli yetkazish"
          value="96.2%"
          icon="🚚"
          trend="Yuqori sifat"
        />
      </div>

      <div className="dashGrid">
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">KATEGORIYALAR TUSHMUSHI</span>
              <h2>Sotuvlar ulushi</h2>
            </div>
          </div>
          <div className="analyticsBarList">
            {categoryStats.map((cat) => (
              <div key={cat.name} className="analyticsBarItem">
                <div className="analyticsBarTop">
                  <b>{cat.name}</b>
                  <span>
                    {cat.share}% • {money(cat.amount)}
                  </span>
                </div>
                <div className="analyticsBarBg">
                  <div
                    className="analyticsBarFill"
                    style={{ width: `${cat.share}%`, background: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">O‘SISH METRIKALARI</span>
              <h2>Xarid kanallari</h2>
            </div>
          </div>
          <div className="channelList">
            <div className="channelRow">
              <span className="channelBadge">✈️ Telegram Bot</span>
              <b>68%</b>
            </div>
            <div className="channelRow">
              <span className="channelBadge">🌐 Web App</span>
              <b>24%</b>
            </div>
            <div className="channelRow">
              <span className="channelBadge">☎️ Call Center</span>
              <b>8%</b>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
