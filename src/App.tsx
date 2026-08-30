import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import "./App.css";
import { MonthlySpendingChart } from "./components/SpendingChart";
import { exportOrdersToPDF } from "./utils/pdfExport";
import {
  Home3DIcon,
  Search3DIcon,
  Heart3DIcon,
  Bag3DIcon,
  User3DIcon,
} from "./components/Nav3DIcons";
import {
  ProductImageGallery,
  type Product,
} from "./components/ProductImageGallery";
import { RotatingCategoriesSection } from "./components/RotatingCategorySection";
import { ProductReviewsSection } from "./components/ProductReviewsSection";
import { getSynchronizedCategories, normalizeCategory } from "./utils/categoryUtils";
import type { Banner } from "./admin/components/AdminBannersTab";
import { SettingsModal } from "./components/SettingsModal";
import { HelpSupportModal } from "./components/HelpSupportModal";
import { NotificationModal } from "./components/NotificationModal";
import { OnlineChatView } from "./components/OnlineChatView";
import { PullToRefresh } from "./components/PullToRefresh";
import {
  PromosModal,
  DeliveryTermsModal,
  SizeGuideModal,
  AboutBrandModal,
} from "./components/ProfileExtraModals";
import { SocialLinksModal } from "./components/SocialLinksModal";
import { DEFAULT_PRODUCTS } from "./utils/defaultProducts";
import {
  parseColorValue,
  formatColorName,
  isLightColor,
} from "./utils/colorHelpers";
import {
  type Language,
  type TranslationKey,
  getTranslation,
} from "./utils/translations";
import { type Currency, formatCurrencyPrice } from "./utils/currency";
import {
  type ChatMessage,
  getUnreadMessages,
  markMessagesAsRead,
  subscribeToChat,
} from "./utils/chatSync";
import { detectPlatform, initPlatformEnvironment } from "./utils/platformAdapter";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData?: string;
        version?: string;
        isVersionAtLeast?: (version: string) => boolean;
        requestContact?: (callback: (ok: boolean) => void) => void;
        onEvent?: (event: string, callback: (data?: any) => void) => void;
        offEvent?: (event: string, callback: (data?: any) => void) => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy") => void;
          notificationOccurred?: (
            type: "error" | "success" | "warning",
          ) => void;
        };
      };
    };
    L?: any;
  }
}

type CartItem = {
  product: Product;
  size: string;
  color: string;
  quantity: number;
};
type Address = {
  latitude: number;
  longitude: number;
  region?: string;
  district?: string;
  street?: string;
  house?: string;
  apartment?: string;
  landmark?: string;
};
type Order = {
  id: string;
  order_number?: string;
  items: CartItem[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  address?: Address;
  phone: string;
  payment: string;
  status: string;
  receipt_url?: string;
  createdAt: string;
  updatedAt?: string;
  statusUpdatedAt?: string;
};
type Page =
  | "home"
  | "catalog"
  | "wishlist"
  | "cart"
  | "profile"
  | "checkout"
  | "orders"
  | "addresses"
  | "product"
  | "chat";
const MAIN_TABS: Page[] = ["home", "catalog", "wishlist", "cart", "profile"];
const API_URL = (
  import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com"
).replace(/\/$/, "");

const uzbekistanRegionsData: Record<string, string[]> = {
  "Toshkent sh.": [
    "Chilonzor tumani",
    "Yunusobod tumani",
    "Mirzo Ulug‘bek tumani",
    "Yakkasaroy tumani",
    "Shayxontohur tumani",
    "Olmazor tumani",
    "Uchtepa tumani",
    "Mirobod tumani",
    "Yashnobod tumani",
    "Sergeli tumani",
    "Yangihayot tumani",
    "Bektemir tumani"
  ],
  "Toshkent vil.": [
    "Chinoz tumani",
    "Zangiota tumani",
    "Qibray tumani",
    "Toshkent tumani",
    "Yangiyo‘l tumani",
    "Oqqo‘rg‘on tumani",
    "Bo‘ka tumani",
    "Chirchiq sh.",
    "Angren sh.",
    "Olmaliq sh.",
    "Bekobod sh.",
    "Parkent tumani",
    "Piskent tumani",
    "Bo‘stonliq tumani",
    "Quyichirchiq tumani",
    "O‘rtachirchiq tumani"
  ],
  "Samarqand vil.": [
    "Samarqand sh.",
    "Samarqand tumani",
    "Urgut tumani",
    "Kattaqo‘rg‘on sh.",
    "Kattaqo‘rg‘on tumani",
    "Ishtixon tumani",
    "Payariq tumani",
    "Jomboy tumani",
    "Bulung‘ur tumani",
    "Narpay tumani",
    "Paxtachi tumani",
    "Nurobod tumani",
    "Qo‘shrabot tumani",
    "Tayloq tumani"
  ],
  "Buxoro vil.": [
    "Buxoro sh.",
    "Buxoro tumani",
    "G‘ijduvon tumani",
    "Vobkent tumani",
    "Kogon sh.",
    "Kogon tumani",
    "Jondor tumani",
    "Olot tumani",
    "Qorako‘l tumani",
    "Peshku tumani",
    "Romitan tumani",
    "Shofirkon tumani"
  ],
  "Farg‘ona vil.": [
    "O‘zbekiston tumani",
    "Farg‘ona sh.",
    "Marg‘ilon sh.",
    "Qo‘qon sh.",
    "Quvasoy sh.",
    "Farg‘ona tumani",
    "Quva tumani",
    "Rishton tumani",
    "Oltiariq tumani",
    "Bag‘dod tumani",
    "Beshariq tumani",
    "Dang‘ara tumani",
    "Furqat tumani",
    "Qo‘shtepa tumani",
    "Uchko‘prik tumani",
    "Yozyovon tumani",
    "Toshloq tumani",
    "So‘x tumani"
  ],
  "Andijon vil.": [
    "Andijon sh.",
    "Xonobod sh.",
    "Andijon tumani",
    "Asaka tumani",
    "Baliqchi tumani",
    "Buloqboshi tumani",
    "Bo‘z tumani",
    "Jalaquduq tumani",
    "Izboskan tumani",
    "Marhamat tumani",
    "Oltinko‘l tumani",
    "Paxtaobod tumani",
    "Shahrixon tumani",
    "Ulug‘nor tumani",
    "Qo‘rg‘ontepa tumani"
  ],
  "Namangan vil.": [
    "Namangan sh.",
    "Namangan tumani",
    "Chust tumani",
    "Kosonsoy tumani",
    "Mingbuloq tumani",
    "Norin tumani",
    "Pop tumani",
    "To‘raqo‘rg‘on tumani",
    "Uychi tumani",
    "Uchqo‘rg‘on tumani",
    "Yangiqo‘rg‘on tumani"
  ],
  "Qashqadaryo vil.": [
    "Qarshi sh.",
    "Shahrisabz sh.",
    "Qarshi tumani",
    "G‘uzor tumani",
    "Dehqonobod tumani",
    "Qamashi tumani",
    "Kasbi tumani",
    "Kitob tumani",
    "Mirishkor tumani",
    "Muborak tumani",
    "Nishon tumani",
    "Chiroqchi tumani",
    "Yakkabog‘ tumani"
  ],
  "Surxondaryo vil.": [
    "Termiz sh.",
    "Denov tumani",
    "Angor tumani",
    "Boysun tumani",
    "Bandixon tumani",
    "Jarkurgon tumani",
    "Muzrabot tumani",
    "Oltinsoy tumani",
    "Sariosiyo tumani",
    "Termiz tumani",
    "Uzun tumani",
    "Sherobod tumani",
    "Sho‘rchi tumani"
  ],
  "Xorazm vil.": [
    "Urganch sh.",
    "Xiva sh.",
    "Bog‘ot tumani",
    "Gurlan tumani",
    "Qo‘shko‘pir tumani",
    "Shovot tumani",
    "Urganch tumani",
    "Xazorasp tumani",
    "Xiva tumani",
    "Yangiariq tumani",
    "Yangibozor tumani",
    "Tuproqqal’a tumani"
  ],
  "Navoiy vil.": [
    "Navoiy sh.",
    "Zarafshon sh.",
    "Konimex tumani",
    "Karmana tumani",
    "Qiziltepa tumani",
    "Navbahor tumani",
    "Nurota tumani",
    "Tomdi tumani",
    "Uchquduq tumani",
    "Xatirchi tumani"
  ],
  "Jizzax vil.": [
    "Jizzax sh.",
    "Arnasoy tumani",
    "Baxmal tumani",
    "G‘allaorol tumani",
    "Sharof Rashidov tumani",
    "Do‘stlik tumani",
    "Zafarobod tumani",
    "Zarbdor tumani",
    "Mirzacho‘l tumani",
    "Paxtakor tumani",
    "Forish tumani",
    "Yangiobod tumani"
  ],
  "Sirdaryo vil.": [
    "Guliston sh.",
    "Yangiyer sh.",
    "Shirin sh.",
    "Oqoltin tumani",
    "Boyovut tumani",
    "Guliston tumani",
    "Mirzaobod tumani",
    "Sardoba tumani",
    "Sayxunobod tumani",
    "Sirdaryo tumani",
    "Xovos tumani"
  ],
  "Qoraqalpog‘iston Respublikasi": [
    "Nukus sh.",
    "Amudaryo tumani",
    "Beruniy tumani",
    "Kegeyli tumani",
    "Qonliko‘l tumani",
    "Qorao‘zak tumani",
    "Chimboy tumani",
    "Shumanay tumani",
    "Ellikqal’a tumani",
    "Mo‘ynoq tumani",
    "Nukus tumani",
    "Taxtako‘pir tumani",
    "To‘rtko‘l tumani",
    "Xo‘jayli tumani"
  ]
};

function matchUzbekistanRegionAndDistrict(
  rawState: string,
  rawCounty: string,
  rawCity: string,
  lat: number,
  lon: number,
): { region: string; district: string } {
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/['`‘’]/g, "")
      .replace(/viloyat(i)?|vil\.?/g, "")
      .replace(/tuman(i)?|tum\.?/g, "")
      .replace(/shahar(i)?|sh\.?/g, "")
      .replace(/district|region|city|state|county|area|republic|resp/g, "")
      .trim();

  const combined = `${norm(rawState)} ${norm(rawCounty)} ${norm(rawCity)}`;

  let foundRegion = "";

  // 1. Check coordinates for Tashkent city bounds explicitly
  if (lat >= 41.15 && lat <= 41.42 && lon >= 69.10 && lon <= 69.45) {
    foundRegion = "Toshkent sh.";
  } else {
    // 2. Text match against region keys
    for (const rKey of Object.keys(uzbekistanRegionsData)) {
      const nKey = norm(rKey);
      if (!nKey) continue;
      if (
        combined.includes(nKey) ||
        (nKey.includes("toshkent") && combined.includes("tashkent")) ||
        (nKey.includes("samarqand") && combined.includes("samarkand")) ||
        (nKey.includes("buxoro") && combined.includes("bukhara")) ||
        (nKey.includes("farg") && combined.includes("fergana")) ||
        (nKey.includes("andijon") && combined.includes("andijan")) ||
        (nKey.includes("namangan") && combined.includes("namangan")) ||
        (nKey.includes("qashqadaryo") && (combined.includes("kashkadarya") || combined.includes("qarshi"))) ||
        (nKey.includes("surxondaryo") && (combined.includes("surkhandarya") || combined.includes("termiz"))) ||
        (nKey.includes("xorazm") && (combined.includes("khorezm") || combined.includes("urganch"))) ||
        (nKey.includes("navoiy") && combined.includes("navoi")) ||
        (nKey.includes("jizzax") && combined.includes("jizzakh")) ||
        (nKey.includes("sirdaryo") && (combined.includes("syrdarya") || combined.includes("guliston"))) ||
        (nKey.includes("qoraqalp") && combined.includes("karakalpak"))
      ) {
        foundRegion = rKey;
        break;
      }
    }
  }

  // 3. Fallback to coordinate bounding boxes if text match didn't yield a region
  if (!foundRegion) {
    if (lat >= 40.5 && lat <= 42.2 && lon >= 68.5 && lon <= 71.2) foundRegion = "Toshkent vil.";
    else if (lat >= 39.1 && lat <= 40.2 && lon >= 65.5 && lon <= 67.5) foundRegion = "Samarqand vil.";
    else if (lat >= 40.0 && lat <= 40.9 && lon >= 70.3 && lon <= 72.0) foundRegion = "Farg‘ona vil.";
    else if (lat >= 40.4 && lat <= 41.0 && lon >= 71.9 && lon <= 73.2) foundRegion = "Andijon vil.";
    else if (lat >= 40.7 && lat <= 41.5 && lon >= 70.4 && lon <= 72.2) foundRegion = "Namangan vil.";
    else if (lat >= 38.8 && lat <= 41.1 && lon >= 62.1 && lon <= 65.2) foundRegion = "Buxoro vil.";
    else if (lat >= 38.2 && lat <= 39.4 && lon >= 64.9 && lon <= 67.5) foundRegion = "Qashqadaryo vil.";
    else if (lat >= 37.1 && lat <= 38.6 && lon >= 66.5 && lon <= 68.4) foundRegion = "Surxondaryo vil.";
    else if (lat >= 41.0 && lat <= 42.0 && lon >= 60.0 && lon <= 61.5) foundRegion = "Xorazm vil.";
    else if (lat >= 39.8 && lat <= 43.5 && lon >= 62.0 && lon <= 66.0) foundRegion = "Navoiy vil.";
    else if (lat >= 39.8 && lat <= 41.5 && lon >= 67.0 && lon <= 68.9) foundRegion = "Jizzax vil.";
    else if (lat >= 40.0 && lat <= 41.0 && lon >= 68.3 && lon <= 69.3) foundRegion = "Sirdaryo vil.";
    else if (lat >= 41.0 && lat <= 45.6 && lon >= 56.0 && lon <= 62.5) foundRegion = "Qoraqalpog‘iston Respublikasi";
    else foundRegion = "Toshkent sh.";
  }

  // 4. Find matching district in foundRegion
  const distList = uzbekistanRegionsData[foundRegion] || [];
  let foundDistrict = "";

  const countyNorm = norm(rawCounty);
  const cityNorm = norm(rawCity);

  // Special district detection for Farg‘ona vil. (O‘zbekiston tumani / Yaypan)
  if (foundRegion === "Farg‘ona vil.") {
    if (
      countyNorm.includes("ozbekiston") ||
      countyNorm.includes("uzbekistan") ||
      countyNorm.includes("yaypan") ||
      cityNorm.includes("yaypan") ||
      combined.includes("yaypan") ||
      (lat >= 40.25 && lat <= 40.58 && lon >= 70.70 && lon <= 71.15)
    ) {
      foundDistrict = "O‘zbekiston tumani";
    }
  }

  if (!foundDistrict) {
    for (const d of distList) {
      const nD = norm(d);
      if (!nD) continue;

      if (d === "O‘zbekiston tumani" || nD === "ozbekiston") {
        if (
          countyNorm.includes("ozbekiston") ||
          countyNorm.includes("uzbekistan") ||
          countyNorm.includes("yaypan") ||
          combined.includes("yaypan")
        ) {
          foundDistrict = d;
          break;
        }
        continue;
      }

      if (
        combined.includes(nD) ||
        (countyNorm && (nD.includes(countyNorm) || countyNorm.includes(nD))) ||
        (cityNorm && (nD.includes(cityNorm) || cityNorm.includes(nD)))
      ) {
        foundDistrict = d;
        break;
      }
    }
  }

  // Tashkent city sub-bounds for district detection
  if (!foundDistrict && foundRegion === "Toshkent sh.") {
    if (lat <= 41.28 && lon <= 69.23) foundDistrict = "Chilonzor tumani";
    else if (lat >= 41.32 && lon >= 69.25) foundDistrict = "Yunusobod tumani";
    else if (lat >= 41.30 && lon >= 69.30) foundDistrict = "Mirzo Ulug‘bek tumani";
    else if (lat <= 41.27 && lon >= 69.28) foundDistrict = "Yashnobod tumani";
    else if (lat <= 41.24 && lon <= 69.22) foundDistrict = "Sergeli tumani";
    else if (lat >= 41.30 && lon <= 69.22) foundDistrict = "Uchtepa tumani";
    else if (lat >= 41.32 && lon >= 69.24) foundDistrict = "Shayxontohur tumani";
    else if (lat >= 41.34 && lon >= 69.24) foundDistrict = "Olmazor tumani";
    else foundDistrict = "Chilonzor tumani";
  }

  if (!foundDistrict && distList.length > 0) {
    foundDistrict = distList[0];
  }

  return { region: foundRegion, district: foundDistrict };
}
const tg = () => window.Telegram?.WebApp;
const formatDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "Sana noma'lum"
    : d.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
};
const isRecentlyUpdated = (order: Order, hours = 24) => {
  const ts = order.statusUpdatedAt || order.updatedAt || order.createdAt;
  if (!ts) return false;
  const time = new Date(ts).getTime();
  if (Number.isNaN(time)) return false;
  const diff = Date.now() - time;
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
};
const getRecentUpdateLabel = (order: Order) => {
  const ts = order.statusUpdatedAt || order.updatedAt || order.createdAt;
  if (!ts) return "Yaqinda";
  const time = new Date(ts).getTime();
  if (Number.isNaN(time)) return "Yaqinda";
  const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSec < 60) return "hozirgina";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} daq oldin`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} soat oldin`;
  return "24s ichida";
};
const orderNumber = () => `GULI-${Math.floor(100000 + Math.random() * 900000)}`;
const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const placeholder = (name = "GULI") =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#f6e8eb"/><text x="400" y="500" text-anchor="middle" font-family="Arial" font-size="42" fill="#b95a70">${name.slice(0, 18)}</text></svg>`)}`;
const imageUrl = (p: Product, index = 0) => {
  const list = [p.image, ...(p.images || [])].filter(Boolean);
  const url = list[index] || list[0] || "";
  if (!url) return placeholder(p.name);
  try {
    const u = new URL(url);
    if (u.hostname.includes("images.unsplash.com")) {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", "900");
      u.searchParams.set("q", "78");
    }
    return u.toString();
  } catch {
    return url;
  }
};
function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="productGrid"
      role="status"
      aria-label="Mahsulotlar yuklanmoqda"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeletonProductCard" key={i}>
          <div className="skeletonProductImage skeletonShimmer" />
          <div className="skeletonProductBody">
            <div className="skeletonLine skeletonCategory skeletonShimmer" />
            <div className="skeletonLine skeletonTitle skeletonShimmer" />
            <div className="skeletonLine skeletonCode skeletonShimmer" />
            <div className="skeletonPriceRow">
              <div className="skeletonLine skeletonPrice skeletonShimmer" />
              <div className="skeletonHeart skeletonShimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
function OrdersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="ordersList"
      role="status"
      aria-label="Buyurtmalar yuklanmoqda"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeletonOrderCard" key={i}>
          <div className="skeletonOrderTop">
            <div className="skeletonLine skeletonOrderNum skeletonShimmer" />
            <div className="skeletonLine skeletonOrderDate skeletonShimmer" />
          </div>
          <div className="skeletonOrderMain">
            <div className="skeletonOrderThumb skeletonShimmer" />
            <div className="skeletonOrderInfo">
              <div className="skeletonLine skeletonOrderTitle skeletonShimmer" />
              <div className="skeletonLine skeletonOrderMeta skeletonShimmer" />
              <div className="skeletonLine skeletonOrderPrice skeletonShimmer" />
            </div>
          </div>
          <div className="skeletonOrderBottom">
            <div className="skeletonLine skeletonOrderStatus skeletonShimmer" />
            <div className="skeletonLine skeletonOrderButton skeletonShimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lon: number) => void;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(Boolean(window.L));

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (window.L) {
      setReady(true);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setReady(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
      css.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !el.current || !window.L) return;
    const L = window.L;
    const lat = latitude || 41.2995;
    const lon = longitude || 69.2401;

    if (!map.current) {
      map.current = L.map(el.current, { zoomControl: false }).setView(
        [lat, lon],
        16,
      );
      L.control.zoom({ position: "bottomright" }).addTo(map.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map.current);
      marker.current = L.marker([lat, lon], {
        draggable: true,
      }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
      map.current.on("click", (e: any) => {
        marker.current.setLatLng(e.latlng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });
    } else {
      marker.current?.setLatLng([lat, lon]);
      map.current.setView([lat, lon], 16);
    }
    setTimeout(() => map.current?.invalidateSize(), 100);
  }, [ready, latitude, longitude]);

  return (
    <div className="mapPicker">
      <div className="mapModalCard3D" style={{ margin: "10px 0" }}>
        <div className="mapModalHeader">
          <h3>🗺️ 3D Aniq Joylashuv Xaritasi</h3>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>GPS Faol</span>
        </div>
        <div className="mapInteractiveStage">
          <div ref={el} className="leafletMap" style={{ width: "100%", height: "100%" }} />
          <div className="mapPinPulse">
            <span className="mapPinIcon">📍</span>
            <span className="mapPinLabel">Sizning turgan joyingiz</span>
          </div>
        </div>
        <div className="mapCoordsBar">
          <div className="coordsInfoText">
            📍 Kenglik va uzunlik: <b>{latitude.toFixed(5)}, {longitude.toFixed(5)}</b>
          </div>
        </div>
      </div>
      {!ready ? <div className="mapLoading">Xarita yuklanmoqda…</div> : null}
      <div className="mapHint">
        💡 Pinni xaritada istalgan joyga sudrang yoki bosing
      </div>
    </div>
  );
}

const DEFAULT_HERO_BANNERS: Banner[] = [
  {
    id: 1,
    title: "Eksklyuziv Pijamalar Sets ✨",
    subtitle: "Uydagi har bir lahjangizni go‘zallashtiring",
    imageUrl: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=85",
    badgeText: "TOP SOTILGAN",
    ctaText: "Xarid qilish",
    active: true,
  },
  {
    id: 2,
    title: "Yangi Bahor Kolleksiyasi 🌸",
    subtitle: "Nafis ipak, qulay bichim va zamonaviy uslub",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85",
    badgeText: "YANGILIK ✦",
    ctaText: "Kolleksiyani ko‘rish",
    active: true,
  },
  {
    id: 3,
    title: "Premium Ipak & To‘rli Komplektlar ✨",
    subtitle: "Nafislik, qulaylik va o‘zingizga bo‘lgan ishonch",
    imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85",
    badgeText: "PREMIUM",
    ctaText: "Kashf qilish",
    active: true,
  },
  {
    id: 4,
    title: "Maxsus Chegirmalar — 30% Gacha 🎁",
    subtitle: "Barcha sara to‘plamlar uchun cheklangan taklif",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85",
    badgeText: "AKSIYA 🔥",
    ctaText: "Tanlash",
    active: true,
  },
];

export default function App() {
  const isTelegramWebapp = useMemo(() => detectPlatform().isTelegram, []);
  const [page, setPage] = useState<Page>("home");
  const [previousPage, setPreviousPage] = useState<Page>("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => readStorage("cart", []));
  const [wishlist, setWishlist] = useState<number[]>(() =>
    readStorage("wishlist", []),
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    readStorage("orders", []),
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<
    "all" | "recent" | "in_progress" | "completed" | "cancelled"
  >("all");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [phone, setPhone] = useState(
    () => localStorage.getItem("guli_phone") || "",
  );
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [showCardPaymentModal, setShowCardPaymentModal] = useState(false);
  const [paymentTimer, setPaymentTimer] = useState(600); // 10 minutes (600 seconds)
  const [timerActive, setTimerActive] = useState(false);
  const [uploadedReceipt, setUploadedReceipt] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(1);
  const [address, setAddress] = useState<Address>(() =>
    readStorage("guli_address", {
      latitude: 41.2995,
      longitude: 69.2401,
      region: "Toshkent sh.",
      district: "Chilonzor tumani",
      street: "",
      house: "",
      apartment: "",
      landmark: "",
    }),
  );
  const [locationLoading, setLocationLoading] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showSpendingStats, setShowSpendingStats] = useState(false);
  const [toast, setToast] = useState("");

  const telegramUser = tg()?.initDataUnsafe?.user;
  const displayName =
    [telegramUser?.first_name, telegramUser?.last_name]
      .filter(Boolean)
      .join(" ") || "GULI mijozi";
  const avatar = telegramUser?.photo_url || "";
  const currentUserId = telegramUser?.id
    ? String(telegramUser.id)
    : "guest-user";

  // Theme & Settings & Chat states (Dynamic User-Specific Sessions)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem(`guli_theme_${currentUserId}`) || localStorage.getItem("guli_theme");
    return saved === "dark" || saved === "light" ? saved : "light";
  });
  const [language, setLanguage] = useState<Language>(() => {
    const saved = (localStorage.getItem(`guli_lang_${currentUserId}`) || localStorage.getItem("guli_lang")) as Language;
    return saved === "uz" || saved === "ru" || saved === "en" ? saved : "uz";
  });
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem(`guli_currency_${currentUserId}`) as Currency;
    return saved === "UZS" || saved === "USD" || saved === "RUB" ? saved : "UZS";
  });
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(`guli_haptics_${currentUserId}`);
    return saved === "false" ? false : true;
  });
  const [density, setDensity] = useState<"normal" | "compact" | "large">(() => {
    const saved = localStorage.getItem(`guli_density_${currentUserId}`) as any;
    return saved === "compact" || saved === "normal" || saved === "large" ? saved : "normal";
  });
  const [orderAlerts, setOrderAlerts] = useState<boolean>(() => {
    const saved = localStorage.getItem(`guli_order_alerts_${currentUserId}`);
    return saved === "false" ? false : true;
  });
  const [promoAlerts, setPromoAlerts] = useState<boolean>(() => {
    const saved = localStorage.getItem(`guli_promo_alerts_${currentUserId}`);
    return saved === "false" ? false : true;
  });

  const [promoBannerUrl, setPromoBannerUrl] = useState<string>(
    "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1100&q=78"
  );

  const [heroBanners, setHeroBanners] = useState<Banner[]>(() => {
    let list = (window as any).__GULI_ADMIN_BANNERS__;
    if (!list) {
      try {
        const saved = localStorage.getItem("guli_admin_banners");
        if (saved) list = JSON.parse(saved);
      } catch {}
    }
    if (Array.isArray(list) && list.length > 0) {
      const active = list.filter((b: Banner) => b.active !== false);
      if (active.length > 0) return active;
    }
    return DEFAULT_HERO_BANNERS;
  });

  const [activeBannerIdx, setActiveBannerIdx] = useState<number>(0);
  const [heroDragOffset, setHeroDragOffset] = useState<number>(0);
  const [isHeroDragging, setIsHeroDragging] = useState<boolean>(false);
  const heroTouchStartX = useRef<number>(0);
  const heroTouchStartY = useRef<number>(0);
  const heroTouchStartTime = useRef<number>(0);
  const isHorizontalHeroSwipe = useRef<boolean | null>(null);

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (heroBanners.length <= 1) return;
    heroTouchStartX.current = e.touches[0].clientX;
    heroTouchStartY.current = e.touches[0].clientY;
    heroTouchStartTime.current = Date.now();
    isHorizontalHeroSwipe.current = null;
    setIsHeroDragging(true);
    setHeroDragOffset(0);
  };

  const handleHeroTouchMove = (e: React.TouchEvent) => {
    if (!isHeroDragging || heroBanners.length <= 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - heroTouchStartX.current;
    const diffY = currentY - heroTouchStartY.current;

    if (isHorizontalHeroSwipe.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalHeroSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalHeroSwipe.current) {
      e.stopPropagation();
      // Add slight elastic damping at edges if only 1 banner or non-looping feel
      setHeroDragOffset(diffX);
    }
  };

  const handleHeroTouchEnd = (e: React.TouchEvent) => {
    if (!isHeroDragging) return;
    e.stopPropagation();
    setIsHeroDragging(false);
    const duration = Date.now() - heroTouchStartTime.current;
    const isQuickFlick = duration < 280 && Math.abs(heroDragOffset) > 20;

    if (isHorizontalHeroSwipe.current && heroBanners.length > 1) {
      if (heroDragOffset < -35 || (isQuickFlick && heroDragOffset < 0)) {
        setActiveBannerIdx((prev) => (prev + 1) % heroBanners.length);
      } else if (heroDragOffset > 35 || (isQuickFlick && heroDragOffset > 0)) {
        setActiveBannerIdx((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
      }
    } else if (Math.abs(heroDragOffset) < 8 && duration < 300) {
      // Tap on banner -> navigate to catalog
      go("catalog");
    }
    setHeroDragOffset(0);
    isHorizontalHeroSwipe.current = null;
  };

  const handleHeroMouseDown = (e: React.MouseEvent) => {
    if (heroBanners.length <= 1) return;
    heroTouchStartX.current = e.clientX;
    heroTouchStartY.current = e.clientY;
    heroTouchStartTime.current = Date.now();
    isHorizontalHeroSwipe.current = true;
    setIsHeroDragging(true);
    setHeroDragOffset(0);
  };

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (!isHeroDragging || heroBanners.length <= 1) return;
    const diffX = e.clientX - heroTouchStartX.current;
    setHeroDragOffset(diffX);
  };

  const handleHeroMouseUp = () => {
    if (!isHeroDragging) return;
    setIsHeroDragging(false);
    const duration = Date.now() - heroTouchStartTime.current;
    const isQuickFlick = duration < 280 && Math.abs(heroDragOffset) > 20;

    if (heroBanners.length > 1) {
      if (heroDragOffset < -35 || (isQuickFlick && heroDragOffset < 0)) {
        setActiveBannerIdx((prev) => (prev + 1) % heroBanners.length);
      } else if (heroDragOffset > 35 || (isQuickFlick && heroDragOffset > 0)) {
        setActiveBannerIdx((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
      }
    } else if (Math.abs(heroDragOffset) < 8 && duration < 300) {
      go("catalog");
    }
    setHeroDragOffset(0);
  };

  const handleHeroMouseLeave = () => {
    if (isHeroDragging) {
      handleHeroMouseUp();
    }
  };

  useEffect(() => {
    const syncBanners = () => {
      let list = (window as any).__GULI_ADMIN_BANNERS__;
      if (!list) {
        try {
          const saved = localStorage.getItem("guli_admin_banners");
          if (saved) list = JSON.parse(saved);
        } catch {}
      }
      if (Array.isArray(list) && list.length > 0) {
        const active = list.filter((b: Banner) => b.active !== false);
        if (active.length > 0) {
          setHeroBanners(active);
          setActiveBannerIdx(0);
          return;
        }
      }
      // Fallback
      setHeroBanners(DEFAULT_HERO_BANNERS);
    };

    syncBanners();
    window.addEventListener("guli_banners_updated", syncBanners);
    window.addEventListener("storage", syncBanners);

    const fetchBanner = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings/banner`);
        if (res.ok) {
          const text = await res.text();
          let j: any = null;
          try {
            j = JSON.parse(text);
          } catch {}
          if (j && j.success && j.url) {
            setPromoBannerUrl(j.url);
          }
        }
      } catch {}
    };
    fetchBanner();

    return () => {
      window.removeEventListener("guli_banners_updated", syncBanners);
      window.removeEventListener("storage", syncBanners);
    };
  }, []);

  // Automatic banner rotation every 5s if multiple active banners
  useEffect(() => {
    if (heroBanners.length <= 1 || isHeroDragging) return;
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroBanners.length, isHeroDragging]);

  const t = (key: TranslationKey) => getTranslation(key, language);
  const formatPrice = (n: number) => {
    return formatCurrencyPrice(n, currency, language);
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpInitialStep, setHelpInitialStep] = useState<"none" | "details">("none");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSocialLinksOpen, setIsSocialLinksOpen] = useState(false);
  const [isPromosOpen, setIsPromosOpen] = useState(false);
  const [isDeliveryInfoOpen, setIsDeliveryInfoOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const [unreadMessages, setUnreadMessages] = useState<ChatMessage[]>(() =>
    getUnreadMessages(currentUserId),
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  // Initialize platform responsive environment
  useEffect(() => {
    initPlatformEnvironment();
  }, []);

  // Apply theme to root (User Specific)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(`guli_theme_${currentUserId}`, theme);
    localStorage.setItem("guli_theme", theme);
  }, [theme, currentUserId]);

  // Store language choice (User Specific)
  useEffect(() => {
    localStorage.setItem(`guli_lang_${currentUserId}`, language);
    localStorage.setItem("guli_lang", language);
  }, [language, currentUserId]);

  // Apply currency choice (User Specific)
  useEffect(() => {
    localStorage.setItem(`guli_currency_${currentUserId}`, currency);
  }, [currency, currentUserId]);

  // Apply haptics choice
  useEffect(() => {
    localStorage.setItem(`guli_haptics_${currentUserId}`, String(hapticsEnabled));
  }, [hapticsEnabled, currentUserId]);

  // Apply layout density (User Specific)
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    localStorage.setItem(`guli_density_${currentUserId}`, density);
  }, [density, currentUserId]);

  // Apply order alerts settings
  useEffect(() => {
    localStorage.setItem(`guli_order_alerts_${currentUserId}`, String(orderAlerts));
  }, [orderAlerts, currentUserId]);

  // Apply promo alerts settings
  useEffect(() => {
    localStorage.setItem(`guli_promo_alerts_${currentUserId}`, String(promoAlerts));
  }, [promoAlerts, currentUserId]);

  // Subscribe to real-time chat updates & unread message count
  useEffect(() => {
    const refreshUnread = () => {
      setUnreadMessages(getUnreadMessages(currentUserId));
    };

    const handleNewAdminMsg = (e: Event) => {
      const msg = (e as CustomEvent).detail as ChatMessage;
      if (!msg) return;
      if (!msg.userId || String(msg.userId) === String(currentUserId)) {
        refreshUnread();
        if (page !== "chat") {
          try {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
              "warning",
            );
          } catch {}
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(660, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.2, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.45);
            }
          } catch {}
          const snippet =
            msg.text.length > 40 ? msg.text.slice(0, 40) + "…" : msg.text;
          showToast(`💬 GULI Admin: ${snippet}`);
        }
      }
    };

    refreshUnread();
    const unsubscribe = subscribeToChat(refreshUnread);
    window.addEventListener("guli_new_admin_message", handleNewAdminMsg);

    return () => {
      unsubscribe();
      window.removeEventListener("guli_new_admin_message", handleNewAdminMsg);
    };
  }, [currentUserId, page]);

  // When user is viewing the chat page, automatically mark incoming messages as read
  useEffect(() => {
    if (page === "chat") {
      markMessagesAsRead(currentUserId, "user");
      setUnreadMessages([]);
    }
  }, [page, currentUserId]);

  const tabTouchStartX = useRef<number>(0);
  const tabTouchStartY = useRef<number>(0);
  const tabTouchStartTime = useRef<number>(0);
  const isSwipingTab = useRef<boolean>(false);

  const handleTabTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!MAIN_TABS.includes(page)) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(".hero") ||
      target.closest(".heroSlideTrack") ||
      target.closest(".heroSlideItem") ||
      target.closest(".productGallerySwipe") ||
      target.closest(".leafletMap") ||
      target.closest(".categoryScroll") ||
      target.closest(".orderFilterTabs") ||
      target.closest(".categoryTabs") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("button") ||
      target.closest(".galleryThumbnails")
    ) {
      isSwipingTab.current = false;
      return;
    }
    tabTouchStartX.current = e.touches[0].clientX;
    tabTouchStartY.current = e.touches[0].clientY;
    tabTouchStartTime.current = Date.now();
    isSwipingTab.current = true;
  };

  const handleTabTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!isSwipingTab.current || !MAIN_TABS.includes(page)) return;
    isSwipingTab.current = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - tabTouchStartX.current;
    const diffY = endY - tabTouchStartY.current;
    const timeDiff = Date.now() - tabTouchStartTime.current;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Swipe threshold
    if (absX >= 48 && absX > absY * 1.25 && timeDiff < 750) {
      const currentIndex = MAIN_TABS.indexOf(page);
      if (currentIndex !== -1) {
        if (diffX < 0 && currentIndex < MAIN_TABS.length - 1) {
          // Swiped left -> Next tab
          go(MAIN_TABS[currentIndex + 1]);
        } else if (diffX > 0 && currentIndex > 0) {
          // Swiped right -> Previous tab
          go(MAIN_TABS[currentIndex - 1]);
        }
      }
    }
  };

  useEffect(() => {
    try {
      tg()?.ready();
      tg()?.expand();
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  }, [wishlist]);
  useEffect(() => {
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    localStorage.setItem("guli_phone", phone);
  }, [phone]);
  useEffect(() => {
    localStorage.setItem("guli_address", JSON.stringify(address));
  }, [address]);

  useEffect(() => {
    let interval: any = null;
    if (timerActive && paymentTimer > 0) {
      interval = setInterval(() => {
        setPaymentTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, paymentTimer]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Iltimos faqat rasm faylini yuklang");
      return;
    }
    setIsUploadingReceipt(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawData = ev.target?.result as string;
      const img = new Image();
      img.src = rawData;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1000;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.78);
        setUploadedReceipt(compressed);
        setIsUploadingReceipt(false);
        try {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        } catch {}
        showToast("To‘lov cheki muvaffaqiyatli yuklandi ☺️");
      };
    };
    reader.readAsDataURL(file);
  };
  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setProductsLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/products?limit=100`);
      if (!r.ok) throw new Error(`Status: ${r.status}`);
      const text = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {
        // Not JSON
      }
      const list =
        j && j.success && Array.isArray(j.data) && j.data.length > 0
          ? j.data
          : DEFAULT_PRODUCTS;
      setProducts(list);
      setProductsError("");
      return list;
    } catch {
      setProducts(DEFAULT_PRODUCTS);
      setProductsError("");
      return DEFAULT_PRODUCTS;
    } finally {
      if (!silent) setProductsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!telegramUser?.id) return [];
      if (!silent) setOrdersLoading(true);
      try {
        const r = await fetch(
          `${API_URL}/api/orders?telegram_id=${telegramUser.id}`,
        );
        if (!r.ok) throw new Error("Buyurtmalarni yuklashda xatolik");
        const j = await r.json();
        if (!j.success || !Array.isArray(j.data)) return [];
        const list: Order[] = j.data.map((row: any) => ({
          id: String(row.order_number || row.id || orderNumber()),
          items: Array.isArray(row.items) ? row.items : [],
          subtotal: Number(row.subtotal || 0),
          delivery: Number(row.delivery || 0),
          discount: Number(row.discount || 0),
          total: Number(row.total || 0),
          address: row.address || undefined,
          phone: row.phone || "",
          payment: row.payment || "cash",
          status: row.status || "Qabul qilindi",
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || undefined,
          statusUpdatedAt: row.status_updated_at || row.updated_at || undefined,
        }));
        setOrders(list);
        return list;
      } catch (e) {
        console.error("Failed to load orders", e);
        throw e;
      } finally {
        if (!silent) setOrdersLoading(false);
      }
    },
    [telegramUser?.id],
  );

  useEffect(() => {
    loadProducts(false).catch(() => {});
  }, [loadProducts]);

  useEffect(() => {
    if (telegramUser?.id) {
      loadOrders(false).catch(() => {});
      const interval = setInterval(() => {
        loadOrders(true).catch(() => {});
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [telegramUser?.id, loadOrders]);
  useEffect(() => {
    const w = tg();
    if (!w?.onEvent || !telegramUser?.id) return;
    const isVersionOk =
      typeof w.isVersionAtLeast === "function"
        ? w.isVersionAtLeast("6.9")
        : Boolean(w.version && parseFloat(w.version) >= 6.9);
    if (!isVersionOk) return;
    const handler = (data?: any) => {
      if (data?.status === "sent") showToast("Raqam Telegramdan olindi ✓");
    };
    try {
      w.onEvent("contactRequested", handler);
      return () => w.offEvent?.("contactRequested", handler);
    } catch {}
  }, [telegramUser?.id]);
  const go = (next: Page) => {
    try {
      tg()?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
    setPreviousPage(page);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openProduct = (product: Product, from: Page = page) => {
    setPreviousPage(from);
    setSelectedProduct(product);
    setSelectedSize(product.sizes?.[0] || "");
    setSelectedColor(product.colors?.[0] || "");
    go("product");
  };
  const toggleWishlist = (id: number) => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
    setWishlist((x) =>
      x.includes(id) ? x.filter((v) => v !== id) : [...x, id],
    );
  };
  const addToCart = (
    product: Product,
    size = product.sizes?.[0] || "",
    color = product.colors?.[0] || "",
  ) => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}
    setCart((x) => {
      const found = x.find(
        (i) =>
          i.product.id === product.id && i.size === size && i.color === color,
      );
      return found
        ? x.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i))
        : [...x, { product, size, color, quantity: 1 }];
    });
  };
  const changeQuantity = (index: number, amount: number) =>
    setCart((x) =>
      x
        .map((i, n) =>
          n === index ? { ...i, quantity: i.quantity + amount } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const delivery = subtotal >= 300000 ? 0 : 20000;
  const discount = promoApplied ? Math.min(subtotal, promoDiscount) : 0;
  const total = Math.max(0, subtotal + delivery - discount);
  const allCategories = useMemo(
    () => getSynchronizedCategories(products),
    [products],
  );
  const filtered = useMemo(
    () => {
      const list = products.filter(
        (p) =>
          p.active !== false &&
          (selectedCategory === "Barchasi" ||
            normalizeCategory(p.category) === normalizeCategory(selectedCategory)) &&
          (!search.trim() ||
            p.product_code?.includes(search.trim()) ||
            p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
            normalizeCategory(p.category).toLowerCase().includes(search.trim().toLowerCase())),
      );
      return [...list].sort((a, b) => {
        const catA = normalizeCategory(a.category);
        const catB = normalizeCategory(b.category);
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
    },
    [products, selectedCategory, search],
  );
  const applyPromo = async () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}
    const code = promo.trim().toUpperCase();
    if (!code) {
      setPromoApplied(false);
      setPromoDiscount(0);
      showToast(t("promo_placeholder"));
      return;
    }
    setPromoLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/promo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const j = await r.json();
      if (!r.ok || !j.success)
        throw new Error(j.message || "Promo kodni tekshirishda xatolik");
      setPromo(j.data?.code || code);
      setPromoDiscount(Number(j.data?.discount || 0));
      setPromoApplied(true);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
          "success",
        );
      } catch {}
      showToast(
        `Promo qo‘llandi: −${formatPrice(Number(j.data?.discount || 0))} ✓`,
      );
    } catch (e) {
      setPromoApplied(false);
      setPromoDiscount(0);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
          "error",
        );
      } catch {}
      showToast(
        e instanceof Error ? e.message : "Promo kodni tekshirishda xatolik",
      );
    } finally {
      setPromoLoading(false);
    }
  };
  const reverseGeocode = async (lat: number, lon: number) => {
    let rawState = "";
    let rawCounty = "";
    let rawCity = "";
    let streetName = "";

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=uz,ru,en`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          rawState = addr.state || addr.region || addr.city || "";
          rawCounty =
            addr.county ||
            addr.district ||
            addr.suburb ||
            addr.city_district ||
            addr.town ||
            "";
          rawCity = addr.city || addr.town || addr.village || "";
          streetName = addr.road || addr.street || addr.pedestrian || "";
        }
      }
    } catch (e) {
      console.warn("Reverse geocode fetch failed:", e);
    }

    const { region, district } = matchUzbekistanRegionAndDistrict(
      rawState,
      rawCounty,
      rawCity,
      lat,
      lon,
    );

    setAddress((a) => ({
      ...a,
      latitude: lat,
      longitude: lon,
      region,
      district,
      street: streetName || a.street || "",
    }));

    showToast(`📍 Joylashuv va manzil aniqlandi: ${region}, ${district}`);
  };

  const updateMapPosition = (lat: number, lon: number) => {
    setAddress((a) => ({ ...a, latitude: lat, longitude: lon }));
    reverseGeocode(lat, lon);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      showToast("Telefoningiz lokatsiyani qo‘llab-quvvatlamaydi. Toshkent markazi belgilanmoqda.");
      updateMapPosition(41.2995, 69.2401);
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        await reverseGeocode(lat, lon);
        setLocationLoading(false);
      },
      async () => {
        setLocationLoading(false);
        showToast(
          "Lokatsiya ruxsati berilmadi. Toshkent markazi avtomatik belgilandi.",
        );
        await reverseGeocode(41.2995, 69.2401);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  };
  const requestTelegramPhone = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}

    const w = tg();
    const supportsContact = Boolean(
      w &&
      typeof w.requestContact === "function" &&
      (typeof w.isVersionAtLeast === "function"
        ? w.isVersionAtLeast("6.9")
        : Boolean(w.version && parseFloat(w.version) >= 6.9)),
    );

    if (!supportsContact || !w?.requestContact) {
      // Check localStorage for saved phone
      const saved = localStorage.getItem("guli_phone");
      if (saved) {
        setPhone(saved);
        showToast("✅ Saqlangan telefon raqamingiz tiklandi");
        return;
      }
      showToast(
        "Telegram ilovasidan kirganingizda raqam avtomatik olinadi. Iltimos raqamni quyidagi qatorga yozing.",
      );
      return;
    }

    setPhoneLoading(true);
    showToast("📱 Telegram raqamini so‘rash ochilmoqda...");

    try {
      w.requestContact(async (ok: boolean) => {
        try {
          if (!ok) {
            setPhoneLoading(false);
            showToast("Telegram raqamini ulashish rad etildi.");
            return;
          }
          // Poll backend for updated telegram_phone
          for (let i = 0; i < 10; i++) {
            try {
              const r = await fetch(`${API_URL}/api/telegram-user`);
              const j = await r.json();
              if (j.success && j.data?.telegram_phone) {
                const fetchedPhone = j.data.telegram_phone;
                setPhone(fetchedPhone);
                localStorage.setItem("guli_phone", fetchedPhone);
                setPhoneLoading(false);
                try {
                  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
                } catch {}
                showToast("✅ Telegram raqamingiz muvaffaqiyatli kiritildi!");
                return;
              }
            } catch {}
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
          setPhoneLoading(false);
          showToast("Raqam yuborildi, lekin serverdan olishda kechikish bo‘ldi. Iltimos qayta urinib ko‘ring.");
        } catch {
          setPhoneLoading(false);
          showToast("Telegram raqamini olishda xatolik yuz berdi.");
        }
      });
    } catch {
      setPhoneLoading(false);
      showToast("Telegram raqamini olish imkoni bo‘lmadi. Raqamni qo‘lda kiriting.");
    }
  };
  const setAddressField = (key: keyof Address, value: string) =>
    setAddress((a) => ({ ...a, [key]: value }));
  const submitOrderWithCard = async () => {
    if (!phone.trim()) {
      showToast("Iltimos telefon raqamingizni kiriting");
      return;
    }
    if (!cart.length) {
      showToast("Savat bo‘sh");
      return;
    }
    if (!uploadedReceipt) {
      showToast("Iltimos to‘lov cheki rasmini yuklang");
      return;
    }
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("heavy");
    } catch {}

    // Start 3D progress animation
    setIsProcessingPayment(true);
    setProcessingProgress(20);
    setProcessingStep(1); // 1: Chek rasmi va kvitansiya tekshirilmoqda

    await new Promise((resolve) => setTimeout(resolve, 600));
    setProcessingProgress(50);
    setProcessingStep(2); // 2: To'lov ma'lumotlari uzatilmoqda

    const id = orderNumber();
    const now = new Date().toISOString();
    const payload = {
      order_number: id,
      telegram_id: telegramUser?.id,
      username: telegramUser?.username,
      first_name: telegramUser?.first_name,
      phone: phone.trim(),
      items: cart,
      subtotal,
      delivery,
      discount,
      total,
      address,
      payment: "Karta (Uzcard / Humo)",
      status: "⏳ To'lovni tasdiqlash kutilmoqda",
      receipt_url: uploadedReceipt,
      promo_code: promoApplied ? promo.trim().toUpperCase() : null,
    };
    try {
      const r = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success)
        throw new Error(j.message || "Buyurtma yuborilmadi");
      if (telegramUser?.id && address.latitude)
        fetch(`${API_URL}/api/save-address`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...address,
            username: telegramUser.username,
            phone: phone.trim(),
          }),
        }).catch(() => {});

      setProcessingProgress(85);
      setProcessingStep(3); // 3: Status "To'lovni tasdiqlash kutilmoqda" ga o'zgardi
      await new Promise((resolve) => setTimeout(resolve, 750));

      setProcessingProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setOrders((x) => [
        {
          id: String(j.data?.order_number || id),
          order_number: id,
          items: cart,
          subtotal,
          delivery,
          discount,
          total,
          address,
          phone: phone.trim(),
          payment: "Karta (Uzcard / Humo)",
          status: "⏳ To'lovni tasdiqlash kutilmoqda",
          receipt_url: uploadedReceipt,
          createdAt: now,
          updatedAt: now,
          statusUpdatedAt: now,
        },
        ...x,
      ]);
      setCart([]);
      setPromo("");
      setPromoApplied(false);
      setPromoDiscount(0);
      setIsProcessingPayment(false);
      setShowCardPaymentModal(false);
      setTimerActive(false);
      setUploadedReceipt(null);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
          "success",
        );
      } catch {}
      go("orders");
      showToast("Buyurtmangiz yuborildi! Status: ⏳ To'lovni tasdiqlash kutilmoqda ✓");
    } catch (e) {
      setIsProcessingPayment(false);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
          "error",
        );
      } catch {}
      showToast(e instanceof Error ? e.message : "Buyurtma yuborilmadi");
    }
  };
  const similar = selectedProduct
    ? products
        .filter(
          (p) =>
            p.category === selectedProduct.category &&
            p.id !== selectedProduct.id,
        )
        .slice(0, 4)
    : [];
  const card = (p: Product, compact = false) => {
    const isWishlisted = wishlist.includes(p.id);
    const shortDesc = p.description
      ? p.description.length > 55
        ? p.description.slice(0, 55) + "…"
        : p.description
      : "";
    const ratingValue = p.rating && p.rating > 0 ? p.rating : 5.0;
    const reviewCount = p.reviews && p.reviews > 0 ? p.reviews : Math.floor(((p.id * 17) % 45) + 8);
    const isOutOfStock = p.stock !== undefined && p.stock <= 0;

    return (
      <article
        className={`productCard ${compact ? "compact" : ""} ${isOutOfStock ? "outOfStock" : ""}`}
        key={p.id}
        id={`product-card-${p.id}`}
        onClick={() => openProduct(p)}
      >
        <div className="productImage">
          <ProductImageGallery product={p} onOpen={() => openProduct(p)} />
          <button
            className={`heart ${isWishlisted ? "active" : ""}`}
            id={`heart-btn-${p.id}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(p.id);
            }}
            title={isWishlisted ? "Saralangandan o‘chirish" : "Saralanganlarga qo‘shish"}
          >
            {isWishlisted ? "♥" : "♡"}
          </button>
          {p.discount ? <span className="discount">-{p.discount}%</span> : null}
          {isOutOfStock ? (
            <span className="stockBadge out">Tugagan</span>
          ) : p.stock !== undefined && p.stock <= 3 && p.stock > 0 ? (
            <span className="stockBadge low">Faqat {p.stock} ta qoldi</span>
          ) : null}

          <div className="productRatingBadge">
            <span className="ratingStar">★</span>
            <span className="ratingVal">{ratingValue.toFixed(1)}</span>
            <span className="ratingReviews">({reviewCount})</span>
          </div>
        </div>
        <div className="productBody">
          <div className="productMetaRow">
            <span className="productCategoryTag">{p.category}</span>
            {p.product_code ? (
              <span className="productCodePill">№ {p.product_code}</span>
            ) : null}
          </div>
          <h3 className="productTitle" title={p.name}>
            {p.name}
          </h3>
          {shortDesc ? <p className="productShortDesc">{shortDesc}</p> : null}

          <div className="productStarsRow">
            <div className="starsVisual">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`starGlyph ${star <= Math.round(ratingValue) ? "filled" : ""}`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="reviewsCountText">{reviewCount} sharh</span>
          </div>

          {p.colors && p.colors.length > 0 ? (
            <div className="productOptionDots">
              <span className="productDotCount">{p.colors.length} ta rang</span>
            </div>
          ) : null}

          <div className="priceLine">
            <div className="priceGroup">
              <b className="currentPrice">{formatPrice(p.price)}</b>
              {p.oldPrice ? (
                <del className="oldPrice">{formatPrice(p.oldPrice)}</del>
              ) : null}
            </div>
            <button
              className="quickAddBtn"
              id={`quick-add-btn-${p.id}`}
              disabled={isOutOfStock}
              onClick={(e) => {
                e.stopPropagation();
                if (isOutOfStock) return;
                addToCart(p);
                showToast("✓ Savatga qo‘shildi");
              }}
              title={isOutOfStock ? "Mahsulot qolmagan" : "Savatga tez qo‘shish"}
            >
              <span>+</span>
            </button>
          </div>
        </div>
      </article>
    );
  };
  const handleExportPdf = (targetOrders?: Order[], customLabel?: string) => {
    if (!orders.length) {
      showToast("Eksport qilish uchun buyurtmalar mavjud emas");
      return;
    }
    setExportingPdf(true);
    try {
      const list = targetOrders && targetOrders.length ? targetOrders : orders;
      const ok = exportOrdersToPDF({
        orders: list,
        userName: displayName,
        userPhone: phone,
        userHandle: telegramUser?.username,
        filterLabel: customLabel || "Barchasi",
      });
      if (ok) {
        showToast("✓ Buyurtmalar tarixi PDF shaklida yuklandi");
      } else {
        showToast("PDF yaratishda xatolik");
      }
    } catch (e) {
      console.error(e);
      showToast("PDF yuklashda xatolik");
    } finally {
      setExportingPdf(false);
    }
  };
  const reorder = (order: Order) => {
    if (!order.items || !order.items.length) {
      showToast("Buyurtmada mahsulotlar topilmadi");
      return;
    }
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}
    setCart((currentCart) => {
      const updated = [...currentCart];
      for (const item of order.items) {
        if (!item?.product) continue;
        const size = item.size || item.product.sizes?.[0] || "";
        const color = item.color || item.product.colors?.[0] || "";
        const qty = item.quantity || 1;
        const existingIndex = updated.findIndex(
          (c) =>
            c.product.id === item.product.id &&
            c.size === size &&
            c.color === color,
        );
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + qty,
          };
        } else {
          updated.push({ product: item.product, size, color, quantity: qty });
        }
      }
      return updated;
    });
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
        "success",
      );
    } catch {}
    showToast("✓ Mahsulotlar savatga qo‘shildi!");
    go("cart");
  };

  const handleShare = () => {
    const shareText =
      "GULI Premium — Nafis va sifatli ayollar ichki kiyimlari to‘plami 🌷";
    const shareUrl = "https://t.me/guli_lingerie_bot";
    if (navigator.share) {
      navigator
        .share({ title: "GULI Premium", text: shareText, url: shareUrl })
        .catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showToast("✓ Havola nusxalandi!");
    } else {
      showToast(shareUrl);
    }
  };

  const handleClearCache = () => {
    const preservePhone = localStorage.getItem("guli_phone");
    const preserveAddress = localStorage.getItem("guli_address");
    localStorage.clear();
    if (preservePhone) localStorage.setItem("guli_phone", preservePhone);
    if (preserveAddress) localStorage.setItem("guli_address", preserveAddress);
    localStorage.setItem("guli_theme", theme);
    localStorage.setItem("guli_lang", language);
    showToast("✓ Kesh muvaffaqiyatli tozalandi");
    setIsSettingsOpen(false);
  };

  const ordersPage = () => {
    const q = orderSearch.trim().toLowerCase();
    const filteredByCategory = orders.filter((o) => {
      if (orderFilter === "all") return true;
      if (orderFilter === "recent") return isRecentlyUpdated(o);
      if (orderFilter === "completed") return o.status === "Yetkazildi";
      if (orderFilter === "cancelled") return o.status === "Bekor qilindi";
      if (orderFilter === "in_progress")
        return o.status !== "Yetkazildi" && o.status !== "Bekor qilindi";
      return true;
    });
    const visibleOrders = filteredByCategory.filter((o) => {
      if (!q) return true;
      const codes = (o.items || [])
        .map((it) => it?.product?.product_code || "")
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return codes.includes(q) || String(o.id).toLowerCase().includes(q);
    });
    const filterCounts = {
      all: orders.length,
      recent: orders.filter((o) => isRecentlyUpdated(o)).length,
      in_progress: orders.filter(
        (o) => o.status !== "Yetkazildi" && o.status !== "Bekor qilindi",
      ).length,
      completed: orders.filter((o) => o.status === "Yetkazildi").length,
      cancelled: orders.filter((o) => o.status === "Bekor qilindi").length,
    };
    const filterTabs: [
      "all" | "recent" | "in_progress" | "completed" | "cancelled",
      string,
      string,
    ][] = [
      ["all", t("filter_all"), "📦"],
      ["recent", t("filter_recent"), "⚡"],
      ["in_progress", t("filter_in_progress"), "⏳"],
      ["completed", t("filter_completed"), "✓"],
      ["cancelled", t("filter_cancelled"), "✕"],
    ];
    const currentTabName =
      filterTabs.find(([k]) => k === orderFilter)?.[1] || t("filter_all");
    return (
      <PullToRefresh
        language={language}
        onRefresh={async () => {
          await loadOrders(true);
          showToast("✓ Buyurtmalar yangilandi");
        }}
      >
        <main className="page ordersPageContainer">
          <div className="pageHeader ordersHeroHeader">
            <div className="pageHeaderTop">
              <div>
                <span className="pageHeaderEyebrow">
                  {t("nav_orders").toUpperCase()}
                </span>
                <h1 className="ordersPageTitle">{t("my_orders")}</h1>
              </div>
              {orders.length > 0 ? (
                <button
                  id="export-orders-pdf-btn"
                  className="exportPdfButton"
                  onClick={() =>
                    handleExportPdf(
                      visibleOrders.length ? visibleOrders : orders,
                      q ? `Qidiruv: "${q}"` : currentTabName,
                    )
                  }
                  disabled={exportingPdf}
                  title="Buyurtmalar tarixini PDF formatida yuklab olish"
                >
                  <span className="pdfIcon">📄</span>
                  <span>{exportingPdf ? "Yuklanmoqda..." : "PDF hisobot"}</span>
                </button>
              ) : null}
            </div>
            <p className="pageHeaderSubtitle">{t("orders_desc")}</p>
            
            <div className="searchBox ordersSearchBox">
              <span className="searchIcon">⌕</span>
              <input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="6 xonali mahsulot kodi yoki buyurtma №..."
              />
              {orderSearch && (
                <button
                  className="searchClearBtn"
                  onClick={() => setOrderSearch("")}
                  title="Qidiruvni tozalash"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="orderFilterTabs" role="tablist">
            {filterTabs.map(([key, label, icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={orderFilter === key}
                className={`orderFilterTab ${orderFilter === key ? "active" : ""}`}
                onClick={() => {
                  try {
                    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
                  } catch {}
                  setOrderFilter(key);
                }}
              >
                <span className="filterTabIcon">{icon}</span>
                <span className="filterTabLabel">{label}</span>
                <span className="filterCount">{filterCounts[key]}</span>
              </button>
            ))}
          </div>

          <div className="statsToggleContainer" id="stats-toggle-section">
            <button
              id="toggle-spending-stats-btn"
              type="button"
              className={`statsToggleBtn ${showSpendingStats ? "active" : ""}`}
              onClick={() => {
                try {
                  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
                } catch {}
                setShowSpendingStats((prev) => !prev);
              }}
              aria-expanded={showSpendingStats}
            >
              <div className="statsToggleLeft">
                <span className="statsToggleIcon">📊</span>
                <div className="statsToggleText">
                  <span className="statsToggleTitle">{t("stats_and_spending")}</span>
                  <span className="statsToggleSub">{t("stats_subtitle")}</span>
                </div>
              </div>
              <div className="statsToggleRight">
                <span className="statsToggleBadge">3D</span>
                <span className={`statsToggleChevron ${showSpendingStats ? "open" : ""}`}>
                  {showSpendingStats ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {showSpendingStats && (
              <div className="spendingChartWrapper">
                <MonthlySpendingChart orders={orders} />
              </div>
            )}
          </div>

          {ordersLoading ? (
            <OrdersListSkeleton count={3} />
          ) : visibleOrders.length ? (
            <div className="ordersList">
              {visibleOrders.map((o, index) => {
                const recent = isRecentlyUpdated(o);
                const isCompleted = o.status === "Yetkazildi";
                const totalItemCount = (o.items || []).reduce(
                  (sum, it) => sum + (it.quantity || 1),
                  0,
                );
                return (
                  <article
                    className={`orderCard ${selectedOrderId === o.id ? "expanded" : ""} ${recent ? "recentlyUpdated" : ""}`}
                    key={o.id}
                    id={`order-card-${o.id}`}
                    style={{ animationDelay: `${Math.min(index * 50, 350)}ms` }}
                  >
                    <div className="orderTop">
                      <div className="orderNumberGroup">
                        <span className="orderNumberBadge">№ {o.id}</span>
                        {o.items?.[0]?.product?.product_code ? (
                          <span className="orderCodeTag">
                            Kod: {o.items[0].product.product_code}
                          </span>
                        ) : null}
                      </div>
                      <div className="orderTopMeta">
                        {recent ? (
                          <span
                            className="recentBadge"
                            id={`order-badge-${o.id}`}
                            title={`Holati ${getRecentUpdateLabel(o)} yangilandi`}
                          >
                            <span className="recentBadgePulse" />
                            24s Yangilandi
                          </span>
                        ) : null}
                        <span className="orderDate">
                          {formatDate(o.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="orderMain"
                      onClick={() => {
                        const item = o.items?.[0];
                        if (item?.product) openProduct(item.product, "orders");
                      }}
                    >
                      <div className="orderThumbGroup">
                        <div className="orderThumb">
                          {o.items?.[0]?.product ? (
                            <img
                              src={imageUrl(o.items[0].product)}
                              alt={o.items[0].product.name}
                            />
                          ) : null}
                        </div>
                        {o.items && o.items.length > 1 ? (
                          <span className="moreItemsPill">
                            +{o.items.length - 1}
                          </span>
                        ) : null}
                      </div>

                      <div className="orderInfoCol">
                        <h3 className="orderItemTitle">
                          {o.items?.[0]?.product?.name || "Buyurtma"}
                        </h3>
                        <p className="orderMetaSummary">
                          {totalItemCount} ta mahsulot ·{" "}
                          <span className="paymentMethodPill">
                            {o.payment === "card" ? "💳 Karta" : "💵 Naqd"}
                          </span>
                        </p>
                        <strong className="orderTotalAmount">
                          {formatPrice(o.total)}
                        </strong>
                      </div>
                    </div>

                    <div className="orderBottom">
                      <span
                        className={`orderStatus ${recent ? "recent" : ""} status-${(o.status || "").toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <span
                          className={`statusDot ${recent ? "livePulse" : ""}`}
                        >
                          ●
                        </span>{" "}
                        {o.status}
                        {recent ? (
                          <span className="recentStatusTime">
                            ({getRecentUpdateLabel(o)})
                          </span>
                        ) : null}
                      </span>
                      <div className="orderActions">
                        {isCompleted ? (
                          <button
                            className="reorderButton"
                            id={`reorder-btn-${o.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              reorder(o);
                            }}
                            title="Ushbu buyurtmadagi mahsulotlarni yana savatga qo‘shish"
                          >
                            <span>🔄</span>
                            <span>Qayta buyurtma</span>
                          </button>
                        ) : null}
                        <button
                          className="detailsToggleBtn"
                          onClick={() =>
                            setSelectedOrderId(
                              selectedOrderId === o.id ? null : o.id,
                            )
                          }
                        >
                          {selectedOrderId === o.id
                            ? "Yopish ↑"
                            : "Tafsilotlar →"}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`orderDetailsCollapse ${selectedOrderId === o.id ? "expanded" : ""}`}
                      id={`order-details-${o.id}`}
                      aria-hidden={selectedOrderId !== o.id}
                    >
                      <div className="orderDetailsInner">
                        <div className="orderDetails">
                          {recent ? (
                            <div className="orderRecentNotice">
                              <span className="noticeIcon">⚡</span>
                              <div>
                                <strong>
                                  Holati yaqinda yangilandi (
                                  {getRecentUpdateLabel(o)})
                                </strong>
                                <p>
                                  Buyurtmangiz holati «{o.status}» bosqichida.
                                </p>
                              </div>
                            </div>
                          ) : null}
                          <div className="statusTimeline">
                            {[
                              "⏳ Buyurtma kutilmoqda",
                              "Qabul qilindi",
                              "Tayyorlanmoqda",
                              "Yo‘lda",
                              "Yetkazildi",
                            ].map((s, i) => (
                              <div
                                className={
                                  o.status === s ||
                                  [
                                    "⏳ Buyurtma kutilmoqda",
                                    "Qabul qilindi",
                                    "Tayyorlanmoqda",
                                    "Yo‘lda",
                                    "Yetkazildi",
                                  ].indexOf(o.status) >= i
                                    ? "done"
                                    : ""
                                }
                                key={s}
                              >
                                <span>{i + 1}</span>
                                <b>{s}</b>
                              </div>
                            ))}
                          </div>
                          <div className="orderDetailGrid">
                            <div>
                              <small>Mahsulot kodi</small>
                              <b>
                                {(o.items || [])
                                  .map((it) => it?.product?.product_code)
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </b>
                            </div>
                            <div>
                              <small>Telefon</small>
                              <b>{o.phone || "—"}</b>
                            </div>
                            <div>
                              <small>To‘lov</small>
                              <b>{o.payment || "Karta (Uzcard / Humo)"}</b>
                            </div>
                            <div>
                              <small>Mahsulotlar</small>
                              <b>{formatPrice(o.subtotal)}</b>
                            </div>
                            <div>
                              <small>Yetkazib berish</small>
                              <b>
                                {o.delivery ? formatPrice(o.delivery) : "Bepul"}
                              </b>
                            </div>
                            <div>
                              <small>Chegirma</small>
                              <b>
                                {o.discount
                                  ? `−${formatPrice(o.discount)}`
                                  : "—"}
                              </b>
                            </div>
                            <div>
                              <small>Jami</small>
                              <b>{formatPrice(o.total)}</b>
                            </div>
                          </div>
                          {o.address ? (
                            <p className="orderAddress">
                              📍{" "}
                              {[
                                o.address.region,
                                o.address.district,
                                o.address.street,
                                o.address.house,
                                o.address.apartment,
                              ]
                                .filter(Boolean)
                                .join(", ") || "Manzil saqlangan"}
                            </p>
                          ) : null}
                          {o.receipt_url ? (
                            <div className="orderReceiptUserView" style={{ marginTop: "12px", padding: "10px", background: "rgba(0,0,0,0.03)", borderRadius: "10px" }}>
                              <small style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>🧾 Yuklangan to‘lov cheki (kvitansiya):</small>
                              <img
                                src={o.receipt_url}
                                alt="To‘lov cheki"
                                className="userReceiptThumb"
                                onClick={() => window.open(o.receipt_url, '_blank')}
                                style={{ maxWidth: "180px", maxHeight: "180px", borderRadius: "8px", border: "1px solid var(--border-color)", cursor: "pointer", objectFit: "cover" }}
                              />
                            </div>
                          ) : null}
                          {isCompleted ? (
                            <div className="orderReorderBar">
                              <button
                                className="orderReorderFullBtn"
                                id={`reorder-full-btn-${o.id}`}
                                onClick={() => reorder(o)}
                              >
                                <span>🔄</span>
                                <span>
                                  Qayta buyurtma berish (Savatga qo‘shish)
                                </span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <div>📦</div>
              <h3>
                {q
                  ? "Qidiruv bo‘yicha buyurtma topilmadi"
                  : orderFilter !== "all"
                    ? "Ushbu toifada buyurtmalar yo‘q"
                    : "Buyurtmalar hali yo‘q"}
              </h3>
              <p>
                {q
                  ? "Boshqa 6 xonali mahsulot kodi yoki buyurtma raqamini kiriting."
                  : orderFilter !== "all"
                    ? "Boshqa toifani tanlang yoki filtrni «Barchasi»ga o‘tkazing."
                    : "Birinchi buyurtmangiz shu yerda ko‘rinadi."}
              </p>
              {orderFilter !== "all" ? (
                <button
                  className="primaryButton"
                  onClick={() => setOrderFilter("all")}
                >
                  Barcha buyurtmalarni ko‘rish
                </button>
              ) : (
                <button className="primaryButton" onClick={() => go("catalog")}>
                  Katalogga o‘tish
                </button>
              )}
            </div>
          )}
        </main>
      </PullToRefresh>
    );
  };

  const profilePage = () => (
    <main className="page">
      <div className="profileHero">
        <div className="profileAvatar">
          {avatar && !profilePhotoError ? (
            <img
              src={avatar}
              alt={displayName}
              onError={() => setProfilePhotoError(true)}
            />
          ) : (
            <img
              src="/guli_logo.jpg"
              alt="Guli Premium Logo"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
            />
          )}
        </div>
        <div>
          <h1>{displayName}</h1>
          <p>
            {telegramUser?.username
              ? `@${telegramUser.username}`
              : "GULI Premium mijozi"}
          </p>
          <span className="verified">✓ Telegram Verified</span>
        </div>
      </div>

      <section className="profileSection">
        <h2>{t("account_section")}</h2>
        <button
          className="menuRow"
          id="profile-orders-btn"
          onClick={() => go("orders")}
        >
          <span className="profileSticker3D">📦</span>
          <div>
            <b>{t("my_orders")}</b>
            <small>
              {t("orders_desc")} ({orders.length} ta)
            </small>
          </div>
          <i>›</i>
        </button>
        {orders.length > 0 ? (
          <button
            className="menuRow"
            id="profile-pdf-btn"
            onClick={() => handleExportPdf(orders, "Barchasi")}
          >
            <span className="profileSticker3D">📄</span>
            <div>
              <b>{t("pdf_report")}</b>
              <small>Shaxsiy hisobotni PDF formatida yuklab olish</small>
            </div>
            <i>›</i>
          </button>
        ) : null}
        <button
          className="menuRow"
          id="profile-wishlist-btn"
          onClick={() => go("wishlist")}
        >
          <span className="profileSticker3D">💖</span>
          <div>
            <b>{t("my_wishlist")}</b>
            <small>
              {t("my_wishlist_desc")} ({wishlist.length} ta)
            </small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-addresses-btn"
          onClick={() => go("addresses")}
        >
          <span className="profileSticker3D">📍</span>
          <div>
            <b>{t("my_addresses")}</b>
            <small>{t("my_addresses_desc")}</small>
          </div>
          <i>›</i>
        </button>
      </section>

      <section className="profileSection">
        <h2>Xizmat va Bog‘lanish</h2>
        <button
          className="menuRow"
          id="profile-chat-btn"
          onClick={() => go("chat")}
        >
          <span className="profileSticker3D">💬</span>
          <div>
            <b>{t("online_chat")}</b>
            {unreadMessages.length > 0 ? (
              <span className="badgePill">{unreadMessages.length} yangi</span>
            ) : null}
            <small>{t("online_chat_desc")}</small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-help-btn"
          onClick={() => {
            setHelpInitialStep("none");
            setIsHelpOpen(true);
          }}
        >
          <span className="profileSticker3D">📞</span>
          <div>
            <b>{t("help_support")}</b>
            <small>Call Center (+998 90 581-11-17) & FAQ</small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-social-btn"
          onClick={() => setIsSocialLinksOpen(true)}
        >
          <span className="profileSticker3D">🌐</span>
          <div>
            <b>{t("social_media")}</b>
            <small>{t("social_media_desc")}</small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-support-btn"
          style={{ 
            background: "linear-gradient(135deg, rgba(217, 119, 6, 0.08), rgba(217, 119, 6, 0.03))", 
            borderLeft: "3.5px solid #d97706" 
          }}
          onClick={() => {
            setHelpInitialStep("details");
            setIsHelpOpen(true);
          }}
        >
          <span className="profileSticker3D">🤗</span>
          <div>
            <b style={{ color: "var(--primary)" }}>Adminni qo'llab-quvvatlash</b>
            <small>Loyihani rivojlantirishga o'z hissangizni qo'shing</small>
          </div>
          <i>›</i>
        </button>
      </section>



      <section className="profileSection">
        <h2>{t("convenience_section")}</h2>
        <button
          className="menuRow"
          id="profile-settings-btn"
          onClick={() => setIsSettingsOpen(true)}
        >
          <span>⚙️</span>
          <div>
            <b>{t("settings")}</b>
            <small>
              {theme === "dark" ? t("theme_dark") : t("theme_light")} ·{" "}
              {currency} · {language.toUpperCase()}
            </small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-share-btn"
          onClick={handleShare}
        >
          <span>↗</span>
          <div>
            <b>{t("share_guli")}</b>
            <small>{t("share_guli_desc")}</small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-clear-cache-btn"
          onClick={handleClearCache}
        >
          <span>🗑️</span>
          <div>
            <b>{t("clear_cache")}</b>
            <small>{t("clear_cache")}</small>
          </div>
          <i>›</i>
        </button>
        <button
          className="menuRow"
          id="profile-admin-btn"
          onClick={() => {
            window.location.href = "/admin";
          }}
        >
          <span>🔐</span>
          <div>
            <b>Admin paneli (GULI Admin)</b>
            <small>Boshqaruv, mahsulotlar, buyurtmalar va chat</small>
          </div>
          <i>›</i>
        </button>
      </section>
    </main>
  );

  return (
    <div className="appShell">
      <header className="topbar">
        <button className="brand" onClick={() => go("home")}>
          <span className="brandIcon">
            <img
              src="/guli_logo.jpg"
              alt="Guli Premium"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
            />
          </span>
          <span>
            <b>GULI</b>
            <small>{t("brand_sub")}</small>
          </span>
        </button>
        <div className="headerActions">
          <a
            href="/admin"
            className="adminHeaderShortcut"
            id="topbar-admin-shortcut"
            title="Admin paneliga o'tish"
            style={{
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              background: "var(--rose-soft, #fdf0f3)",
              border: "1px solid var(--rose-line, #f7d2dc)",
              borderRadius: "14px",
              color: "var(--rose, #b6536b)",
              transition: "all 0.2s ease",
            }}
          >
            🔐 Admin
          </a>
          <button
            className={`iconButton notifBellBtn ${unreadMessages.length > 0 ? "hasUnread" : ""}`}
            id="topbar-notifications-btn"
            onClick={() => setIsNotificationsOpen(true)}
            aria-label={t("notifications")}
            title={t("notifications")}
          >
            <span className="bellIconSpan">🔔</span>
            {unreadMessages.length > 0 ? (
              <>
                <span className="notifBadge">{unreadMessages.length}</span>
                <span className="bellPulse" />
              </>
            ) : null}
          </button>
          <button
            className="iconButton"
            id="topbar-wishlist-btn"
            onClick={() => go("wishlist")}
            aria-label={t("nav_wishlist")}
          >
            ♡<span className="badge">{wishlist.length}</span>
          </button>
          <button
            className="iconButton"
            id="topbar-cart-btn"
            onClick={() => go("cart")}
            aria-label={t("nav_cart")}
          >
            🛍️<span className="badge">{cartCount}</span>
          </button>
        </div>
      </header>

      <div
        className="tabSwipeArea pageAnimEnter"
        key={page}
        onTouchStart={handleTabTouchStart}
        onTouchEnd={handleTabTouchEnd}
      >
        {page === "home" && (
          <>
            <section
              className={`hero ${isTelegramWebapp ? "telegramHeroBanner" : ""}`}
              onTouchStart={handleHeroTouchStart}
              onTouchMove={handleHeroTouchMove}
              onTouchEnd={handleHeroTouchEnd}
              onTouchCancel={handleHeroTouchEnd}
              onMouseDown={handleHeroMouseDown}
              onMouseMove={handleHeroMouseMove}
              onMouseUp={handleHeroMouseUp}
              onMouseLeave={handleHeroMouseLeave}
            >
              <div
                className="heroSlideTrack"
                style={{
                  transform: `translate3d(calc(-${activeBannerIdx * 100}% + ${heroDragOffset}px), 0, 0)`,
                  transition: isHeroDragging ? "none" : "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {heroBanners.map((banner, idx) => {
                  const badge = banner.badgeText || "TOP SOTILGAN";
                  const title = banner.title || "Eksklyuziv Pijamalar Sets ✨";
                  const subtitle =
                    banner.subtitle ||
                    "Uydagi har bir lahjangizni go‘zallashtiring";
                  const cta = banner.ctaText || "Xarid qilish";

                  return (
                    <div key={banner.id || idx} className="heroSlideItem">
                      {/* Background Image - 100% Natural, Vibrant and Crisp */}
                      <img
                        src={banner.imageUrl || promoBannerUrl}
                        alt={banner.title || "Banner"}
                        className="heroSlideImg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = promoBannerUrl;
                        }}
                        draggable={false}
                      />

                      {/* Content / Banner Bio covering entire surface */}
                      <div
                        className="heroOverlay"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCategory("Barchasi");
                          setSearch("");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                          go("catalog");
                        }}
                      >
                        <span className="heroBadge">{badge}</span>
                        <h1 className="heroTitle">{title}</h1>
                        <p className="heroSubtitle">{subtitle}</p>
                        <div className="heroCtaWrap">
                          <button
                            type="button"
                            className="hero3dBtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategory("Barchasi");
                              setSearch("");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              go("catalog");
                            }}
                          >
                            <span>{cta || "Xarid qilish"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>


            </section>
            <RotatingCategoriesSection
              categories={allCategories}
              products={products}
              onSelectCategory={(catName) => {
                setSelectedCategory(catName);
                go("catalog");
              }}
              onOpenProduct={(p) => openProduct(p, "home")}
              onViewAll={() => {
                setSelectedCategory("Barchasi");
                go("catalog");
              }}
            />
            <section className="section">
              <div className="sectionTitle">
                <h2>{t("featured_title")}</h2>
                <button onClick={() => go("catalog")}>{t("see_all")}</button>
              </div>
              {productsLoading ? (
                <ProductGridSkeleton count={4} />
              ) : productsError ? (
                <div className="empty">
                  <div>⚠️</div>
                  <h3>Catalog vaqtincha ochilmadi</h3>
                  <p>{productsError}</p>
                </div>
              ) : (
                <div className="productGrid">
                  {products
                    .filter((p) => p.featured && p.active !== false)
                    .slice(0, 8)
                    .map((p) => card(p))}
                </div>
              )}
            </section>
            <div className="deliveryBanner">
              <div>
                <span>🚚</span>
                <div>
                  <b>{t("delivery_banner_title")}</b>
                  <p>{t("delivery_banner_desc")}</p>
                </div>
              </div>
            </div>
          </>
        )}
        {page === "catalog" && (
          <PullToRefresh
            language={language}
            onRefresh={async () => {
              await loadProducts(true);
              showToast("✓ Katalog yangilandi");
            }}
          >
            <main className="page">
              <div className="pageHeader">
                <span>GULI {t("brand_sub")}</span>
                <h1>{t("catalog_title")}</h1>
                <p>{t("catalog_sub")}</p>
              </div>
              <div className="searchBox">
                ⌕
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search_placeholder")}
                />
              </div>
              <div className="categoryTabs">
                {allCategories.map((c) => (
                  <button
                    key={c.name}
                    className={`tab ${selectedCategory === c.name ? "active" : ""}`}
                    onClick={() => setSelectedCategory(c.name)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {productsLoading ? (
                <ProductGridSkeleton count={6} />
              ) : productsError ? (
                <div className="empty">
                  <div>⚠️</div>
                  <h3>Yuklashda xatolik</h3>
                  <p>{productsError}</p>
                </div>
              ) : filtered.length ? (
                <div className="productGrid">
                  {filtered.map((p) => card(p))}
                </div>
              ) : (
                <div className="empty">
                  <div>⌕</div>
                  <h3>{t("product_not_found")}</h3>
                  <p>{t("product_not_found_desc")}</p>
                </div>
              )}
            </main>
          </PullToRefresh>
        )}
        {page === "product" && selectedProduct && (
          <main className="productDetail">
            <button className="backButton" onClick={() => go(previousPage)}>
              ← {t("back")}
            </button>
            <div className="detailImageWrap">
              <ProductImageGallery product={selectedProduct} detail />
              <button
                className="detailHeart"
                onClick={() => toggleWishlist(selectedProduct.id)}
              >
                {wishlist.includes(selectedProduct.id) ? "♥" : "♡"}
              </button>
            </div>
            <div className="detailContent">
              <span className="categoryLabel">{selectedProduct.category}</span>
              <h1>{selectedProduct.name}</h1>
              {selectedProduct.product_code ? (
                <small className="productCodeLabel">
                  {t("product_code")}: {selectedProduct.product_code}
                </small>
              ) : null}
              <div className="rating">
                ★ {selectedProduct.rating.toFixed(1)}{" "}
                <span>
                  ({selectedProduct.reviews} {t("reviews_count")})
                </span>
              </div>
              <div className="priceRow">
                <strong>{formatPrice(selectedProduct.price)}</strong>
                {selectedProduct.oldPrice ? (
                  <del>{formatPrice(selectedProduct.oldPrice)}</del>
                ) : null}
              </div>
              <p className="description">{selectedProduct.description}</p>
              <h3>{t("size")}</h3>
              <div className="options">
                {selectedProduct.sizes.map((s) => (
                  <button
                    key={s}
                    className={`option ${selectedSize === s ? "active" : ""}`}
                    onClick={() => setSelectedSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <h3>{t("color")}</h3>
              <div className="colorOptionsSwatches">
                {selectedProduct.colors.map((c) => {
                  const { name, hex } = parseColorValue(c);
                  const isLight = isLightColor(hex);
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`colorSwatchBtn ${selectedColor === c ? "active" : ""}`}
                      onClick={() => setSelectedColor(c)}
                      title={name}
                      aria-label={name}
                    >
                      <span
                        className="colorSwatchCircle"
                        style={{
                          backgroundColor: hex,
                          border: isLight
                            ? "1px solid rgba(0, 0, 0, 0.16)"
                            : "1px solid rgba(255, 255, 255, 0.12)",
                        }}
                      >
                        {selectedColor === c && (
                          <span
                            className="colorSwatchCheck"
                            style={{ color: isLight ? "#111111" : "#ffffff" }}
                          >
                            ✓
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="stock">
                {selectedProduct.stock > 0
                  ? `✓ ${t("in_stock")}: ${selectedProduct.stock} dona`
                  : t("out_of_stock")}
              </div>
              <button
                className="primaryButton large"
                disabled={selectedProduct.stock <= 0}
                onClick={() => {
                  addToCart(selectedProduct, selectedSize, selectedColor);
                  go("cart");
                }}
              >
                {t("add_to_cart")} — {formatPrice(selectedProduct.price)}
              </button>
            </div>
            <ProductReviewsSection
              productCode={selectedProduct.product_code || String(selectedProduct.id)}
              productName={selectedProduct.name}
              productId={selectedProduct.id}
              telegramUser={
                telegramUser
                  ? {
                      id: telegramUser.id,
                      first_name: telegramUser.first_name,
                      last_name: telegramUser.last_name,
                      username: telegramUser.username,
                      photo_url: telegramUser.photo_url,
                    }
                  : undefined
              }
              onShowToast={showToast}
            />
            <section className="recommendSection">
              <div className="sectionTitle">
                <div>
                  <span>{t("you_may_also_like")}</span>
                  <h2>{t("similar_products")}</h2>
                </div>
              </div>
              {similar.length ? (
                <div className="productGrid">
                  {similar.map((p) => card(p, true))}
                </div>
              ) : (
                <p className="muted">{t("no_similar_products")}</p>
              )}
            </section>
          </main>
        )}
        {page === "cart" && (
          <main className="page">
            <div className="pageHeader">
              <span>BUYURTMA</span>
              <h1>{t("cart_title")}</h1>
              <p>
                {cartCount
                  ? `${cartCount} ${t("cart_items_selected")}`
                  : t("cart_empty_title")}
              </p>
            </div>
            {cart.length === 0 ? (
              <div className="empty">
                <div>🛍️</div>
                <h3>{t("cart_empty_title")}</h3>
                <p>{t("cart_empty_desc")}</p>
                <button className="primaryButton" onClick={() => go("catalog")}>
                  {t("go_to_catalog")}
                </button>
              </div>
            ) : (
              <>
                <div className="cartList">
                  {cart.map((item, index) => (
                    <div
                      className="cartItem"
                      key={`${item.product.id}-${item.size}-${item.color}-${index}`}
                    >
                      <img
                        src={imageUrl(item.product)}
                        alt={item.product.name}
                      />
                      <div className="cartInfo">
                        <b>{item.product.name}</b>
                        <small>
                          {item.product.product_code
                            ? `Kod: ${item.product.product_code} · `
                            : ""}
                          {item.size || "O‘lcham tanlanmagan"} ·{" "}
                          {formatColorName(item.color) || "Rang tanlanmagan"}
                        </small>
                        <strong>
                          {formatPrice(item.product.price * item.quantity)}
                        </strong>
                        <div className="quantity">
                          <button onClick={() => changeQuantity(index, -1)}>
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button onClick={() => changeQuantity(index, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="promoBox">
                  <input
                    value={promo}
                    onChange={(e) => {
                      setPromo(e.target.value.toUpperCase());
                      if (promoApplied) {
                        setPromoApplied(false);
                        setPromoDiscount(0);
                      }
                    }}
                    placeholder="Promo kod"
                    maxLength={40}
                  />
                  <button onClick={applyPromo} disabled={promoLoading}>
                    {promoLoading
                      ? "Tekshirilmoqda…"
                      : promoApplied
                        ? "✓ Qo‘llandi"
                        : "Qo‘llash"}
                  </button>
                </div>
                {promoApplied ? (
                  <div className="promoSuccess">
                    ✓ {promo} promo kodi qo‘llandi · −
                    {formatPrice(promoDiscount)}
                  </div>
                ) : null}
                <div className="summary">
                  <div>
                    <span>Mahsulotlar</span>
                    <b>{formatPrice(subtotal)}</b>
                  </div>
                  <div>
                    <span>Yetkazib berish</span>
                    <b>{delivery ? formatPrice(delivery) : "Bepul"}</b>
                  </div>
                  {discount > 0 ? (
                    <div className="discountLine">
                      <span>Chegirma</span>
                      <b>−{formatPrice(discount)}</b>
                    </div>
                  ) : null}
                  <hr />
                  <div className="total">
                    <span>Jami</span>
                    <b>{formatPrice(total)}</b>
                  </div>
                </div>
                <button
                  className="primaryButton large"
                  onClick={() => go("checkout")}
                >
                  Buyurtma berish — {formatPrice(total)}
                </button>
              </>
            )}
          </main>
        )}
        {page === "checkout" && (
          <main className="page checkoutPage">
            <div className="pageHeader">
              <span>CHECKOUT</span>
              <h1>Buyurtmani rasmiylashtirish</h1>
              <p>Ma’lumotlarni tekshiring va buyurtmani tasdiqlang.</p>
            </div>
            <div className="checkoutCard">
              <div className="cardTitle">
                <span className="step">1</span>
                <div>
                  <h3>Telefon raqami</h3>
                  <p>Buyurtma bo‘yicha bog‘lanish uchun</p>
                </div>
              </div>
              <input
                className="input full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                type="tel"
              />
              <button
                className={`phoneAutoButton btn-3d ${phoneLoading ? "loading" : ""}`}
                onClick={requestTelegramPhone}
                disabled={phoneLoading}
              >
                {phoneLoading
                  ? "⏳ Telegramdan olinmoqda…"
                  : phone
                    ? "✓ Telegram raqamini yangilash"
                    : "📱 Telegram raqamimni avtomatik olish"}
              </button>
            </div>
            <div className="checkoutCard">
              <div className="cardTitle">
                <span className="step">2</span>
                <div>
                  <h3>Yetkazib berish manzili</h3>
                  <p>GPS lokatsiya yoki qo‘lda to‘ldiring</p>
                </div>
              </div>
              <button className="locationButton btn-3d" onClick={requestLocation}>
                {locationLoading
                  ? "⌛ Aniqlanmoqda..."
                  : address.latitude
                    ? "↻ Joylashuvni qayta aniqlash"
                    : "📍 Joylashuvimni aniqlash"}
              </button>
              {address.latitude ? (
                <LocationPicker
                  latitude={address.latitude}
                  longitude={address.longitude}
                  onChange={updateMapPosition}
                />
              ) : null}


              {/* Region & District Selectors with Manual Fallback */}
              {(() => {
                const availableRegions = Object.keys(uzbekistanRegionsData);
                const isCustomRegion = Boolean(address.region && !availableRegions.includes(address.region));
                const currentDistricts = address.region && uzbekistanRegionsData[address.region] ? uzbekistanRegionsData[address.region] : [];
                const isCustomDistrict = Boolean(address.district && currentDistricts.length > 0 && !currentDistricts.includes(address.district));

                return (
                  <>
                    <div className="twoInputs" style={{ marginBottom: "12px" }}>
                      <div>
                        <label style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: "4px" }}>Viloyat / Shahar</label>
                        <select
                          className="input"
                          style={{ width: "100%" }}
                          value={isCustomRegion ? "Boshqa" : (address.region || "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Boshqa") {
                              setAddressField("region", "");
                              setAddressField("district", "");
                            } else {
                              setAddressField("region", val);
                              const dists = uzbekistanRegionsData[val] || [];
                              setAddressField("district", dists[0] || "");
                            }
                          }}
                        >
                          <option value="">Viloyatni tanlang...</option>
                          {availableRegions.map((reg) => (
                            <option key={reg} value={reg}>{reg}</option>
                          ))}
                          <option value="Boshqa">✍️ Boshqa (qo‘lda kiritish)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: "4px" }}>Tuman / Shaharcha</label>
                        {currentDistricts.length > 0 ? (
                          <select
                            className="input"
                            style={{ width: "100%" }}
                            value={isCustomDistrict ? "Boshqa" : (address.district || "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "Boshqa") {
                                setAddressField("district", "");
                              } else {
                                setAddressField("district", val);
                              }
                            }}
                          >
                            <option value="">Tumanni tanlang...</option>
                            {currentDistricts.map((dist) => (
                              <option key={dist} value={dist}>{dist}</option>
                            ))}
                            <option value="Boshqa">✍️ Boshqa (qo‘lda kiritish)</option>
                          </select>
                        ) : (
                          <input
                            className="input"
                            style={{ width: "100%" }}
                            value={address.district || ""}
                            onChange={(e) => setAddressField("district", e.target.value)}
                            placeholder="Tuman nomi"
                          />
                        )}
                      </div>
                    </div>

                    {(isCustomRegion || !address.region) && (
                      <input
                        className="input full"
                        style={{ marginBottom: "10px" }}
                        value={address.region || ""}
                        onChange={(e) => setAddressField("region", e.target.value)}
                        placeholder="Viloyatni qo‘lda kiriting (masalan: Toshkent)"
                      />
                    )}

                    {(isCustomDistrict || (currentDistricts.length > 0 && address.district === "")) && (
                      <input
                        className="input full"
                        style={{ marginBottom: "10px" }}
                        value={address.district || ""}
                        onChange={(e) => setAddressField("district", e.target.value)}
                        placeholder="Tumanni qo‘lda kiriting (masalan: Chilonzor)"
                      />
                    )}
                  </>
                );
              })()}
              <input
                className="input full"
                value={address.street || ""}
                onChange={(e) => setAddressField("street", e.target.value)}
                placeholder="Ko‘cha nomi va uyingiz manzili"
              />
              <div className="twoInputs">
                <input
                  className="input"
                  value={address.house || ""}
                  onChange={(e) => setAddressField("house", e.target.value)}
                  placeholder="Uy raqami / Dom"
                />
                <input
                  className="input"
                  value={address.apartment || ""}
                  onChange={(e) => setAddressField("apartment", e.target.value)}
                  placeholder="Padezd / Xonadon"
                />
              </div>
              <input
                className="input full"
                value={address.landmark || ""}
                onChange={(e) => setAddressField("landmark", e.target.value)}
                placeholder="Mo‘ljal (masalan: Supermarket yonida)"
              />
            </div>
            <div className="checkoutCard">
              <div className="cardTitle">
                <span className="step">3</span>
                <div>
                  <h3>To‘lov usuli</h3>
                </div>
              </div>
              <div
                className={`paymentOptionVibrant ${!phone.trim() || !address.region?.trim() || !address.district?.trim() || !address.street?.trim() || !cart.length ? "disabled" : ""}`}
                onClick={() => {
                  if (!phone.trim()) {
                    showToast("Iltimos telefon raqamingizni kiriting");
                    return;
                  }
                  if (!address.region?.trim() || !address.district?.trim() || !address.street?.trim()) {
                    showToast("Iltimos manzilni (viloyat, tuman va ko‘cha) to‘liq kiriting");
                    return;
                  }
                  if (!cart.length) {
                    showToast("Savat bo‘sh");
                    return;
                  }
                  setShowCardPaymentModal(true);
                }}
                style={{
                  cursor: (phone.trim() && address.region?.trim() && address.district?.trim() && address.street?.trim() && cart.length) ? "pointer" : "not-allowed",
                  opacity: (phone.trim() && address.region?.trim() && address.district?.trim() && address.street?.trim() && cart.length) ? 1 : 0.65
                }}
              >
                <div className="vibrantCardIcon">💳</div>
                <div className="vibrantCardInfo">
                  <div className="vibrantCardTitleRow">
                    <b className="vibrantCardTitle">Karta (Uzcard / Humo)</b>
                    <span className="vibrantCardBadge">Tanlangan</span>
                  </div>
                  <small className="vibrantCardSub">Uzcard va Humo kartalari orqali tezkor to‘lov</small>
                </div>
                <div className="vibrantCheckMark">✓</div>
              </div>
            </div>
            <div className="checkoutTotal">
              <span>Jami to‘lov</span>
              <b>{formatPrice(total)}</b>
            </div>
            <button
              className="primaryButton large btn-3d"
              disabled={!phone.trim() || !address.region?.trim() || !address.district?.trim() || !address.street?.trim() || !cart.length}
              onClick={() => {
                if (!phone.trim()) {
                  showToast("Iltimos telefon raqamingizni kiriting");
                  return;
                }
                if (!address.region?.trim() || !address.district?.trim() || !address.street?.trim()) {
                  showToast("Iltimos manzilni (viloyat, tuman va ko‘cha) to‘liq kiriting");
                  return;
                }
                if (!cart.length) {
                  showToast("Savat bo‘sh");
                  return;
                }
                setShowCardPaymentModal(true);
              }}
              style={{
                opacity: (phone.trim() && address.region?.trim() && address.district?.trim() && address.street?.trim() && cart.length) ? 1 : 0.55,
                cursor: (phone.trim() && address.region?.trim() && address.district?.trim() && address.street?.trim() && cart.length) ? "pointer" : "not-allowed"
              }}
            >
              💳 Karta orqali to‘lov qilish — {formatPrice(total)}
            </button>
          </main>
        )}
        {page === "wishlist" && (
          <main className="page">
            <div className="pageHeader">
              <span>GULI {t("brand_sub")}</span>
              <h1>{t("my_wishlist")}</h1>
              <p>{t("my_wishlist_desc")}</p>
            </div>
            {wishlist.length ? (
              <div className="productGrid">
                {products
                  .filter((p) => wishlist.includes(p.id))
                  .map((p) => card(p))}
              </div>
            ) : (
              <div className="wishlistEmptyWrap">
                <div className="empty">
                  <div>♡</div>
                  <h3>Sevimlilar bo‘sh</h3>
                  <p>Yoqtirgan mahsulotlaringizni shu yerda saqlang.</p>
                  <button
                    className="primaryButton"
                    onClick={() => go("catalog")}
                  >
                    {t("go_to_catalog")}
                  </button>
                </div>
                {productsLoading ? (
                  <div className="wishlistPopularSection">
                    <div className="sectionTitle">
                      <div>
                        <span className="sectionEyebrow">TAVSIYA ETILADI</span>
                        <h2>Ommabop mahsulotlar</h2>
                      </div>
                    </div>
                    <ProductGridSkeleton count={4} />
                  </div>
                ) : products.length ? (
                  <section className="wishlistPopularSection">
                    <div className="sectionTitle">
                      <div>
                        <span className="sectionEyebrow">TAVSIYA ETILADI</span>
                        <h2>Ommabop mahsulotlar</h2>
                      </div>
                      <button onClick={() => go("catalog")}>Barchasi →</button>
                    </div>
                    <div className="productGrid">
                      {(products.filter((p) => p.featured).length
                        ? products.filter((p) => p.featured)
                        : products
                      )
                        .slice(0, 4)
                        .map((p) => card(p))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </main>
        )}
        {page === "orders" && ordersPage()}
        {page === "profile" && profilePage()}
        {page === "addresses" && (
          <main className="page">
            <div className="pageHeader">
              <span>{t("nav_profile").toUpperCase()}</span>
              <h1>{t("my_addresses")}</h1>
              <p>{t("my_addresses_desc")}</p>
            </div>
            {address.latitude ? (
              <div className="savedAddressCard">
                <div className="savedAddressIcon">📍</div>
                <div>
                  <b>{address.region || "Joylashuv"}</b>
                  <p>
                    {[
                      address.district,
                      address.street,
                      address.house,
                      address.apartment,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Lokatsiya saqlandi"}
                  </p>
                  <small>
                    {address.latitude.toFixed(5)},{" "}
                    {address.longitude.toFixed(5)}
                  </small>
                  <button
                    className="smallAction"
                    onClick={() => go("checkout")}
                  >
                    Manzilni tahrirlash
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty">
                <div>📍</div>
                <h3>Manzil hali saqlanmagan</h3>
                <p>Checkoutda joylashuvingizni aniqlang.</p>
                <button
                  className="primaryButton"
                  onClick={() => go("checkout")}
                >
                  Manzil qo‘shish
                </button>
              </div>
            )}
          </main>
        )}
        {page === "chat" && (
          <OnlineChatView
            language={language}
            onBack={() => go(previousPage || "profile")}
            user={
              telegramUser
                ? {
                    id: telegramUser.id,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name,
                    username: telegramUser.username,
                    photo_url: telegramUser.photo_url,
                  }
                : undefined
            }
            onShowToast={showToast}
          />
        )}
      </div>

      <nav className="bottomNav" aria-label="Asosiy navigatsiya">
        <button
          className={page === "home" ? "active" : ""}
          onClick={() => go("home")}
          aria-label={t("nav_home")}
          title={t("nav_home")}
        >
          <span className="navIcon">
            <Home3DIcon active={page === "home"} />
          </span>
        </button>
        <button
          className={page === "catalog" ? "active" : ""}
          onClick={() => go("catalog")}
          aria-label={t("nav_catalog")}
          title={t("nav_catalog")}
        >
          <span className="navIcon">
            <Search3DIcon active={page === "catalog"} />
          </span>
        </button>
        <button
          className={page === "wishlist" ? "active" : ""}
          onClick={() => go("wishlist")}
          aria-label={t("nav_wishlist")}
          title={t("nav_wishlist")}
        >
          <span className="navIcon">
            <Heart3DIcon active={page === "wishlist"} />
          </span>
          {wishlist.length > 0 ? (
            <em className="wishlistBadge">{wishlist.length}</em>
          ) : null}
        </button>
        <button
          className={page === "cart" ? "active" : ""}
          onClick={() => go("cart")}
          aria-label={t("nav_cart")}
          title={t("nav_cart")}
        >
          <span className="navIcon">
            <Bag3DIcon active={page === "cart"} />
          </span>
          {cartCount > 0 ? <em>{cartCount}</em> : null}
        </button>
        <button
          className={
            page === "profile" ||
            page === "orders" ||
            page === "addresses" ||
            page === "chat"
              ? "active"
              : ""
          }
          onClick={() => go("profile")}
          aria-label={t("nav_profile")}
          title={t("nav_profile")}
        >
          <span className="navIcon">
            <User3DIcon
              active={
                page === "profile" ||
                page === "orders" ||
                page === "addresses" ||
                page === "chat"
              }
            />
          </span>
        </button>
      </nav>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          theme={theme}
          onThemeChange={setTheme}
          language={language}
          onLanguageChange={setLanguage}
          currency={currency}
          onCurrencyChange={setCurrency}
          hapticsEnabled={hapticsEnabled}
          onHapticsToggle={setHapticsEnabled}
          density={density}
          onDensityChange={setDensity}
          orderAlerts={orderAlerts}
          onOrderAlertsToggle={setOrderAlerts}
          promoAlerts={promoAlerts}
          onPromoAlertsToggle={setPromoAlerts}
          onClose={() => setIsSettingsOpen(false)}
          onClearCache={handleClearCache}
          onResetSettings={() => {
            setTheme("light");
            setLanguage("uz");
            setCurrency("UZS");
            setHapticsEnabled(true);
            setDensity("normal");
            setOrderAlerts(true);
            setPromoAlerts(true);
            showToast(getTranslation("reset_settings_confirm", language));
          }}
        />
      )}

      {/* Help & Support Modal */}
      {isHelpOpen && (
        <HelpSupportModal
          language={language}
          onClose={() => setIsHelpOpen(false)}
          onOpenChat={() => {
            setIsHelpOpen(false);
            go("chat");
          }}
          onShowToast={showToast}
          initialStep={helpInitialStep}
          telegramUser={telegramUser}
        />
      )}

      {/* Social Links Modal */}
      <SocialLinksModal
        isOpen={isSocialLinksOpen}
        onClose={() => setIsSocialLinksOpen(false)}
      />

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <NotificationModal
          language={language}
          unreadMessages={unreadMessages}
          orders={orders}
          userId={currentUserId}
          onClose={() => setIsNotificationsOpen(false)}
          onOpenChat={() => {
            setIsNotificationsOpen(false);
            go("chat");
          }}
          onOpenOrders={() => {
            setIsNotificationsOpen(false);
            go("orders");
          }}
        />
      )}

      {/* Promos & Discounts Modal */}
      {isPromosOpen && (
        <PromosModal
          language={language}
          onClose={() => setIsPromosOpen(false)}
          onApplyPromo={(code) => {
            setPromo(code);
            setIsPromosOpen(false);
            showToast(`✓ Promo kod kiritildi: ${code}`);
            go("cart");
          }}
          onShowToast={showToast}
        />
      )}

      {/* Delivery & Payment Terms Modal */}
      {isDeliveryInfoOpen && (
        <DeliveryTermsModal
          language={language}
          onClose={() => setIsDeliveryInfoOpen(false)}
        />
      )}

      {/* Size Guide Modal */}
      {isSizeGuideOpen && (
        <SizeGuideModal
          language={language}
          onClose={() => setIsSizeGuideOpen(false)}
        />
      )}

      {/* About Brand & Privacy Modal */}
      {isAboutOpen && (
        <AboutBrandModal
          language={language}
          onClose={() => setIsAboutOpen(false)}
        />
      )}

      {/* Karta orqali to'lov modal (3D) */}
      {showCardPaymentModal && (
        <div
          className="modalBackdrop modalBackdropCenter"
          onClick={() => {
            if (!timerActive) setShowCardPaymentModal(false);
          }}
        >
          <div
            className="modalCard cardPaymentModal3D"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px", width: "92%", padding: "20px" }}
          >
            <div className="modalHeader">
              <h2>💳 Karta orqali to‘lov</h2>
              <button
                className="closeModalBtn"
                onClick={() => {
                  setShowCardPaymentModal(false);
                  setTimerActive(false);
                }}
              >
                ✕
              </button>
            </div>

            <div className="cardDetailsContainer">
              {isProcessingPayment ? (
                <div className="paymentProcessing3D">
                  <div className="hologram3DCube">
                    <div className="cube3DRing"></div>
                    <div className="cube3DRingOuter"></div>
                    <div className="cube3DCore">
                      {processingProgress < 100 ? "⚡" : "✅"}
                    </div>
                  </div>

                  <h3 className="processingTitle3D">
                    {processingProgress < 100
                      ? "To‘lov va chek tasdiqlanmoqda..."
                      : "Buyurtma rasmiylashtirildi!"}
                  </h3>

                  <div className="progressTrack3D">
                    <div
                      className="progressBar3D"
                      style={{ width: `${processingProgress}%` }}
                    >
                      <span className="glowParticle"></span>
                    </div>
                  </div>

                  <div className="progressPercent3D">{processingProgress}%</div>

                  <div className="processingStepsList">
                    <div
                      className={`stepItem3D ${
                        processingStep >= 1 ? "active" : ""
                      } ${processingStep > 1 ? "completed" : ""}`}
                    >
                      <span className="stepIcon">
                        {processingStep > 1 ? "✓" : "📷"}
                      </span>
                      <span className="stepText">
                        Chek va kvitansiya fayli tekshirilmoqda
                      </span>
                    </div>

                    <div
                      className={`stepItem3D ${
                        processingStep >= 2 ? "active" : ""
                      } ${processingStep > 2 ? "completed" : ""}`}
                    >
                      <span className="stepIcon">
                        {processingStep > 2 ? "✓" : "💳"}
                      </span>
                      <span className="stepText">
                        To‘lov ma’lumotlari serverga uzatilmoqda
                      </span>
                    </div>

                    <div
                      className={`stepItem3D ${
                        processingStep >= 3 ? "active" : ""
                      } ${processingStep > 3 ? "completed" : ""}`}
                    >
                      <span className="stepIcon">
                        {processingStep >= 3 ? "⏳" : "📝"}
                      </span>
                      <span className="stepText">
                        Status:{" "}
                        <strong>"⏳ To'lovni tasdiqlash kutilmoqda"</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : !timerActive ? (
                <>
                  <div className="paymentNoticeBox">
                    <div className="noticeTitle">⚠️ Diqqat! To‘lov haqida ogohlantirish</div>
                    <p>
                      "💸 To‘lov qilish" tugmasini bosganingizdan so‘ng karta rekvizitlari ko‘rinadi. To‘lov muddati <b>10 minut</b> bo‘lib, ushbu muddat ichida to‘lovni amalga oshirib, chek rasmini yuklaysiz.
                    </p>
                  </div>

                  <button
                    className="primaryButton large btn-3d startPayment3DBtn"
                    style={{ width: "100%", marginTop: "16px" }}
                    onClick={() => {
                      setTimerActive(true);
                      setPaymentTimer(600);
                      try {
                        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("heavy");
                      } catch {}
                    }}
                  >
                    💸 To‘lov qilish
                  </button>
                </>
              ) : (
                <>
                  <div className="cardVisualBox">
                    <div className="cardChip">💳 Uzcard / Humo</div>
                    <div className="cardHolderName">
                      <span className="cardLabel">Karta egasi:</span>
                      <strong className="holderText">
                        {localStorage.getItem("guli_payment_card_holder") || "X.Yusufaliyev"}
                      </strong>
                    </div>
                    <div className="cardNumberRow">
                      <span className="cardNumber">
                        {localStorage.getItem("guli_payment_card_number") || "9860 1766 1229 1557"}
                      </span>
                      <button
                        className="copyCardBtn"
                        type="button"
                        onClick={() => {
                          const num = (
                            localStorage.getItem("guli_payment_card_number") || "9860 1766 1229 1557"
                          ).replace(/\s+/g, "");
                          try {
                            navigator.clipboard.writeText(num);
                          } catch {}
                          setCopiedCard(true);
                          showToast("✓ Karta raqami nusxalandi!");
                          setTimeout(() => setCopiedCard(false), 2500);
                        }}
                      >
                        {copiedCard ? "✓ Nusxalandi" : "📋 Nusxa olish"}
                      </button>
                    </div>
                  </div>

                  <div className="activePaymentSection">
                    <div className="timerBox3D">
                      <span className="sticker3D">⏳</span>
                      <div className="timerTextWrap">
                        <span className="timerLabel">To‘lov muddati:</span>
                        <strong className={`timerDigits ${paymentTimer < 120 ? "urgent" : ""}`}>
                          {formatTimer(paymentTimer)}
                        </strong>
                      </div>
                    </div>

                    <div className="receiptUploadBox">
                      <label className="receiptUploadLabel">
                        <span>📷 Chek rasmini (kvitansiya) yuklash uchun bosing</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFileChange}
                          style={{ display: "none" }}
                        />
                      </label>

                      {isUploadingReceipt && (
                        <div className="uploadingSpinner">
                          ⏳ Rasm ishlanmoqda...
                        </div>
                      )}

                      {uploadedReceipt && (
                        <div className="uploadedReceiptStatus">
                          <div className="happyStickerHeader">
                            <span className="sticker3DHappy">☺️</span>
                            <span>Chek muvaffaqiyatli yuklandi!</span>
                          </div>
                          <img
                            src={uploadedReceipt}
                            alt="Yuklangan chek"
                            className="receiptPreviewImg"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      className="primaryButton large btn-3d submitReceipt3DBtn"
                      style={{ width: "100%", marginTop: "16px" }}
                      onClick={submitOrderWithCard}
                    >
                      ☺️ To‘lov qildim
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
