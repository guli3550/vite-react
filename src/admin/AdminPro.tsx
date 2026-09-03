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
import ReviewsAdmin from "./ReviewsAdmin";
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
  last_name?: string;
  customer_name?: string;
  birth_date?: string;
  dob?: string;
  telegram_photo?: string;
  photo_url?: string;
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
  receipt_url?: string;
  receiptUrl?: string;
  payment_status?: string;
};

function parseOrderAddress(raw: any) {
  if (!raw) return { region: "", district: "", street: "", house: "", apartment: "", landmark: "", latitude: undefined, longitude: undefined, formatted_address: "" };
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { region: "", district: "", street: raw, house: "", apartment: "", landmark: "", formatted_address: raw };
    }
  }
  return {
    region: String(obj.region || obj.city || obj.viloyat || "").trim(),
    district: String(obj.district || obj.tuman || "").trim(),
    street: String(obj.street || obj.street_name || obj.street_address || obj.address_line || obj.kocha || "").trim(),
    house: String(obj.house || obj.house_number || obj.dom || obj.building || obj.bino || "").trim(),
    apartment: String(obj.apartment || obj.flat || obj.apartment_number || obj.padez || obj.entrance || obj.xonadon || "").trim(),
    landmark: String(obj.landmark || obj.moljal || obj.target || obj.note || obj.comment || "").trim(),
    latitude: obj.latitude || obj.lat,
    longitude: obj.longitude || obj.lng || obj.lon,
    formatted_address: String(obj.formatted_address || obj.address || obj.full_address || "").trim(),
  };
}

function formatBirthDate(v?: string): string {
  if (!v) return "";
  const str = String(v).trim();
  const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchIso) {
    const [, y, m, d] = matchIso;
    const mIdx = Number(m) - 1;
    return `${d}.${m}.${y} (${Number(d)}-${months[mIdx] || m}, ${y}-yil)`;
  }
  const matchDot = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (matchDot) {
    const [, d, m, y] = matchDot;
    const dPad = d.padStart(2, "0");
    const mPad = m.padStart(2, "0");
    const mIdx = Number(m) - 1;
    return `${dPad}.${mPad}.${y} (${Number(d)}-${months[mIdx] || m}, ${y}-yil)`;
  }
  return str;
}

type User = {
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  telegram_phone?: string;
  updated_at?: string;
  photo_url?: string;
  telegram_photo?: string;
};

type Promo = {
  id?: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount_amount?: number | null;
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
  max_discount_amount: null,
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
  const [customApiUrl, setCustomApiUrl] = useState<string>(
    () => sessionStorage.getItem("guli_custom_api_url") || API
  );
  const [token, setToken] = useState(
    () => sessionStorage.getItem("guli_admin_token") || ""
  );
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [directTokenInput, setDirectTokenInput] = useState("");
  const [pingStatus, setPingStatus] = useState<string>("");
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
  const [userPhotosMap, setUserPhotosMap] = useState<Record<number, string>>({});

  // Kun / Tun rejimini mijoz web app kabi to'liq qo'llash va eshitib turish
  useEffect(() => {
    const applyTheme = () => {
      const mode = localStorage.getItem("guli_admin_theme") || localStorage.getItem("guli_theme") || "light";
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.classList.toggle("dark", mode === "dark");
    };
    applyTheme();
    window.addEventListener("guli_theme_changed", applyTheme);
    window.addEventListener("guli_settings_updated", applyTheme);
    return () => {
      window.removeEventListener("guli_theme_changed", applyTheme);
      window.removeEventListener("guli_settings_updated", applyTheme);
    };
  }, []);

  // Mijozlarning Telegram profil rasmlarini sinxronlashtirish
  useEffect(() => {
    let cancelled = false;
    const adminToken = sessionStorage.getItem("guli_admin_token") || "";
    const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\/$/, "");
    if (!adminToken || !users.length) return;

    const missingUsers = users.filter((u) => u.telegram_id && !userPhotosMap[u.telegram_id]);
    if (!missingUsers.length) return;

    missingUsers.slice(0, 30).forEach((u) => {
      fetch(`${base}/api/admin/users/${u.telegram_id}/details`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
        .then((r) => r.json().catch(() => null))
        .then((j) => {
          if (!cancelled && j?.success && j?.data?.photos?.length) {
            const pUrl = j.data.photos[0]?.url;
            if (pUrl) {
              setUserPhotosMap((prev) => ({ ...prev, [u.telegram_id]: pUrl }));
            }
          }
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [users, token]);

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

  // When admin opens the chat tab, stop ringing bell animation
  useEffect(() => {
    if (tab === "chat") {
      setIsBellRinging(false);
    }
  }, [tab]);

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
    const base = (customApiUrl.trim() || API).replace(/\/$/, "");
    const r = await fetch(`${base}${path}`, {
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
  }, [token, customApiUrl]);

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
    const cleanLogin = login.trim();
    const cleanPassword = password.trim();
    const targetApi = (customApiUrl.trim() || API).replace(/\/$/, "");
    try {
      const r = await fetch(`${targetApi}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanLogin, password: cleanPassword }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) {
        if (r.status === 401) {
          throw Error(
            `Kirish rad etildi (401): Login yoki parol Render serveridagi ADMIN_USERNAME va ADMIN_PASSWORD bilan to‘liq mos kelmadi.`
          );
        }
        if (r.status === 503) {
          throw Error(
            `Server sozlanmagan (503): Render.com da ADMIN_USERNAME, ADMIN_PASSWORD yoki ADMIN_SECRET o‘rnatilmagan.`
          );
        }
        throw Error(j?.message || `Server xatosi (${r.status})`);
      }
      sessionStorage.setItem("guli_custom_api_url", targetApi);
      sessionStorage.setItem("guli_admin_token", j.token);
      setToken(j.token);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Kirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleDirectTokenLogin = () => {
    const t = directTokenInput.trim();
    if (!t) {
      setLoginError("Iltimos, tokenni kiriting");
      return;
    }
    const targetApi = (customApiUrl.trim() || API).replace(/\/$/, "");
    sessionStorage.setItem("guli_custom_api_url", targetApi);
    sessionStorage.setItem("guli_admin_token", t);
    setToken(t);
  };

  const testServerPing = async () => {
    setPingStatus("Tekshirilmoqda...");
    const targetApi = (customApiUrl.trim() || API).replace(/\/$/, "");
    try {
      const start = Date.now();
      const r = await fetch(`${targetApi}/api/health`, { method: "GET" });
      const j = await r.json().catch(() => null);
      const ms = Date.now() - start;
      if (r.ok && j?.status === "online") {
        setPingStatus(`🟢 Server online (${ms}ms)`);
      } else {
        setPingStatus(`🟡 Server javob berdi (${r.status})`);
      }
    } catch (err: any) {
      setPingStatus(`🔴 Ulanib bo‘lmadi: ${err.message || "Xatolik"}`);
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
      const type = promo.discount_type === "fixed" ? "fixed" : "percent";
      const discount = Number(promo.discount_value);
      const min = Number(promo.min_order_amount || 0);
      const maxLimit =
        promo.max_discount_amount == null || (promo.max_discount_amount as any) === ""
          ? null
          : Number(promo.max_discount_amount);
      const limit =
        promo.usage_limit == null || promo.usage_limit === null || (promo.usage_limit as any) === ""
          ? null
          : Number(promo.usage_limit);

      if (!/^[A-Z0-9_-]{3,40}$/.test(code))
        throw Error(
          "Promo kodi 3–40 belgidan iborat bo‘lsin (masalan: GULI10)"
        );
      if (type === "percent") {
        if (!Number.isFinite(discount) || discount <= 0 || discount > 100)
          throw Error("Chegirma foizi 1 dan 100 gacha bo‘lishi kerak");
      } else {
        if (!Number.isFinite(discount) || discount <= 0)
          throw Error("Chegirma summasi 0 dan katta bo‘lishi kerak");
      }
      if (maxLimit !== null && (!Number.isFinite(maxLimit) || maxLimit <= 0))
        throw Error("Maksimal chegirma summasi 0 dan katta bo‘lishi kerak yoki bo‘sh qoldiring");
      if (!Number.isFinite(min) || min < 0)
        throw Error("Minimal buyurtma noto‘g‘ri");
      if (limit !== null && (!Number.isInteger(limit) || limit < 1))
        throw Error("Limit kamida 1 bo‘lishi kerak yoki bo‘sh qoldiring");

      const payload = {
        ...promo,
        code,
        discount_type: type,
        discount_value: discount,
        max_discount_amount: maxLimit,
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
              placeholder="Admin login"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Parol
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin parol"
                autoComplete="current-password"
                style={{ paddingRight: "44px" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  padding: "4px 8px",
                  color: "#887076",
                }}
                title={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>
          {loginError && <div className="proError">{loginError}</div>}
          <button className="proPrimary" disabled={busy}>
            {busy ? "Tekshirilmoqda…" : "Kirish →"}
          </button>

          <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px dashed #e8d7dc" }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: "transparent",
                border: "none",
                color: "#965b6e",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 0",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <span>⚙️ Server & Token sozlamalari</span>
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div style={{ marginTop: "12px", display: "grid", gap: "10px", fontSize: "12px", textAlign: "left" }}>
                <div>
                  <label style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "#6d5e64" }}>
                    Backend API manzili:
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={customApiUrl}
                      onChange={(e) => setCustomApiUrl(e.target.value)}
                      placeholder="https://guli-lingerie-api.onrender.com"
                      style={{ fontSize: "12px", padding: "8px 10px", flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={testServerPing}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: "1px solid #d4b2bc",
                        background: "#fff",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Ping
                    </button>
                  </div>
                  {pingStatus && (
                    <small style={{ display: "block", marginTop: "4px", color: pingStatus.includes("🟢") ? "#166534" : "#991b1b" }}>
                      {pingStatus}
                    </small>
                  )}
                </div>

                <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px solid #f0e2e6" }}>
                  <label style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "#6d5e64" }}>
                    Publish saytdan olingan Token (ixtiyoriy):
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={directTokenInput}
                      onChange={(e) => setDirectTokenInput(e.target.value)}
                      placeholder="guli_admin_token (eyJ...)"
                      style={{ fontSize: "12px", padding: "8px 10px", flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleDirectTokenLogin}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#c9526b",
                        color: "#fff",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Ulash
                    </button>
                  </div>
                  <small style={{ color: "#a58e95", fontSize: "10px", display: "block", marginTop: "3px" }}>
                    Publish qilingan panelda kirgan bo‘lsangiz, sessionStorage dagi tokenni qo‘yib to‘g‘ridan-to‘g‘ri kirishingiz mumkin.
                  </small>
                </div>
              </div>
            )}
          </div>

          <small style={{ marginTop: "14px" }}>Admin tokeni xavfsiz holda sessionStorage’da saqlanadi.</small>
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

        {/* Tab: ⭐ Sharhlar */}
        {tab === "reviews" && <ReviewsAdmin token={token} />}

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
                        <div
                          className="avatarMini"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            overflow: "hidden",
                            display: "inline-grid",
                            placeItems: "center",
                            background: "#f8fafc",
                            border: "1.5px solid #be123c",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                            padding: 0,
                            flexShrink: 0,
                          }}
                        >
                          {(userPhotosMap[u.telegram_id] || (u as any).photo_url || (u as any).telegram_photo) ? (
                            <img
                              src={userPhotosMap[u.telegram_id] || (u as any).photo_url || (u as any).telegram_photo}
                              alt={u.first_name || ""}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#be123c" }}>
                              {(u.first_name || u.username || "G").slice(0, 1).toUpperCase()}
                            </span>
                          )}
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
                          {p.discount_type === "percent" ? (
                            <div>
                              <b>{p.discount_value}%</b>
                              {p.max_discount_amount && Number(p.max_discount_amount) > 0 ? (
                                <div style={{ fontSize: "11px", color: "var(--accent, #e11d48)", fontWeight: 500 }}>
                                  maks. {money(p.max_discount_amount)}
                                </div>
                              ) : (
                                <div style={{ fontSize: "11px", color: "var(--text-muted, #71717a)" }}>
                                  limitsiz
                                </div>
                              )}
                            </div>
                          ) : (
                            money(p.discount_value)
                          )}
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
        {tab === "chat" && (
          <AdminChatTab
            token={token}
            onViewOrderDetails={(orderNum) => {
              const ord = orders.find(
                (o) => String(o.order_number || o.id) === String(orderNum)
              );
              if (ord) setSelectedOrder(ord);
            }}
          />
        )}

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
  const addr = parseOrderAddress(order.address);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const codes = productCodes(order);
  const [realReceiptUrl, setRealReceiptUrl] = useState<string>(
    (order as any).receiptUrl || (order as any).receipt_url || ""
  );
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [customerPhoto, setCustomerPhoto] = useState<string>(
    order.telegram_photo || order.photo_url || ""
  );

  useEffect(() => {
    let cancelled = false;
    const orderId = String(order.id || order.order_number || "");
    const adminToken = sessionStorage.getItem("guli_admin_token") || "";
    const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\/$/, "");

    if (orderId && adminToken) {
      setLoadingReceipt(true);
      fetch(`${base}/api/admin/orders/${encodeURIComponent(orderId)}/payment-receipt`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
        .then((r) => r.json().catch(() => null))
        .then((j) => {
          if (!cancelled && j?.success && j?.data?.receipt_url) {
            setRealReceiptUrl(j.data.receipt_url);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingReceipt(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [order.id, order.order_number]);

  const receiptImg = realReceiptUrl || (order as any).receiptUrl || (order as any).receipt_url || "";

  useEffect(() => {
    let cancelled = false;
    const orderNum = order.order_number || String(order.id || "");
    const adminToken = sessionStorage.getItem("guli_admin_token") || "";
    const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\/$/, "");

    if (orderNum) {
      fetch(`${base}/api/admin/order/${encodeURIComponent(orderNum)}/customer-photos`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
        .then((r) => r.json().catch(() => null))
        .then((j) => {
          if (!cancelled && j?.success && j?.data?.photos?.length) {
            const photoUrl = j.data.photos[0]?.url;
            if (photoUrl) setCustomerPhoto(photoUrl);
          }
        })
        .catch(() => {});
    } else if (order.telegram_id) {
      fetch(`${base}/api/admin/users/${order.telegram_id}/details`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
        .then((r) => r.json().catch(() => null))
        .then((j) => {
          if (!cancelled && j?.success && j?.data?.photos?.length) {
            const photoUrl = j.data.photos[0]?.url;
            if (photoUrl) setCustomerPhoto(photoUrl);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [order.id, order.order_number, order.telegram_id]);

  const customerFullName =
    [order.first_name, order.last_name].filter(Boolean).join(" ") ||
    order.customer_name ||
    order.first_name ||
    "Mijoz";

  return (
    <div className="drawerShade" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="proEyebrow">BUYURTMA TAFSILOTLARI</span>
            <h2>№ {order.order_number || order.id}</h2>
            <small>🕒 {date(order.created_at)}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="drawerBody">
          {/* Mijoz Profil Card (Telegram Avatar + Ism Familiya + Username + Aloqa) */}
          <div className="orderDetailCard">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: 22,
                  fontWeight: 700,
                  boxShadow: "0 3px 10px rgba(244, 63, 94, 0.25)",
                  flexShrink: 0,
                  border: "2px solid #ffffff",
                }}
              >
                {customerPhoto ? (
                  <img
                    src={customerPhoto}
                    alt={customerFullName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => setCustomerPhoto("")}
                  />
                ) : (
                  customerFullName.slice(0, 1).toUpperCase()
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {customerFullName}
                  </b>
                  <span
                    style={{
                      fontSize: 11,
                      background: "#fdf2f8",
                      color: "var(--rose, #e11d48)",
                      border: "1px solid #fbcfe8",
                      padding: "2px 8px",
                      borderRadius: 8,
                      fontWeight: 800,
                      fontFamily: "monospace",
                    }}
                  >
                    ID: #{(order as any).customer_id || order.telegram_id || (order as any).user_id || order.id}
                  </span>
                  {order.telegram_id ? (
                    <span
                      style={{
                        fontSize: 10.5,
                        background: "#e0f2fe",
                        color: "#0369a1",
                        padding: "2px 8px",
                        borderRadius: 8,
                        fontWeight: 700,
                      }}
                    >
                      TG ID: {order.telegram_id}
                    </span>
                  ) : null}
                </div>
                <small style={{ color: "var(--muted, #64748b)", display: "block", marginTop: 3 }}>
                  {order.username ? `@${order.username}` : "Telegram orqali buyurtma"}
                </small>
              </div>
            </div>

            {/* Quick action buttons (Qo'ng'iroq / Telegram) */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line, #e2e8f0)" }}>
              {order.phone && (
                <a
                  href={`tel:${order.phone}`}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "#ecfdf5",
                    color: "#059669",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: "1px solid #a7f3d0",
                  }}
                >
                  📞 Qo‘ng‘iroq qilish
                </a>
              )}
              {order.username && (
                <a
                  href={`https://t.me/${order.username.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  ✈️ Telegram yozish
                </a>
              )}
            </div>
          </div>

          {/* Barcha ma'lumotlar toza, tartibli qatorlarda (Order Details Row List) */}
          <div className="orderDetailRowList">
            <div className="orderDetailRow">
              <span className="rowLabel">🆔 Mijoz ID</span>
              <span className="rowValue" style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--rose, #e11d48)" }}>
                #{(order as any).customer_id || order.telegram_id || (order as any).user_id || order.id}
              </span>
            </div>

            {order.telegram_id ? (
              <div className="orderDetailRow">
                <span className="rowLabel">✈️ Telegram ID</span>
                <span className="rowValue" style={{ fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>
                  {order.telegram_id}
                </span>
              </div>
            ) : null}

            <div className="orderDetailRow">
              <span className="rowLabel">👤 Mijoz F.I.Sh</span>
              <span className="rowValue">{customerFullName}</span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">🎂 Tug‘ilgan sana</span>
              <span className="rowValue" style={{ color: (order.birth_date || (order as any).dob) ? "inherit" : "var(--muted)" }}>
                {formatBirthDate(order.birth_date || (order as any).dob) || "Ko‘rsatilmagan"}
              </span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">📞 Telefon raqami</span>
              <span className="rowValue">
                {order.phone ? (
                  <a href={`tel:${order.phone}`} style={{ color: "var(--rose, #e11d48)", textDecoration: "none" }}>
                    {order.phone}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">💳 To‘lov usuli</span>
              <span className="rowValue">
                {order.payment === "card" ? "💳 Karta (Uzcard / Humo)" : "💵 Naqd pul"}
              </span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">🏷️ To‘lov holati</span>
              <span className="rowValue">
                {order.status === "Qabul qilindi" || order.payment_status === "paid" ? (
                  <span style={{ color: "#059669", background: "#ecfdf5", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
                    ✓ To‘langan / Tasdiqlangan
                  </span>
                ) : receiptImg ? (
                  <span style={{ color: "#0284c7", background: "#e0f2fe", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
                    Chek yuklangan (Tekshirilmoqda)
                  </span>
                ) : (
                  <span style={{ color: "#b45309", background: "#fef3c7", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>
                    Chek kutilmoqda
                  </span>
                )}
              </span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">📦 Mahsulot kodlari</span>
              <span className="rowValue" style={{ color: "var(--rose, #e11d48)", letterSpacing: "0.05em" }}>
                {codes.join(", ") || "—"}
              </span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">💰 Mahsulotlar qiymati</span>
              <span className="rowValue">{money(order.subtotal || order.total)}</span>
            </div>

            <div className="orderDetailRow">
              <span className="rowLabel">🚚 Yetkazib berish xizmati</span>
              <span className="rowValue" style={{ color: order.delivery ? "inherit" : "#059669" }}>
                {order.delivery ? money(order.delivery) : "Bepul"}
              </span>
            </div>

            <div className="orderDetailRow" style={{ background: "rgba(244,63,94,0.06)", fontWeight: 800 }}>
              <span className="rowLabel" style={{ fontWeight: 800, color: "var(--rose, #e11d48)" }}>
                💵 Jami buyurtma summasi
              </span>
              <span className="rowValue" style={{ color: "var(--rose, #e11d48)", fontSize: 15, fontWeight: 900 }}>
                {money(order.total)}
              </span>
            </div>
          </div>

          {/* Mijoz Yuborgan To'lov Cheki */}
          <div className="orderDetailCard">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 750, display: "flex", alignItems: "center", gap: 6 }}>
                🧾 Mijoz yuborgan to‘lov cheki
              </h3>
              <span
                style={{
                  fontSize: 11,
                  background: receiptImg ? "#dcfce7" : "#fef3c7",
                  color: receiptImg ? "#166534" : "#92400e",
                  padding: "3px 9px",
                  borderRadius: 12,
                  fontWeight: 700,
                }}
              >
                {loadingReceipt ? "Yuklanmoqda..." : receiptImg ? "Yuklangan chek ✓" : "Chek yo'q"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {receiptImg ? (
                <div
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--line, #cbd5e1)",
                    width: 96,
                    height: 118,
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    background: "var(--bg-card-sub, #e2e8f0)",
                  }}
                  onClick={() => onOpenReceipt(receiptImg)}
                  title="To'liq hajmda ochish"
                >
                  <img
                    src={receiptImg}
                    alt="To'lov cheki"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      inset: "auto 0 0 0",
                      background: "rgba(0,0,0,0.65)",
                      color: "#fff",
                      fontSize: 10,
                      textAlign: "center",
                      padding: "3px 0",
                      fontWeight: 600,
                    }}
                  >
                    🔍 Katta ko‘rish
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 118,
                    flexShrink: 0,
                    borderRadius: 12,
                    border: "1px dashed var(--line, #cbd5e1)",
                    display: "grid",
                    placeItems: "center",
                    background: "var(--bg-card-sub, #f1f5f9)",
                    color: "var(--muted, #94a3b8)",
                    fontSize: 24,
                    textAlign: "center",
                    padding: 8,
                  }}
                >
                  <div>
                    <div>🧾</div>
                    <small style={{ fontSize: 10, display: "block", color: "var(--muted, #64748b)", marginTop: 4 }}>
                      {loadingReceipt ? "Yuklanmoqda..." : "Chek yuklanmagan"}
                    </small>
                  </div>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted, #475569)", marginBottom: 4 }}>
                  <b>To‘lov turi:</b> {order.payment === "card" ? "💳 Karta o‘tkazmasi (Uzcard/Humo)" : "💵 Naqd"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted, #475569)", marginBottom: 8 }}>
                  <b>Tranzaksiya:</b> #{order.order_number || order.id}-TX
                </div>
                {receiptImg && (
                  <div style={{ marginBottom: 10 }}>
                    <a
                      href={receiptImg}
                      target="_blank"
                      rel="noreferrer"
                      download={`Chek_${order.order_number || order.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11.5,
                        color: "#0284c7",
                        textDecoration: "none",
                        fontWeight: 600,
                        background: "#e0f2fe",
                        padding: "4px 8px",
                        borderRadius: 6,
                      }}
                    >
                      📥 Chekni yuklab olish
                    </a>
                  </div>
                )}

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
                      width: "100%",
                      justifyContent: "center",
                    }}
                    onClick={() => onStatus(order, "Qabul qilindi")}
                  >
                    ✅ Chek tasdiqlash → "Qabul qilindi"
                  </button>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#059669",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#ecfdf5",
                      padding: "6px 10px",
                      borderRadius: 8,
                    }}
                  >
                    ✓ Chek tasdiqlangan va status "Qabul qilindi"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Buyurtma Holati (Status & Timeline) */}
          <div className="orderDetailCard">
            <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 750 }}>
              🔄 Buyurtma statusi
            </h3>
            <select
              value={order.status}
              onChange={(e) => onStatus(order, e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--bg-card, #ffffff)",
                color: "var(--ink, #0f172a)",
                fontWeight: 700,
                fontSize: 13,
                outline: "none",
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
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

          {/* Mahsulotlar Ro'yxati */}
          <div className="orderDetailCard">
            <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 750 }}>
              👗 Buyurtma mahsulotlari ({order.items?.length || 0} ta)
            </h3>
            {(order.items || []).map((it: any, i: number) => (
              <div className="lineItem" key={i}>
                {it.product?.image ? (
                  <img
                    src={it.product.image}
                    alt={it.product?.name || "Mahsulot"}
                    style={{ width: 48, height: 56, objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 56,
                      borderRadius: 8,
                      background: "var(--bg-card-sub, #f1f5f9)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20,
                    }}
                  >
                    👗
                  </div>
                )}
                <div>
                  <b style={{ fontSize: 13.5 }}>{it.product?.name || "Mahsulot"}</b>
                  <small style={{ color: "var(--muted, #64748b)", fontSize: 11, marginTop: 4, display: "block" }}>
                    {it.product?.product_code ? (
                      <span style={{ color: "var(--rose, #e11d48)", fontWeight: 700 }}>
                        Kod: {it.product.product_code} ·{" "}
                      </span>
                    ) : null}
                    O‘lcham: {it.size || "—"} · Rang: {formatColorName(it.color) || "—"} · Soni: {it.quantity || 1} dona
                  </small>
                </div>
                <strong style={{ fontSize: 13.5, color: "var(--ink, #0f172a)", whiteSpace: "nowrap" }}>
                  {money(Number(it.product?.price || 0) * Number(it.quantity || 1))}
                </strong>
              </div>
            ))}
          </div>

          {/* To'liq Yetkazib Berish Manzili Qatorlari */}
          <div className="orderDetailCard">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 750, display: "flex", alignItems: "center", gap: 6 }}>
                📍 To‘liq yetkazib berish manzili
              </h3>
              <button
                type="button"
                onClick={() => {
                  const fullText = [
                    addr.region && `Viloyat: ${addr.region}`,
                    addr.district && `Tuman: ${addr.district}`,
                    addr.street && `Ko'cha/Manzil: ${addr.street}`,
                    addr.house && `Uy/Dom: ${addr.house}`,
                    addr.apartment && `Padez/Xonadon: ${addr.apartment}`,
                    addr.landmark && `Mo'ljal: ${addr.landmark}`,
                    order.phone && `Tel: ${order.phone}`,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  navigator.clipboard?.writeText(fullText || "Manzil ko'rsatilmagan");
                  setCopiedAddress(true);
                  setTimeout(() => setCopiedAddress(false), 2000);
                }}
                style={{
                  fontSize: 11.5,
                  padding: "5px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line, #cbd5e1)",
                  background: copiedAddress ? "#dcfce7" : "var(--bg-card, #ffffff)",
                  color: copiedAddress ? "#166534" : "var(--ink, #334155)",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.2s",
                }}
              >
                {copiedAddress ? "✓ Nusxalandi" : "📋 Manzilni nusxalash"}
              </button>
            </div>

            {/* Asosiy birlashtirilgan manzil */}
            <div
              style={{
                background: "var(--bg-card-sub, #f8fafc)",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--line, #e2e8f0)",
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 10.5, color: "var(--muted, #64748b)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
                Umumiy manzil qatori:
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: 600, color: "var(--ink, #0f172a)" }}>
                📍 {[
                  addr.region,
                  addr.district,
                  addr.street,
                  addr.house ? `Uy/Dom: ${addr.house}` : null,
                  addr.apartment ? `Padez/Xonadon: ${addr.apartment}` : null,
                  addr.landmark ? `(Mo‘ljal: ${addr.landmark})` : null,
                ]
                  .filter(Boolean)
                  .join(", ") || addr.formatted_address || "Manzil ko‘rsatilmagan"}
              </p>
            </div>

            {/* Manzilning alohida qatorlari (Row Grid) */}
            <div className="addressRowGrid">
              <div className="addressRowCard">
                <span className="addrLabel">🗺️ Viloyat / Shahar:</span>
                <span className="addrVal" style={{ color: addr.region ? "inherit" : "var(--muted)" }}>
                  {addr.region || "Ko‘rsatilmagan"}
                </span>
              </div>

              <div className="addressRowCard">
                <span className="addrLabel">🏘️ Tuman / Hudud:</span>
                <span className="addrVal" style={{ color: addr.district ? "inherit" : "var(--muted)" }}>
                  {addr.district || "Ko‘rsatilmagan"}
                </span>
              </div>

              <div className="addressRowCard">
                <span className="addrLabel">📍 Ko‘cha / Mahalla:</span>
                <span className="addrVal" style={{ color: addr.street ? "inherit" : "var(--muted)" }}>
                  {addr.street || "Ko‘rsatilmagan"}
                </span>
              </div>

              <div className="addressRowCard">
                <span className="addrLabel">🏠 Uy raqami / Dom:</span>
                <span className="addrVal" style={{ color: addr.house ? "inherit" : "var(--muted)" }}>
                  {addr.house || "Ko‘rsatilmagan"}
                </span>
              </div>

              <div className="addressRowCard">
                <span className="addrLabel">🚪 Xonadon / Padezd:</span>
                <span className="addrVal" style={{ color: addr.apartment ? "inherit" : "var(--muted)" }}>
                  {addr.apartment || "Ko‘rsatilmagan"}
                </span>
              </div>

              <div className="addressRowCard">
                <span className="addrLabel">🏢 Mo‘ljal (Orientir):</span>
                <span className="addrVal" style={{ color: addr.landmark ? "inherit" : "var(--muted)" }}>
                  {addr.landmark || "Ko‘rsatilmagan"}
                </span>
              </div>
            </div>

            {/* Geolokatsiya & Xaritalar */}
            {addr.latitude && addr.longitude ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    color: "#2563eb",
                    textDecoration: "none",
                    background: "#eff6ff",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  🗺️ Google Maps ({Number(addr.latitude).toFixed(4)}, {Number(addr.longitude).toFixed(4)}) ↗
                </a>
                <a
                  href={`https://yandex.com/maps/?pt=${addr.longitude},${addr.latitude}&z=16&l=map`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    color: "#dc2626",
                    textDecoration: "none",
                    background: "#fef2f2",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    border: "1px solid #fecaca",
                  }}
                >
                  📍 Yandex Maps ↗
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${addr.latitude}, ${addr.longitude}`);
                    setCopiedCoords(true);
                    setTimeout(() => setCopiedCoords(false), 2000);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: copiedCoords ? "#166534" : "var(--muted, #475569)",
                    background: copiedCoords ? "#dcfce7" : "var(--bg-card, #ffffff)",
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontWeight: 600,
                    border: "1px solid var(--line, #cbd5e1)",
                    cursor: "pointer",
                  }}
                >
                  {copiedCoords ? "✓ Koordinata olindi" : "🌐 Nusxa"}
                </button>
              </div>
            ) : null}
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
  const [userPhoto, setUserPhoto] = useState<string>(
    user.photo_url || user.telegram_photo || ""
  );
  const mine = orders.filter(
    (o) =>
      o.telegram_id === user.telegram_id ||
      (user.username && o.username === user.username)
  );
  const spend = mine.reduce((s, o) => s + Number(o.total || 0), 0);
  const userFullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    "Mijoz";
  const userDob =
    mine.find((o) => o.birth_date || (o as any).dob)?.birth_date ||
    (mine.find((o) => (o as any).dob) as any)?.dob ||
    "";

  useEffect(() => {
    let cancelled = false;
    if (!user.telegram_id) return;
    const adminToken = sessionStorage.getItem("guli_admin_token") || "";
    const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\/$/, "");

    fetch(`${base}/api/admin/users/${user.telegram_id}/details`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (!cancelled && j?.success && j?.data?.photos?.length) {
          const photoUrl = j.data.photos[0]?.url;
          if (photoUrl) setUserPhoto(photoUrl);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user.telegram_id]);

  return (
    <div className="drawerShade" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="proEyebrow">CRM MIJOZ</span>
            <h2>{userFullName}</h2>
            <small>
              {user.username ? `@${user.username}` : "Telegram foydalanuvchisi"}
            </small>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>
        <div className="drawerBody">
          <div className="orderDetailCard">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: 22,
                  fontWeight: 700,
                  boxShadow: "0 3px 10px rgba(244, 63, 94, 0.25)",
                  flexShrink: 0,
                  border: "2px solid #ffffff",
                }}
              >
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={userFullName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => setUserPhoto("")}
                  />
                ) : (
                  (user.first_name || "G").slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <b style={{ fontSize: 16 }}>{user.telegram_phone || userFullName}</b>
                <small style={{ color: "var(--muted, #64748b)", display: "block", marginTop: 2 }}>
                  TG ID: {user.telegram_id} {user.username ? `· @${user.username}` : ""}
                </small>
              </div>
            </div>
          </div>

          <div className="orderDetailRowList">
            <div className="orderDetailRow">
              <span className="rowLabel">👤 Ism Familiya</span>
              <span className="rowValue">{userFullName}</span>
            </div>
            <div className="orderDetailRow">
              <span className="rowLabel">🎂 Tug‘ilgan sana</span>
              <span className="rowValue" style={{ color: userDob ? "inherit" : "var(--muted)" }}>
                {formatBirthDate(userDob) || "Ko‘rsatilmagan"}
              </span>
            </div>
            <div className="orderDetailRow">
              <span className="rowLabel">📦 Buyurtmalar soni</span>
              <span className="rowValue">{mine.length} ta buyurtma</span>
            </div>
            <div className="orderDetailRow" style={{ background: "rgba(244,63,94,0.06)" }}>
              <span className="rowLabel" style={{ color: "var(--rose, #e11d48)", fontWeight: 800 }}>
                💎 Jami xarid summasi
              </span>
              <span className="rowValue" style={{ color: "var(--rose, #e11d48)", fontSize: 15, fontWeight: 900 }}>
                {money(spend)}
              </span>
            </div>
          </div>

          <div className="orderDetailCard">
            <h3 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 750 }}>
              📜 Buyurtmalar tarixi ({mine.length})
            </h3>
            {mine.length ? (
              mine.map((o) => (
                <button
                  type="button"
                  className="customerOrder"
                  key={o.id}
                  onClick={() => onOrder(o)}
                >
                  <span>
                    {productCodes(o)[0] || "—"} · #{o.order_number || o.id}
                  </span>
                  <b>{money(o.total)}</b>
                  <small>{o.status} · {date(o.created_at)}</small>
                </button>
              ))
            ) : (
              <p style={{ color: "var(--muted)", margin: 0, fontSize: 13 }}>Bu mijozda buyurtmalar topilmadi.</p>
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
  const isPercent = (value.discount_type || "percent") === "percent";

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
              placeholder="Masalan: GULI20"
              maxLength={40}
              pattern="[A-Za-z0-9_-]{3,40}"
              required
            />
            <small>Faqat harf, raqam, _ va - ishlating.</small>
          </label>

          <label>
            Chegirma turi
            <select
              value={value.discount_type || "percent"}
              onChange={(e) => set("discount_type", e.target.value as any)}
            >
              <option value="percent">Foiz (%)</option>
              <option value="fixed">Aniq summa (so'm)</option>
            </select>
            <small>Foizli yoki qat'iy summa chegirmasi.</small>
          </label>

          <label>
            {isPercent ? "Chegirma foizi (%)" : "Chegirma summasi (so'm)"}
            <input
              type="number"
              min="1"
              max={isPercent ? "100" : undefined}
              step="1"
              value={value.discount_value}
              onFocus={replaceZeroOnFocus}
              onChange={(e) =>
                set(
                  "discount_value",
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
              placeholder={isPercent ? "Masalan: 20" : "Masalan: 50000"}
              required
            />
            <small>
              {isPercent
                ? "Mijoz savatidan shu foiz chegiriladi."
                : "Mijoz savatidan aynan shu summa chegiriladi."}
            </small>
          </label>

          {isPercent && (
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Maksimal chegirma limiti (so'm, ixtiyoriy)</span>
                {value.max_discount_amount && Number(value.max_discount_amount) > 0 ? (
                  <span style={{ fontSize: "11px", color: "var(--accent, #e11d48)", fontWeight: 600 }}>
                    Maks. {money(Number(value.max_discount_amount))}
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", color: "var(--text-muted, #71717a)" }}>
                    Limitsiz
                  </span>
                )}
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                inputMode="numeric"
                value={value.max_discount_amount ?? ""}
                onChange={(e) =>
                  set(
                    "max_discount_amount",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder="Masalan: 100000 (bo‘sh qoldirilsa limitsiz)"
              />
              <small>
                Mijoz qancha katta xarid qilsa ham (masalan 1 000 000 so'm), chegirma shu ko'rsatilgan limitdan oshmaydi.
              </small>
              <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                {[30000, 50000, 100000, 200000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => set("max_discount_amount", preset)}
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color, #e4e4e7)",
                      background: value.max_discount_amount === preset ? "var(--accent, #e11d48)" : "transparent",
                      color: value.max_discount_amount === preset ? "#fff" : "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {preset.toLocaleString("uz-UZ")} so'm
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => set("max_discount_amount", null)}
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color, #e4e4e7)",
                    background: !value.max_discount_amount ? "var(--accent, #e11d48)" : "transparent",
                    color: !value.max_discount_amount ? "#fff" : "inherit",
                    cursor: "pointer",
                  }}
                >
                  Cheksiz (limitsiz)
                </button>
              </div>
            </label>
          )}

          <label>
            Minimal buyurtma (ixtiyoriy)
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              value={value.min_order_amount}
              onFocus={replaceZeroOnFocus}
              onChange={(e) =>
                set(
                  "min_order_amount",
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
              placeholder="0"
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
