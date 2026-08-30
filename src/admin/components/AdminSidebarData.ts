export type NavTabKey =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "reviews"
  | "customers"
  | "payments"
  | "promos"
  | "banners"
  | "analytics"
  | "chat"
  | "callcenter"
  | "notifications"
  | "settings"
  | "extensions";

export type NavItem = {
  key: NavTabKey;
  icon: string;
  label: string;
  badge?: number;
};

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { key: "dashboard", icon: "🏠", label: "Bosh sahifa" },
  { key: "orders", icon: "🛒", label: "Buyurtmalar" },
  { key: "products", icon: "👗", label: "Mahsulotlar" },
  { key: "categories", icon: "🗂", label: "Kategoriyalar" },
  { key: "reviews", icon: "⭐", label: "Sharhlar" },
  { key: "customers", icon: "👥", label: "Mijozlar" },
  { key: "payments", icon: "💳", label: "To‘lovlar" },
  { key: "promos", icon: "🎟", label: "Kuponlar" },
  { key: "banners", icon: "🖼", label: "Bannerlar" },
  { key: "analytics", icon: "📊", label: "Tahlillar" },
  { key: "chat", icon: "💬", label: "Online Chat" },
  { key: "callcenter", icon: "☎️", label: "Call Center Chat" },
  { key: "notifications", icon: "🔔", label: "Bildirishnomalar" },
  { key: "settings", icon: "⚙️", label: "Sozlamalar" },
  { key: "extensions", icon: "🧩", label: "Kengaytmalar" },
];
