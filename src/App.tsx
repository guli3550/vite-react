import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        requestContact?: (callback: (ok: boolean) => void) => void;
        onEvent?: (event: string, callback: (data?: any) => void) => void;
        offEvent?: (event: string, callback: (data?: any) => void) => void;
        initData?: string;
        initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } };
        HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy") => void; notificationOccurred: (type: "error" | "success" | "warning") => void };
      };
    };
    L?: any;
  }
}

type Product = { id: number; name: string; category: string; price: number; oldPrice?: number; image: string; images?: string[]; description: string; sizes: string[]; colors: string[]; rating: number; reviews: number; stock: number; featured?: boolean; discount?: number };
type CartItem = { product: Product; size: string; color: string; quantity: number };
type Address = { latitude: number; longitude: number; region?: string; district?: string; street?: string; house?: string; apartment?: string; landmark?: string };
type Order = { id: string; items: CartItem[]; subtotal: number; delivery: number; discount: number; total: number; address?: Address; phone: string; payment: string; status: string; createdAt: string };
type Page = "home" | "catalog" | "wishlist" | "cart" | "profile" | "checkout" | "orders" | "addresses" | "product";

const CATEGORIES = [
  { name: "Barchasi", icon: "✦" },
  { name: "Byustgalter", icon: "♡" },
  { name: "Trusik", icon: "◇" },
  { name: "Komplektlar", icon: "✧" },
  { name: "Uy kiyimlari", icon: "☾" },
  { name: "Sexy lingerie", icon: "♢" },
];
const API_URL = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const formatPrice = (value: number) => `${Math.round(value).toLocaleString("uz-UZ")} so'm`;
const formatDate = (value: string) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "Sana noma'lum" : d.toLocaleDateString("uz-UZ"); };
const orderNumber = () => `GULI-${Math.floor(1000000 + Math.random() * 9000000)}`;
const tg = () => window.Telegram?.WebApp;
const haptic = () => tg()?.HapticFeedback?.impactOccurred("light");
const readStorage = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const placeholder = (name = "GULI") => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#f6e8eb"/><text x="400" y="500" text-anchor="middle" font-family="Arial" font-size="42" fill="#b95a70">${name.slice(0,18)}</text></svg>`)}`;
function optimizeImage(url: string, width = 700) { if (!url) return placeholder(); try { const u = new URL(url); if (u.hostname.includes("images.unsplash.com")) { u.searchParams.set("auto", "format"); u.searchParams.set("fit", "crop"); u.searchParams.set("w", String(width)); u.searchParams.set("q", "78"); } return u.toString(); } catch { return url; } }
function safeProductImage(product: Product, index = 0) { const list = [product.image, ...(product.images || [])].filter(Boolean); return optimizeImage(list[index] || list[0] || "", 760); }

function ProductImage({ product, detail = false }: { product: Product; detail?: boolean }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = [product.image, ...(product.images || [])].filter(Boolean);
  const src = sourceIndex < sources.length ? optimizeImage(sources[sourceIndex], detail ? 1100 : 650) : placeholder(product.name);
  return <img src={src} alt={product.name} loading={detail ? "eager" : "lazy"} decoding="async" fetchPriority={detail ? "high" : "auto"} onError={() => setSourceIndex((v) => v + 1)} />;
}

function LocationPicker({ latitude, longitude, onChange }: { latitude: number; longitude: number; onChange: (lat: number, lon: number) => void }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(Boolean(window.L));
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.async = true; script.onload = () => setReady(true); document.body.appendChild(script);
    return () => { script.remove(); css.remove(); };
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;
    const L = window.L;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, { zoomControl: false, attributionControl: true }).setView([latitude, longitude], 16);
      L.control.zoom({ position: "bottomright" }).addTo(mapInstance.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapInstance.current);
      markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(mapInstance.current);
      markerRef.current.on("dragend", () => { const p = markerRef.current.getLatLng(); onChange(p.lat, p.lng); });
      mapInstance.current.on("click", (e: any) => { markerRef.current.setLatLng(e.latlng); onChange(e.latlng.lat, e.latlng.lng); });
    } else {
      const current = markerRef.current.getLatLng();
      if (Math.abs(current.lat - latitude) > 0.00001 || Math.abs(current.lng - longitude) > 0.00001) { markerRef.current.setLatLng([latitude, longitude]); mapInstance.current.setView([latitude, longitude], 16); }
    }
    setTimeout(() => mapInstance.current?.invalidateSize(), 80);
    return () => {};
  }, [ready, latitude, longitude, onChange]);
  return <div className="mapPicker"><div ref={mapRef} className="leafletMap" />{!ready ? <div className="mapLoading">Xarita yuklanmoqda…</div> : null}<div className="mapHint">📍 Pinni sudrang yoki xaritada kerakli joyga bosing</div></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [previousPage, setPreviousPage] = useState<Page>("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => readStorage("cart", []));
  const [wishlist, setWishlist] = useState<number[]>(() => readStorage("wishlist", []));
  const [orders, setOrders] = useState<Order[]>(() => readStorage("orders", []));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [phone, setPhone] = useState(() => localStorage.getItem("guli_phone") || "");
  const [payment, setPayment] = useState("cash");
  const [address, setAddress] = useState<Address>(() => readStorage("guli_address", { latitude: 0, longitude: 0, region: "", district: "", street: "", house: "", apartment: "", landmark: "" }));
  const [locationLoading, setLocationLoading] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  const telegramUser = tg()?.initDataUnsafe?.user;
  const displayName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || "GULI mijozi";
  const avatar = telegramUser?.photo_url || "";

  useEffect(() => { tg()?.ready(); tg()?.expand(); }, []);
  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("wishlist", JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem("orders", JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem("guli_phone", phone); }, [phone]);
  useEffect(() => { localStorage.setItem("guli_address", JSON.stringify(address)); }, [address]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/products?limit=100`).then((r) => { if (!r.ok) throw new Error("Catalog API javob bermadi"); return r.json(); }).then((result) => { if (!result.success || !Array.isArray(result.data)) throw new Error("Catalog ma'lumotlari noto'g'ri"); if (!cancelled) setProducts(result.data); }).catch((e) => { if (!cancelled) setProductsError(e instanceof Error ? e.message : "Mahsulotlarni yuklashda xatolik"); }).finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!telegramUser?.id) return;
    setOrdersLoading(true);
    fetch(`${API_URL}/api/orders?telegram_id=${telegramUser.id}`).then((r) => r.ok ? r.json() : Promise.reject(new Error())).then((result) => {
      if (result.success && Array.isArray(result.data)) setOrders(result.data.map((row: any) => ({ id: String(row.order_number || row.id || orderNumber()).replace(/^GULI-\d{13}$/, orderNumber()), items: Array.isArray(row.items) ? row.items : [], subtotal: Number(row.subtotal || 0), delivery: Number(row.delivery || 0), discount: Number(row.discount || 0), total: Number(row.total || 0), address: row.address || undefined, phone: row.phone || "", payment: row.payment || "cash", status: row.status || "Qabul qilindi", createdAt: row.created_at || new Date().toISOString() }))));
    }).catch(() => {}).finally(() => setOrdersLoading(false));
  }, [telegramUser?.id]);

  useEffect(() => {
    const webApp = tg();
    if (!webApp?.onEvent || !telegramUser?.id) return;
    const handler = (data?: any) => { if (data?.status === "sent") { setShareMessage("Raqam Telegramdan olindi ✓"); setTimeout(() => setShareMessage(""), 1800); } };
    webApp.onEvent("contactRequested", handler);
    return () => webApp.offEvent?.("contactRequested", handler);
  }, [telegramUser?.id]);

  const filteredProducts = useMemo(() => products.filter((product) => { const categoryMatch = selectedCategory === "Barchasi" || product.category === selectedCategory; const query = search.trim().toLowerCase(); return categoryMatch && (!query || product.name.toLowerCase().includes(query) || product.category.toLowerCase().includes(query)); }), [products, selectedCategory, search]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryPrice = cartSubtotal >= 300000 ? 0 : 20000;
  const discount = promoApplied ? Math.round(cartSubtotal * 0.1) : 0;
  const cartTotal = Math.max(0, cartSubtotal + deliveryPrice - discount);

  const go = (next: Page) => { haptic(); setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openProduct = (product: Product, from: Page = page) => { setPreviousPage(from); setSelectedProduct(product); setSelectedSize(product.sizes?.[0] || ""); setSelectedColor(product.colors?.[0] || ""); go("product"); };
  const addToCart = (product: Product, size = product.sizes?.[0] || "", color = product.colors?.[0] || "") => { setCart((current) => { const existing = current.find((item) => item.product.id === product.id && item.size === size && item.color === color); return existing ? current.map((item) => item.product.id === product.id && item.size === size && item.color === color ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product, size, color, quantity: 1 }]; }); haptic(); };
  const toggleWishlist = (id: number) => { setWishlist((current) => current.includes(id) ? current.filter((v) => v !== id) : [...current, id]); haptic(); };
  const changeQuantity = (index: number, amount: number) => setCart((current) => current.map((item, i) => i === index ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));

  const similarProducts = useMemo(() => { if (!selectedProduct) return []; const targetPrice = selectedProduct.price; return products.filter((p) => p.id !== selectedProduct.id).map((p) => { const categoryScore = p.category === selectedProduct.category ? 50 : 0; const priceScore = Math.max(0, 30 - (Math.abs(p.price - targetPrice) / Math.max(targetPrice, 1)) * 30); const ratingScore = Math.min(10, p.rating * 2); const discountScore = Math.min(10, p.discount || 0); return { p, score: categoryScore + priceScore + ratingScore + discountScore }; }).sort((a, b) => b.score - a.score).slice(0, 4).map(({ p }) => p); }, [products, selectedProduct]);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try { const r = await fetch(`${API_URL}/api/reverse-geocode?lat=${latitude}&lon=${longitude}`); if (!r.ok) return; const result = await r.json(); if (result.success && result.data) setAddress((current) => ({ ...current, latitude, longitude, region: result.data.region || current.region, district: result.data.district || current.district, street: result.data.street || current.street })); } catch { /* keep coordinates */ }
  };
  const updateMapPosition = (latitude: number, longitude: number) => { setAddress((current) => ({ ...current, latitude, longitude })); reverseGeocode(latitude, longitude); };
  const requestLocation = () => {
    if (!navigator.geolocation) { setAddressMessage("Telefoningiz lokatsiyani qo‘llab-quvvatlamaydi."); return; }
    setLocationLoading(true); setAddressMessage("");
    navigator.geolocation.getCurrentPosition(async (position) => { await reverseGeocode(position.coords.latitude, position.coords.longitude); setLocationLoading(false); }, () => { setLocationLoading(false); setAddressMessage("Lokatsiya ruxsati berilmadi. Telefon sozlamalaridan ruxsat bering."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  };

  const requestTelegramPhone = async () => {
    const webApp = tg();
    if (!webApp?.requestContact) { setShareMessage("Telegram raqamini avtomatik olish bu qurilmada mavjud emas"); setTimeout(() => setShareMessage(""), 2500); return; }
    setPhoneLoading(true);
    webApp.requestContact(async (ok) => {
      if (!ok) { setPhoneLoading(false); return; }
      for (let i = 0; i < 8; i += 1) {
        try { const r = await fetch(`${API_URL}/api/telegram-user?telegram_id=${telegramUser?.id}`); const result = await r.json(); if (result.success && result.data?.telegram_phone) { setPhone(result.data.telegram_phone); setShareMessage("✅ Telegram raqami kiritildi"); setPhoneLoading(false); setTimeout(() => setShareMessage(""), 2200); return; } } catch { /* retry */ }
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      setPhoneLoading(false); setShareMessage("Raqam Telegramga yuborildi. Bir ozdan keyin qayta tekshiring."); setTimeout(() => setShareMessage(""), 2800);
    });
  };

  const shareApp = async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: "GULI Premium", text: "GULI Premium katalogini ko‘ring 🌷", url }); else await navigator.clipboard.writeText(url); setShareMessage("Ilova havolasi tayyor ✓"); } catch { setShareMessage(""); } setTimeout(() => setShareMessage(""), 2200); };

  const renderProductCard = (product: Product, compact = false) => (
    <article className={`productCard ${compact ? "compact" : ""}`} key={product.id}>
      <div className="productImageWrap" role="button" tabIndex={0} onClick={() => openProduct(product)} onKeyDown={(e) => e.key === "Enter" && openProduct(product)}>
        <ProductImage product={product} />
        {product.discount ? <span className="discountBadge">-{product.discount}%</span> : null}
        <button className="heartButton" onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}>{wishlist.includes(product.id) ? "♥" : "♡"}</button>
      </div>
      <div className="productInfo"><span>{product.category}</span><h3>{product.name}</h3><div className="smallRating">★ {product.rating.toFixed(1)} <span>({product.reviews})</span></div><div className="cardBottom"><div><strong>{formatPrice(product.price)}</strong>{product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}</div><button className="addButton" onClick={() => addToCart(product)}>+</button></div></div>
    </article>
  );

  const renderOrderDetail = (order: Order) => {
    const first = order.items?.[0]?.product;
    const currentStatus = order.status || "Qabul qilindi";
    const statuses = ["Qabul qilindi", "Tayyorlanmoqda", "Yo‘lda", "Yetkazildi"];
    const activeIndex = Math.max(0, statuses.findIndex((s) => s === currentStatus));
    return <section className="orderDetailPanel"><div className="detailPanelTop"><div><span>BUYURTMA TAFSILOTI</span><h2>№ {order.id}</h2><small>{formatDate(order.createdAt)}</small></div><button className="closeDetail" onClick={() => setSelectedOrderId(null)}>×</button></div><div className="orderDetailHero">{first ? <img src={safeProductImage(first)} alt={first.name} onClick={() => { const product = products.find((p) => p.id === first.id) || first; openProduct(product, "orders"); }} /> : <div className="orderPlaceholder">🛍️</div>}<div><b>{first?.name || `${order.items.length} ta mahsulot`}</b><p>{order.items.length} ta mahsulot · {order.payment === "card" ? "Karta" : "Naqd"}</p><strong>{formatPrice(order.total)}</strong></div></div><div className="statusTimeline"><h3>Buyurtma holati</h3>{statuses.map((status, index) => <div className={`statusStep ${index <= activeIndex ? "done" : ""}`} key={status}><span>{index <= activeIndex ? "✓" : index + 1}</span><div><b>{status}</b>{index === 0 ? <small>Buyurtmangiz qabul qilindi</small> : null}</div></div>)}</div><div className="orderInfoGrid"><div><span>Telefon</span><b>{order.phone || "—"}</b></div><div><span>Jami</span><b>{formatPrice(order.total)}</b></div><div><span>Yetkazib berish</span><b>{order.delivery ? formatPrice(order.delivery) : "Bepul"}</b></div><div><span>Manzil</span><b>{order.address ? [order.address.region, order.address.district, order.address.street, order.address.house, order.address.apartment].filter(Boolean).join(", ") || "Lokatsiya belgilangan" : "—"}</b></div></div></section>;
  };

  const renderOrders = () => <main className="page ordersPage"><div className="pageHeader"><span>BUYURTMALAR</span><h1>Mening buyurtmalarim</h1><p>Har bir buyurtmani ochib, mahsulot va holatini ko‘ring.</p></div>{selectedOrderId ? (() => { const order = orders.find((o) => o.id === selectedOrderId); return order ? renderOrderDetail(order) : null; })() : null}{ordersLoading ? <div className="empty"><div>⏳</div><p>Buyurtmalar yuklanmoqda...</p></div> : orders.length ? <div className="ordersList">{orders.map((order) => { const firstItem = order.items?.[0]; const rawProduct = firstItem?.product; const firstProduct = rawProduct ? (products.find((p) => p.id === rawProduct.id) || rawProduct) : undefined; return <article className="orderCard" key={order.id}><div className="orderHead"><b>№ {order.id}</b><span>{formatDate(order.createdAt)}</span></div><div className="orderPreview" onClick={() => firstProduct && openProduct(firstProduct, "orders")} role="button">{firstProduct ? <img src={safeProductImage(firstProduct)} alt={firstProduct.name} /> : <div className="orderPlaceholder">🛍️</div>}<div><strong>{firstProduct?.name || "Buyurtma"}</strong><p>{Math.max(order.items?.length || 1, 1)} ta mahsulot · {order.payment === "card" ? "Karta" : "Naqd"}</p><b>{formatPrice(order.total)}</b></div></div><div className="orderFooter"><span className="statusDot">● {order.status}</span><button onClick={() => { setSelectedOrderId(order.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Tafsilotlar →</button></div></article>; })}</div> : <div className="empty"><div>🛍️</div><h3>Hali buyurtma yo‘q</h3><p>Tanlagan mahsulotlaringiz shu yerda ko‘rinadi.</p><button className="primaryButton" onClick={() => go("catalog")}>Katalogni ko‘rish</button></div>}</main>;

  const renderProfile = () => <main className="page profilePage"><section className="profileHero"><div className="avatarLarge">{avatar && !profilePhotoError ? <img src={avatar} alt={displayName} onError={() => setProfilePhotoError(true)} /> : <span>{displayName.charAt(0).toUpperCase()}</span>}</div><div><h1>{displayName}</h1><p>{telegramUser?.username ? `@${telegramUser.username}` : "Telegram foydalanuvchisi"}</p><span className="verifiedPill">✓ Telegram</span></div></section><section className="profileStats"><button onClick={() => go("orders")}><b>{orders.length}</b><span>Buyurtma</span></button><button onClick={() => go("wishlist")}><b>{wishlist.length}</b><span>Sevimli</span></button><button onClick={() => go("cart")}><b>{cartCount}</b><span>Savat</span></button></section><section className="profileSection"><h3>Hisobim</h3><button className="profileRow" onClick={() => go("orders")}><span className="rowIcon">📦</span><span><b>Buyurtmalarim</b><small>Tarix va buyurtma holati</small></span><i>›</i></button><button className="profileRow" onClick={() => go("wishlist")}><span className="rowIcon">♡</span><span><b>Sevimlilar</b><small>Saqlangan mahsulotlar</small></span><i>›</i></button><button className="profileRow" onClick={() => go("addresses")}><span className="rowIcon">📍</span><span><b>Manzillarim</b><small>Yetkazib berish manzillari</small></span><i>›</i></button></section><section className="profileSection"><h3>Qulayliklar</h3><button className="profileRow" onClick={shareApp}><span className="rowIcon">↗</span><span><b>GULI'ni ulashish</b><small>Do‘stlaringizga yuboring</small></span><i>›</i></button><button className="profileRow" onClick={() => setShareMessage("Yordam uchun Telegram orqali yozing") }><span className="rowIcon">?</span><span><b>Yordam</b><small>Savollar va qo‘llab-quvvatlash</small></span><i>›</i></button><div className="profileInfo"><span>Telefon</span><b>{phone || "Checkoutda avtomatik to‘ldiriladi"}</b></div></section>{shareMessage ? <div className="toast">{shareMessage}</div> : null}</main>;

  const setAddressField = (key: keyof Address, value: string) => setAddress((current) => ({ ...current, [key]: value }));
  const submitOrder = async () => {
    const id = orderNumber();
    const payload = { order_number: id, telegram_id: telegramUser?.id, username: telegramUser?.username, first_name: telegramUser?.first_name, phone, items: cart, subtotal: cartSubtotal, delivery: deliveryPrice, discount, total: cartTotal, address, payment, status: "Qabul qilindi" };
    try {
      const response = await fetch(`${API_URL}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Buyurtma serverga yuborilmadi");
      const result = await response.json(); if (!result.success) throw new Error(result.message || "Buyurtma xatosi");
      if (telegramUser?.id && address.latitude) fetch(`${API_URL}/api/save-address`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telegram_id: telegramUser.id, username: telegramUser.username, phone, ...address }) }).catch(() => {});
      const saved: Order = { id: result.data?.order_number || id, items: cart, subtotal: cartSubtotal, delivery: deliveryPrice, discount, total: cartTotal, address, phone, payment, status: "Qabul qilindi", createdAt: new Date().toISOString() };
      setOrders((current) => [saved, ...current]); setCart([]); setSelectedOrderId(saved.id); go("orders"); tg()?.HapticFeedback?.notificationOccurred("success");
    } catch (error) { alert(error instanceof Error ? error.message : "Buyurtmani yuborishda xatolik"); }
  };

  return <div className="app">
    <header className="topbar"><button className="brand" onClick={() => go("home")}><span className="brandIcon">🌷</span><span><b>GULI</b><small>PREMIUM</small></span></button><div className="headerActions"><button className="iconButton" onClick={() => go("wishlist")}>♡<span className="badge">{wishlist.length}</span></button><button className="iconButton" onClick={() => go("cart")}>🛍️<span className="badge">{cartCount}</span></button></div></header>

    {page === "home" && <><section className="hero"><div className="heroOverlay"><span>PREMIUM COLLECTION</span><h1>Go‘zallik sizdan boshlanadi.</h1><p>Nafislik, qulaylik va o‘zingizga bo‘lgan ishonch.</p><button className="heroButton" onClick={() => go("catalog")}>Kolleksiyani ko‘rish →</button></div></section><section className="section"><div className="sectionTitle"><h2>Kategoriyalar</h2><button onClick={() => go("catalog")}>Barchasi</button></div><div className="categoryScroll">{CATEGORIES.slice(1).map((category) => <button className="categoryCard" key={category.name} onClick={() => { setSelectedCategory(category.name); go("catalog"); }}><span>{category.icon}</span><b>{category.name}</b></button>)}</div></section><section className="section"><div className="sectionTitle"><h2>Tanlanganlar</h2><button onClick={() => go("catalog")}>Barchasi</button></div>{productsLoading ? <div className="empty"><div>⏳</div><p>Mahsulotlar yuklanmoqda...</p></div> : productsError ? <div className="empty"><div>⚠️</div><h3>Catalog vaqtincha ochilmadi</h3><p>{productsError}</p></div> : <div className="productGrid">{products.filter((p) => p.featured).slice(0, 4).map((p) => renderProductCard(p))}</div>}</section><div className="deliveryBanner"><div><span>🚚</span><div><b>300 000 so‘mdan yuqori buyurtma — bepul yetkazib berish</b><p>O‘zbekiston bo‘ylab qulay yetkazib berish.</p></div></div></div></>}

    {page === "catalog" && <main className="page"><div className="pageHeader"><span>GULI PREMIUM</span><h1>Katalog</h1><p>O‘zingizga mosini toping.</p></div><div className="searchBox">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot qidirish..." /></div><div className="categoryTabs">{CATEGORIES.map((category) => <button key={category.name} className={`tab ${selectedCategory === category.name ? "active" : ""}`} onClick={() => setSelectedCategory(category.name)}>{category.name}</button>)}</div>{productsLoading ? <div className="empty"><div>⏳</div><p>Mahsulotlar yuklanmoqda...</p></div> : productsError ? <div className="empty"><div>⚠️</div><h3>Yuklashda xatolik</h3><p>{productsError}</p></div> : filteredProducts.length ? <div className="productGrid">{filteredProducts.map((p) => renderProductCard(p))}</div> : <div className="empty"><div>⌕</div><h3>Mahsulot topilmadi</h3><p>Boshqa qidiruv yoki kategoriya tanlang.</p></div>}</main>}

    {page === "product" && selectedProduct && <main className="productDetail"><button className="backButton" onClick={() => go(previousPage)}>← Orqaga</button><div className="detailImageWrap"><ProductImage product={selectedProduct} detail /><button className="detailHeart" onClick={() => toggleWishlist(selectedProduct.id)}>{wishlist.includes(selectedProduct.id) ? "♥" : "♡"}</button>{selectedProduct.discount ? <span className="detailDiscount">-{selectedProduct.discount}%</span> : null}</div><div className="detailContent"><span className="categoryLabel">{selectedProduct.category}</span><h1>{selectedProduct.name}</h1><div className="rating">★ {selectedProduct.rating.toFixed(1)} <span>({selectedProduct.reviews} sharh)</span></div><div className="priceRow"><strong>{formatPrice(selectedProduct.price)}</strong>{selectedProduct.oldPrice ? <del>{formatPrice(selectedProduct.oldPrice)}</del> : null}</div><p className="description">{selectedProduct.description}</p><div className="detailMeta"><span>✓ Tez yetkazib berish</span><span>↻ Qulay qaytarish</span></div><h3>O‘lcham</h3><div className="options">{selectedProduct.sizes.map((size) => <button key={size} className={`option ${selectedSize === size ? "active" : ""}`} onClick={() => setSelectedSize(size)}>{size}</button>)}</div><h3>Rang</h3><div className="options">{selectedProduct.colors.map((color) => <button key={color} className={`option ${selectedColor === color ? "active" : ""}`} onClick={() => setSelectedColor(color)}>{color}</button>)}</div><div className="stock">{selectedProduct.stock > 0 ? `✓ Mavjud: ${selectedProduct.stock} dona` : "Hozircha mavjud emas"}</div><button className="primaryButton large" disabled={selectedProduct.stock <= 0} onClick={() => { addToCart(selectedProduct, selectedSize, selectedColor); go("cart"); }}>Savatga qo‘shish — {formatPrice(selectedProduct.price)}</button></div><section className="recommendSection"><div className="sectionTitle"><div><span>SIZGA HAM YOQISHI MUMKIN</span><h2>O‘xshash mahsulotlar</h2></div></div>{similarProducts.length ? <div className="productGrid">{similarProducts.map((p) => renderProductCard(p, true))}</div> : <p className="muted">Hozircha o‘xshash mahsulot topilmadi.</p>}</section></main>}

    {page === "cart" && <main className="page"><div className="pageHeader"><span>BUYURMA</span><h1>Savat</h1><p>{cartCount ? `${cartCount} ta mahsulot tanlandi` : "Savatni to‘ldiring"}</p></div>{cart.length === 0 ? <div className="empty"><div>🛍️</div><h3>Savat bo‘sh</h3><p>Mahsulot tanlang va xaridni boshlang.</p><button className="primaryButton" onClick={() => go("catalog")}>Katalogga o‘tish</button></div> : <><div className="cartList">{cart.map((item, index) => <div className="cartItem" key={`${item.product.id}-${item.size}-${item.color}-${index}`}><img src={safeProductImage(item.product)} alt={item.product.name} loading="lazy" /><div className="cartInfo"><b>{item.product.name}</b><small>{item.size || "O‘lcham tanlanmagan"} · {item.color || "Rang tanlanmagan"}</small><strong>{formatPrice(item.product.price * item.quantity)}</strong><div className="quantity"><button onClick={() => changeQuantity(index, -1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(index, 1)}>+</button></div></div></div>)}</div><div className="promoBox"><input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo kod" /><button onClick={() => setPromoApplied(Boolean(promo.trim()))}>{promoApplied ? "✓" : "Qo‘llash"}</button></div><div className="summary"><div><span>Mahsulotlar</span><b>{formatPrice(cartSubtotal)}</b></div><div><span>Yetkazib berish</span><b>{deliveryPrice ? formatPrice(deliveryPrice) : "Bepul"}</b></div>{discount > 0 ? <div className="discountLine"><span>Chegirma</span><b>−{formatPrice(discount)}</b></div> : null}<hr/><div className="total"><span>Jami</span><b>{formatPrice(cartTotal)}</b></div></div><button className="primaryButton large" onClick={() => go("checkout")}>Buyurtma berish — {formatPrice(cartTotal)}</button></>}</main>}

    {page === "checkout" && <main className="page checkoutPage"><div className="pageHeader"><span>CHECKOUT</span><h1>Buyurtmani rasmiylashtirish</h1><p>Ma’lumotlarni tekshiring va buyurtmani tasdiqlang.</p></div><div className="checkoutCard"><div className="cardTitle"><span className="step">1</span><div><h3>Telefon raqami</h3><p>Buyurtma bo‘yicha bog‘lanish uchun</p></div></div><input className="input full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" type="tel" /><button className={`phoneAutoButton ${phoneLoading ? "loading" : ""}`} onClick={requestTelegramPhone} disabled={phoneLoading}>{phoneLoading ? "⏳ Telegramdan olinmoqda…" : phone ? "✓ Telegram raqamini yangilash" : "📱 Telegram raqamimni avtomatik olish"}</button></div><div className="checkoutCard"><div className="cardTitle"><span className="step">2</span><div><h3>Yetkazib berish manzili</h3><p>GPS yoki xaritadan aniq joyni belgilang</p></div></div><button className="locationButton" onClick={requestLocation}>{locationLoading ? "⌛ Aniqlanmoqda..." : address.latitude ? "↻ Joylashuvni qayta aniqlash" : "📍 Joylashuvimni aniqlash"}</button>{address.latitude ? <><LocationPicker latitude={address.latitude} longitude={address.longitude} onChange={updateMapPosition} /><div className="mapCaption">✓ Belgilangan joy: {address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}</div></> : null}{addressMessage ? <div className="addressError">{addressMessage}</div> : null}<div className="addressAuto"><span>✓</span><div><b>Avtomatik to‘ldiriladi</b><small>Viloyat, tuman va ko‘cha</small></div></div><div className="twoInputs"><input className="input" value={address.region || ""} onChange={(e) => setAddressField("region", e.target.value)} placeholder="Viloyat" /><input className="input" value={address.district || ""} onChange={(e) => setAddressField("district", e.target.value)} placeholder="Tuman" /></div><input className="input full" value={address.street || ""} onChange={(e) => setAddressField("street", e.target.value)} placeholder="Ko‘cha" /><div className="addressFieldsLabel">Uy va qo‘shimcha ma’lumot</div><div className="twoInputs"><input className="input" value={address.house || ""} onChange={(e) => setAddressField("house", e.target.value)} placeholder="Dom / uy raqami" /><input className="input" value={address.apartment || ""} onChange={(e) => setAddressField("apartment", e.target.value)} placeholder="Padezd / xonadon" /></div><input className="input full" value={address.landmark || ""} onChange={(e) => setAddressField("landmark", e.target.value)} placeholder="Mo‘ljal (ixtiyoriy)" /></div><div className="checkoutCard"><div className="cardTitle"><span className="step">3</span><div><h3>To‘lov usuli</h3><p>O‘zingizga qulay usulni tanlang</p></div></div><label className={`paymentOption ${payment === "cash" ? "selected" : ""}`}><input type="radio" checked={payment === "cash"} onChange={() => setPayment("cash")} />💵 <span><b>Naqd</b><small>Yetkazib berishda</small></span></label><label className={`paymentOption ${payment === "card" ? "selected" : ""}`}><input type="radio" checked={payment === "card"} onChange={() => setPayment("card")} />💳 <span><b>Karta</b><small>To‘lov usuli</small></span></label></div><div className="checkoutTotal"><span>Jami to‘lov</span><b>{formatPrice(cartTotal)}</b></div><button className="primaryButton large" disabled={!phone.trim() || cart.length === 0} onClick={submitOrder}>Buyurtmani tasdiqlash — {formatPrice(cartTotal)}</button></main>}

    {page === "wishlist" && <main className="page"><div className="pageHeader"><span>GULI PREMIUM</span><h1>Sevimlilar</h1><p>Siz saqlagan mahsulotlar.</p></div>{wishlist.length ? <div className="productGrid">{products.filter((p) => wishlist.includes(p.id)).map((p) => renderProductCard(p))}</div> : <div className="empty"><div>♡</div><h3>Sevimlilar bo‘sh</h3><p>Yoqtirgan mahsulotlaringizni shu yerda saqlang.</p><button className="primaryButton" onClick={() => go("catalog")}>Mahsulot topish</button></div>}</main>}
    {page === "orders" && renderOrders()}
    {page === "profile" && renderProfile()}
    {page === "addresses" && <main className="page"><div className="pageHeader"><span>PROFIL</span><h1>Manzillarim</h1><p>Yetkazib berish uchun saqlangan manzil.</p></div>{address.latitude ? <div className="savedAddressCard"><div className="savedAddressIcon">📍</div><div><b>{address.region || "Joylashuv"}</b><p>{[address.district, address.street, address.house, address.apartment].filter(Boolean).join(", ") || "Lokatsiya saqlandi"}</p><small>{address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}</small><button className="smallAction" onClick={() => go("checkout")}>Manzilni tahrirlash</button></div></div> : <div className="empty"><div>📍</div><h3>Manzil hali saqlanmagan</h3><p>Checkoutda joylashuvingizni aniqlang.</p><button className="primaryButton" onClick={() => go("checkout")}>Manzil qo‘shish</button></div>}</main>}

    <nav className="bottomNav"><button className={page === "home" ? "active" : ""} onClick={() => go("home")}><span>⌂</span><small>Asosiy</small></button><button className={page === "catalog" ? "active" : ""} onClick={() => go("catalog")}><span>⌕</span><small>Katalog</small></button><button className={page === "wishlist" ? "active" : ""} onClick={() => go("wishlist")}><span>♡</span><small>Sevimli</small></button><button className={page === "cart" ? "active" : ""} onClick={() => go("cart")}><span>🛍️<em>{cartCount || ""}</em></span><small>Savat</small></button><button className={page === "profile" || page === "orders" || page === "addresses" ? "active" : ""} onClick={() => go("profile")}><span>{avatar && !profilePhotoError ? <img className="navAvatar" src={avatar} alt="" onError={() => setProfilePhotoError(true)} /> : "●"}</span><small>Profil</small></button></nav>
  </div>;
}
