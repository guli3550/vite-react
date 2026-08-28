import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from "recharts";

type CartItem = { product: any; size: string; color: string; quantity: number };
type Order = {
  id: string;
  items: CartItem[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  address?: any;
  phone: string;
  payment: string;
  status: string;
  createdAt: string;
};

interface SpendingChartProps {
  orders: Order[];
  onViewOrders?: () => void;
}

const UZ_MONTHS = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyun",
  "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"
];

const formatPrice = (n: number) => `${Math.round(n).toLocaleString("uz-UZ")} so'm`;

const formatShortPrice = (n: number) => {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} mln`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)} ming`;
  }
  return String(n);
};

export function MonthlySpendingChart({ orders, onViewOrders }: SpendingChartProps) {
  const [chartType, setChartType] = useState<"bar" | "area">("bar");

  const data = useMemo(() => {
    const list = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = `${UZ_MONTHS[month]} '${String(year).slice(2)}`;

      const matchingOrders = orders.filter((o) => {
        if (!o.createdAt) return false;
        const od = new Date(o.createdAt);
        return !isNaN(od.getTime()) && od.getFullYear() === year && od.getMonth() === month;
      });

      const total = matchingOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const count = matchingOrders.length;

      list.push({
        key: monthKey,
        label,
        shortLabel: UZ_MONTHS[month],
        total,
        count,
        isCurrent: i === 0,
      });
    }
    return list;
  }, [orders]);

  const totalSpent6m = useMemo(() => data.reduce((acc, curr) => acc + curr.total, 0), [data]);
  const totalOrders6m = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data]);
  const avgMonthlySpend = Math.round(totalSpent6m / 6);
  const maxSpend = Math.max(...data.map((d) => d.total), 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="spendingTooltip">
          <div className="tooltipHeader">{item.label}</div>
          <div className="tooltipTotal">{formatPrice(item.total)}</div>
          <div className="tooltipCount">
            {item.count > 0 ? `${item.count} ta buyurtma` : "Xarid amalga oshirilmagan"}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="spendingAnalyticsCard" id="profile-spending-analytics">
      <div className="spendingHeader">
        <div>
          <span className="spendingEyebrow">STATISTIKA & XARAJATLAR</span>
          <h3>Oxirgi 6 oylik xaridlar</h3>
        </div>
        <div className="chartToggleGroup">
          <button
            type="button"
            className={`chartToggleBtn ${chartType === "bar" ? "active" : ""}`}
            onClick={() => setChartType("bar")}
            title="Ustunli diagramma"
          >
            📊
          </button>
          <button
            type="button"
            className={`chartToggleBtn ${chartType === "area" ? "active" : ""}`}
            onClick={() => setChartType("area")}
            title="Chiziqli grafik"
          >
            📈
          </button>
        </div>
      </div>

      <div className="spendingStatsGrid">
        <div className="statBlock">
          <small>Jami xarajat (6 oy)</small>
          <strong>{formatPrice(totalSpent6m)}</strong>
        </div>
        <div className="statBlock">
          <small>Oylik o‘rtacha</small>
          <strong>{formatPrice(avgMonthlySpend)}</strong>
        </div>
        <div className="statBlock">
          <small>Buyurtmalar soni</small>
          <strong>{totalOrders6m} ta</strong>
        </div>
      </div>

      <div className="chartContainer">
        <ResponsiveContainer width="100%" height={190}>
          {chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4e4e7" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={{ stroke: "#ebdbe0" }}
                tick={{ fill: "#8f7c82", fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#a08e93", fontSize: 10 }}
                tickFormatter={formatShortPrice}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(201, 82, 107, 0.06)" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={600}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.total === 0
                        ? "#f0dee2"
                        : entry.total === maxSpend && maxSpend > 0
                        ? "#b94561"
                        : "#d95f7a"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c9526b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#c9526b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4e4e7" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={{ stroke: "#ebdbe0" }}
                tick={{ fill: "#8f7c82", fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#a08e93", fontSize: 10 }}
                tickFormatter={formatShortPrice}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#c9526b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#spendGradient)"
                activeDot={{ r: 5, fill: "#b94561", stroke: "#fff", strokeWidth: 2 }}
                animationDuration={600}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="spendingFooter">
        <span className="spendingLegend">
          <span className="legendDot"></span> Oylik buyurtmalar summasi
        </span>
        {onViewOrders && (
          <button type="button" className="spendingLinkBtn" onClick={onViewOrders}>
            Barcha buyurtmalar →
          </button>
        )}
      </div>
    </section>
  );
}
