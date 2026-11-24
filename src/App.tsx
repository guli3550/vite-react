import React, {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  Reels3DIcon,
  Bag3DIcon,
  User3DIcon,
} from "./components/Nav3DIcons";
import { ReelsFeed } from "./components/reels/ReelsFeed";
import { GuliMarketProfile } from "./components/profile/GuliMarketProfile";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { DEFAULT_PRODUCTS } from "./utils/defaultProducts";
import {
  ProductImageGallery,
  type Product,
} from "./components/ProductImageGallery";
import { RotatingCategoriesSection } from "./components/RotatingCategorySection";
import { VideoAdHighlights } from "./components/videoAds/VideoAdHighlights";
import { ProductReviewsSection } from "./components/ProductReviewsSection";
import { getSynchronizedCategories, normalizeCategory } from "./utils/categoryUtils";
import {
  buildProductQueryKey,
  getCachedProductQuery,
  invalidateProductQueryCache,
  runDeduplicatedProductQuery,
} from "./utils/productQueryCache";
import {
  REELS_TRANSITION_DURATION_MS,
  THEME_TRANSITION_DURATION_MS,
  analyzeColorTransition,
  flushElementStyles,
  prefersReducedMotionEnabled,
  syncBrowserAndTelegramChrome,
} from "./utils/themeTransition";
import { getApiBaseUrl } from "./lib/apiOrigin";
import { resolvePublicMediaUrl } from "./utils/resolvePublicMediaUrl";
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
import { SavedAddressesManager } from "./components/SavedAddressesManager";
import { CheckoutView } from "./components/CheckoutView";
import { YandexCheckoutMap } from "./components/YandexCheckoutMap";
import {
  UZBEKISTAN_REGIONS_DATA,
  reverseGeocodeCoordinates,
  type AddressSearchCandidate,
} from "./utils/uzbekistanGeocoding";
import { OrderConfirmedModal } from "./components/OrderConfirmedModal";
import { GULI_LOGO_BASE64 } from "./utils/guliLogoBase64";
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
  matchesCustomerChatScope,
  subscribeToChat,
} from "./utils/chatSync";
import {
  dismissNotificationIdsStorage,
  hasActivePendingOrders,
  markOrderNotificationsAsReadStorage,
  shouldPollOrders,
} from "./utils/notificationFeed";
import { resolveSwipedProduct } from "./utils/productNav";
import { detectPlatform, initPlatformEnvironment } from "./utils/platformAdapter";
import { CustomerAuthModal, type AuthUser } from "./components/CustomerAuthModal";
import { getSupabase, signOutEverywhere } from "./lib/supabaseClient";
import { ModernProfileView } from "./components/ModernProfileView";
import { checkReceiptDelayed, getDeliveryEstimate } from "./utils/delivery";
import { copyToClipboard } from "./utils/clipboard";
import { VideoAdCard } from "./components/videoAds/VideoAdCard";
import { getAdsForPlacement, isAdActiveAndVisible, type VideoAd } from "./types/videoAd";
import { markStartupPhase } from "./utils/startupProgress";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData?: string;
        version?: string;
        isVersionAtLeast?: (version: string) => boolean;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
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
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          isVisible?: boolean;
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
export type Order = {
  id: string;
  order_number?: string;
  first_name?: string;
  last_name?: string;
  customer_name?: string;
  birth_date?: string;
  dob?: string;
  items: CartItem[];
  subtotal: number;
  delivery: number;
  discount: number;
  cashback_used?: number;
  cashback_earned?: number;
  total: number;
  address?: Address;
  phone: string;
  payment: string;
  status: string;
  receipt_url?: string;
  payment_receipt_path?: string;
  payment_status?: string;
  createdAt: string;
  updatedAt?: string;
  statusUpdatedAt?: string;
};
export type OrderNotification = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  previousStatus?: string;
  previousPaymentStatus?: string;
  timestamp: string;
  read: boolean;
};

const orderStateKey = (order: Pick<Order, "status" | "payment_status">) =>
  JSON.stringify({
    status: String(order.status || ""),
    paymentStatus: String(order.payment_status || "pending"),
  });

const orderNotificationKey = (userId: string | number) =>
  `guli_order_notifications_v2_${String(userId)}`;
const orderStateKeyStorage = (userId: string | number) =>
  `guli_order_state_v2_${String(userId)}`;


type Page =
  | "home"
  | "catalog"
  | "wishlist"
  | "reels"
  | "cart"
  | "profile"
  | "checkout"
  | "orders"
  | "addresses"
  | "product"
  | "chat"
  | "brand_profile";
const MAIN_TABS: Page[] = ["home", "catalog", "reels", "cart", "profile"];
const API_URL = getApiBaseUrl();

const persistOrdersSafely = (orders: Order[]) => {
  // Receipts can be large data URLs. They must never be persisted in localStorage
  // together with the complete order list; that can exhaust the Web Storage quota
  // and crash the React app during checkout/realtime updates.
  const compact = orders.map((order) => {
    const rest = { ...order };
    delete (rest as { receipt_url?: string }).receipt_url;
    return rest;
  });
  try {
    localStorage.setItem("orders", JSON.stringify(compact));
    localStorage.removeItem("guli_orders");
  } catch (error) {
    // Storage is only an offline cache. Never let quota exhaustion break the app.
    console.warn("[Guli storage] orders cache skipped:", error);
  }
};

const uzbekistanRegionsData = UZBEKISTAN_REGIONS_DATA;
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
  const url = resolvePublicMediaUrl(list[index] || list[0] || "");
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
const LocationPicker = YandexCheckoutMap;

export default function App() {
  const isTelegramWebapp = useMemo(() => detectPlatform().isTelegram, []);
  const telegramUser = tg()?.initDataUnsafe?.user;

  // Modern Customer Authentication State (Google + Email)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("guli_auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<"signin" | "signup">("signin");
  const [authGateCustomMessage, setAuthGateCustomMessage] = useState<{ title?: string; subtitle?: string }>({});

  const isCustomerAuthenticated = useMemo(() => {
    if (telegramUser?.id) return true;
    const token = localStorage.getItem("guli_access_token");
    if (token || authUser) return true;
    return false;
  }, [telegramUser, authUser]);

  const displayName =
    authUser?.full_name ||
    [telegramUser?.first_name, telegramUser?.last_name]
      .filter(Boolean)
      .join(" ") ||
    localStorage.getItem("guli_first_name") ||
    "GULI mijozi";
  const avatar =
    authUser?.avatar_url ||
    localStorage.getItem("guli_custom_avatar") ||
    localStorage.getItem("guli_avatar_url") ||
    telegramUser?.photo_url ||
    "";
  const currentUserId = telegramUser?.id
    ? String(telegramUser.id)
    : authUser?.id || "guest-user";

  const [page, setPage] = useState<Page>(() => {
    try {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes("/profile/guli-market") || hash.includes("/profile/guli-market")) {
        return "brand_profile";
      }
    } catch {}
    return "home";
  });
  const [previousPage, setPreviousPage] = useState<Page>("home");
  const [pageHistory, setPageHistory] = useState<Page[]>(["home"]);
  const [reelsActiveIndex, setReelsActiveIndex] = useState<number>(0);
  const [targetReelId, setTargetReelId] = useState<string | undefined>(undefined);
  const [brandProfileInitialTab, setBrandProfileInitialTab] = useState<"tovarlar" | "reels" | "reklamalar">("tovarlar");
  const PRODUCTS_PAGE_SIZE = 40;
  const [products, setProducts] = useState<Product[]>([]);
  const [homeCatalogSnapshot, setHomeCatalogSnapshot] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [productsHasMore, setProductsHasMore] = useState(true);
  const productsOffsetRef = useRef(0);
  const productsHasMoreRef = useRef(true);
  const productsLoadingMoreRef = useRef(false);
  const productsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  // Keeps the storefront self-healing when the Render service is cold-starting.
  // A customer must never need to refresh the entire page to recover the catalog.
  const productsRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupProductsReportedRef = useRef(false);
  const startupBannersReportedRef = useRef(false);
  const [productsError, setProductsError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [brandProfileProductQueue, setBrandProfileProductQueue] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [homeVideoAds, setHomeVideoAds] = useState<VideoAd[]>([]);
  const [feedVideoAds, setFeedVideoAds] = useState<VideoAd[]>([]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [cart, setCart] = useState<CartItem[]>(() => readStorage("cart", []));
  const [wishlist, setWishlist] = useState<number[]>(() =>
    readStorage("wishlist", []),
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    readStorage("orders", []),
  );
  const orderNotificationsKey = orderNotificationKey(currentUserId);
  const orderStatesKey = orderStateKeyStorage(currentUserId);
  const [orderNotifications, setOrderNotifications] = useState<OrderNotification[]>(() => {
    try {
      const raw = localStorage.getItem(orderNotificationsKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const orderStatesRef = useRef<Record<string, string>>({});
  const orderStatesReadyRef = useRef(false);
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
  const [firstName, setFirstName] = useState<string>(() => {
    return (
      localStorage.getItem("guli_first_name") ||
      telegramUser?.first_name ||
      ""
    );
  });
  const [lastName, setLastName] = useState<string>(() => {
    return (
      localStorage.getItem("guli_last_name") ||
      telegramUser?.last_name ||
      ""
    );
  });
  const [birthDate, setBirthDate] = useState<string>(() => {
    return localStorage.getItem("guli_birth_date") || "";
  });
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [showCardPaymentModal, setShowCardPaymentModal] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    orderId: string;
    total?: number;
  } | null>(null);
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
  const [locationResolving, setLocationResolving] = useState(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const pendingQrPromoRef = useRef<string>("");
  const [useCashback, setUseCashback] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showSpendingStats, setShowSpendingStats] = useState(false);
  const [toast, setToast] = useState("");

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

  const [promoBannerUrl, setPromoBannerUrl] = useState<string>("");

  const [appLogo, setAppLogo] = useState<string>(() => {
    const saved = localStorage.getItem("guli_custom_logo");
    if (!saved || saved === "/guli-logo.webp" || saved === "/guli-logo.jpg") {
      return GULI_LOGO_BASE64;
    }
    return saved;
  });

  useEffect(() => {
    const handleLogoUpdate = (e: any) => {
      const saved = e?.detail || localStorage.getItem("guli_custom_logo");
      const newLogo = !saved || saved === "/guli-logo.webp" || saved === "/guli-logo.jpg" ? GULI_LOGO_BASE64 : saved;
      setAppLogo(newLogo);
    };
    window.addEventListener("guli_logo_updated", handleLogoUpdate);
    window.addEventListener("guli_settings_updated", handleLogoUpdate);
    return () => {
      window.removeEventListener("guli_logo_updated", handleLogoUpdate);
      window.removeEventListener("guli_settings_updated", handleLogoUpdate);
    };
  }, []);

  const [heroBanners, setHeroBanners] = useState<Banner[]>([]);

  const [activeBannerIdx, setActiveBannerIdx] = useState<number>(0);
  const [heroDragOffset, setHeroDragOffset] = useState<number>(0);
  const [isHeroDragging, setIsHeroDragging] = useState<boolean>(false);
  const heroTouchStartX = useRef<number>(0);
  const heroTouchStartY = useRef<number>(0);
  const heroTouchStartTime = useRef<number>(0);
  const isHorizontalHeroSwipe = useRef<boolean | null>(null);
  // Prevent the browser's synthetic click after a swipe from activating a banner link.
  const heroSuppressClickRef = useRef(false);
  const suppressHeroClick = () => {
    heroSuppressClickRef.current = true;
    window.setTimeout(() => {
      heroSuppressClickRef.current = false;
    }, 400);
  };
  const openHeroBanner = (banner?: Banner) => {
    const target = String(banner?.actionTarget || "").trim();
    if (target && /^https?:\/\//i.test(target)) {
      const telegramWebApp = window.Telegram?.WebApp;
      if (telegramWebApp?.openLink) {
        telegramWebApp.openLink(target);
      } else {
        window.location.href = target;
      }
      return;
    }
    if (target.startsWith("/")) {
      window.location.href = target;
      return;
    }
    setSelectedCategory("Barchasi");
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    go("catalog");
  };

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
      suppressHeroClick();
      if (heroDragOffset < -35 || (isQuickFlick && heroDragOffset < 0)) {
        setActiveBannerIdx((prev) => (prev + 1) % heroBanners.length);
      } else if (heroDragOffset > 35 || (isQuickFlick && heroDragOffset > 0)) {
        setActiveBannerIdx((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
      }
    } else if (Math.abs(heroDragOffset) < 12 && duration < 450) {
      openHeroBanner(heroBanners[activeBannerIdx]);
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
      suppressHeroClick();
      if (heroDragOffset < -35 || (isQuickFlick && heroDragOffset < 0)) {
        setActiveBannerIdx((prev) => (prev + 1) % heroBanners.length);
      } else if (heroDragOffset > 35 || (isQuickFlick && heroDragOffset > 0)) {
        setActiveBannerIdx((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
      }
    }
    setHeroDragOffset(0);
  };

  const handleHeroMouseLeave = () => {
    if (isHeroDragging) {
      handleHeroMouseUp();
    }
  };

  useEffect(() => {
    markStartupPhase("cache");

    const syncBanners = async () => {
      try {
        const res = await fetch(`${API_URL}/api/banners`, {
          cache: "no-store",
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        });
        if (!res.ok) throw new Error(`Banner API status: ${res.status}`);
        const json = await res.json();
        if (json.success !== true || !Array.isArray(json.data)) {
          throw new Error(json?.message || "Banner API noto‘g‘ri javob qaytardi");
        }
        const active = json.data.filter((b: Banner) => b.active !== false);
        setHeroBanners(active);
        setActiveBannerIdx(0);
      } catch (error) {
        console.warn("[GULI] Production banner load failed", error);
        setHeroBanners([]);
        setActiveBannerIdx(0);
      } finally {
        if (!startupBannersReportedRef.current) {
          startupBannersReportedRef.current = true;
          markStartupPhase("banners");
        }
      }
    };

    syncBanners();
    window.addEventListener("guli_banners_updated", syncBanners);
    window.addEventListener("storage", syncBanners);

    const fetchBanner = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings/banner`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        setPromoBannerUrl(json?.success === true && typeof json.url === "string" ? json.url : "");
      } catch {
        setPromoBannerUrl("");
      }
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

  // Load active video ads for Home and Feed
  useEffect(() => {
    const platform = isTelegramWebapp ? "telegram" : "web";
    fetch(`${API_URL}/api/video-ads?placement=all&platform=${platform}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          // The public API returns complete VideoAd records; narrow the untyped JSON boundary here.
          const ads = (json.data as VideoAd[]).filter((item) => isAdActiveAndVisible(item));
          const home = getAdsForPlacement(ads, "home");
          const feed = getAdsForPlacement(ads, "product_feed");
          setHomeVideoAds(home);
          setFeedVideoAds(feed);
        }
      })
      .catch((err) => console.warn("[VideoAds] Storefront fetch warning:", err));
  }, [isTelegramWebapp]);

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

  const unreadOrderNotificationCount = useMemo(() => {
    const seen = new Set<string>();
    for (const item of orderNotifications) {
      if (!item.read) {
        seen.add(String(item.orderNumber || item.id));
      }
    }
    return seen.size;
  }, [orderNotifications]);
  const totalUnreadNotificationCount =
    unreadMessages.length + unreadOrderNotificationCount;

  const pageRef = useRef<Page>(page);
  pageRef.current = page;
  const orderAlertsRef = useRef<boolean>(orderAlerts);
  orderAlertsRef.current = orderAlerts;
  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;
  const ordersInFlightRef = useRef<Promise<Order[]> | null>(null);
  const lastOrdersFetchAtRef = useRef<number>(0);
  const ordersRealtimeConnectedRef = useRef<boolean>(false);

  const registerOrderStateChanges = useCallback((nextOrders: Order[]) => {
    const nextStates: Record<string, string> = {};
    nextOrders.forEach((order) => {
      nextStates[String(order.order_number || order.id)] = orderStateKey(order);
    });

    const previousStates = orderStatesRef.current;
    if (orderStatesReadyRef.current) {
      const changes: OrderNotification[] = [];
      const isViewingOrders = pageRef.current === "orders";
      nextOrders.forEach((order) => {
        const key = String(order.order_number || order.id);
        const before = previousStates[key];
        const after = nextStates[key];
        if (!before || before === after) return;

        let previous: { status?: string; paymentStatus?: string } = {};
        let current: { status?: string; paymentStatus?: string } = {};
        try { previous = JSON.parse(before); } catch {}
        try { current = JSON.parse(after); } catch {}

        changes.push({
          id: `order-state-${key}-${Date.now()}-${changes.length}`,
          orderNumber: String(order.order_number || order.id),
          status: String(current.status || order.status || ""),
          paymentStatus: String(current.paymentStatus || order.payment_status || "pending"),
          previousStatus: previous.status,
          previousPaymentStatus: previous.paymentStatus,
          timestamp: order.updatedAt || order.statusUpdatedAt || new Date().toISOString(),
          read: isViewingOrders,
        });
      });

      if (changes.length) {
        setOrderNotifications((existing) => {
          const filteredChanges = changes.filter((c) => {
            const latestExisting = existing.find((e) => e.orderNumber === c.orderNumber);
            if (!latestExisting) return true;
            return (
              latestExisting.status !== c.status ||
              latestExisting.paymentStatus !== c.paymentStatus
            );
          });
          if (!filteredChanges.length) return existing;
          const updated = [...filteredChanges, ...existing].slice(0, 100);
          try { localStorage.setItem(orderNotificationsKey, JSON.stringify(updated)); } catch {}
          window.dispatchEvent(new Event("guli_order_notifications_updated"));
          if (orderAlertsRef.current && !isViewingOrders) {
            const first = filteredChanges[0];
            setToast(`📦 Buyurtma №${first.orderNumber}: ${first.status}`);
            window.setTimeout(() => setToast(""), 2800);
          }
          return updated;
        });
      }
    }

    orderStatesRef.current = nextStates;
    orderStatesReadyRef.current = true;
    try { localStorage.setItem(orderStatesKey, JSON.stringify(nextStates)); } catch {}
  }, [orderNotificationsKey, orderStatesKey]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    if (orderStatesReadyRef.current) return;
    try {
      const raw = localStorage.getItem(orderStatesKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        orderStatesRef.current = parsed as Record<string, string>;
        orderStatesReadyRef.current = true;
      }
    } catch {}
  }, [orderStatesKey]);

  useEffect(() => {
    const syncOrderNotificationState = () => {
      try {
        const raw = localStorage.getItem(orderNotificationsKey);
        const parsed = raw ? JSON.parse(raw) : [];
        setOrderNotifications(Array.isArray(parsed) ? parsed : []);
      } catch {}
    };
    window.addEventListener("guli_order_notifications_updated", syncOrderNotificationState);
    return () => window.removeEventListener("guli_order_notifications_updated", syncOrderNotificationState);
  }, [orderNotificationsKey]);

  // Initialize platform responsive environment
  useEffect(() => {
    initPlatformEnvironment();
  }, []);

  // (Supabase Auth and Google Auth blocks removed for canonical Telegram-only auth)


  // Expose global trigger for auth bridge and brand profile navigation
  useEffect(() => {
    (window as any).openGuliCustomerAuthModal = (tab: "signin" | "signup" = "signin") => {
      setAuthInitialTab(tab);
      setIsCustomerAuthOpen(true);
    };
    (window as any).openGuliBrandProfile = () => {
      go("brand_profile");
    };
    return () => {
      delete (window as any).openGuliCustomerAuthModal;
      delete (window as any).openGuliBrandProfile;
    };
  }, []);

  const handleLogout = async () => {
    await signOutEverywhere();
    setAuthUser(null);
    setOrders([]);
    setWishlist([]);
    localStorage.removeItem("orders");
    localStorage.removeItem("guli_orders");
    localStorage.removeItem("guli_wishlist");
    localStorage.removeItem("guli_phone");
    localStorage.removeItem("guli_first_name");
    localStorage.removeItem("guli_last_name");
    localStorage.removeItem("guli_birth_date");
    localStorage.removeItem("guli_email");
    localStorage.removeItem("guli_custom_avatar");
    localStorage.removeItem("guli_avatar_url");
    localStorage.removeItem("guli_customer_photo");
    showToast("✓ Hisobingizdan chiqdingiz. Qayta kirishingiz mumkin.");
  };

  const handleUpdateProfile = (updated: Partial<AuthUser> & { birth_date?: string }) => {
    setAuthUser((prev) => {
      const next = prev ? { ...prev, ...updated } : ({ id: "user_" + Date.now(), ...updated } as AuthUser);
      localStorage.setItem("guli_auth_user", JSON.stringify(next));
      return next;
    });
    const key = authUser?.id || currentUserId;
    if (updated.avatar_url && key) {
      localStorage.setItem(`guli_avatar_${key}`, updated.avatar_url);
    }

    // Buyurtma rasmiylashtirish (Checkout) maydonlariga avtomatik kiritish
    if (updated.full_name) {
      const parts = updated.full_name.trim().split(/\s+/);
      const fName = parts[0] || "";
      const lName = parts.slice(1).join(" ") || "";
      setFirstName(fName);
      setLastName(lName);
      localStorage.setItem("guli_first_name", fName);
      localStorage.setItem("guli_last_name", lName);
      if (key) {
        localStorage.setItem(`guli_name_${key}`, updated.full_name.trim());
      }
    }
    if (updated.phone) {
      const p = updated.phone.trim();
      setPhone(p);
      localStorage.setItem("guli_phone", p);
      if (key) {
        localStorage.setItem(`guli_phone_${key}`, p);
      }
    }
    const dob = updated.birth_date || (updated as any)?.dob;
    if (dob) {
      const d = dob.trim();
      setBirthDate(d);
      localStorage.setItem("guli_birth_date", d);
      if (key) {
        localStorage.setItem(`guli_dob_${key}`, d);
      }
    }

    showToast("✓ Profil muvaffaqiyatli saqlandi!");
  };

  const appShellRef = useRef<HTMLDivElement | null>(null);
  const themeVeilRef = useRef<HTMLDivElement | null>(null);
  const themeToggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevThemeRef = useRef<"light" | "dark">(theme);
  const prevRenderedPageRef = useRef<Page>(page);
  const themeTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reelsTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeIconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth gradual color transitions for theme switch & Reels <-> storefront navigation
  useLayoutEffect(() => {
    const root = document.documentElement;
    const appShellEl = appShellRef.current;
    const veilEl = themeVeilRef.current;
    const toggleBtnEl = themeToggleBtnRef.current;

    const plan = analyzeColorTransition(
      prevThemeRef.current,
      theme,
      prevRenderedPageRef.current,
      page,
    );
    const reducedMotion = prefersReducedMotionEnabled();

    if (plan.needsColorTransition && !reducedMotion) {
      if (themeTransitionTimerRef.current) {
        clearTimeout(themeTransitionTimerRef.current);
      }
      root.classList.add("guli-theme-transitioning");
      if (plan.themeChanged) {
        flushElementStyles(root);
      }
      themeTransitionTimerRef.current = setTimeout(() => {
        root.classList.remove("guli-theme-transitioning");
        themeTransitionTimerRef.current = null;
      }, THEME_TRANSITION_DURATION_MS + 40);
    }

    if (plan.themeChanged && toggleBtnEl && !reducedMotion) {
      if (themeIconTimerRef.current) {
        clearTimeout(themeIconTimerRef.current);
      }
      toggleBtnEl.classList.remove("is-switching");
      flushElementStyles(toggleBtnEl);
      toggleBtnEl.classList.add("is-switching");
      themeIconTimerRef.current = setTimeout(() => {
        toggleBtnEl.classList.remove("is-switching");
        themeIconTimerRef.current = null;
      }, 500);
    }

    if ((plan.reelsExited || plan.reelsEntered) && !reducedMotion) {
      if (reelsTransitionTimerRef.current) {
        clearTimeout(reelsTransitionTimerRef.current);
      }
      appShellEl?.classList.remove("guli-reels-exiting", "guli-reels-entering");
      if (veilEl) {
        veilEl.classList.remove("is-from-reels", "is-to-reels");
        flushElementStyles(veilEl);
        veilEl.classList.add(plan.reelsExited ? "is-from-reels" : "is-to-reels");
      }
      appShellEl?.classList.add(plan.reelsExited ? "guli-reels-exiting" : "guli-reels-entering");
      reelsTransitionTimerRef.current = setTimeout(() => {
        appShellEl?.classList.remove("guli-reels-exiting", "guli-reels-entering");
        veilEl?.classList.remove("is-from-reels", "is-to-reels");
        reelsTransitionTimerRef.current = null;
      }, REELS_TRANSITION_DURATION_MS + 40);
    }

    root.setAttribute("data-theme", theme);
    syncBrowserAndTelegramChrome(theme, page);

    prevThemeRef.current = theme;
    prevRenderedPageRef.current = page;
  }, [theme, page]);

  useEffect(() => {
    return () => {
      if (themeTransitionTimerRef.current) clearTimeout(themeTransitionTimerRef.current);
      if (reelsTransitionTimerRef.current) clearTimeout(reelsTransitionTimerRef.current);
      if (themeIconTimerRef.current) clearTimeout(themeIconTimerRef.current);
      document.documentElement.classList.remove("guli-theme-transitioning");
    };
  }, []);

  // Persist theme choice (User Specific)
  useEffect(() => {
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

  // Listen to admin settings updates
  const [settingsVersion, setSettingsVersion] = useState(0);
  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettingsVersion((v) => v + 1);
      const savedTheme = localStorage.getItem("guli_theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      const savedLang = localStorage.getItem("guli_lang") as Language;
      if (savedLang === "uz" || savedLang === "ru" || savedLang === "en") setLanguage(savedLang);
    };

    const handleThemeEvt = (e: any) => {
      const mode = e.detail || localStorage.getItem("guli_theme") || "light";
      if (mode === "light" || mode === "dark") setTheme(mode);
    };

    const handleLangEvt = (e: any) => {
      const l = e.detail || localStorage.getItem("guli_lang");
      if (l === "uz" || l === "ru" || l === "en") setLanguage(l);
    };

    window.addEventListener("guli_settings_updated", handleSettingsUpdate);
    window.addEventListener("guli_theme_changed", handleThemeEvt);
    window.addEventListener("guli_lang_changed", handleLangEvt);

    return () => {
      window.removeEventListener("guli_settings_updated", handleSettingsUpdate);
      window.removeEventListener("guli_theme_changed", handleThemeEvt);
      window.removeEventListener("guli_lang_changed", handleLangEvt);
    };
  }, []);

  // Subscribe to real-time chat updates & unread message count
  useEffect(() => {
    const refreshUnread = () => {
      setUnreadMessages(getUnreadMessages(currentUserId));
    };

    const handleNewAdminMsg = (e: Event) => {
      const msg = (e as CustomEvent).detail as ChatMessage;
      if (!msg) return;
      if (!msg.userId || matchesCustomerChatScope(msg.userId, currentUserId)) {
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
          const rawSnippet =
            msg.text ||
            (msg.type === "video_note"
              ? "📹 Dumaloq video"
              : msg.type === "video"
              ? "🎬 Video xabar"
              : msg.type === "audio"
              ? "🎙️ Ovozli xabar"
              : msg.type === "file"
              ? `📄 ${msg.fileName || "Hujjat"}`
              : msg.type === "image"
              ? "📷 Rasm"
              : "Yangi xabar");
          const snippet =
            rawSnippet.length > 40 ? rawSnippet.slice(0, 40) + "…" : rawSnippet;
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

  // When user views Chat or Orders, mark corresponding notifications as read cleanly
  useEffect(() => {
    if (page === "chat") {
      markMessagesAsRead(currentUserId, "user");
      setUnreadMessages([]);
    } else if (page === "orders") {
      const updated = markOrderNotificationsAsReadStorage(currentUserId);
      setOrderNotifications(updated);
      const orderIds = (orders || []).map((o) => `order-${o.id}`);
      if (orderIds.length) {
        dismissNotificationIdsStorage(orderIds);
      }
    }
  }, [page, currentUserId, orders]);

  const tabTouchStartX = useRef<number>(0);
  const tabTouchStartY = useRef<number>(0);
  const tabTouchStartTime = useRef<number>(0);
  const isSwipingTab = useRef<boolean>(false);

  const isBrandProductSwipeActive =
    page === "product" &&
    previousPage === "brand_profile" &&
    brandProfileProductQueue.length > 1;

  const handleTabTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!MAIN_TABS.includes(page) && !isBrandProductSwipeActive) return;
    // Disable horizontal tab swipe navigation when entering Reels from Guli Market profile
    if (page === "reels" && previousPage === "brand_profile") {
      isSwipingTab.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (
      target.closest(".reelsViewport") ||
      target.closest(".reelsContainer") ||
      target.closest(".guli-fullscreen-ad-overlay") ||
      target.closest(".hero") ||
      target.closest(".heroSlideTrack") ||
      target.closest(".heroSlideItem") ||
      target.closest('.productGallerySwipe[data-multi-image="true"]') ||
      (!isBrandProductSwipeActive && target.closest(".productGallerySwipe")) ||
      target.closest(".leafletMap") ||
      target.closest(".yandexMapCard") ||
      target.closest(".yandexLeafletCanvas") ||
      target.closest(".categoryScroll") ||
      target.closest(".orderFilterTabs") ||
      target.closest(".categoryTabs") ||
      target.closest(".guli-ad-stories") ||
      target.closest(".options") ||
      target.closest(".colorOptionsSwatches") ||
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
    if (!isSwipingTab.current || (!MAIN_TABS.includes(page) && !isBrandProductSwipeActive)) return;
    if (page === "reels" && previousPage === "brand_profile") {
      isSwipingTab.current = false;
      return;
    }
    isSwipingTab.current = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - tabTouchStartX.current;
    const diffY = endY - tabTouchStartY.current;
    const timeDiff = Date.now() - tabTouchStartTime.current;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (isBrandProductSwipeActive) {
      const nextMatch = resolveSwipedProduct({
        queue: brandProfileProductQueue,
        currentProductId: selectedProduct?.id,
        diffX,
        diffY,
        timeDiff,
      });
      if (nextMatch) {
        try {
          tg()?.HapticFeedback?.impactOccurred?.("light");
        } catch {}
        setSelectedProduct(nextMatch.product);
        setSelectedSize(nextMatch.product.sizes?.[0] || "");
        setSelectedColor(nextMatch.product.colors?.[0] || "");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

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
    persistOrdersSafely(orders);
  }, [orders]);
  useEffect(() => {
    localStorage.setItem("guli_phone", phone);
  }, [phone]);
  useEffect(() => {
    localStorage.setItem("guli_first_name", firstName);
  }, [firstName]);
  useEffect(() => {
    localStorage.setItem("guli_last_name", lastName);
  }, [lastName]);
  useEffect(() => {
    localStorage.setItem("guli_birth_date", birthDate);
  }, [birthDate]);
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

  const [reuploadingOrderId, setReuploadingOrderId] = useState<string | null>(null);

  const handleOrderReceiptReupload = async (orderId: string, file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Iltimos faqat rasm faylini yuklang");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("Chek hajmi 10 MB dan oshmasligi kerak");
      return;
    }

    setReuploadingOrderId(orderId);

    const readFileAndCompress = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const rawData = ev.target?.result as string;
          const img = new Image();
          img.src = rawData;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 1200;
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
            const compressed = canvas.toDataURL("image/jpeg", 0.82);
            resolve(compressed);
          };
          img.onerror = () => reject(new Error("Rasmni qayta ishlashda xatolik"));
        };
        reader.onerror = () => reject(new Error("Faylni o‘qishda xatolik"));
        reader.readAsDataURL(file);
      });
    };

    try {
      const compressed = await readFileAndCompress();

      const token = localStorage.getItem("guli_access_token") || "";
      const tgData = (window as any).Telegram?.WebApp?.initData;
      const phoneVal = localStorage.getItem("guli_phone") || localStorage.getItem("guli_customer_phone") || "";

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (tgData) headers["X-Telegram-Init-Data"] = tgData;
      if (phoneVal) headers["X-Customer-Phone"] = phoneVal.replace(/\D/g, "");

      const bodyPayload = JSON.stringify({
        data: compressed,
        receipt_url: compressed,
        mimeType: "image/jpeg",
        order_id: orderId,
      });

      const res = await fetch(`${API_URL}/api/customer/orders/${encodeURIComponent(orderId)}/receipt`, {
        method: "POST",
        headers,
        body: bodyPayload,
      }).catch((e) => {
        console.warn("[Receipt upload attempt notice]", e);
        return null;
      });

      if (!res) {
        throw new Error("Tarmoq xatosi: Serverga ulanib bo‘lmadi.");
      }

      const resJson = await res.json().catch(() => null);
      if (!res.ok || !resJson?.success) {
        throw new Error(resJson?.message || `Server xatosi: HTTP ${res.status}`);
      }

      const updatedServerOrder = resJson.data || {};
      const newReceiptUrl = updatedServerOrder.receipt_url || compressed;

      setOrders((prevOrders) => {
        const updated = prevOrders.map((o) =>
          String(o.id) === String(orderId) || String(o.order_number) === String(orderId)
            ? {
                ...o,
                receipt_url: newReceiptUrl,
                payment_receipt_path: updatedServerOrder.payment_receipt_path || o.payment_receipt_path,
                payment_status: "receipt_uploaded",
                updatedAt: new Date().toISOString(),
                statusUpdatedAt: new Date().toISOString(),
              }
            : o
        );
        persistOrdersSafely(updated);
        return updated;
      });

      try {
        window.dispatchEvent(
          new CustomEvent("guli_order_receipt_updated", {
            detail: { orderId, receipt_url: newReceiptUrl },
          })
        );
      } catch {}

      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      } catch {}

      showToast("To‘lov cheki muvaffaqiyatli saqlandi ☺️");
    } catch (err: any) {
      console.warn("[Handle receipt reupload failure]", err);
      showToast(err?.message || "Chekni yuklashda xatolik yuz berdi");
    } finally {
      setReuploadingOrderId(null);
    }
  };
  const loadProducts = useCallback(async (silent = false, append = false, forceRefresh = false) => {
    const offset = append ? productsOffsetRef.current : 0;
    const normalizedSearch = debouncedSearch.trim();
    const isUnfilteredHomeFeed =
      offset === 0 &&
      !normalizedSearch &&
      (!selectedCategory || selectedCategory === "Barchasi");
    const queryKey = buildProductQueryKey({
      category: selectedCategory,
      search: normalizedSearch,
      limit: PRODUCTS_PAGE_SIZE,
      offset,
    });
    const hasWarmCache = !append && !forceRefresh && Boolean(getCachedProductQuery<Product>(queryKey));

    if (append) {
      if (productsLoadingMoreRef.current || !productsHasMoreRef.current) return [];
      productsLoadingMoreRef.current = true;
      setProductsLoadingMore(true);
    } else {
      productsOffsetRef.current = 0;
      productsHasMoreRef.current = true;
      setProductsHasMore(true);
      if (!silent && !hasWarmCache) {
        setProductsLoading(true);
      }
    }

    const params = new URLSearchParams({
      limit: String(PRODUCTS_PAGE_SIZE),
      offset: String(offset),
    });
    if (selectedCategory && selectedCategory !== "Barchasi") {
      params.set("category", selectedCategory);
    }
    if (normalizedSearch) {
      params.set("search", normalizedSearch);
    }

    try {
      const query = params.toString();
      const primaryUrl = `${API_URL}/api/products?${query}`.replace("? ", "?");

      const { rows, hasMore } = await runDeduplicatedProductQuery<Product>(
        queryKey,
        async () => {
          let r: Response | null = null;
          let lastError: unknown = null;

          // Customer catalog is served by Vercel -> Supabase.
          // Render is deliberately NOT part of this read path, so a sleeping
          // backend cannot block the first storefront load.
          for (let attempt = 0; attempt < 3 && !r; attempt += 1) {
            try {
              const candidate = await fetch(primaryUrl, {
                cache: forceRefresh ? "no-store" : "default",
                headers: { Accept: "application/json" },
              });
              if (candidate.ok) {
                r = candidate;
                break;
              }
              lastError = new Error(`Status: ${candidate.status}`);
              if (![429, 500, 502, 503, 504].includes(candidate.status)) {
                r = candidate;
                break;
              }
            } catch (error) {
              lastError = error;
            }
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            }
          }

          if (!r) throw (lastError instanceof Error ? lastError : new Error("Katalog serveri vaqtincha javob bermadi"));
          if (!r.ok) throw new Error(`Status: ${r.status}`);

          const j = await r.json();
          if (!j || j.success !== true || !Array.isArray(j.data)) {
            throw new Error(j?.message || "Katalog API noto‘g‘ri javob qaytardi");
          }

          return {
            rows: j.data as Product[],
            hasMore: Boolean(j.pagination?.hasMore),
          };
        },
        { forceRefresh },
      );

      const nextOffset = offset + rows.length;
      productsOffsetRef.current = nextOffset;
      productsHasMoreRef.current = hasMore;
      setProductsHasMore(hasMore);
      setProductsError("");
      if (productsRecoveryTimerRef.current) {
        clearTimeout(productsRecoveryTimerRef.current);
        productsRecoveryTimerRef.current = null;
      }

      if (isUnfilteredHomeFeed && rows.length > 0) {
        setHomeCatalogSnapshot(rows);
      }

      setProducts((prev) => {
        if (!append) return rows;
        const existingIds = new Set(prev.map((p) => String(p.id)));
        const uniqueNew = rows.filter((p) => !existingIds.has(String(p.id)));
        return [...prev, ...uniqueNew];
      });

      return rows;
    } catch (error) {
      if (!append) {
        const message =
          error instanceof Error ? error.message : "Mahsulotlarni yuklashda xatolik";
        setProducts([]);
        productsOffsetRef.current = 0;
        productsHasMoreRef.current = false;
        setProductsHasMore(false);
        setProductsError(message);

        // Continue recovering in the background. This is deliberately silent:
        // the page stays usable and the next retry replaces the error as soon
        // as the backend becomes available. No browser refresh is required.
        if (!productsRecoveryTimerRef.current) {
          productsRecoveryTimerRef.current = setTimeout(() => {
            productsRecoveryTimerRef.current = null;
            loadProducts(true, false, true).catch(() => {});
          }, 2500);
        }
      }
      return [];
    } finally {
      if (!append && !startupProductsReportedRef.current) {
        startupProductsReportedRef.current = true;
        markStartupPhase("products");
      }
      if (append) {
        productsLoadingMoreRef.current = false;
        setProductsLoadingMore(false);
      } else if (!silent) {
        setProductsLoading(false);
      }
    }
  }, [selectedCategory, debouncedSearch]);

  const [phoneLookupInput, setPhoneLookupInput] = useState(() => {
    return localStorage.getItem("guli_phone") || localStorage.getItem("guli_customer_phone") || localStorage.getItem("guli_last_order_phone") || "";
  });
  const [isLookingUpOrders, setIsLookingUpOrders] = useState(false);

  const loadOrders = useCallback(
    async (silent = false, customPhone?: string) => {
      if (!customPhone && ordersInFlightRef.current) {
        return ordersInFlightRef.current;
      }
      const token = localStorage.getItem("guli_access_token") || "";
      const savedPhone = customPhone || localStorage.getItem("guli_phone") || localStorage.getItem("guli_customer_phone") || localStorage.getItem("guli_last_order_phone") || authUser?.phone || "";
      const cleanPhone = String(savedPhone).replace(/\D/g, "");
      const localOrdersRaw = localStorage.getItem("guli_orders") || localStorage.getItem("orders") || "[]";
      let localOrderNumbers: string[] = [];
      try {
        const parsed = JSON.parse(localOrdersRaw);
        if (Array.isArray(parsed)) {
          localOrderNumbers = parsed
            .map((x: any) => String(x.order_number || x.id || ""))
            .filter((v: string) => v && v !== "undefined" && v !== "null");
        }
      } catch {}

      // URL search params lookup for external browser deep links
      let urlPhone = "";
      let urlTgId = "";
      try {
        const sp = new URLSearchParams(window.location.search);
        urlPhone = (sp.get("phone") || sp.get("tel") || "").replace(/\D/g, "");
        urlTgId = (sp.get("tg_id") || sp.get("telegram_id") || "").trim();
        const urlOrder = sp.get("order") || sp.get("order_number");
        if (urlOrder && !localOrderNumbers.includes(urlOrder)) {
          localOrderNumbers.push(urlOrder);
        }
        if (urlPhone && !cleanPhone) {
          localStorage.setItem("guli_phone", urlPhone);
        }
      } catch {}

      const effectivePhone = cleanPhone || urlPhone;
      const effectiveTgId = telegramUser?.id ? String(telegramUser.id) : urlTgId;

      if (!effectiveTgId && !token && !localOrderNumbers.length && (!effectivePhone || effectivePhone.length < 7)) {
        return [];
      }

      lastOrdersFetchAtRef.current = Date.now();
      if (!silent) setOrdersLoading(true);
      const task = (async (): Promise<Order[]> => {
      try {
        const queryParams = new URLSearchParams();
        if (localOrderNumbers.length) {
          queryParams.set("order_numbers", localOrderNumbers.slice(0, 30).join(","));
        }
        if (effectiveTgId) {
          queryParams.set("telegram_id", effectiveTgId);
        }
        if (effectivePhone && effectivePhone.length >= 7) {
          queryParams.set("phone", effectivePhone);
        }
        queryParams.set("_t", Date.now().toString());

        let url = `${API_URL}/api/orders?${queryParams.toString()}`;
        if (token && !effectiveTgId) {
          url = `${API_URL}/api/customer/orders?${queryParams.toString()}`;
        }

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (effectivePhone) headers["X-Customer-Phone"] = effectivePhone;
        if (effectiveTgId) headers["X-Telegram-Id"] = effectiveTgId;
        const tgData = (window as any).Telegram?.WebApp?.initData;
        if (tgData) headers["X-Telegram-Init-Data"] = tgData;

        // Abort timeout after 8 seconds to prevent hanging if Render server is hibernating
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let r: Response | null = null;
        try {
          r = await fetch(url, { headers, signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!r || !r.ok) throw new Error(`Orders fetch failed: ${r?.status || "network_error"}`);
        const j = await r.json();
        if (!j.success || !Array.isArray(j.data)) return [];
        const list: Order[] = j.data.map((row: any) => ({
          id: String(row.order_number || row.id || orderNumber()),
          order_number: row.order_number || undefined,
          first_name: row.first_name || undefined,
          last_name: row.last_name || undefined,
          customer_name: row.customer_name || undefined,
          birth_date: row.birth_date || row.dob || undefined,
          items: Array.isArray(row.items) ? row.items : [],
          subtotal: Number(row.subtotal || 0),
          delivery: Number(row.delivery || 0),
          discount: Number(row.discount || 0),
          total: Number(row.total || 0),
          address: row.address || undefined,
          phone: row.phone || "",
          payment: row.payment || "cash",
          payment_status: row.payment_status || "pending",
          status:
            row.status ||
            (String(row.payment_status || "").toLowerCase() === "verified"
              ? "Qabul qilindi"
              : "⏳ To'lovni tasdiqlash kutilmoqda"),
          receipt_url: row.receipt_url || undefined,
          payment_receipt_path: row.payment_receipt_path || undefined,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || undefined,
          statusUpdatedAt: row.status_updated_at || row.updated_at || undefined,
        }));
        setOrders((prev) => {
          const map = new Map<string, Order>();
          list.forEach((o) => map.set(String(o.order_number || o.id), o));
          // keep any pending local orders not yet on server
          prev.forEach((o) => {
            const key = String(o.order_number || o.id);
            if (!map.has(key)) map.set(key, o);
          });
          const merged = Array.from(map.values()).sort((a, b) => {
            const ta = new Date(a.createdAt || 0).getTime();
            const tb = new Date(b.createdAt || 0).getTime();
            return tb - ta;
          });
          persistOrdersSafely(merged);
          registerOrderStateChanges(merged);
          return merged;
        });
        return list;
      } catch (e) {
        console.warn("[Orders] Server fetch note (using local cache or Supabase):", e);

        // Fallback 1: LocalStorage cached orders
        let cachedOrders: Order[] = [];
        try {
          const raw = localStorage.getItem("orders") || localStorage.getItem("guli_orders");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cachedOrders = parsed;
              setOrders(parsed);
            }
          }
        } catch {}

        // Fallback 2: Direct Supabase query if available
        try {
          const sb = getSupabase();
          if (sb) {
            let sbQuery = sb.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
            if (effectiveTgId) {
              sbQuery = sbQuery.eq("telegram_id", effectiveTgId);
            } else if (effectivePhone && effectivePhone.length >= 7) {
              sbQuery = sbQuery.eq("phone", effectivePhone);
            } else if (localOrderNumbers.length) {
              sbQuery = sbQuery.in("order_number", localOrderNumbers.slice(0, 30));
            }
            const { data: sbData, error: sbErr } = await sbQuery;
            if (!sbErr && Array.isArray(sbData) && sbData.length > 0) {
              const mapped: Order[] = sbData.map((row: any) => ({
                id: String(row.order_number || row.id || orderNumber()),
                order_number: row.order_number || undefined,
                first_name: row.first_name || undefined,
                last_name: row.last_name || undefined,
                customer_name: row.customer_name || undefined,
                birth_date: row.birth_date || row.dob || undefined,
                items: Array.isArray(row.items) ? row.items : [],
                subtotal: Number(row.subtotal || 0),
                delivery: Number(row.delivery || 0),
                discount: Number(row.discount || 0),
                total: Number(row.total || 0),
                address: row.address || undefined,
                phone: row.phone || "",
                payment: row.payment || "cash",
                payment_status: row.payment_status || "pending",
                status:
                  row.status ||
                  (String(row.payment_status || "").toLowerCase() === "verified"
                    ? "Qabul qilindi"
                    : "⏳ To'lovni tasdiqlash kutilmoqda"),
                receipt_url: row.receipt_url || undefined,
                payment_receipt_path: row.payment_receipt_path || undefined,
                createdAt: row.created_at || new Date().toISOString(),
                updatedAt: row.updated_at || undefined,
                statusUpdatedAt: row.status_updated_at || row.updated_at || undefined,
              }));
              setOrders(mapped);
              try {
                localStorage.setItem("orders", JSON.stringify(mapped));
                localStorage.setItem("guli_orders", JSON.stringify(mapped));
              } catch {}
              return mapped;
            }
          }
        } catch {}

        return cachedOrders;
      } finally {
        if (!customPhone) {
          ordersInFlightRef.current = null;
        }
        lastOrdersFetchAtRef.current = Date.now();
        if (!silent) setOrdersLoading(false);
      }
      })();
      if (!customPhone) {
        ordersInFlightRef.current = task;
      }
      return task;
    },
    [telegramUser?.id, authUser?.phone, registerOrderStateChanges],
  );

  useEffect(() => {
    loadProducts(false).catch(() => {});
    return () => {
      if (productsRecoveryTimerRef.current) {
        clearTimeout(productsRecoveryTimerRef.current);
        productsRecoveryTimerRef.current = null;
      }
    };
  }, [loadProducts]);

  useEffect(() => {
    if (page !== "catalog" || !productsHasMore || productsLoading || productsLoadingMore) {
      return;
    }
    const sentinel = productsLoadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadProducts(true, true).catch(() => {});
        }
      },
      { rootMargin: "800px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, productsHasMore, productsLoading, productsLoadingMore, loadProducts]);

  useEffect(() => {
    loadOrders(false).catch(() => {});

    const handleServerOrderSync = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const incoming = Array.isArray(detail?.orders) ? detail.orders : [];
      if (!incoming.length) return;
      setOrders((prev) => {
        const map = new Map(prev.map((o) => [String(o.order_number || o.id), o]));
        for (const row of incoming) {
          const key = String(row.order_number || row.id || "");
          if (!key) continue;
          const old = map.get(key);
          map.set(key, {
            ...(old || {}),
            ...row,
            id: key,
            order_number: row.order_number || key,
            payment_status: row.payment_status || old?.payment_status || "pending",
            status: row.status || old?.status || "⏳ Buyurtma kutilmoqda",
          } as Order);
        }
        const next = Array.from(map.values());
        try {
          localStorage.setItem("orders", JSON.stringify(next));
          localStorage.setItem("guli_orders", JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    window.addEventListener("guli_orders_server_sync", handleServerOrderSync);

    // Realtime is the primary status transport. Only poll when cooldown allows,
    // and back off substantially when Realtime is connected or no pending orders exist.
    const fallbackInterval = setInterval(() => {
      if (
        shouldPollOrders({
          lastPollAt: lastOrdersFetchAtRef.current,
          realtimeConnected: ordersRealtimeConnectedRef.current,
          hasPendingOrders: hasActivePendingOrders(ordersRef.current),
          visibilityState: document.visibilityState,
        })
      ) {
        loadOrders(true).catch(() => {});
      }
    }, 60000);
    
    // Supabase Realtime synchronization
    let activeChannel: any = null;
    let isSubscribed = true;

    const setupRealtime = async () => {
      try {
        const sb = getSupabase();
        if (!sb || !isSubscribed) return;

        activeChannel = sb
          .channel('public:orders_customer_realtime')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'orders',
            },
            (payload: any) => {
              const newRow = payload.new;
              if (!newRow) return;
              const newId = String(newRow.id || '');
              const newOrderNum = String(newRow.order_number || '');

              // Instantly update React state for matching customer orders
              setOrders((prevOrders) => {
                let matched = false;
                const updated = prevOrders.map((o) => {
                  const isMatch = (newId && String(o.id) === newId) ||
                                  (newOrderNum && (String(o.order_number) === newOrderNum || String(o.id) === newOrderNum));
                  if (isMatch) {
                    matched = true;
                    return {
                      ...o,
                      status: newRow.status || o.status,
                      payment_status: newRow.payment_status || (o as any).payment_status,
                      payment_receipt_path: newRow.payment_receipt_path || (o as any).payment_receipt_path,
                      receipt_url: newRow.receipt_url || o.receipt_url,
                      updatedAt: newRow.updated_at || new Date().toISOString(),
                      statusUpdatedAt: newRow.status_updated_at || newRow.updated_at || o.statusUpdatedAt,
                    };
                  }
                  return o;
                });

                if (matched) {
                  persistOrdersSafely(updated);
                  registerOrderStateChanges(updated);
                }
                return updated;
              });
            }
          )
          .subscribe((status: string) => {
            ordersRealtimeConnectedRef.current = status === "SUBSCRIBED";
          });
      } catch (e) {
        console.warn("[Supabase Realtime Setup Warning]", e);
      }
    };

    void setupRealtime();

    return () => {
      isSubscribed = false;
      ordersRealtimeConnectedRef.current = false;
      clearInterval(fallbackInterval);
      window.removeEventListener("guli_orders_server_sync", handleServerOrderSync);
      if (activeChannel) {
        const sb = getSupabase();
        if (sb) {
          sb.removeChannel(activeChannel).catch(() => {});
        }
      }
    };
  }, [loadOrders]);

  useEffect(() => {
    if (
      page === "orders" &&
      shouldPollOrders({
        lastPollAt: lastOrdersFetchAtRef.current,
        realtimeConnected: ordersRealtimeConnectedRef.current,
        hasPendingOrders: hasActivePendingOrders(ordersRef.current),
        visibilityState: document.visibilityState,
        force: true,
        minForceGapMs: 10000,
      })
    ) {
      loadOrders(false).catch(() => {});
    }
  }, [page, loadOrders]);

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        shouldPollOrders({
          lastPollAt: lastOrdersFetchAtRef.current,
          realtimeConnected: ordersRealtimeConnectedRef.current,
          hasPendingOrders: hasActivePendingOrders(ordersRef.current),
          visibilityState: document.visibilityState,
          force: true,
          minForceGapMs: 20000,
        })
      ) {
        loadOrders(true).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadOrders]);
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
    if (next === "home" && page !== "home") {
    }
    if (next !== page) {
      setPreviousPage(page);
      setPageHistory((prev) => [...prev, next]);
      try {
        const targetUrl = next === "brand_profile" ? "/profile/guli-market" : window.location.pathname === "/profile/guli-market" ? "/" : window.location.pathname;
        window.history.pushState({ guliPage: next }, "", targetUrl);
      } catch {}

      // Buyurtma rasmiylashtirish sahifasiga o'tganda profil ma'lumotlarini avtomatik tekshirib to'ldirish
      if (next === "checkout") {
        try {
          const uKey = authUser?.id || currentUserId;
          const pName = authUser?.full_name || (uKey ? localStorage.getItem(`guli_name_${uKey}`) : "") || localStorage.getItem("guli_first_name") || "";
          if (pName) {
            const parts = pName.trim().split(/\s+/);
            if (parts[0]) setFirstName(parts[0]);
            if (parts.slice(1).join(" ")) setLastName(parts.slice(1).join(" "));
          }
          const pPhone = authUser?.phone || (uKey ? localStorage.getItem(`guli_phone_${uKey}`) : "") || localStorage.getItem("guli_phone");
          if (pPhone) setPhone(pPhone);
          const pDob = (authUser as any)?.birth_date || (uKey ? localStorage.getItem(`guli_dob_${uKey}`) : "") || localStorage.getItem("guli_birth_date");
          if (pDob) setBirthDate(pDob);
        } catch {}
      }
    }
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeviceBack = useCallback(() => {
    try {
      tg()?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    // 1. Close any open modal
    if (isCustomerAuthOpen) {
      setIsCustomerAuthOpen(false);
      setAuthGateCustomMessage({});
      return true;
    }
    if (showCardPaymentModal) {
      setShowCardPaymentModal(false);
      setTimerActive(false);
      return true;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return true;
    }
    if (isHelpOpen) {
      setIsHelpOpen(false);
      return true;
    }
    if (isNotificationsOpen) {
      setIsNotificationsOpen(false);
      return true;
    }
    if (isSocialLinksOpen) {
      setIsSocialLinksOpen(false);
      return true;
    }
    if (isPromosOpen) {
      setIsPromosOpen(false);
      return true;
    }
    if (isDeliveryInfoOpen) {
      setIsDeliveryInfoOpen(false);
      return true;
    }
    if (isSizeGuideOpen) {
      setIsSizeGuideOpen(false);
      return true;
    }
    if (isAboutOpen) {
      setIsAboutOpen(false);
      return true;
    }
    if (selectedOrderId) {
      setSelectedOrderId(null);
      return true;
    }

    // 2. Product view -> return to previous page
    if (page === "product" || selectedProduct) {
      setSelectedProduct(null);
      const target = previousPage && previousPage !== "product" ? previousPage : "home";
      setPage(target);
      return true;
    }

    // 2a. Reels view -> if came from brand_profile, return to brand_profile
    if (page === "reels" && previousPage === "brand_profile") {
      setPage("brand_profile");
      return true;
    }

    // 2b. Brand profile -> return to reels or previous page
    if (page === "brand_profile") {
      const target = previousPage && previousPage !== "brand_profile" ? previousPage : "reels";
      setPage(target);
      try {
        window.history.pushState({ guliPage: target }, "", "/");
      } catch {}
      return true;
    }

    // 3. Kategoriya va rekomendatsiya bo'limida bo'lsa asosiy ekranga qaytish
    if (selectedCategory !== "Barchasi" || search.trim() !== "" || page === "catalog") {
      setSelectedCategory("Barchasi");
      setSearch("");
      if (page !== "home") {
        setPage("home");
        setPageHistory(["home"]);
      }
      return true;
    }

    // 4. Orqaga oldingi bo'limga qaytish (Navigation History Stack)
    if (pageHistory.length > 1) {
      const nextHistory = [...pageHistory];
      nextHistory.pop(); // remove current page
      const prev = nextHistory[nextHistory.length - 1] || "home";
      setPageHistory(nextHistory);
      if (prev === "home")
      setPage(prev);
      return true;
    }

    // 5. If not on home, return to Home
    if (page !== "home") {
      setPage("home");
      setPageHistory(["home"]);
      return true;
    }

    return false;
  }, [
    isCustomerAuthOpen,
    showCardPaymentModal,
    isSettingsOpen,
    isHelpOpen,
    isNotificationsOpen,
    isSocialLinksOpen,
    isPromosOpen,
    isDeliveryInfoOpen,
    isSizeGuideOpen,
    isAboutOpen,
    selectedOrderId,
    page,
    selectedProduct,
    previousPage,
    selectedCategory,
    search,
    pageHistory,
  ]);

  // Browser / Hardware Back Navigation (PopState)
  useEffect(() => {
    try {
      if (!window.history.state || !window.history.state.guliInit) {
        window.history.replaceState({ guliInit: true, guliPage: page }, "", "");
      }
    } catch {}

    const onPopState = () => {
      const handled = handleDeviceBack();
      if (handled) {
        try {
          window.history.pushState({ guliInit: true, guliPage: page }, "", "");
        } catch {}
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [handleDeviceBack, page]);

  // Telegram WebApp BackButton Integration
  useEffect(() => {
    const tgBackButton = window.Telegram?.WebApp?.BackButton;
    if (!tgBackButton) return;

    const hasOpenModal =
      isCustomerAuthOpen ||
      showCardPaymentModal ||
      isSettingsOpen ||
      isHelpOpen ||
      isNotificationsOpen ||
      isSocialLinksOpen ||
      isPromosOpen ||
      isDeliveryInfoOpen ||
      isSizeGuideOpen ||
      isAboutOpen ||
      Boolean(selectedOrderId);

    const isNonHomeState =
      page !== "home" ||
      selectedCategory !== "Barchasi" ||
      search.trim() !== "" ||
      selectedProduct !== null;

    if (hasOpenModal || isNonHomeState) {
      try {
        tgBackButton.show();
        const onTgBack = () => {
          handleDeviceBack();
        };
        tgBackButton.onClick(onTgBack);
        return () => {
          tgBackButton.offClick(onTgBack);
        };
      } catch {}
    } else {
      try {
        tgBackButton.hide();
      } catch {}
    }
  }, [
    handleDeviceBack,
    isCustomerAuthOpen,
    showCardPaymentModal,
    isSettingsOpen,
    isHelpOpen,
    isNotificationsOpen,
    isSocialLinksOpen,
    isPromosOpen,
    isDeliveryInfoOpen,
    isSizeGuideOpen,
    isAboutOpen,
    selectedOrderId,
    page,
    selectedCategory,
    search,
    selectedProduct,
  ]);
  const openProduct = (product: Product, from: Page = page, queue?: Product[]) => {
    setPreviousPage(from);
    if (from === "brand_profile" && Array.isArray(queue) && queue.length > 0) {
      setBrandProfileProductQueue(queue);
    } else if (from !== "product") {
      setBrandProfileProductQueue([]);
    }
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

  // Dynamic delivery calculations from admin settings
  const adminSettings = useMemo(() => {
    void settingsVersion;
    try {
      return JSON.parse(localStorage.getItem("guli_admin_settings") || "{}");
    } catch {
      return {};
    }
  }, [settingsVersion]);
  const freeDeliveryThreshold =
    Number(adminSettings.freeDeliveryThreshold) === 300000
      ? 600000
      : Number(adminSettings.freeDeliveryThreshold) || 600000;
  const standardDeliveryFee = adminSettings.standardDeliveryFee !== undefined ? Number(adminSettings.standardDeliveryFee) : 20000;
  const delivery = subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
  const discount = promoApplied ? Math.min(subtotal, promoDiscount) : 0;

  // Real Cashback calculations based on completed orders
  const completedOrdersForCashback = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "Yetkazildi" ||
          o.status === "Qabul qilindi" ||
          o.status === "To'lov tasdiqlandi" ||
          o.status === "Yo‘lda" ||
          o.status === "Tayyorlanmoqda"
      ),
    [orders]
  );
  const realTotalSpentForCashback = useMemo(
    () => completedOrdersForCashback.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [completedOrdersForCashback]
  );
  const realCashbackEarned = Math.round(realTotalSpentForCashback * 0.02);
  const totalCashbackUsed = useMemo(
    () => orders.reduce((sum, o) => sum + (Number((o as any).cashback_used) || 0), 0),
    [orders]
  );
  const availableCashback = Math.max(0, realCashbackEarned - totalCashbackUsed);
  const payableBeforeCashback = Math.max(0, subtotal + delivery - discount);
  const maxCashbackDeduction = Math.min(availableCashback, payableBeforeCashback);
  const appliedCashback = useCashback ? maxCashbackDeduction : 0;
  const total = Math.max(0, payableBeforeCashback - appliedCashback);
  const homeShowcaseProducts = useMemo(
    () => (homeCatalogSnapshot.length > 0 ? homeCatalogSnapshot : products),
    [homeCatalogSnapshot, products],
  );
  const allCategories = useMemo(
    () => getSynchronizedCategories(homeShowcaseProducts),
    [homeShowcaseProducts],
  );
  const filtered = useMemo(
    () =>
      [...products]
        .filter((p) => p.active !== false)
        .sort((a, b) => {
          const catA = normalizeCategory(a.category);
          const catB = normalizeCategory(b.category);
          if (catA !== catB) return catA.localeCompare(catB);
          return (a.sort_order || 0) - (b.sort_order || 0);
        }),
    [products],
  );
  const applyPromo = async (
    overrideCode?: string,
    source: "manual" | "qr" = "manual",
  ): Promise<boolean> => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}
    const code = (overrideCode !== undefined ? overrideCode : promo).trim().toUpperCase();
    if (!code) {
      setPromoApplied(false);
      setPromoDiscount(0);
      showToast(t("promo_placeholder"));
      return false;
    }
    setPromoLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/promo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal, source }),
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
      return true;
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
      return false;
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const rawPromo =
        url.searchParams.get("promo") ||
        url.searchParams.get("code") ||
        "";
      const clean = rawPromo.trim().toUpperCase();
      if (clean && /^[A-Z0-9_-]{3,40}$/.test(clean)) {
        pendingQrPromoRef.current = clean;
        setPromo(clean);
        showToast(`✓ QR vaucher tayyor: ${clean}`);
        url.searchParams.delete("promo");
        url.searchParams.delete("code");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pending = pendingQrPromoRef.current;
    if (page === "checkout" && pending && subtotal > 0 && !promoApplied && !promoLoading) {
      pendingQrPromoRef.current = "";
      void applyPromo(pending, "qr");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, subtotal]);
  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      geocodeAbortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setLocationResolving(true);

    try {
      const resolved = await reverseGeocodeCoordinates(lat, lon, controller.signal);
      if (controller.signal.aborted) return;

      setAddress((a) => ({
        ...a,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        region: resolved.region,
        district: resolved.district,
        street: resolved.street,
        house: resolved.house,
      }));

      showToast(
        resolved.formattedAddress
          ? `📍 ${resolved.formattedAddress}`
          : `📍 Joylashuv aniqlandi: ${resolved.region}, ${resolved.district}`,
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        console.warn("Reverse geocode error:", e);
      }
    } finally {
      if (geocodeAbortRef.current === controller) {
        setLocationResolving(false);
      }
    }
  };

  const handleSelectAddressCandidate = (candidate: AddressSearchCandidate) => {
    try {
      geocodeAbortRef.current?.abort();
    } catch {}
    setLocationResolving(false);
    setAddress((a) => ({
      ...a,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      region: candidate.region,
      district: candidate.district,
      street: candidate.street,
      house: candidate.house,
    }));
    const fullText = [
      candidate.region,
      candidate.district,
      candidate.street,
      candidate.house ? `${candidate.house}-uy` : "",
    ]
      .filter(Boolean)
      .join(", ");
    showToast(`📍 ${fullText}`);
  };

  const updateMapPosition = (lat: number, lon: number) => {
    setAddress((a) => ({ ...a, latitude: lat, longitude: lon }));
    void reverseGeocode(lat, lon);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      showToast("Joylashuv aniqlash imkonsiz. Xaritadan manzilingizni bosing.");
      updateMapPosition(address.latitude || 41.2995, address.longitude || 69.2401);
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        setAddress((a) => ({ ...a, latitude: lat, longitude: lon }));
        await reverseGeocode(lat, lon);
        setLocationLoading(false);
      },
      async () => {
        setLocationLoading(false);
        showToast(
          "Aniq joylashuv olinmadi. Xaritadan o‘z uyingizni bosing yoki qidiring.",
        );
        await reverseGeocode(address.latitude || 41.2995, address.longitude || 69.2401);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
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
    if (!firstName.trim()) {
      showToast("Iltimos ismingizni kiriting");
      return;
    }
    if (!phone.trim()) {
      showToast("Iltimos telefon raqamingizni kiriting");
      return;
    }
    if (!cart.length) {
      showToast("Savat hali bo‘sh");
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
    const customerFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const token = localStorage.getItem("guli_access_token") || "";
    const tgData = (window as any).Telegram?.WebApp?.initData;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (tgData) headers["X-Telegram-Init-Data"] = tgData;

    const payload = {
      order_number: id,
      telegram_id: telegramUser?.id || undefined,
      auth_user_id: authUser?.id || undefined,
      username: telegramUser?.username || undefined,
      first_name: firstName.trim() || telegramUser?.first_name || "",
      last_name: lastName.trim() || telegramUser?.last_name || "",
      customer_name: customerFullName || telegramUser?.first_name || "Mijoz",
      birth_date: birthDate.trim() || null,
      dob: birthDate.trim() || null,
      phone: phone.trim(),
      items: cart,
      subtotal,
      delivery,
      discount,
      cashback_used: appliedCashback,
      cashback_earned: Math.round(total * 0.02),
      total,
      address,
      payment: "card_manual",
      status: "⏳ To'lovni tasdiqlash kutilmoqda",
      receipt_url: uploadedReceipt,
      data: uploadedReceipt,
      mimeType: "image/jpeg",
      promo_code: promoApplied ? promo.trim().toUpperCase() : null,
    };
    try {
      const r = await fetch(`${API_URL}/api/customer/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success)
        throw new Error(j.message || "Buyurtma yuborilmadi");

      const createdOrderNumber = String(j.data?.order_number || id);
      const createdOrderId = String(j.data?.id || createdOrderNumber);

      if (uploadedReceipt) {
        fetch(`${API_URL}/api/orders/${encodeURIComponent(createdOrderNumber)}/receipt`, {
          method: "POST",
          headers,
          body: JSON.stringify({ receipt_url: uploadedReceipt, data: uploadedReceipt, mimeType: "image/jpeg" }),
        }).catch(() => {
          fetch(`${API_URL}/api/customer/orders/${encodeURIComponent(createdOrderNumber)}/receipt`, {
            method: "POST",
            headers,
            body: JSON.stringify({ receipt_url: uploadedReceipt, data: uploadedReceipt, mimeType: "image/jpeg" }),
          }).catch(() => {});
        });
      }

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

      const createdOrder: Order = {
        id: createdOrderId,
        order_number: createdOrderNumber,
        items: cart,
        subtotal,
        delivery,
        discount,
        cashback_used: appliedCashback,
        cashback_earned: Math.round(total * 0.02),
        total,
        address,
        phone: phone.trim(),
        payment: "card_manual",
        status: "⏳ To'lovni tasdiqlash kutilmoqda",
        receipt_url: uploadedReceipt,
        createdAt: now,
        updatedAt: now,
        statusUpdatedAt: now,
      };

      setOrders((x) => {
        const next = [createdOrder, ...x.filter((o) => o.id !== createdOrder.id && o.order_number !== createdOrder.order_number)];
        try {
          localStorage.setItem("orders", JSON.stringify(next));
          localStorage.setItem("guli_orders", JSON.stringify(next));
          if (phone.trim()) {
            localStorage.setItem("guli_phone", phone.trim());
            localStorage.setItem("guli_customer_phone", phone.trim());
            localStorage.setItem("guli_last_order_phone", phone.trim());
          }
          const nums = JSON.parse(localStorage.getItem("guli_my_order_numbers") || "[]");
          const updatedNums = [...new Set([createdOrderNumber, createdOrderId, ...(Array.isArray(nums) ? nums : [])])];
          localStorage.setItem("guli_my_order_numbers", JSON.stringify(updatedNums));
        } catch {}
        return next;
      });

      // Explicitly store order and receipt in localStorage for admin payments tab
      try {
        if (uploadedReceipt) {
          const receiptsMap = JSON.parse(localStorage.getItem("guli_receipts") || "{}");
          receiptsMap[id] = uploadedReceipt;
          receiptsMap[createdOrderId] = uploadedReceipt;
          receiptsMap[createdOrderNumber] = uploadedReceipt;
          localStorage.setItem("guli_receipts", JSON.stringify(receiptsMap));
        }
      } catch {}
      setCart([]);
      setPromo("");
      setPromoApplied(false);
      setPromoDiscount(0);
      setUseCashback(false);
      setIsProcessingPayment(false);
      setShowCardPaymentModal(false);
      setTimerActive(false);
      setUploadedReceipt(null);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(
          "success",
        );
      } catch {}

      // Show order confirmed screen with genuine order number (#GULI-XXXX)
      setConfirmedOrder({
        orderNumber: createdOrderNumber,
        orderId: createdOrderId,
        total,
      });
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
      console.warn("[PDF export failure]", e);
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

  const handleShare = async () => {
    const shareText =
      "GULI Premium — Nafis va sifatli ayollar ichki kiyimlari to‘plami 🌷";
    const shareUrl = "https://t.me/guli3550bot";
    if (navigator.share) {
      try {
        await navigator.share({ title: "GULI Premium", text: shareText, url: shareUrl });
      } catch {
        await copyToClipboard(shareUrl);
        showToast("✓ Havola nusxalandi!");
      }
    } else {
      await copyToClipboard(shareUrl);
      showToast("✓ Havola nusxalandi!");
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
    if (!isCustomerAuthenticated && orders.length === 0 && !ordersLoading) {
      return (
        <main className="page" style={{ padding: "36px 16px", textAlign: "center", maxWidth: "480px", margin: "0 auto" }}>
          <div
            style={{
              backgroundColor: "var(--bg-card, #ffffff)",
              borderRadius: "28px",
              padding: "36px 22px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              border: "1px solid var(--border-color, #f1f5f9)",
            }}
          >
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                backgroundColor: "rgba(190, 24, 93, 0.1)",
                color: "#be185d",
                fontSize: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              🔒
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px", color: "var(--text-main, #1e293b)" }}>
              Buyurtmalarim bo'limi
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", lineHeight: 1.5, margin: "0 0 22px" }}>
              Barcha buyurtmalaringiz tarixi, to'lov kvitansiyalari va yetkazib berish holatini kuzatish uchun avval tizimga kiring.
            </p>

            <button
              onClick={() => {
                setAuthGateCustomMessage({
                  title: "Buyurtmalarni ko'rish",
                  subtitle: "Buyurtmalar tarixi va cheklaringizni ko'rish uchun Google yoki Email orqali kiring",
                });
                setIsCustomerAuthOpen(true);
              }}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "16px",
                border: "none",
                background: "linear-gradient(135deg, #be185d, #ec4899)",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(190, 24, 93, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <span>🔑</span> Google / Email orqali kirish
            </button>

            <div style={{ margin: "16px 0", paddingTop: "16px", borderTop: "1px dashed var(--border-color, #e2e8f0)", textAlign: "left" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-muted, #64748b)", marginBottom: "8px" }}>
                Yoki telefon raqamingiz orqali qidiring:
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={phoneLookupInput}
                  onChange={(e) => setPhoneLookupInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-input, #cbd5e1)",
                    fontSize: "13px",
                    backgroundColor: "var(--bg-input, #f8fafc)",
                    color: "var(--text-main, #1e293b)",
                    outline: "none",
                  }}
                />
                <button
                  disabled={isLookingUpOrders}
                  onClick={async () => {
                    const cl = phoneLookupInput.replace(/\D/g, "");
                    if (cl.length < 7) {
                      showToast("Iltimos to'g'ri telefon raqam kiriting");
                      return;
                    }
                    setIsLookingUpOrders(true);
                    localStorage.setItem("guli_phone", phoneLookupInput);
                    localStorage.setItem("guli_customer_phone", phoneLookupInput);
                    const res = await loadOrders(false, phoneLookupInput);
                    setIsLookingUpOrders(false);
                    if (res && res.length > 0) {
                      showToast(`✓ ${res.length} ta buyurtma topildi!`);
                    } else {
                      showToast("Ushbu raqamga tegishli buyurtmalar topilmadi.");
                    }
                  }}
                  style={{
                    padding: "11px 16px",
                    borderRadius: "12px",
                    border: "none",
                    backgroundColor: "var(--primary, #be185d)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isLookingUpOrders ? "Qidirilmoqda…" : "Qidirish"}
                </button>
              </div>
            </div>

            <button
              onClick={() => go("catalog")}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: "1px solid var(--border-color, #e2e8f0)",
                backgroundColor: "transparent",
                color: "var(--text-main, #475569)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Katalogga o'tish
            </button>
          </div>
        </main>
      );
    }

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
                        setSelectedOrderId(selectedOrderId === o.id ? null : o.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        className="orderProductsListUnder"
                        style={{
                          display: "flex",
                          gap: "10px",
                          overflowX: "auto",
                          paddingBottom: "8px",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        {(o.items || []).map((it, idx) => {
                          const prod = it.product;
                          const img = prod ? imageUrl(prod) : ((it as any).image || "");
                          const itemPrice = (prod?.price || (it as any).price || 0);
                          const itemName = prod?.name || (it as any).name || "Mahsulot";
                          const itemCode = prod?.product_code || (it as any).product_code;

                          return (
                            <div
                              key={idx}
                              className="orderProductCardUnder"
                              style={{
                                flexShrink: 0,
                                width: "125px",
                                display: "flex",
                                flexDirection: "column",
                                background: "var(--bg-card-sub, rgba(0,0,0,0.03))",
                                borderRadius: "12px",
                                overflow: "hidden",
                                border: "1px solid var(--border-color)",
                              }}
                              onClick={(e) => {
                                if (prod) {
                                  e.stopPropagation();
                                  openProduct(prod, "orders");
                                }
                              }}
                            >
                              {/* Product Image */}
                              <div
                                style={{
                                  position: "relative",
                                  width: "100%",
                                  height: "110px",
                                  background: "var(--bg-card)",
                                  display: "grid",
                                  placeItems: "center",
                                  overflow: "hidden",
                                }}
                              >
                                {img ? (
                                  <img
                                    src={img}
                                    alt={itemName}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span style={{ fontSize: "28px" }}>👗</span>
                                )}
                                {it.quantity && it.quantity > 1 ? (
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: "4px",
                                      right: "4px",
                                      background: "rgba(15, 23, 42, 0.85)",
                                      color: "#ffffff",
                                      fontSize: "10px",
                                      padding: "2px 6px",
                                      borderRadius: "6px",
                                      fontWeight: 800,
                                    }}
                                  >
                                    ×{it.quantity}
                                  </span>
                                ) : null}
                              </div>

                              {/* Price and Details placed UNDER the image */}
                              <div
                                style={{
                                  padding: "8px 7px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "3px",
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "11.5px",
                                    fontWeight: 750,
                                    color: "var(--text-main)",
                                    lineHeight: "1.3",
                                    maxHeight: "2.6em",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                  }}
                                  title={itemName}
                                >
                                  {itemName}
                                </div>

                                {itemCode && (
                                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>
                                    Kod: {itemCode}
                                  </div>
                                )}

                                {(it.size || it.color) && (
                                  <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {[it.size, it.color ? formatColorName(it.color) : null].filter(Boolean).join(" · ")}
                                  </div>
                                )}

                                <div
                                  style={{
                                    marginTop: "auto",
                                    paddingTop: "5px",
                                    fontSize: "12px",
                                    fontWeight: 900,
                                    color: "var(--primary)",
                                  }}
                                >
                                  {formatPrice(itemPrice * (it.quantity || 1))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Overall Order Summary Bar */}
                      <div
                        className="orderInfoSummaryBar"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "var(--bg-card-sub, rgba(0,0,0,0.02))",
                          borderRadius: "10px",
                          border: "1px solid var(--border-color)",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginTop: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                          <span>Jami: <b>{totalItemCount} ta mahsulot</b></span>
                          <span>·</span>
                          <span className="paymentMethodPill">
                            {o.payment === "card" || o.payment?.toLowerCase().includes("karta") ? "💳 Karta" : "💵 Naqd"}
                          </span>
                          {(o as any).cashback_used && Number((o as any).cashback_used) > 0 ? (
                            <span style={{ color: "#059669", fontWeight: 700, fontSize: "11px" }}>
                              (💎 −{formatPrice(Number((o as any).cashback_used))} keshbek)
                            </span>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Jami summa:</span>
                          <strong style={{ fontSize: "15px", color: "var(--text-main)", fontWeight: 900 }}>
                            {formatPrice(o.total)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="orderBottom" style={{ flexWrap: "wrap", gap: "8px" }}>
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
                      <div className="orderActions" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {/* Tezkor Chek yuklash / qayta yuklash tugmasi (Mijozga doim ochiq ko'rinadi) */}
                        {o.payment === "card" || o.receipt_url ? (
                          <label
                            htmlFor={`quick-receipt-upload-${o.id}`}
                            className="orderReceiptQuickBtn"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: o.receipt_url ? "rgba(16, 185, 129, 0.1)" : "var(--primary-gradient, linear-gradient(135deg, #c9526b 0%, #a83d54 100%))",
                              color: o.receipt_url ? "#059669" : "#ffffff",
                              border: o.receipt_url ? "1px solid #10b981" : "none",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              boxShadow: o.receipt_url ? "none" : "0 2px 6px rgba(201, 82, 107, 0.25)",
                            }}
                            title={o.receipt_url ? "Chekni qayta yuklash yoki yangilash" : "To‘lov chekini yuklash"}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>{reuploadingOrderId === o.id ? "⏳" : o.receipt_url ? "🔄" : "🧾"}</span>
                            <span>{reuploadingOrderId === o.id ? "Yuklanmoqda..." : o.receipt_url ? "Chekni qayta yuklash" : "Chek yuklash"}</span>
                            <input
                              id={`quick-receipt-upload-${o.id}`}
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              disabled={reuploadingOrderId === o.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleOrderReceiptReupload(o.id, file);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        ) : null}

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
                          <div className="modernTimeline">
                            <div className="modernTimelineInner">
                              <div className="mt-line-bg"></div>
                              <div className="mt-line-fill" style={{ width: 
                                o.status === "Yetkazildi" ? "100%" : 
                                o.status === "Qabul qilishga tayyor" ? "75%" : 
                                o.status === "Yo‘lda" ? "50%" : 
                                o.status === "Tayyorlanmoqda" ? "25%" : 
                                (o.status === "Qabul qilindi" || o.status === "To'lov tasdiqlandi") ? "10%" : "0%"
                              }}></div>

                              {/* 1. Qabul qilindi */}
                              <div className={`mt-step ${['Qabul qilindi', "To'lov tasdiqlandi", 'Tayyorlanmoqda', 'Yo‘lda', 'Qabul qilishga tayyor', 'Yetkazildi'].includes(o.status) ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <span className="mt-label">Qabul qilindi</span>
                              </div>

                              {/* 2. Tayyorlanmoqda */}
                              <div className={`mt-step ${o.status === 'Tayyorlanmoqda' ? 'pulse' : ['Yo‘lda', 'Qabul qilishga tayyor', 'Yetkazildi'].includes(o.status) ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                                </div>
                                <span className="mt-label">Jarayonda</span>
                              </div>

                              {/* 3. Yo'lda */}
                              <div className={`mt-step ${o.status === 'Yo‘lda' ? 'pulse' : ['Qabul qilishga tayyor', 'Yetkazildi'].includes(o.status) ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </div>
                                <span className="mt-label">Yo'lda</span>
                              </div>

                              {/* 4. Punktda */}
                              <div className={`mt-step ${o.status === 'Qabul qilishga tayyor' ? 'pulse' : o.status === 'Yetkazildi' ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                                </div>
                                <span className="mt-label">Punktda</span>
                              </div>

                              {/* 5. Yakunlandi */}
                              <div className={`mt-step ${o.status === 'Yetkazildi' ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <span className="mt-label">Yakunlandi</span>
                              </div>
                            </div>
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

                          {/* Xarid qilingan barcha mahsulotlar to'liq ro'yxati */}
                          <div
                            className="orderItemsDetailList"
                            style={{
                              marginTop: "12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 750,
                                color: "var(--text-color)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                paddingBottom: "4px",
                                borderBottom: "1px solid var(--border-color)",
                              }}
                            >
                              <span>👗 Xarid qilingan mahsulotlar:</span>
                              <span style={{ fontSize: "11px", color: "var(--muted-color)", fontWeight: 600 }}>
                                {(o.items || []).length} xil mahsulot
                              </span>
                            </div>
                            {(o.items || []).map((it, idx) => {
                              const itemAny = it as any;
                              const prod = it.product || itemAny.product_data || itemAny.productDetails;
                              const img = prod ? imageUrl(prod) : (itemAny.image || "");
                              const name = prod?.name || itemAny.name || "Mahsulot";
                              const code = prod?.product_code || itemAny.product_code || "";
                              const size = itemAny.selected_size || it.size || itemAny.size || "";
                              const color = itemAny.selected_color || it.color || itemAny.color || "";
                              const price = itemAny.price || prod?.price || 0;
                              const qty = it.quantity || 1;

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px 10px",
                                    borderRadius: "10px",
                                    background: "rgba(0,0,0,0.02)",
                                    border: "1px solid var(--border-color)",
                                    cursor: prod ? "pointer" : "default",
                                  }}
                                  onClick={() => {
                                    if (prod) openProduct(prod, "orders");
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "48px",
                                      height: "56px",
                                      borderRadius: "8px",
                                      overflow: "hidden",
                                      flexShrink: 0,
                                      background: "#f1f5f9",
                                      display: "grid",
                                      placeItems: "center",
                                      border: "1px solid var(--border-color)",
                                    }}
                                  >
                                    {img ? (
                                      <img
                                        src={img}
                                        alt={name}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                      />
                                    ) : (
                                      <span style={{ fontSize: "20px" }}>👗</span>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: 700,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        color: "var(--text-color)",
                                      }}
                                    >
                                      {name}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--muted-color)", marginTop: "2px" }}>
                                      {code ? (
                                        <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                                          Kod: {code} ·{" "}
                                        </span>
                                      ) : null}
                                      {size ? `O‘lcham: ${size} · ` : ""}
                                      {color ? `Rang: ${color} · ` : ""}
                                      Soni: {qty} dona
                                    </div>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-color)" }}>
                                      {formatPrice(price * qty)}
                                    </div>
                                    {qty > 1 && (
                                      <div style={{ fontSize: "10.5px", color: "var(--muted-color)" }}>
                                        {formatPrice(price)} / dona
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {o.address ? (
                            <div className="orderAddress" style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(0,0,0,0.02)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-color)", marginBottom: "4px" }}>
                                📍 Yetkazib berish manzili:
                              </div>
                              <div style={{ fontSize: "13px", color: "var(--text-color)", lineHeight: "1.4" }}>
                                {[
                                  o.address.region,
                                  o.address.district,
                                  o.address.street,
                                  o.address.house ? `Uy/Dom: ${o.address.house}` : null,
                                  o.address.apartment ? `Padezd/Xonadon: ${o.address.apartment}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Manzil saqlangan"}
                              </div>
                              {o.address.landmark ? (
                                <div style={{ fontSize: "12px", color: "var(--muted-color)", marginTop: "4px" }}>
                                  🏢 <b>Mo‘ljal:</b> {o.address.landmark}
                                </div>
                              ) : null}
                              <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                                🚚 Yetkazib berish muddati: {getDeliveryEstimate(o.address.region, o.address.district).label}
                              </div>
                            </div>
                          ) : null}
                          {/* To'lov cheki bo'limi va aynan ushbu buyurtma uchun qayta yuklash knopkasi */}
                          {(() => {
                            const receiptCheck = checkReceiptDelayed(o.createdAt, o.status, o.receipt_url);
                            return (
                              <div className="orderReceiptUserView" style={{ marginTop: "12px", padding: "12px", background: "rgba(0,0,0,0.025)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                                  <small style={{ fontWeight: 700, fontSize: "12px", color: "var(--text-color)" }}>
                                    🧾 To‘lov cheki (Kvitansiya):
                                  </small>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: o.receipt_url ? "#059669" : "#d97706", background: o.receipt_url ? "#ecfdf5" : "#fef3c7", padding: "2px 8px", borderRadius: "6px" }}>
                                    {o.receipt_url ? "Chek yuklangan ✓" : "Chek yuklanmagan"}
                                  </span>
                                </div>

                                {receiptCheck.isPending && (
                                  <div
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: "8px",
                                      fontSize: "11.5px",
                                      lineHeight: 1.45,
                                      marginBottom: "10px",
                                      background: receiptCheck.isDelayed ? "rgba(220, 38, 38, 0.08)" : "rgba(217, 119, 6, 0.08)",
                                      border: `1px solid ${receiptCheck.isDelayed ? "rgba(220, 38, 38, 0.25)" : "rgba(217, 119, 6, 0.2)"}`,
                                      color: receiptCheck.isDelayed ? "#b91c1c" : "#b45309",
                                    }}
                                  >
                                    {receiptCheck.isDelayed ? (
                                      <>
                                        <b>⚠️ Eslatma:</b> To‘lovingiz admin tomonidan tasdiqlash kutilmoqda, tez orada tasdiqlanadi kuting yoki qo‘llab quvvatlash markazi bilan bog‘laning.
                                      </>
                                    ) : (
                                      <>
                                        <b>⏱️ Chek tekshiruvi:</b> Yuborilgan to‘lov cheki 2 soat ichida admin tomonidan tasdiqlanadi.
                                      </>
                                    )}
                                  </div>
                                )}

                            {o.receipt_url ? (
                              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                                <img
                                  src={o.receipt_url}
                                  alt="To‘lov cheki"
                                  className="userReceiptThumb"
                                  onClick={() => window.open(o.receipt_url, '_blank')}
                                  style={{ width: "80px", height: "80px", borderRadius: "8px", border: "1px solid var(--border-color)", cursor: "pointer", objectFit: "cover", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
                                  title="To‘liq o‘lchamda ochish"
                                />
                                <div style={{ flex: 1, minWidth: "140px" }}>
                                  <div style={{ fontSize: "11.5px", color: "var(--muted-color)", marginBottom: "4px" }}>
                                    To‘lov cheki muvaffaqiyatli saqlangan. Agar yangilamoqchi bo‘lsangiz, quyidagi tugma orqali qayta yuklashingiz mumkin.
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: "11.5px", color: "var(--muted-color)", marginBottom: "8px" }}>
                                To‘lovni tasdiqlash uchun to‘lov cheki (skrinshot yoki kvitansiya) rasmini yuklang.
                              </div>
                            )}

                            <div>
                              <label
                                htmlFor={`order-receipt-upload-${o.id}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "6px",
                                  padding: "7px 14px",
                                  borderRadius: "8px",
                                  background: o.receipt_url ? "rgba(189, 82, 106, 0.08)" : "var(--primary-gradient, linear-gradient(135deg, #c9526b 0%, #a83d54 100%))",
                                  color: o.receipt_url ? "var(--primary)" : "#ffffff",
                                  border: o.receipt_url ? "1px solid var(--primary)" : "none",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  boxShadow: o.receipt_url ? "none" : "0 3px 10px rgba(189,82,106,0.25)",
                                }}
                              >
                                <span>{reuploadingOrderId === o.id ? "⏳" : "🔄"}</span>
                                <span>
                                  {reuploadingOrderId === o.id
                                    ? "Yuklanmoqda..."
                                    : o.receipt_url
                                      ? "Chekni qayta yuklash"
                                      : "To‘lov chekini yuklash"}
                                </span>
                                <input
                                  id={`order-receipt-upload-${o.id}`}
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  disabled={reuploadingOrderId === o.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleOrderReceiptReupload(o.id, file);
                                    }
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })()}
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

  const profilePage = () => {
    return (
      <main className="page" style={{ padding: "0 0 40px" }}>
        <ModernProfileView
          authUser={authUser}
          telegramUser={telegramUser}
          userAvatar={avatar}
          orders={orders}
          wishlistCount={wishlist.length}
          unreadChatCount={unreadMessages.length}
          language={language}
          currency={currency}
          theme={theme}
          onNavigate={go}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => {
            setHelpInitialStep("none");
            setIsHelpOpen(true);
          }}
          onOpenSocial={() => setIsSocialLinksOpen(true)}
          onOpenPromos={() => setIsPromosOpen(true)}
          onOpenDeliveryTerms={() => setIsDeliveryInfoOpen(true)}
          onOpenSizeGuide={() => setIsSizeGuideOpen(true)}
          onOpenAboutBrand={() => setIsAboutOpen(true)}
          onExportPdf={() => handleExportPdf(orders, "Barchasi")}
          onShare={handleShare}
          onClearCache={handleClearCache}
          onLogout={handleLogout}
          onUpdateProfile={handleUpdateProfile}
          onSelectOrderFilter={(f) => setOrderFilter(f)}
          onOpenAuth={(tab) => {
            setAuthInitialTab(tab || "signup");
            setIsCustomerAuthOpen(true);
          }}
          t={t}
        />
        <div
          className="profileWatermark"
          style={{
            textAlign: "center",
            padding: "24px 0 16px",
            color: "var(--text-muted, #94a3b8)",
            opacity: 0.38,
            fontSize: "11px",
            letterSpacing: "0.5px",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          @Yusufaliyev_1225
        </div>
      </main>
    );
  };

  return (
    <div
      ref={appShellRef}
      className={`appShell ${page === "chat" ? "chatPageActive" : ""} ${page === "reels" ? "reelsPageActive" : ""}`}
    >
      <div ref={themeVeilRef} className="guliThemeTransitionVeil" aria-hidden="true" />
      <PwaInstallPrompt hidden={page === "reels"} />
      {page !== "chat" && page !== "reels" && page !== "brand_profile" && (
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <button
            className="brand"
            onClick={() => {
              setBrandProfileInitialTab("tovarlar");
              go("brand_profile");
            }}
            type="button"
            aria-label="Guli Market profil sahifasiga o‘tish"
            title="Guli Market rasmiy profili"
          >
            <span
              className="brandIcon guli-brand-circle-logo"
              style={{
                width: "52px",
                height: "52px",
                minWidth: "42px",
                minHeight: "42px",
                maxWidth: "42px",
                maxHeight: "42px",
                flex: "0 0 42px",
                flexShrink: 0,
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <img
                src={appLogo || GULI_LOGO_BASE64}
                alt="Guli Market"
                style={{
                  width: "100%",
                  height: "100%",
                  minWidth: "100%",
                  minHeight: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "contain",
                  padding: "2px",
                  borderRadius: "50%",
                  display: "block",
                  flexShrink: 0,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = GULI_LOGO_BASE64;
                }}
              />
            </span>
            <span>
              <b className="brandMarketWord">Market</b>
            </span>
          </button>
        </div>
        <div className="headerActions">
          <button
            ref={themeToggleBtnRef}
            className="iconButton themeToggleBtn"
            id="topbar-theme-toggle-btn"
            onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setTheme(nextTheme);
              try {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
              } catch {}
            }}
            aria-label={theme === "dark" ? "Kunduzgi rejimga o'tish" : "Tungi rejimga o'tish"}
            title={theme === "dark" ? "Kunduzgi rejim (Yorug')" : "Tungi rejim (Qorong'i)"}
          >
            <span className="themeToggleGlyph">
              {theme === "dark" ? "☀️" : "🌙"}
            </span>
          </button>
          <button
            className={`iconButton notifBellBtn ${totalUnreadNotificationCount > 0 ? "hasUnread" : ""}`}
            id="topbar-notifications-btn"
            onClick={() => setIsNotificationsOpen(true)}
            aria-label={t("notifications")}
            title={t("notifications")}
          >
            <span className="bellIconSpan">🔔</span>
            {totalUnreadNotificationCount > 0 ? (
              <>
                <span className="notifBadge">{totalUnreadNotificationCount}</span>
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
      )}

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
                  const handleBannerClick = () => {
                    if (heroSuppressClickRef.current) {
                      heroSuppressClickRef.current = false;
                      return;
                    }
                    openHeroBanner(banner);
                  };

                  return (
                    <div key={banner.id || idx} className="heroSlideItem" onClick={handleBannerClick}>
                      {/* Background Image - 100% Natural, Vibrant and Crisp */}
                      <img
                        src={banner.imageUrl || promoBannerUrl || placeholder("GULI")}
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
                              handleBannerClick();
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

            <VideoAdHighlights
              ads={homeVideoAds}
              onOpenProduct={(prodId) => {
                const p = products.find(
                  (item) => String(item.id) === String(prodId) || item.product_code === String(prodId)
                );
                if (p) openProduct(p, "home");
                else go("catalog");
              }}
              onNavigateUrl={(url) => {
                if (url.startsWith("/")) {
                  if (url.includes("category=")) {
                    const match = url.match(/category=([^&]+)/);
                    if (match) setSelectedCategory(decodeURIComponent(match[1]));
                  }
                  go("catalog");
                } else {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg?.openLink) tg.openLink(url);
                  else window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
            />

            <RotatingCategoriesSection
              categories={allCategories}
              products={homeShowcaseProducts}
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
            <section className="section featuredProductsSection">
              <div className="sectionTitle featuredProductsHeader">
                <span className="categorySectionEyebrow">SARALANGANLAR</span>
                <button onClick={() => go("catalog")}>{t("see_all")}</button>
              </div>
              {productsLoading && homeShowcaseProducts.length === 0 ? (
                <ProductGridSkeleton count={4} />
              ) : productsError && homeShowcaseProducts.length === 0 ? (
                <div className="empty">
                  <div>⚠️</div>
                  <h3>Catalog vaqtincha ochilmadi</h3>
                  <p>{productsError}</p>
                </div>
              ) : (
                <div className="productGrid">
                  {homeShowcaseProducts
                    .filter((p) => p.featured && p.active !== false)
                    .slice(0, 8)
                    .map((p) => card(p))}
                </div>
              )}
            </section>
            <div
              className="deliveryBanner cursor-pointer"
              onClick={() => setIsDeliveryInfoOpen(true)}
              role="button"
              tabIndex={0}
              title="Yetkazib berish shartlari"
            >
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
              productsOffsetRef.current = 0;
              productsHasMoreRef.current = true;
              setProductsHasMore(true);
              productsLoadingMoreRef.current = false;
              invalidateProductQueryCache();
              await loadProducts(true, false, true);
              showToast("✓ Katalog yangilandi");
            }}
          >
            <main className="page">
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
                <>
                  <div className="productGrid">
                    {filtered.map((p, idx) => (
                      <Fragment key={p.id || idx}>
                        {card(p)}
                        {idx === Math.min(3, filtered.length - 1) && feedVideoAds.length > 0 && (
                          <VideoAdCard
                            key={feedVideoAds[0].id}
                            ad={feedVideoAds[0]}
                            galleryAds={feedVideoAds}
                            placement="product_feed"
                            onOpenProduct={(prodId) => {
                              const found = products.find(
                                (item) => String(item.id) === String(prodId) || item.product_code === String(prodId)
                              );
                              if (found) openProduct(found, "catalog");
                            }}
                            onNavigateUrl={(url) => {
                              if (url.startsWith("/")) {
                                if (url.includes("category=")) {
                                  const match = url.match(/category=([^&]+)/);
                                  if (match) setSelectedCategory(decodeURIComponent(match[1]));
                                }
                              } else {
                                const tg = (window as any).Telegram?.WebApp;
                                if (tg?.openLink) tg.openLink(url);
                                else window.open(url, "_blank", "noopener,noreferrer");
                              }
                            }}
                            onDismiss={(adId) => {
                              setFeedVideoAds((prev) => prev.filter((item) => item.id !== adId));
                            }}
                          />
                        )}
                      </Fragment>
                    ))}
                  </div>
                  <div ref={productsLoadMoreRef} aria-hidden="true" style={{ height: "4px", margin: "10px 0" }} />
                  {productsLoadingMore ? (
                    <div style={{ padding: "18px 0" }}>
                      <ProductGridSkeleton count={2} />
                    </div>
                  ) : null}
                  {productsHasMore && !productsLoadingMore && !productsLoading ? (
                    <div style={{ textAlign: "center", padding: "12px 0 24px" }}>
                      <button
                        type="button"
                        onClick={() => loadProducts(true, true)}
                        style={{
                          background: "transparent",
                          border: "1px solid #f0dfe3",
                          color: "#c9526b",
                          borderRadius: "12px",
                          padding: "8px 20px",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Yana yuklash ↓
                      </button>
                    </div>
                  ) : null}
                  {!productsHasMore && products.length > 0 ? (
                    <p className="muted" style={{ textAlign: "center", padding: "16px 0 24px", fontSize: "13px" }}>
                      Barcha faol mahsulotlar ko‘rsatildi ({products.length} ta)
                    </p>
                  ) : null}
                </>
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
        {page === "product" && selectedProduct && (() => {
          const productRating = selectedProduct.rating && selectedProduct.rating > 0 ? selectedProduct.rating : 5.0;
          const productReviewsCount = selectedProduct.reviews && selectedProduct.reviews > 0 ? selectedProduct.reviews : Math.floor(((selectedProduct.id * 17) % 45) + 8);
          const discountPercent = selectedProduct.discount || (selectedProduct.oldPrice && selectedProduct.oldPrice > selectedProduct.price ? Math.round(((selectedProduct.oldPrice - selectedProduct.price) / selectedProduct.oldPrice) * 100) : null);
          const activeColorObj = parseColorValue(selectedColor);

          const scrollToReviews = () => {
            const el = document.getElementById("product-reviews-section");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          };

          const handleRatingUpdate = (newRating: number, newCount: number) => {
            setSelectedProduct((prev) => prev ? { ...prev, rating: newRating, reviews: newCount } : prev);
            setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? { ...p, rating: newRating, reviews: newCount } : p));
            setHomeCatalogSnapshot((prev) => prev.map((p) => p.id === selectedProduct.id ? { ...p, rating: newRating, reviews: newCount } : p));
          };

          const brandQueueIdx =
            previousPage === "brand_profile" && brandProfileProductQueue.length > 1
              ? brandProfileProductQueue.findIndex((p) => p.id === selectedProduct.id)
              : -1;

          return (
            <main className="productDetail">
              {brandQueueIdx !== -1 && (
                <div className="productQueueNavBar">
                  <button
                    type="button"
                    className="productQueueNavBtn"
                    disabled={brandQueueIdx <= 0}
                    onClick={() => {
                      const prev = brandProfileProductQueue[brandQueueIdx - 1];
                      if (prev) {
                        setSelectedProduct(prev);
                        setSelectedSize(prev.sizes?.[0] || "");
                        setSelectedColor(prev.colors?.[0] || "");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    aria-label="Oldingi tavar"
                  >
                    ‹ Oldingi
                  </button>
                  <span className="productQueueNavMeta">
                    {brandQueueIdx + 1} / {brandProfileProductQueue.length}
                  </span>
                  <button
                    type="button"
                    className="productQueueNavBtn"
                    disabled={brandQueueIdx >= brandProfileProductQueue.length - 1}
                    onClick={() => {
                      const next = brandProfileProductQueue[brandQueueIdx + 1];
                      if (next) {
                        setSelectedProduct(next);
                        setSelectedSize(next.sizes?.[0] || "");
                        setSelectedColor(next.colors?.[0] || "");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    aria-label="Keyingi tavar"
                  >
                    Keyingi ›
                  </button>
                </div>
              )}
              <div className="detailImageWrap">
                <ProductImageGallery product={selectedProduct} detail />
                <button
                  className="detailHeart"
                  onClick={() => toggleWishlist(selectedProduct.id)}
                  aria-label="Wishlist"
                >
                  {wishlist.includes(selectedProduct.id) ? "♥" : "♡"}
                </button>
              </div>

              <div className="detailContent">
                {/* Top Meta: Category, Code & Interactive Rating Pill */}
                <div className="detailMetaRow">
                  <div className="detailMetaLeft">
                    <span className="categoryLabel">{selectedProduct.category}</span>
                    {selectedProduct.product_code && (
                      <span className="productCodeLabel">
                        {selectedProduct.product_code}
                      </span>
                    )}
                  </div>
                  
                  <button 
                    type="button" 
                    className="detailRatingPill" 
                    onClick={scrollToReviews}
                    title="Sharhlarni ko'rish"
                  >
                    <span className="detailRatingStar">★</span>
                    <strong className="detailRatingScore">{productRating.toFixed(1)}</strong>
                    <span className="detailRatingReviews">({productReviewsCount})</span>
                  </button>
                </div>

                {/* Title */}
                <h1 className="detailTitle">{selectedProduct.name}</h1>

                {/* Price & Stock info bar */}
                <div className="detailPriceRow">
                  <div className="detailPriceGroup">
                    <strong className="detailMainPrice">{formatPrice(selectedProduct.price)}</strong>
                    {selectedProduct.oldPrice ? (
                      <del className="detailOldPrice">{formatPrice(selectedProduct.oldPrice)}</del>
                    ) : null}
                    {discountPercent ? (
                      <span className="detailDiscountBadge">-{discountPercent}%</span>
                    ) : null}
                  </div>

                  <div className={`detailStockChip ${selectedProduct.stock > 0 ? "inStock" : "outStock"}`}>
                    {selectedProduct.stock > 0
                      ? `✓ ${t("in_stock")}: ${selectedProduct.stock} dona`
                      : t("out_of_stock")}
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <p className="detailDescription">{selectedProduct.description}</p>
                )}

                {/* Compact Selectors Box */}
                <div className="detailSelectorsBox">
                  {/* Size Selector */}
                  {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                    <div className="detailSelectorGroup">
                      <div className="selectorLabelRow">
                        <span className="selectorTitle">{t("size")}:</span>
                        <span className="selectorActiveVal">{selectedSize}</span>
                      </div>
                      <div className="options">
                        {selectedProduct.sizes.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`option ${selectedSize === s ? "active" : ""}`}
                            onClick={() => setSelectedSize(s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Color Selector */}
                  {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                    <div className="detailSelectorGroup">
                      <div className="selectorLabelRow">
                        <span className="selectorTitle">{t("color")}:</span>
                        <span className="selectorActiveVal">{activeColorObj.name}</span>
                      </div>
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
                                  background: hex,
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
                    </div>
                  )}
                </div>

                {/* Add to Cart Button */}
                <button
                  className="primaryButton large detailAddToCartBtn"
                  disabled={selectedProduct.stock <= 0}
                  onClick={() => {
                    addToCart(selectedProduct, selectedSize, selectedColor);
                    go("cart");
                  }}
                >
                  <span>🛍️ {t("add_to_cart")}</span>
                  <span className="btnDotSep">•</span>
                  <span>{formatPrice(selectedProduct.price)}</span>
                </button>
              </div>

              <ProductReviewsSection
                productCode={selectedProduct.product_code || String(selectedProduct.id)}
                productName={selectedProduct.name}
                productId={selectedProduct.id}
                productRating={productRating}
                productReviewsCount={productReviewsCount}
                onRatingUpdate={handleRatingUpdate}
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
          );
        })()}
        {page === "cart" && (
          <main className="page">
            {cart.length > 0 && (
              <div className="cartPremiumHeader">
                <h1 className="cartPremiumSentence">
                  Siz tanlagan mahsulotlarning umumiy ro‘yxati
                </h1>
                <div className="cartCountPill">
                  {cartCount} ta mahsulot
                </div>
              </div>
            )}
            {cart.length === 0 ? (
              <div className="empty">
                <div>🛍️</div>
                <h3>{t("cart_empty_title")}</h3>
                <p>{t("cart_empty_desc")}</p>
                <button
                  className="primaryButton"
                  onClick={() => go("catalog")}
                  style={{ margin: "14px auto 0", maxWidth: "260px" }}
                >
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
                  {appliedCashback > 0 ? (
                    <div className="discountLine" style={{ color: "#059669" }}>
                      <span>💎 Keshbek chegirmasi</span>
                      <b>−{formatPrice(appliedCashback)}</b>
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
          <CheckoutView
            language={language}
            onBack={() => go("cart")}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            phone={phone}
            setPhone={setPhone}
            phoneLoading={phoneLoading}
            requestTelegramPhone={requestTelegramPhone}
            address={address}
            setAddressField={setAddressField}
            requestLocation={requestLocation}
            locationLoading={locationLoading}
            updateMapPosition={updateMapPosition}
            uzbekistanRegionsData={uzbekistanRegionsData}
            cart={cart}
            total={total}
            subtotal={subtotal}
            deliveryFee={delivery}
            formatPrice={formatPrice}
            showToast={showToast}
            onProceedPayment={() => setShowCardPaymentModal(true)}
            availableCashback={availableCashback}
            useCashback={useCashback}
            onToggleCashback={setUseCashback}
            cashbackDiscount={appliedCashback}
            LocationPicker={LocationPicker}
            isResolvingAddress={locationResolving}
            onSelectSearchCandidate={handleSelectAddressCandidate}
            promo={promo}
            setPromo={setPromo}
            promoApplied={promoApplied}
            promoDiscount={promoDiscount}
            promoLoading={promoLoading}
            onApplyPromo={applyPromo}
            onRemovePromo={() => {
              setPromoApplied(false);
              setPromoDiscount(0);
            }}
          />
        )}
        {page === "reels" && (
          <ReelsFeed
            initialReelId={targetReelId}
            initialIndex={reelsActiveIndex}
            onActiveIndexChange={(idx) => {
              setReelsActiveIndex((prev) => (prev === idx ? prev : idx));
            }}
            onOpenBrandProfile={() => {
              setBrandProfileInitialTab("tovarlar");
              setTargetReelId(undefined);
              go("brand_profile");
            }}
            onBack={() => {
              const target = previousPage === "brand_profile" ? "brand_profile" : "home";
              go(target);
            }}
            onOpenProduct={(prodId) => {
              const targetProd =
                products.find((p) => p.id === Number(prodId)) ||
                DEFAULT_PRODUCTS.find((p) => p.id === Number(prodId));
              if (targetProd) {
                openProduct(targetProd, "reels");
              } else {
                go("catalog");
              }
            }}
            onNavigateToCatalog={() => go("catalog")}
          />
        )}
        {page === "brand_profile" && (
          <GuliMarketProfile
            onBack={() => {
              const target = previousPage && previousPage !== "brand_profile" ? previousPage : "reels";
              go(target);
            }}
            products={products}
            onOpenProduct={(prod, list) => openProduct(prod, "brand_profile", list)}
            onNavigateToCatalog={(cat) => {
              if (cat) setSelectedCategory(cat);
              go("catalog");
            }}
            onSelectReel={(reelId) => {
              setPreviousPage("brand_profile");
              setTargetReelId(reelId);
              go("reels");
            }}
            onOpenChat={() => go("chat")}
            onShowToast={showToast}
            initialTab={brandProfileInitialTab}
            isUserAuthenticated={isCustomerAuthenticated}
            onOpenAuthModal={() => {
              setAuthInitialTab("signup");
              setIsCustomerAuthOpen(true);
            }}
          />
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
                  <h3>{t("empty_wishlist")}</h3>
                  <p>{t("empty_wishlist_desc")}</p>
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
                        <span className="sectionEyebrow">{t("badge_featured")}</span>
                        <h2>{t("popular_products")}</h2>
                      </div>
                    </div>
                    <ProductGridSkeleton count={4} />
                  </div>
                ) : products.length ? (
                  <section className="wishlistPopularSection">
                    <div className="sectionTitle">
                      <div>
                        <span className="sectionEyebrow">{t("badge_featured")}</span>
                        <h2>{t("popular_products")}</h2>
                      </div>
                      <button onClick={() => go("catalog")}>{t("all")} →</button>
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
          <SavedAddressesManager
            language={language}
            address={address}
            setAddress={setAddress}
            onBack={() => go("profile")}
            locationLoading={locationLoading}
            onRequestLocation={requestLocation}
            onUpdateMapPosition={updateMapPosition}
            uzbekistanRegionsData={uzbekistanRegionsData}
            showToast={showToast}
            LocationPicker={LocationPicker}
          />
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

      {page !== "chat" && (
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
          className={page === "reels" ? "active" : ""}
          onClick={() => go("reels")}
          aria-label={t("nav_reels")}
          title={t("nav_reels")}
        >
          <span className="navIcon">
            <Reels3DIcon active={page === "reels"} />
          </span>
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
            page === "addresses"
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
                page === "addresses"
              }
            />
          </span>
        </button>
      </nav>
      )}

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
        language={language}
      />

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <NotificationModal
          language={language}
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
              <h2>💳 {language === "ru" ? "Оплата картой" : language === "en" ? "Card Payment" : "Karta orqali to‘lov"}</h2>
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
                      ? (language === "ru" ? "Проверка оплаты и чека..." : language === "en" ? "Verifying payment and receipt..." : "To‘lov va chek tasdiqlanmoqda...")
                      : (language === "ru" ? "Заказ успешно оформлен!" : language === "en" ? "Order successfully placed!" : "Buyurtma rasmiylashtirildi!")}
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
                        {language === "ru" ? "Проверка файла чека / квитанции" : language === "en" ? "Verifying receipt / invoice file" : "Chek va kvitansiya fayli tekshirilmoqda"}
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
                        {language === "ru" ? "Передача данных об оплате на сервер" : language === "en" ? "Sending payment data to server" : "To‘lov ma’lumotlari serverga uzatilmoqda"}
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
                        {language === "ru" ? "Статус: " : language === "en" ? "Status: " : "Status: "}
                        <strong>{language === "ru" ? '"⏳ Ожидается подтверждение оплаты"' : language === "en" ? '"⏳ Awaiting payment confirmation"' : '"⏳ To\'lovni tasdiqlash kutilmoqda"'}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : !timerActive ? (
                <>
                  <div className="paymentNoticeBox">
                    <div className="noticeTitle">💳 {language === "ru" ? "Способ оплаты и правила" : language === "en" ? "Payment method and rules" : "To‘lov usuli va qoidalari"}</div>
                    <p>
                      {language === "ru"
                        ? "Независимо от платформ Click, Payme, Beepul и других, оплата производится переводом на пластиковую карту Uzcard / Humo."
                        : language === "en"
                        ? "Regardless of platforms like Click, Payme, Beepul, payment is made via Uzcard / Humo plastic card transfer."
                        : "Click, Payme, Beepul va boshqa barcha moliyaviy platformalardan qat'i nazar, to‘lov faqat Uzcard / Humo plastik kartasi orqali amalga oshiriladi."}
                    </p>
                    <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                      {language === "ru"
                        ? "После нажатия кнопки «💸 Перейти к оплате» отобразятся реквизиты карты. Отправленный чек подтверждается администратором в течение 2 часов."
                        : language === "en"
                        ? 'Click "💸 Proceed to Payment" to see card details. Uploaded receipt is verified by admin within 2 hours.'
                        : '"💸 To‘lov qilish" tugmasini bosganingizdan so‘ng karta rekvizitlari ko‘rinadi. Yuborilgan to‘lov cheki 2 soat ichida admin tomonidan tasdiqlanadi.'}
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
                    💸 {language === "ru" ? "Оплатить" : language === "en" ? "Pay Now" : "To‘lov qilish"}
                  </button>
                </>
              ) : (
                <>
                  <div className="cardVisualBox">
                    <div className="cardChip">💳 Uzcard / Humo</div>
                    <div className="cardHolderName">
                      <span className="cardLabel">{language === "ru" ? "Владелец карты:" : language === "en" ? "Cardholder:" : "Karta egasi:"}</span>
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
                        onClick={async () => {
                          const num = (
                            localStorage.getItem("guli_payment_card_number") || "9860 1766 1229 1557"
                          ).replace(/\s+/g, "");
                          await copyToClipboard(num);
                          setCopiedCard(true);
                          showToast(language === "ru" ? "✓ Номер карты скопирован!" : language === "en" ? "✓ Card number copied!" : "✓ Karta raqami nusxalandi!");
                          setTimeout(() => setCopiedCard(false), 2500);
                        }}
                      >
                        {copiedCard
                          ? (language === "ru" ? "✓ Скопировано" : language === "en" ? "✓ Copied" : "✓ Nusxalandi")
                          : (language === "ru" ? "📋 Скопировать" : language === "en" ? "📋 Copy" : "📋 Nusxa olish")}
                      </button>
                    </div>
                  </div>

                  <div className="activePaymentSection">
                    <div className="timerBox3D">
                      <span className="sticker3D">⏳</span>
                      <div className="timerTextWrap">
                        <span className="timerLabel">{language === "ru" ? "Время на оплату:" : language === "en" ? "Time left:" : "To‘lov muddati:"}</span>
                        <strong className={`timerDigits ${paymentTimer < 120 ? "urgent" : ""}`}>
                          {formatTimer(paymentTimer)}
                        </strong>
                      </div>
                    </div>

                    <div style={{ padding: "8px 12px", background: "rgba(217, 119, 6, 0.08)", border: "1px solid rgba(217, 119, 6, 0.2)", borderRadius: "10px", fontSize: "11.5px", color: "#b45309", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>⏱️</span>
                      <span><b>{language === "ru" ? "Примечание:" : language === "en" ? "Note:" : "Eslatma:"}</b> {language === "ru" ? "Отправленный чек проверяется администратором в течение 2 часов." : language === "en" ? "Submitted receipt is verified by admin within 2 hours." : "Yuborilgan chek 2 soat ichida admin tomonidan tasdiqlanadi."}</span>
                    </div>

                    <div className="receiptUploadBox">
                      <label className="receiptUploadLabel">
                        <span>📷 {language === "ru" ? "Нажмите для загрузки фото чека (квитанции)" : language === "en" ? "Click to upload receipt / payment proof photo" : "Chek rasmini (kvitansiya) yuklash uchun bosing"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFileChange}
                          style={{ display: "none" }}
                        />
                      </label>

                      {isUploadingReceipt && (
                        <div className="uploadingSpinner">
                          {language === "ru" ? "⏳ Обработка изображения..." : language === "en" ? "⏳ Processing image..." : "⏳ Rasm ishlanmoqda..."}
                        </div>
                      )}

                      {uploadedReceipt && (
                        <div className="uploadedReceiptStatus">
                          <div className="happyStickerHeader">
                            <span className="sticker3DHappy">☺️</span>
                            <span>{language === "ru" ? "Чек успешно загружен!" : language === "en" ? "Receipt uploaded successfully!" : "Chek muvaffaqiyatli yuklandi!"}</span>
                          </div>
                          <img
                            src={uploadedReceipt}
                            alt={language === "ru" ? "Загруженный чек" : language === "en" ? "Uploaded receipt" : "Yuklangan chek"}
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
                      ☺️ {language === "ru" ? "Я оплатил(а)" : language === "en" ? "I have paid" : "To‘lov qildim"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast ? <div className="toast">{toast}</div> : null}

      {/* Modern Customer Auth Modal (Google + Email) */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => {
          setIsCustomerAuthOpen(false);
          setAuthGateCustomMessage({});
        }}
        forceGate={false}
        onSuccess={(user) => {
          setAuthUser(user);
          setIsCustomerAuthOpen(false);
          setAuthGateCustomMessage({});
          if (user.full_name) localStorage.setItem("guli_first_name", user.full_name);
          if (user.telegram_username) localStorage.setItem("guli_telegram_username", user.telegram_username);
          showToast(`✓ Xush kelibsiz, ${user.full_name || "Mijoz"}!`);
        }}
        language={language}
        initialTab={authInitialTab}
        customTitle={authGateCustomMessage.title}
        customSubtitle={authGateCustomMessage.subtitle}
      />

      {/* Real Order Confirmed Modal matching Dark/Light Mode specs */}
      {confirmedOrder && (
        <OrderConfirmedModal
          language={language}
          orderNumber={confirmedOrder.orderNumber}
          onViewOrders={() => {
            setConfirmedOrder(null);
            go("orders");
          }}
          onGoHome={() => {
            setConfirmedOrder(null);
            go("catalog");
          }}
          onClose={() => {
            setConfirmedOrder(null);
            go("orders");
          }}
        />
      )}
    </div>
  );
}
