import { useMemo, useState, useEffect } from "react";
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
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
];
const UZ_MONTHS_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyun",
  "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"
];

const formatPrice = (n: number) => `${Math.round(n).toLocaleString("uz-UZ")} so'm`;

const formatShortPrice = (n: number) => {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}k`;
  }
  return String(n);
};

// Animated counter hook
function useCountUp(endValue: number, durationMs = 900) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * endValue));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        setCount(endValue);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [endValue, durationMs]);

  return count;
}

export function MonthlySpendingChart({ orders, onViewOrders }: SpendingChartProps) {
  const [chartType, setChartType] = useState<"bar" | "area">("bar");
  const [activeMonthIdx, setActiveMonthIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    const list = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = `${UZ_MONTHS[month]} ${year}`;
      const shortLabel = UZ_MONTHS_SHORT[month];

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
        shortLabel,
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

  // Animated counters
  const animatedTotalSpent = useCountUp(totalSpent6m, 1000);
  const animatedAvgSpend = useCountUp(avgMonthlySpend, 1000);
  const animatedOrdersCount = useCountUp(totalOrders6m, 800);

  const activeDataPoint = activeMonthIdx !== null ? data[activeMonthIdx] : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="spending3DTooltip">
          <div className="tooltip3DHead">
            <span className="tooltip3DDot" />
            <span className="tooltip3DMonth">{item.label}</span>
          </div>
          <div className="tooltip3DValue">{formatPrice(item.total)}</div>
          <div className="tooltip3DMeta">
            <span>📦 {item.count > 0 ? `${item.count} ta xarid` : "Xarid qilinmagan"}</span>
            {item.total > 0 && maxSpend > 0 ? (
              <span className="tooltip3DShare">
                {Math.round((item.total / (totalSpent6m || 1)) * 100)}% ulush
              </span>
            ) : null}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section 
      className="spendingAnalytics3DCard" 
      id="orders-spending-analytics"
    >
      {/* 3D ambient glow elements */}
      <div className="card3DGlowTop" />
      <div className="card3DGlowBottom" />

      <div className="spending3DHeader">
        <div className="spendingTitleGroup">
          <div className="spendingBadge3D">
            <span className="badgeIcon3D">📊</span>
            <span className="badgeText3D">STATISTIKA & XARAJATLAR</span>
          </div>
          <h3>Xaridlar tahlili va balansi</h3>
          <p className="spendingSubTitle">Oxirgi 6 oylik buyurtmalar dinamikasi</p>
        </div>

        <div className="chartToggle3DGroup" role="radiogroup" aria-label="Grafik turi">
          <button
            type="button"
            className={`chartToggle3DBtn ${chartType === "bar" ? "active" : ""}`}
            onClick={() => setChartType("bar")}
            title="3D Ustunli grafik"
            aria-checked={chartType === "bar"}
            role="radio"
          >
            <span className="toggleIcon3D">📊</span>
            <span className="toggleLabel3D">Ustunli</span>
          </button>
          <button
            type="button"
            className={`chartToggle3DBtn ${chartType === "area" ? "active" : ""}`}
            onClick={() => setChartType("area")}
            title="3D Chiziqli grafik"
            aria-checked={chartType === "area"}
            role="radio"
          >
            <span className="toggleIcon3D">📈</span>
            <span className="toggleLabel3D">Chiziqli</span>
          </button>
        </div>
      </div>

      {/* 3D Animated Summary Stats */}
      <div className="spending3DStatsGrid">
        <div className="stat3DCard statCardTotal">
          <div className="stat3DCardHeader">
            <div className="stat3DIconWrapper bgRose3D">
              <span>💳</span>
            </div>
            <span className="stat3DTag">6 oylik</span>
          </div>
          <small className="stat3DLabel">Jami xarajat</small>
          <strong className="stat3DValue">{formatPrice(animatedTotalSpent)}</strong>
        </div>

        <div className="stat3DCard statCardAvg">
          <div className="stat3DCardHeader">
            <div className="stat3DIconWrapper bgGold3D">
              <span>✨</span>
            </div>
            <span className="stat3DTag">O‘rtacha</span>
          </div>
          <small className="stat3DLabel">Oylik o‘rtacha</small>
          <strong className="stat3DValue">{formatPrice(animatedAvgSpend)}</strong>
        </div>

        <div className="stat3DCard statCardCount">
          <div className="stat3DCardHeader">
            <div className="stat3DIconWrapper bgEmerald3D">
              <span>🛍️</span>
            </div>
            <span className="stat3DTag">Jami</span>
          </div>
          <small className="stat3DLabel">Buyurtmalar</small>
          <strong className="stat3DValue">{animatedOrdersCount} ta</strong>
        </div>
      </div>

      {/* Interactive Active Month highlight strip if clicked or selected */}
      {activeDataPoint && activeDataPoint.total > 0 && (
        <div className="activeMonth3DCallout">
          <span className="calloutIcon3D">📍</span>
          <div>
            <b>{activeDataPoint.label} oyida:</b> {formatPrice(activeDataPoint.total)} ({activeDataPoint.count} ta buyurtma)
          </div>
        </div>
      )}

      {/* 3D Canvas / Chart Wrapper */}
      <div className="chart3DCanvasWrapper">
        <ResponsiveContainer width="100%" height={210}>
          {chartType === "bar" ? (
            <BarChart 
              data={data} 
              margin={{ top: 18, right: 10, left: -16, bottom: 4 }}
              onMouseMove={(state: any) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setActiveMonthIdx(state.activeTooltipIndex);
                }
              }}
              onMouseLeave={() => setActiveMonthIdx(null)}
            >
              <defs>
                <linearGradient id="barGradient3D" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e11d48" stopOpacity={0.95} />
                  <stop offset="40%" stopColor="#be123c" stopOpacity={0.88} />
                  <stop offset="100%" stopColor="#9f1239" stopOpacity={0.72} />
                </linearGradient>
                <linearGradient id="barGradientMax3D" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4d79" stopOpacity={1} />
                  <stop offset="50%" stopColor="#e11d48" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#881337" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="barGradientEmpty3D" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f3d7df" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#faebf0" stopOpacity={0.4} />
                </linearGradient>
                <filter id="shadow3D" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#e11d48" floodOpacity="0.25" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="rgba(225, 29, 72, 0.08)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={{ stroke: "rgba(225, 29, 72, 0.15)" }}
                tick={{ fill: "#8f7c82", fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#a08e93", fontSize: 10, fontWeight: 500 }}
                tickFormatter={formatShortPrice}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(225, 29, 72, 0.05)", radius: 8 }} />
              <Bar 
                dataKey="total" 
                radius={[8, 8, 2, 2]} 
                maxBarSize={38} 
                animationDuration={950}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => {
                  const isMax = entry.total === maxSpend && maxSpend > 0;
                  const isEmpty = entry.total === 0;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        isEmpty
                          ? "url(#barGradientEmpty3D)"
                          : isMax
                          ? "url(#barGradientMax3D)"
                          : "url(#barGradient3D)"
                      }
                      style={{
                        filter: !isEmpty ? "url(#shadow3D)" : undefined,
                        cursor: "pointer",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart 
              data={data} 
              margin={{ top: 18, right: 10, left: -16, bottom: 4 }}
              onMouseMove={(state: any) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setActiveMonthIdx(state.activeTooltipIndex);
                }
              }}
              onMouseLeave={() => setActiveMonthIdx(null)}
            >
              <defs>
                <linearGradient id="areaGlowGradient3D" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e11d48" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#e11d48" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="rgba(225, 29, 72, 0.08)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={{ stroke: "rgba(225, 29, 72, 0.15)" }}
                tick={{ fill: "#8f7c82", fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#a08e93", fontSize: 10, fontWeight: 500 }}
                tickFormatter={formatShortPrice}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#e11d48"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#areaGlowGradient3D)"
                activeDot={{ 
                  r: 6, 
                  fill: "#e11d48", 
                  stroke: "#ffffff", 
                  strokeWidth: 3
                }}
                animationDuration={950}
                animationEasing="ease-out"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* 3D Footer with dynamic indicator */}
      <div className="spending3DFooter">
        <div className="legendItem3D">
          <span className="legendPulseDot" />
          <span className="legendLabelText">
            {maxSpend > 0 
              ? `Eng yuqori: ${data.find(d => d.total === maxSpend)?.label} (${formatPrice(maxSpend)})` 
              : "Buyurtmalar balansi hisoblanmoqda"}
          </span>
        </div>
        {onViewOrders && (
          <button type="button" className="viewOrders3DBtn" onClick={onViewOrders}>
            <span>Buyurtmalar tarixi</span>
            <span className="arrowIcon3D">→</span>
          </button>
        )}
      </div>
    </section>
  );
}
