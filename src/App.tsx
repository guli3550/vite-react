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
import { SavedAddressesManager } from "./components/SavedAddressesManager";
import { CheckoutView } from "./components/CheckoutView";
import { OrderConfirmedModal } from "./components/OrderConfirmedModal";
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
  getStoredChatMessages,
} from "./utils/chatSync";
import { detectPlatform, initPlatformEnvironment } from "./utils/platformAdapter";
import { CustomerAuthModal, type AuthUser } from "./components/CustomerAuthModal";
import { getSupabase, loadSupabaseConfigAsync, signOutEverywhere, syncCustomerProfile } from "./lib/supabaseClient";
import { ModernProfileView } from "./components/ModernProfileView";
import { checkReceiptDelayed, getDeliveryEstimate } from "./utils/delivery";
import { copyToClipboard } from "./utils/clipboard";

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
  import.meta.env.VITE_API_URL || "https://guli-gateway.parizodabaxtiyorov.workers.dev"
).replace(/\/$/, "");
