import { useEffect, useMemo, useState } from "react";
import "./App.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton?: {
          text: string;
          color?: string;
          textColor?: string;
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setText: (text: string) => void;
        };
        initData?: string;
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
          notificationOccurred: (type: "error" | "success" | "warning") => void;
        };
      };
    };
  }
}

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  image: string;
  images?: string[];
  description: string;
  sizes: string[];
  colors: string[];
  rating: number;
  reviews: number;
  stock: number;
  featured?: boolean;
  discount?: number;
};

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
  items: CartItem[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  address?: Address;
  phone: string;
  payment: string;
  status: string;
  createdAt: string;
};

const CATEGORIES = [
  { name: "Barchasi", icon: "✨" },
  { name: "Byustgalter", icon: "👙" },
  { name: "Trusik", icon: "🩲" },
  { name: "Komplektlar", icon: "🎀" },
  { name: "Uy kiyimlari", icon: "🌙" },
  { name: "Sexy lingerie", icon: "🔥" },
];

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const formatPrice = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;
const getTelegram = () => window.Telegram?.WebApp;

export default function App() {
  const [page, setPage] = useState<"home" | "catalog" | "wishlist" | "cart" | "profile" | "checkout" | "orders">("home");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  });
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("wishlist") || "[]"); } catch { return []; }
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    try { return JSON.parse(localStorage.getItem("orders") || "[]"); } catch { return []; }
  });

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("cash");
  const [address, setAddress] = useState<Address>({ latitude: 0, longitude: 0, region: "", district: "", street: "", house: "", apartment: "", landmark: "" });
  const [locationLoading, setLocationLoading] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const telegramUser = getTelegram()?.initDataUnsafe?.user;

  useEffect(() => {
    const tg = getTelegram();
    if (tg) { tg.ready(); tg.expand(); }
  }, []);

  // Catalog is now server-driven; Supabase remains behind the backend secret.
  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      setProductsLoading(true);
      setProductsError("");
      try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error("Catalog API javob bermadi");
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) throw new Error("Catalog ma'lumotlari noto'g'ri");
        if (!cancelled) setProducts(result.data);
      } catch (error) {
        if (!cancelled) setProductsError(error instanceof Error ? error.message : "Mahsulotlarni yuklashda xatolik");
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("wishlist", JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem("orders", JSON.stringify(orders)); }, [orders]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = selectedCategory === "Barchasi" || product.category === selectedCategory;
    const query = search.trim().toLowerCase();
    const searchMatch = !query || product.name.toLowerCase().includes(query) || product.category.toLowerCase().includes(query);
    return categoryMatch && searchMatch;
  }), [products, selectedCategory, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryPrice = cartSubtotal >= 300000 ? 0 : 20000;
  const discount = promoApplied ? Math.round(cartSubtotal * 0.1) : 0;
  const cartTotal = Math.max(0, cartSubtotal + deliveryPrice - discount);

  const haptic = () => getTelegram()?.HapticFeedback?.impactOccurred("light");

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedSize(product.sizes[0] || "");
    setSelectedColor(product.colors[0] || "");
    haptic();
  };

  const addToCart = (product: Product, size = product.sizes[0] || "", color = product.colors[0] || "") => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id && item.size === size && item.color === color);
      if (existing) return current.map((item) => item.product.id === product.id && item.size === size && item.color === color ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, size, color, quantity: 1 }];
    });
    haptic();
  };

  const changeQuantity = (index: number, amount: number) => {
    setCart((current) => current.map((item, i) => i === index ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  };

  const toggleWishlist = (productId: number) => {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
    haptic();
  };

  const requestLocation = () => {
    if (!navigator.geolocation) return alert("Telefoningiz lokatsiyani qo‘llab-quvvatlamaydi.");
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddress((current) => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // The existing UI below remains intact; only its product source is now API-backed.
  const renderProductCard = (product: Product) => (
    <article className="productCard" key={product.id}>
      <button className="productImageWrap" onClick={() => openProduct(product)} aria-label={product.name}>
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.discount ? <span className="discountBadge">-{product.discount}%</span> : null}
        <button className="heartButton" onClick={(event) => { event.stopPropagation(); toggleWishlist(product.id); }} aria-label="Sevimlilarga qo‘shish">{wishlist.includes(product.id) ? "♥" : "♡"}</button>
      </button>
      <div className="productInfo">
        <span>{product.category}</span>
        <h3>{product.name}</h3>
        <div className="smallRating">★ {product.rating.toFixed(1)} <span>({product.reviews})</span></div>
        <div className="cardBottom"><div><strong>{formatPrice(product.price)}</strong>{product.oldPrice ? <del>{formatPrice(product.oldPrice)}</del> : null}</div><button className="addButton" onClick={() => addToCart(product)}>+</button></div>
      </div>
    </article>
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")}><span className="brandIcon">🌷</span><span><b>GULI</b><small>LINGERIE</small></span></button>
        <div className="headerActions"><button className="iconButton" onClick={() => setPage("wishlist")}>♡<span className="badge">{wishlist.length}</span></button><button className="iconButton" onClick={() => setPage("cart")}>🛍️<span className="badge">{cartCount}</span></button></div>
      </header>

      {page === "home" && (
        <>
          <section className="hero"><div className="heroOverlay"><span>PREMIUM COLLECTION</span><h1>Go‘zallik sizdan boshlanadi.</h1><p>Nafislik, qulaylik va o‘zingizga bo‘lgan ishonch.</p><button className="heroButton" onClick={() => setPage("catalog")}>Kolleksiyani ko‘rish →</button></div></section>
          <section className="section"><div className="sectionTitle"><h2>Kategoriyalar</h2><button onClick={() => setPage("catalog")}>Barchasi</button></div><div className="categoryScroll">{CATEGORIES.slice(1).map((category) => <button className="categoryCard" key={category.name} onClick={() => { setSelectedCategory(category.name); setPage("catalog"); }}><span>{category.icon}</span><b>{category.name}</b></button>)}</div></section>
          <section className="section"><div className="sectionTitle"><h2>Tanlanganlar</h2><button onClick={() => setPage("catalog")}>Barchasi</button></div>{productsLoading ? <div className="empty"><div>⏳</div><p>Mahsulotlar yuklanmoqda...</p></div> : productsError ? <div className="empty"><div>⚠️</div><h3>Catalog vaqtincha ochilmadi</h3><p>{productsError}</p></div> : <div className="productGrid">{products.filter((p) => p.featured).slice(0, 4).map(renderProductCard)}</div>}</section>
          <div className="deliveryBanner"><div><span>🚚</span><div><b>300 000 so‘mdan yuqori buyurtma — bepul yetkazib berish</b><p>O‘zbekiston bo‘ylab qulay yetkazib berish.</p></div></div></div>
        </>
      )}

      {page === "catalog" && <main className="page"><div className="pageHeader"><span>GULI LINGERIE</span><h1>Katalog</h1></div><div className="searchBox">🔎<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot qidirish..." /></div><div className="categoryTabs">{CATEGORIES.map((category) => <button key={category.name} className={`tab ${selectedCategory === category.name ? "active" : ""}`} onClick={() => setSelectedCategory(category.name)}>{category.name}</button>)}</div>{productsLoading ? <div className="empty"><div>⏳</div><p>Mahsulotlar yuklanmoqda...</p></div> : productsError ? <div className="empty"><div>⚠️</div><h3>Yuklashda xatolik</h3><p>{productsError}</p></div> : filteredProducts.length ? <div className="productGrid">{filteredProducts.map(renderProductCard)}</div> : <div className="empty"><div>🔎</div><h3>Mahsulot topilmadi</h3><p>Boshqa qidiruv yoki kategoriya tanlang.</p></div>}</main>}

      {selectedProduct && <div className="productDetail"><button className="backButton" onClick={() => setSelectedProduct(null)}>← Orqaga</button><div className="detailImageWrap"><img className="detailImage" src={selectedProduct.image} alt={selectedProduct.name} /><button className="detailHeart" onClick={() => toggleWishlist(selectedProduct.id)}>{wishlist.includes(selectedProduct.id) ? "♥" : "♡"}</button></div><div className="detailContent"><span className="categoryLabel">{selectedProduct.category}</span><h1>{selectedProduct.name}</h1><div className="rating">★ {selectedProduct.rating.toFixed(1)} <span>({selectedProduct.reviews} sharh)</span></div><div className="priceRow"><strong>{formatPrice(selectedProduct.price)}</strong>{selectedProduct.oldPrice ? <del>{formatPrice(selectedProduct.oldPrice)}</del> : null}</div><p className="description">{selectedProduct.description}</p><h3>O‘lcham</h3><div className="options">{selectedProduct.sizes.map((size) => <button key={size} className={`option ${selectedSize === size ? "active" : ""}`} onClick={() => setSelectedSize(size)}>{size}</button>)}</div><h3>Rang</h3><div className="options">{selectedProduct.colors.map((color) => <button key={color} className={`option ${selectedColor === color ? "active" : ""}`} onClick={() => setSelectedColor(color)}>{color}</button>)}</div><div className="stock">{selectedProduct.stock > 0 ? `✓ Mavjud: ${selectedProduct.stock} dona` : "Hozircha mavjud emas"}</div><button className="primaryButton large" disabled={selectedProduct.stock <= 0} onClick={() => { addToCart(selectedProduct, selectedSize, selectedColor); setSelectedProduct(null); }}>Savatga qo‘shish — {formatPrice(selectedProduct.price)}</button></div></div>}

      {page === "cart" && <main className="page"><div className="pageHeader"><span>BUYURTMA</span><h1>Savat</h1></div>{cart.length === 0 ? <div className="empty"><div>🛍️</div><h3>Savat bo‘sh</h3><p>Mahsulot tanlang va xaridni boshlang.</p><button className="primaryButton" onClick={() => setPage("catalog")}>Katalogga o‘tish</button></div> : <><div className="cartList">{cart.map((item, index) => <div className="cartItem" key={`${item.product.id}-${item.size}-${item.color}-${index}`}><img src={item.product.image} alt={item.product.name} /><div className="cartInfo"><b>{item.product.name}</b><small>{item.size} · {item.color}</small><strong>{formatPrice(item.product.price * item.quantity)}</strong><div className="quantity"><button onClick={() => changeQuantity(index, -1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(index, 1)}>+</button></div></div></div>)}</div><div className="promoBox"><input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo kod" /><button onClick={() => setPromoApplied(Boolean(promo.trim()))}>{promoApplied ? "✓" : "Qo‘llash"}</button></div><div className="summary"><div><span>Mahsulotlar</span><b>{formatPrice(cartSubtotal)}</b></div><div><span>Yetkazib berish</span><b>{deliveryPrice ? formatPrice(deliveryPrice) : "Bepul"}</b></div>{discount > 0 ? <div className="discountLine"><span>Chegirma</span><b>−{formatPrice(discount)}</b></div> : null}<hr /><div className="total"><span>Jami</span><b>{formatPrice(cartTotal)}</b></div></div><button className="primaryButton large" onClick={() => setPage("checkout")}>Buyurtma berish</button></>}</main>}

      {page === "checkout" && <main className="page"><div className="pageHeader"><span>CHECKOUT</span><h1>Buyurtmani rasmiylashtirish</h1></div><div className="checkoutCard"><h3>Telefon raqami</h3><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" type="tel" /></div><div className="checkoutCard"><h3>Manzil</h3><button className="locationButton" onClick={requestLocation}>{locationLoading ? "Aniqlanmoqda..." : "📍 Joylashuvimni aniqlash"}</button>{address.latitude ? <div className="locationSuccess"><b>✓ Joylashuv aniqlandi</b><small>{address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}</small></div> : null}<div className="twoInputs"><input className="input" value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} placeholder="Tuman" /><input className="input" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} placeholder="Ko‘cha" /></div><div className="twoInputs"><input className="input" value={address.house} onChange={(e) => setAddress({ ...address, house: e.target.value })} placeholder="Uy" /><input className="input" value={address.apartment} onChange={(e) => setAddress({ ...address, apartment: e.target.value })} placeholder="Xonadon" /></div></div><div className="checkoutCard"><h3>To‘lov usuli</h3><label className="paymentOption"><input type="radio" checked={payment === "cash"} onChange={() => setPayment("cash")} />💵 <span><b>Naqd</b><small>Yetkazib berishda</small></span></label><label className="paymentOption"><input type="radio" checked={payment === "card"} onChange={() => setPayment("card")} />💳 <span><b>Karta</b><small>To‘lov usuli</small></span></label></div><button className="primaryButton large" disabled={!phone.trim() || cart.length === 0} onClick={async () => { const orderNumber = `GULI-${Date.now()}`; const payload = { order_number: orderNumber, telegram_id: telegramUser?.id, username: telegramUser?.username, first_name: telegramUser?.first_name, phone, items: cart, subtotal: cartSubtotal, delivery: deliveryPrice, discount, total: cartTotal, address, payment, status: "Qabul qilindi" }; try { const response = await fetch(`${API_URL}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error("Buyurtma serverga yuborilmadi"); const result = await response.json(); if (!result.success) throw new Error(result.message || "Buyurtma xatosi"); setOrders((current) => [...current, { id: result.data?.id || orderNumber, items: cart, subtotal: cartSubtotal, delivery: deliveryPrice, discount, total: cartTotal, address, phone, payment, status: "Qabul qilindi", createdAt: new Date().toISOString() }]); setCart([]); setPage("orders"); getTelegram()?.HapticFeedback?.notificationOccurred("success"); } catch (error) { alert(error instanceof Error ? error.message : "Buyurtmani yuborishda xatolik"); } }}>Buyurtmani tasdiqlash — {formatPrice(cartTotal)}</button></main>}

      {page === "wishlist" && <main className="page"><div className="pageHeader"><span>GULI LINGERIE</span><h1>Sevimlilar</h1></div>{wishlist.length ? <div className="productGrid">{products.filter((p) => wishlist.includes(p.id)).map(renderProductCard)}</div> : <div className="empty"><div>♡</div><h3>Sevimlilar bo‘sh</h3><p>Yoqtirgan mahsulotlaringizni shu yerda saqlang.</p></div>}</main>}

      {page === "orders" && <main className="page"><div className="pageHeader"><span>BUYURTMALAR</span><h1>Mening buyurtmalarim</h1></div>{orders.length ? <div className="cartList">{orders.slice().reverse().map((order) => <div className="checkoutCard" key={order.id}><h3>№ {order.id}</h3><p>{new Date(order.createdAt).toLocaleString("uz-UZ")}</p><p>Status: <b>{order.status}</b></p><strong>{formatPrice(order.total)}</strong></div>)}</div> : <div className="empty"><div>📦</div><h3>Buyurtmalar yo‘q</h3><p>Buyurtma berganingizdan keyin shu yerda ko‘rinadi.</p></div>}</main>}

      {page === "profile" && <main className="page"><div className="profileHeader"><div>👤</div><h1>{telegramUser?.first_name || "GULI mijozi"}</h1><p>{telegramUser?.username ? `@${telegramUser.username}` : "Telegram orqali xarid qiling"}</p></div><div className="profileMenu"><button onClick={() => setPage("orders")}><span>📦</span><span><b>Buyurtmalarim</b><small>Buyurtma tarixini ko‘rish</small></span><span>›</span></button><button onClick={() => setPage("wishlist")}><span>♡</span><span><b>Sevimlilar</b><small>Saqlangan mahsulotlar</small></span><span>›</span></button></div></main>}

      <nav className="bottomNav"><button className={`navItem ${page === "home" ? "active" : ""}`} onClick={() => { setSelectedProduct(null); setPage("home"); }}><span className="navIcon">⌂</span>Asosiy</button><button className={`navItem ${page === "catalog" ? "active" : ""}`} onClick={() => { setSelectedProduct(null); setPage("catalog"); }}><span className="navIcon">⌕</span>Katalog</button><button className={`navItem ${page === "wishlist" ? "active" : ""}`} onClick={() => { setSelectedProduct(null); setPage("wishlist"); }}><span className="navIcon">♡</span>Sevimli</button><button className={`navItem ${page === "cart" || page === "checkout" ? "active" : ""}`} onClick={() => { setSelectedProduct(null); setPage("cart"); }}><span className="navIcon">🛍️</span>Savat</button><button className={`navItem ${page === "profile" || page === "orders" ? "active" : ""}`} onClick={() => { setSelectedProduct(null); setPage("profile"); }}><span className="navIcon">◉</span>Profil</button></nav>
    </div>
  );
}
