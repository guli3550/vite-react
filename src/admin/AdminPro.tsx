import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ProductModalV2 from "./ProductModalV2";
import AdminChatTab from "../components/AdminChatTab";
import { detectPlatform, type PlatformType } from "../utils/platformAdapter";
import { sendAdminReply, updateConversationMetadata, getTotalUnreadChatCount, subscribeToChat } from "../utils/chatSync";

import { AdminSidebar } from "./components/AdminSidebar";
import { SIDEBAR_NAV_ITEMS, type NavTabKey } from "./components/AdminSidebarData";
import { AdminHeader } from "./components/AdminHeader";
import { AdminCategoriesTab } from "./components/AdminCategoriesTab";
import { AdminPaymentsTab } from "./components/AdminPaymentsTab";
import { AdminBannersTab } from "./components/AdminBannersTab";
import { AdminAnalyticsTab } from "./components/AdminAnalyticsTab";
import { AdminCallCenterTab } from "./components/AdminCallCenterTab";
import { AdminNotificationsTab } from "./components/AdminNotificationsTab";
import { AdminSettingsTab } from "./components/AdminSettingsTab";
import { AdminExtensionsTab } from "./components/AdminExtensionsTab";
import { MetricCard } from "./components/AdminUIComponents";
import { formatColorName } from "../utils/colorHelpers";

import "./AdminPro.css";
import "./ReviewsNav.css";

type Product = {
  id?: number;
  product_code?: string;
  name: string;
  category: string;
  description: string;
  price: number;
  old_price?: number | null;
  image: string;
  images: string[];
  sizes: string[];
  colors: string[];
  rating: number;
  reviews: number;
  stock: number;
  featured: boolean;
  active?: boolean;
  sort_order?: number;
};

type Order = {
  id: string | number;
  order_number?: string;
  telegram_id?: number;
  username?: string;
  first_name?: string;
  phone?: string;
  total: number;
  subtotal: number;
  delivery: number;
  discount: number;
  payment: string;
  status: string;
  address?: any;
  items: any[];
  created_at: string;
};

type User = {
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  telegram_phone?: string;
  updated_at?: string;
};

type Promo = {
  id?: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

const API = (
  import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com"
).replace(/\/$/, "");

const STATUSES = [
  "Qabul qilindi",
  "Tayyorlanmoqda",
  "Yo‘lda",
  "Yetkazildi",
  "Bekor qilindi",
];

const emptyProduct: Product = {
  product_code: "",
  name: "",
  category: "Byustgalter",
  description: "",
  price: 0,
  old_price: null,
  image: "",
  images: [],
  sizes: [],
  colors: [],
  rating: 0,
  reviews: 0,
  stock: 0,
  featured: false,
  active: true,
  sort_order: 0,
};

const emptyPromo: Promo = {
  code: "",
  discount_type: "percent",
  discount_value: 10,
  min_order_amount: 0,
  usage_limit: null,
  used_count: 0,
  active: true,
};

const money = (n: number) =>
  `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;

const date = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
};

const csv = (rows: any[]) =>
  rows
    .map((r) =>
      r
        .map((x: any) => `"${String(x ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" })
  );
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const productCodes = (o: Order) =>
  (o.items || [])
    .map((it: any) => it?.product?.product_code || it?.product_code || "")
    .filter(Boolean);

function playBellChimeSound() {
  try {
    const isSoundEnabled = localStorage.getItem("guli_notif_sound_enabled") !== "false";
    if (!isSoundEnabled) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);

    osc2.frequency.setValueAtTime(1320, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.65);
    osc2.stop(ctx.currentTime + 0.65);
  } catch {}
}

export default function AdminPro() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("guli_admin_token") || ""
  );
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<NavTabKey>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [dashboard, setDashboard] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [product, setProduct] = useState<Product>(emptyProduct);
  const [promo, setPromo] = useState<Promo>(emptyPromo);
  const [productOpen, setProductOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [receiptLightboxUrl, setReceiptLightboxUrl] = useState<string | null>(null);

  // Online Chat Unread Count & Bell 3D Animation State
  const [unreadChatCount, setUnreadChatCount] = useState<number>(() => getTotalUnreadChatCount());
  const [isBellRinging, setIsBellRinging] = useState<boolean>(false);

  useEffect(() => {
    let prevCount = getTotalUnreadChatCount();
    setUnreadChatCount(prevCount);

    const unsubscribe = subscribeToChat((updatedMsgs) => {
      const newCount = getTotalUnreadChatCount();
      setUnreadChatCount(newCount);

      const latest = updatedMsgs[updatedMsgs.length - 1];
      if (latest && latest.sender === "user" && !latest.read && newCount > prevCount) {
        setIsBellRinging(true);
        playBellChimeSound();
        setTimeout(() => setIsBellRinging(false), 2400);
      }
      prevCount = newCount;
    });

    return () => unsubscribe();
  }, []);

  const [activePlatform, setActivePlatform] = useState<PlatformType>(
    () => detectPlatform().type
  );

  const handlePlatformChange = (p: PlatformType) => {
    setActivePlatform(p);
    const root = document.documentElement;
    root.setAttribute("data-platform", p);
    root.classList.remove(
      "platform-telegram",
      "platform-android",
      "platform-windows",
      "platform-tv",
      "platform-browser"
    );
    root.classList.add(`platform-${p}`);
    notify(`Preview almashtirildi: ${p.toUpperCase()} 📱`);
  };

  const notify = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3200);
  };

  const logout = () => {
    sessionStorage.removeItem("guli_admin_token");
    setToken("");
  };

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const r = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (r.status === 401) {
      logout();
      throw Error("Admin sessiyasi tugagan");
    }
    if (!r.ok || j?.success === false)
      throw Error(
        j?.message || j?.detail || `Server xatosi (${r.status})`
      );
    return j;
  }, [token]);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setBusy(true);
    const errors: string[] = [];
    try {
      const results = await Promise.allSettled([
        request("/api/admin/dashboard"),
        request("/api/admin/products?limit=500"),
        request("/api/admin/orders?limit=500"),
        request("/api/admin/users?limit=500"),
        request("/api/admin/promos?limit=500"),
      ]);
      const [d, p, o, u, pr] = results;
      if (d.status === "fulfilled") setDashboard(d.value.data);
      else
        errors.push(
          `Dashboard: ${
            d.reason instanceof Error ? d.reason.message : "xatolik"
          }`
        );
      if (p.status === "fulfilled") setProducts(p.value.data || []);
      else
        errors.push(
          `Mahsulotlar: ${
            p.reason instanceof Error ? p.reason.message : "xatolik"
          }`
        );
      if (o.status === "fulfilled") setOrders(o.value.data || []);
      else
        errors.push(
          `Buyurtmalar: ${
            o.reason instanceof Error ? o.reason.message : "xatolik"
          }`
        );
      if (u.status === "fulfilled") setUsers(u.value.data || []);
      else
        errors.push(
          `Mijozlar: ${
            u.reason instanceof Error ? u.reason.message : "xatolik"
          }`
        );
      if (pr.status === "fulfilled") setPromos(pr.value.data || []);
      else
        errors.push(
          `Promo kodlar: ${
            pr.reason instanceof Error ? pr.reason.message : "xatolik"
          }`
        );

      if (errors.length) {
        if (!silent) notify(errors.join(" • "));
      } else {
        if (!silent) notify("Ma’lumotlar yangilandi ✓");
      }
    } catch (e) {
      if (!silent) notify(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      if (!silent) setBusy(false);
    }
  }, [token, request]);

  useEffect(() => {
    if (!token) return;
    load(false);
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [token, load]);

  const doLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const r = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login, password }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw Error(j.message || "Kirish rad etildi");
      sessionStorage.setItem("guli_admin_token", j.token);
      setToken(j.token);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Kirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const productsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q
      ? products
      : products.filter((p) =>
          `${p.product_code || ""} ${p.name} ${p.category} ${p.id || ""}`
            .toLowerCase()
            .includes(q)
        );
  }, [products, query]);

  const ordersFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (statusFilter === "all" || o.status === statusFilter) &&
        (!q ||
          `${productCodes(o).join(" ")} ${o.order_number || o.id} ${
            o.first_name || ""
          } ${o.username || ""} ${o.phone || ""}`
            .toLowerCase()
            .includes(q))
    );
  }, [orders, statusFilter, query]);

  const usersFiltered = useMemo(
    () =>
      users.filter((u) =>
        `${u.telegram_id} ${u.username || ""} ${u.first_name || ""} ${
          u.last_name || ""
        } ${u.telegram_phone || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [users, query]
  );

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/"))
      throw Error("Faqat rasm fayli tanlang");
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const max = 1600;
      const scale = Math.min(
        1,
        max / Math.max(bitmap.width, bitmap.height)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Rasm tayyorlashda xatolik");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const dataUrl = canvas.toDataURL("image/webp", 0.82);
      const data = dataUrl.split(",")[1];
      const r = await request("/api/admin/upload-image", {
        method: "POST",
        body: JSON.stringify({
          data,
          mimeType: "image/webp",
          extension: "webp",
        }),
      });
      notify("Rasm yuklandi ✓");
      return r.data.url as string;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Rasmni yuklashda xatolik");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...product,
        price: Number(product.price),
        old_price: product.old_price ? Number(product.old_price) : null,
        stock: Number(product.stock),
        rating: Number(product.rating),
        reviews: Number(product.reviews),
        sort_order:
          Number(product.sort_order || 0) ||
          (!product.id
            ? Math.max(0, ...products.map((p) => Number(p.sort_order) || 0)) + 1
            : 0),
      };
      const r = product.id
        ? await request(`/api/admin/products/${product.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await request("/api/admin/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setProducts((x) =>
        product.id ? x.map((p) => (p.id === product.id ? r.data : p)) : [r.data, ...x]
      );
      setProductOpen(false);
      notify(
        `Mahsulot saqlandi${
          r.data?.product_code ? ` · ${r.data.product_code}` : ""
        } ✓`
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Saqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const savePromo = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const code = promo.code.trim().toUpperCase();
      const discount = Number(promo.discount_value);
      const min = Number(promo.min_order_amount || 0);
      const limit =
        promo.usage_limit == null || promo.usage_limit === null
          ? null
          : Number(promo.usage_limit);

      if (!/^[A-Z0-9_-]{3,40}$/.test(code))
        throw Error(
          "Promo kodi 3–40 belgidan iborat bo‘lsin (masalan: GULI10)"
        );
      if (!Number.isFinite(discount) || discount <= 0 || discount > 100)
        throw Error("Chegirma foizi 1 dan 100 gacha bo‘lishi kerak");
      if (!Number.isFinite(min) || min < 0)
        throw Error("Minimal buyurtma noto‘g‘ri");
      if (limit !== null && (!Number.isInteger(limit) || limit < 1))
        throw Error("Limit kamida 1 bo‘lishi kerak yoki bo‘sh qoldiring");

      const payload = {
        ...promo,
        code,
        discount_type: "percent",
        discount_value: discount,
        min_order_amount: min,
        usage_limit: limit,
      };
      const r = promo.id
        ? await request(`/api/admin/promos/${promo.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await request("/api/admin/promos", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setPromos((x) =>
        promo.id ? x.map((p) => (p.id === promo.id ? r.data : p)) : [r.data, ...x]
      );
      setPromoOpen(false);
      notify("Promo kod muvaffaqiyatli saqlandi ✓");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Promo kod yaratishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (o: Order, status: string) => {
    try {
      const r = await request(`/api/admin/orders/${o.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setOrders((x) => x.map((v) => (v.id === o.id ? r.data : v)));
      setSelectedOrder(r.data);

      const targetUserId = o.telegram_id || o.username || o.phone || "guest-user";
      const notifyMsg = `🔔 Buyurtmangiz holati yangilandi!

📦 Buyurtma №: ${o.order_number || o.id}
📊 Yangi Status: "${status}"
💰 Summa: ${money(o.total)}

GULI Lingerie xizmatidan foydalanganingiz uchun tashakkur! 🌸`;

      sendAdminReply(String(targetUserId), notifyMsg);
      updateConversationMetadata(String(targetUserId), {
        lastOrderStatus: status,
        lastOrderNumber: String(o.order_number || o.id),
        lastOrderTotal: o.total,
      });

      notify(`Status "${status}"ga o'zgartirildi va mijoz profili hamda botiga xabar yuborildi! ✓`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Status xatosi");
    }
  };

  const hideProduct = async (p: Product) => {
    try {
      const r = await request(`/api/admin/products/${p.id}`, {
        method: "DELETE",
      });
      setProducts((x) => x.map((v) => (v.id === p.id ? r.data : v)));
      notify("Mahsulot yashirildi");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xatolik");
    }
  };

  if (!token) {
    return (
      <div className="proLogin">
        <div className="loginAura" />
        <form className="proLoginCard" onSubmit={doLogin}>
          <div className="proLogo">🌷</div>
          <span className="proEyebrow">GULI PREMIUM</span>
          <h1>Control Center</h1>
          <p>Do‘konni bitta professional paneldan boshqaring.</p>
          <label>
            Login
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Parol
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {loginError && <div className="proError">{loginError}</div>}
          <button className="proPrimary" disabled={busy}>
            {busy ? "Tekshirilmoqda…" : "Kirish →"}
          </button>
          <small>Admin tokeni faqat sessionStorage’da saqlanadi.</small>
        </form>
      </div>
    );
  }

  const activeNavItem = SIDEBAR_NAV_ITEMS.find((n) => n.key === tab);
  const currentTitle = activeNavItem ? activeNavItem.label : "Bosh sahifa";
  const revenue = Number(dashboard?.todayRevenue || 0);

  return (
    <div className="proShell">
      {/* 15-Item Android-first Drawer Sidebar */}
      <AdminSidebar
        currentTab={tab}
        onSelectTab={(t) => {
          setTab(t);
          setQuery("");
        }}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onLogout={logout}
        unreadChatCount={unreadChatCount}
      />

      <main className="proMain">
        {/* Universal Header */}
        <AdminHeader
          title={currentTitle}
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          searchQuery={query}
          onSearchChange={setQuery}
          unreadNotificationsCount={unreadChatCount}
          isRinging={isBellRinging}
          activePlatform={activePlatform}
          onPlatformChange={handlePlatformChange}
          onRefresh={load}
          isBusy={busy}
          onSelectTab={setTab}
        />

        {/* Action Toolbars for Products & Promos */}
        {(tab === "products" || tab === "promos") && (
          <div className="proToolbar">
            {tab === "products" && (
              <button
                type="button"
                className="proPrimary"
                onClick={() => {
                  setProduct({ ...emptyProduct });
                  setProductOpen(true);
                }}
              >
                + Mahsulot
              </button>
            )}
            {tab === "promos" && (
              <button
                type="button"
                className="proPrimary"
                onClick={() => {
                  setPromo({ ...emptyPromo });
                  setPromoOpen(true);
                }}
              >
                + Promo kod
              </button>
            )}
          </div>
        )}

        {/* Tab 1: 🏠 Bosh sahifa */}
        {tab === "dashboard" && (
          <section className="dash">
            <div className="metricGrid">
              <MetricCard
                label="Bugungi savdo"
                value={money(revenue)}
                icon="₿"
                tone="rose"
              />
              <MetricCard
                label="Buyurtmalar"
                value={dashboard?.ordersCount || 0}
                icon="▣"
              />
              <MetricCard
                label="Mijozlar"
                value={dashboard?.usersCount || 0}
                icon="♙"
              />
              <MetricCard
                label="Faol mahsulotlar"
                value={dashboard?.productsCount || 0}
                icon="◈"
              />
            </div>
            <div className="dashGrid">
              <section className="proPanel">
                <PanelHead
                  eyebrow="OPERATSION"
                  title="Buyurtma holatlari"
                  action={() => setTab("orders")}
                />
                <div className="statusBoard">
                  {STATUSES.slice(0, 4).map((s) => (
                    <div key={s}>
                      <b>{dashboard?.statusCounts?.[s] || 0}</b>
                      <span>{s}</span>
                      <em
                        style={{
                          width: `${Math.min(
                            100,
                            Number(dashboard?.statusCounts?.[s] || 0) * 10
                          )}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
              <section className="proPanel">
                <PanelHead
                  eyebrow="OMBOR"
                  title="Kam qolganlar"
                  action={() => setTab("products")}
                />
                {(dashboard?.lowStock || []).length ? (
                  <div className="lowList">
                    {dashboard.lowStock.slice(0, 6).map((p: Product) => (
                      <div key={p.id}>
                        <span>{p.name}</span>
                        <b>{p.stock} dona</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="proEmpty">✓ Ombor barqaror</div>
                )}
              </section>
            </div>
            <section className="proPanel">
              <div className="panelHead">
                <div>
                  <span className="proEyebrow">LIVE</span>
                  <h2>So‘nggi buyurtmalar</h2>
                </div>
                <button type="button" onClick={() => setTab("orders")}>
                  Barchasi →
                </button>
              </div>
              <OrderTable
                rows={(dashboard?.recentOrders || []).slice(0, 8)}
                onOpen={(o) => setSelectedOrder(o)}
              />
            </section>
          </section>
        )}

        {/* Tab 2: 🛒 Buyurtmalar */}
        {tab === "orders" && (
          <section className="proPanel tablePanel">
            <div className="filterRow">
              {["all", ...STATUSES].map((s) => (
                <button
                  type="button"
                  key={s}
                  className={statusFilter === s ? "active" : ""}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "Barchasi" : s}
                </button>
              ))}
            </div>
            <div className="panelHead">
              <div>
                <span className="proEyebrow">ORDERS</span>
                <h2>{ordersFiltered.length} ta buyurtma</h2>
                <small>6 xonali mahsulot kodi bo‘yicha ham qidirish faol</small>
              </div>
              <button
                type="button"
                onClick={() =>
                  download(
                    "guli-orders.csv",
                    csv([
                      [
                        "Mahsulot kodi",
                        "Buyurtma",
                        "Mijoz",
                        "Telefon",
                        "Jami",
                        "To‘lov",
                        "Status",
                        "Sana",
                      ],
                      ...ordersFiltered.map((o) => [
                        productCodes(o).join(" "),
                        o.order_number || o.id,
                        o.first_name || o.username || "",
                        o.phone || "",
                        o.total,
                        o.payment,
                        o.status,
                        o.created_at,
                      ]),
                    ])
                  )
                }
              >
                ↓ CSV
              </button>
            </div>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>№</th>
                    <th>Mijoz</th>
                    <th>Mahsulot</th>
                    <th>Jami</th>
                    <th>To‘lov</th>
                    <th>Status</th>
                    <th>Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersFiltered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedOrder(o)}
                      className="clickable"
                    >
                      <td>
                        <b className="promoCode">
                          {productCodes(o).join(", ") || "—"}
                        </b>
                      </td>
                      <td>
                        <b>{o.order_number || o.id}</b>
                      </td>
                      <td>
                        <b>{o.first_name || "Mijoz"}</b>
                        <small>
                          {o.username ? `@${o.username}` : o.phone || ""}
                        </small>
                      </td>
                      <td>
                        {o.items?.[0]?.product?.name || "Buyurtma"}
                        {o.items?.length > 1 ? ` +${o.items.length - 1}` : ""}
                      </td>
                      <td>
                        <b>{money(o.total)}</b>
                      </td>
                      <td>{o.payment === "card" ? "Karta" : "Naqd"}</td>
                      <td>
                        <span className="pill">{o.status}</span>
                      </td>
                      <td>{date(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 3: 👗 Mahsulotlar */}
        {tab === "products" && (
          <section className="proPanel tablePanel">
            <div className="panelHead">
              <div>
                <span className="proEyebrow">CATALOG</span>
                <h2>{productsFiltered.length} ta mahsulot</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  download(
                    "guli-products.csv",
                    csv([
                      ["Kod", "ID", "Nom", "Kategoriya", "Narx", "Ombor", "Holat"],
                      ...productsFiltered.map((p) => [
                        p.product_code || "",
                        p.id,
                        p.name,
                        p.category,
                        p.price,
                        p.stock,
                        p.active === false ? "Yashirin" : "Faol",
                      ]),
                    ])
                  )
                }
              >
                ↓ CSV
              </button>
            </div>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Mahsulot</th>
                    <th>Kategoriya</th>
                    <th>Narx</th>
                    <th>Ombor</th>
                    <th>Holat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {productsFiltered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b className="promoCode">{p.product_code || "—"}</b>
                      </td>
                      <td>
                        <div className="entityCell">
                          <img
                            src={
                              p.image ||
                              "https://placehold.co/72x72/f6e8eb/b95a70?text=G"
                            }
                            alt={p.name}
                          />
                          <div>
                            <b>{p.name}</b>
                            <small>
                              Kod {p.product_code || "KOD YO‘Q"}
                            </small>
                            <small>ID {p.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        <b>{money(p.price)}</b>
                        {p.old_price && <del>{money(p.old_price)}</del>}
                      </td>
                      <td>
                        <span
                          className={
                            p.stock < 5 ? "stock dangerStock" : "stock"
                          }
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            p.active === false ? "mutedPill" : ""
                          }`}
                        >
                          {p.active === false
                            ? "Yashirin"
                            : p.featured
                            ? "Tanlangan"
                            : "Faol"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            onClick={() => {
                              setProduct({
                                ...p,
                                images: p.images || [],
                                sizes: p.sizes || [],
                                colors: p.colors || [],
                              });
                              setProductOpen(true);
                            }}
                          >
                            Tahrirlash
                          </button>
                          {p.active !== false && (
                            <button
                              type="button"
                              className="dangerBtn"
                              onClick={() => hideProduct(p)}
                            >
                              Yashirish
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 4: 🗂 Kategoriyalar */}
        {tab === "categories" && <AdminCategoriesTab notify={notify} />}

        {/* Tab 5: 👥 Mijozlar */}
        {tab === "customers" && (
          <section className="proPanel tablePanel">
            <div className="panelHead">
              <div>
                <span className="proEyebrow">CRM</span>
                <h2>{usersFiltered.length} ta mijoz</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  download(
                    "guli-customers.csv",
                    csv([
                      ["Telegram ID", "Ism", "Username", "Telefon", "Yangilangan"],
                      ...usersFiltered.map((u) => [
                        u.telegram_id,
                        [u.first_name, u.last_name].filter(Boolean).join(" "),
                        u.username ? `@${u.username}` : "",
                        u.telegram_phone || "",
                        u.updated_at || "",
                      ]),
                    ])
                  )
                }
              >
                ↓ CSV
              </button>
            </div>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Mijoz</th>
                    <th>Telegram ID</th>
                    <th>Username</th>
                    <th>Telefon</th>
                    <th>Yangilangan</th>
                  </tr>
                </thead>
                <tbody>
                  {usersFiltered.map((u) => (
                    <tr
                      key={u.telegram_id}
                      className="clickable"
                      onClick={() => setSelectedUser(u)}
                    >
                      <td>
                        <div className="avatarMini">
                          {(u.first_name || "G").slice(0, 1).toUpperCase()}
                        </div>
                        <b>
                          {[u.first_name, u.last_name].filter(Boolean).join(" ") ||
                            "Noma’lum"}
                        </b>
                      </td>
                      <td>{u.telegram_id}</td>
                      <td>{u.username ? `@${u.username}` : "—"}</td>
                      <td>{u.telegram_phone || "—"}</td>
                      <td>{u.updated_at ? date(u.updated_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 6: 💳 To‘lovlar */}
        {tab === "payments" && <AdminPaymentsTab notify={notify} />}

        {/* Tab 7: 🎟 Kuponlar */}
        {tab === "promos" && (
          <section className="proPanel tablePanel">
            <div className="panelHead">
              <div>
                <span className="proEyebrow">MARKETING</span>
                <h2>{promos.length} ta promo</h2>
              </div>
            </div>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Chegirma</th>
                    <th>Min.</th>
                    <th>Foydalanish</th>
                    <th>Holat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {promos
                    .filter((p) =>
                      p.code.toLowerCase().includes(query.toLowerCase())
                    )
                    .map((p) => (
                      <tr key={p.id}>
                        <td>
                          <b className="promoCode">{p.code}</b>
                        </td>
                        <td>
                          {p.discount_type === "percent"
                            ? `${p.discount_value}%`
                            : money(p.discount_value)}
                        </td>
                        <td>{money(p.min_order_amount)}</td>
                        <td>
                          {p.used_count}
                          {p.usage_limit ? ` / ${p.usage_limit}` : " / ∞"}
                        </td>
                        <td>
                          <span
                            className={`pill ${p.active ? "" : "mutedPill"}`}
                          >
                            {p.active ? "Faol" : "O‘chiq"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setPromo({ ...p });
                              setPromoOpen(true);
                            }}
                          >
                            Tahrirlash
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 8: 🖼 Bannerlar */}
        {tab === "banners" && <AdminBannersTab notify={notify} />}

        {/* Tab 9: 📊 Tahlillar */}
        {tab === "analytics" && <AdminAnalyticsTab dashboardData={dashboard} />}

        {/* Tab 10: 💬 Online Chat */}
        {tab === "chat" && <AdminChatTab token={token} />}

        {/* Tab 11: ☎️ Call Center Chat */}
        {tab === "callcenter" && <AdminCallCenterTab notify={notify} />}

        {/* Tab 12: 🔔 Xabarlar */}
        {tab === "notifications" && <AdminNotificationsTab notify={notify} />}

        {/* Tab 13: ⚙️ Sozlamalar */}
        {tab === "settings" && (
          <AdminSettingsTab
            notify={notify}
            activePlatform={activePlatform}
            onPlatformChange={handlePlatformChange}
          />
        )}

        {/* Tab 14: 🧩 Qo‘shimcha */}
        {tab === "extensions" && <AdminExtensionsTab notify={notify} />}
      </main>

      {/* Mobile Bottom Navigation Bar for quick access */}
      <nav className="proMobileNav">
        {SIDEBAR_NAV_ITEMS.slice(0, 5).map((n) => (
          <button
            key={n.key}
            type="button"
            className={tab === n.key ? "active" : ""}
            onClick={() => {
              setTab(n.key);
              setQuery("");
            }}
          >
            <span>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatus={updateStatus}
          onOpenReceipt={(url) => setReceiptLightboxUrl(url)}
        />
      )}
      {receiptLightboxUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
          }}
          onClick={() => setReceiptLightboxUrl(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img
              src={receiptLightboxUrl}
              alt="To'lov cheki"
              style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
            />
            <button
              type="button"
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                background: "#ffffff",
                color: "#000",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                fontWeight: 700,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              onClick={() => setReceiptLightboxUrl(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          orders={orders}
          onClose={() => setSelectedUser(null)}
          onOrder={setSelectedOrder}
        />
      )}
      {productOpen && (
        <ProductModalV2
          value={product}
          busy={busy}
          onClose={() => setProductOpen(false)}
          onChange={setProduct}
          onSave={saveProduct}
          onUpload={uploadImage}
        />
      )}
      {promoOpen && (
        <PromoModal
          value={promo}
          busy={busy}
          onClose={() => setPromoOpen(false)}
          onChange={setPromo}
          onSave={savePromo}
        />
      )}
      {toast && <div className="proToast">{toast}</div>}
      {busy && <div className="proBusy" />}
    </div>
  );
}

function PanelHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: () => void;
}) {
  return (
    <div className="panelHead">
      <div>
        <span className="proEyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action && (
        <button type="button" onClick={action}>
          Ko‘rish →
        </button>
      )}
    </div>
  );
}

function OrderTable({
  rows,
  onOpen,
}: {
  rows: any[];
  onOpen: (o: any) => void;
}) {
  return (
    <div className="tableScroll">
      <table>
        <thead>
          <tr>
            <th>Buyurtma</th>
            <th>Mijoz</th>
            <th>Summa</th>
            <th>Status</th>
            <th>Sana</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr
              key={o.id}
              className="clickable"
              onClick={() => onOpen(o)}
            >
              <td>
                <b>{o.order_number || o.id}</b>
              </td>
              <td>{o.first_name || o.username || "Mijoz"}</td>
              <td>
                <b>{money(o.total)}</b>
              </td>
              <td>
                <span className="pill">{o.status}</span>
              </td>
              <td>{date(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDrawer({
  order,
  onClose,
  onStatus,
  onOpenReceipt,
}: {
  order: Order;
  onClose: () => void;
  onStatus: (o: Order, s: string) => void;
  onOpenReceipt: (url: string) => void;
}) {
  const addr = order.address || {};
  const codes = productCodes(order);
  const receiptImg = (order as any).receiptUrl || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80";

  return (
    <div className="drawerShade" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="proEyebrow">BUYURTMA</span>
            <h2>№ {order.order_number || order.id}</h2>
            <small>{date(order.created_at)}</small>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawerBody">
          <section className="detailHero">
            <span className="orderIcon">▣</span>
            <div>
              <b>{order.first_name || "Mijoz"}</b>
              <small>
                {order.username ? `@${order.username}` : "Telegram mijozi"}
              </small>
            </div>
          </section>
          <div className="detailGrid">
            <div>
              <small>Mahsulot kodi</small>
              <b>{codes.join(", ") || "—"}</b>
            </div>
            <div>
              <small>Telefon</small>
              <b>{order.phone || "—"}</b>
            </div>
            <div>
              <small>To‘lov</small>
              <b>{order.payment === "card" ? "Karta" : "Naqd"}</b>
            </div>
            <div>
              <small>Mahsulotlar</small>
              <b>{money(order.subtotal)}</b>
            </div>
            <div>
              <small>Yetkazib berish</small>
              <b>{order.delivery ? money(order.delivery) : "Bepul"}</b>
            </div>
            <div>
              <small>Jami</small>
              <b>{money(order.total)}</b>
            </div>
          </div>

          {/* Mijoz Yuborgan To'lov Cheki */}
          <div className="detailSection" style={{ background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                🧾 Mijoz yuborgan to‘lov cheki ({order.payment === "card" ? "💳 Karta o'tkazmasi" : "💳 Click / Payme"})
              </h3>
              <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                Yuklangan chek
              </span>
            </div>
            
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div
                style={{
                  position: "relative",
                  cursor: "pointer",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid #cbd5e1",
                  width: 100,
                  height: 120,
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                onClick={() => onOpenReceipt(receiptImg)}
              >
                <img
                  src={receiptImg}
                  alt="To'lov cheki"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{ position: "absolute", bottom: 0, inset: "auto 0 0 0", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, textAlign: "center", padding: "2px 0" }}>
                  🔍 Kengaytirish
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                  <b>To'lov turi:</b> {order.payment === "card" ? "💳 Karta o'tkazmasi (Uzcard/Humo)" : "💳 Click / Payme"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
                  <b>Tranzaksiya:</b> #{order.order_number || order.id}-TX
                </div>

                {order.status !== "Qabul qilindi" ? (
                  <button
                    type="button"
                    style={{
                      background: "#059669",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                    }}
                    onClick={() => onStatus(order, "Qabul qilindi")}
                  >
                    ✅ Chek haqiqiy — Statusni "Qabul qilindi"ga o'zgartirish
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, background: "#ecfdf5", padding: "6px 10px", borderRadius: 8 }}>
                    ✓ Chek haqiqiy va status "Qabul qilindi"ga o'tkazilgan
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="detailSection">
            <h3>Status</h3>
            <select
              value={order.status}
              onChange={(e) => onStatus(order, e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="timeline">
              {STATUSES.slice(0, 4).map((s, i) => {
                const current = STATUSES.indexOf(order.status);
                return (
                  <div className={i <= current ? "done" : ""} key={s}>
                    <span>{i < current ? "✓" : i + 1}</span>
                    <b>{s}</b>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="detailSection">
            <h3>Mahsulotlar</h3>
            {(order.items || []).map((it: any, i: number) => (
              <div className="lineItem" key={i}>
                {it.product?.image && <img src={it.product.image} alt="" />}
                <div>
                  <b>{it.product?.name || "Mahsulot"}</b>
                  <small>
                    {it.product?.product_code
                      ? `Kod: ${it.product.product_code} · `
                      : ""}
                    {it.size || "—"} · {formatColorName(it.color) || "—"} ·{" "}
                    {it.quantity || 1} dona
                  </small>
                </div>
                <strong>
                  {money(
                    Number(it.product?.price || 0) * Number(it.quantity || 1)
                  )}
                </strong>
              </div>
            ))}
          </div>
          <div className="detailSection">
            <h3>Yetkazib berish manzili</h3>
            <p className="addressText">
              📍{" "}
              {[
                addr.region,
                addr.district,
                addr.street,
                addr.house,
                addr.apartment,
              ]
                .filter(Boolean)
                .join(", ") || "Manzil ko‘rsatilmagan"}
            </p>
            {addr.landmark && <small>Mo‘ljal: {addr.landmark}</small>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function UserDrawer({
  user,
  orders,
  onClose,
  onOrder,
}: {
  user: User;
  orders: Order[];
  onClose: () => void;
  onOrder: (o: Order) => void;
}) {
  const mine = orders.filter(
    (o) =>
      o.telegram_id === user.telegram_id ||
      (user.username && o.username === user.username)
  );
  const spend = mine.reduce((s, o) => s + Number(o.total || 0), 0);
  return (
    <div className="drawerShade" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="proEyebrow">CRM MIJOZ</span>
            <h2>
              {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                "Noma’lum"}
            </h2>
            <small>
              {user.username ? `@${user.username}` : "Telegram foydalanuvchisi"}
            </small>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawerBody">
          <section className="detailHero">
            <div className="avatarLarge">
              {(user.first_name || "G").slice(0, 1)}
            </div>
            <div>
              <b>{user.telegram_phone || "Telefon saqlanmagan"}</b>
              <small>ID: {user.telegram_id}</small>
            </div>
          </section>
          <div className="detailGrid">
            <div>
              <small>Buyurtmalar</small>
              <b>{mine.length}</b>
            </div>
            <div>
              <small>Jami xarid</small>
              <b>{money(spend)}</b>
            </div>
          </div>
          <div className="detailSection">
            <h3>Buyurtmalar tarixi</h3>
            {mine.length ? (
              mine.map((o) => (
                <button
                  type="button"
                  className="customerOrder"
                  key={o.id}
                  onClick={() => onOrder(o)}
                >
                  <span>
                    {productCodes(o)[0] || "—"} · {o.order_number || o.id}
                  </span>
                  <b>{money(o.total)}</b>
                  <small>{o.status}</small>
                </button>
              ))
            ) : (
              <p>Bu mijozda buyurtmalar topilmadi.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function PromoModal({
  value,
  busy,
  onClose,
  onChange,
  onSave,
}: {
  value: Promo;
  busy: boolean;
  onClose: () => void;
  onChange: (v: Promo) => void;
  onSave: (e: FormEvent) => void;
}) {
  const set = (k: keyof Promo, v: any) => onChange({ ...value, [k]: v });
  const replaceZeroOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.currentTarget.value === "0") e.currentTarget.select();
  };
  return (
    <Modal
      title={value.id ? "Promo tahrirlash" : "Yangi promo"}
      eyebrow="MARKETING"
      onClose={onClose}
    >
      <form onSubmit={onSave}>
        <div className="formGrid">
          <label>
            Kod
            <input
              value={value.code}
              onChange={(e) =>
                set("code", e.target.value.toUpperCase().replace(/\s/g, ""))
              }
              placeholder="Masalan: GULI10"
              maxLength={40}
              pattern="[A-Za-z0-9_-]{3,40}"
              required
            />
            <small>Faqat harf, raqam, _ va - ishlating.</small>
          </label>
          <label>
            Chegirma (%)
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={value.discount_value}
              onFocus={replaceZeroOnFocus}
              onChange={(e) =>
                set(
                  "discount_value",
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
            />
            <small>Mijoz savatidan shu foiz chegiriladi.</small>
          </label>
          <label>
            Minimal buyurtma (ixtiyoriy)
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={value.min_order_amount}
              onFocus={replaceZeroOnFocus}
              onChange={(e) =>
                set(
                  "min_order_amount",
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
            />
            <small>0 bo‘lsa minimal summa talabi yo‘q.</small>
          </label>
          <label>
            Foydalanish limiti (ixtiyoriy)
            <input
              type="number"
              min="1"
              step="1"
              value={value.usage_limit ?? ""}
              onChange={(e) =>
                set(
                  "usage_limit",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="∞"
            />
            <small>Bo‘sh qoldirilsa cheksiz.</small>
          </label>
          <label>
            Holat
            <select
              value={value.active ? "active" : "off"}
              onChange={(e) => set("active", e.target.value === "active")}
            >
              <option value="active">Faol</option>
              <option value="off">O‘chiq</option>
            </select>
          </label>
        </div>
        <div className="modalActions">
          <button type="button" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="proPrimary" disabled={busy}>
            {busy ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: any;
}) {
  return (
    <div className="modalShade" onMouseDown={onClose}>
      <div className="proModal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div>
            <span className="proEyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
