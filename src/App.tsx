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
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy") => void;
          notificationOccurred: (
            type: "error" | "success" | "warning"
          ) => void;
        };
        showPopup?: (
          params: {
            title?: string;
            message: string;
            buttons?: Array<{
              id: string;
              type?: string;
              text: string;
            }>;
          },
          callback?: (buttonId: string) => void
        ) => void;
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

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Premium Lace Komplekt",
    category: "Komplektlar",
    price: 129000,
    oldPrice: 179000,
    discount: 28,
    image:
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85",
    description:
      "Yumshoq va nafis materialdan tayyorlangan premium ichki kiyim komplekti.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Qora", "Oq", "Qizil"],
    rating: 4.9,
    reviews: 128,
    stock: 18,
    featured: true,
  },
  {
    id: 2,
    name: "Elegant Lace Bra",
    category: "Byustgalter",
    price: 99000,
    oldPrice: 139000,
    discount: 29,
    image:
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85",
    description:
      "Kundalik foydalanish uchun qulay va nafis dizayndagi byustgalter.",
    sizes: ["70B", "75B", "80B", "85B"],
    colors: ["Qora", "Bej", "Oq"],
    rating: 4.8,
    reviews: 86,
    stock: 25,
    featured: true,
  },
  {
    id: 3,
    name: "Classic Premium Panty",
    category: "Trusik",
    price: 49000,
    oldPrice: 69000,
    discount: 29,
    image:
      "https://images.unsplash.com/photo-1583743814966-8936f37f3841?auto=format&fit=crop&w=900&q=85",
    description:
      "Yengil va qulay materialdan tayyorlangan premium model.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Qora", "Oq", "Pushti"],
    rating: 4.7,
    reviews: 54,
    stock: 32,
  },
  {
    id: 4,
    name: "Silk Home Set",
    category: "Uy kiyimlari",
    price: 189000,
    oldPrice: 249000,
    discount: 24,
    image:
      "https://images.unsplash.com/photo-1571513722275-4b41940f54b8?auto=format&fit=crop&w=900&q=85",
    description:
      "Uyda foydalanish uchun yengil, qulay va chiroyli komplekt.",
    sizes: ["S", "M", "L"],
    colors: ["Qora", "Pushti"],
    rating: 4.9,
    reviews: 91,
    stock: 14,
    featured: true,
  },
  {
    id: 5,
    name: "Soft Comfort Set",
    category: "Komplektlar",
    price: 149000,
    oldPrice: 199000,
    discount: 25,
    image:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
    description: "Yumshoq material va minimalist dizayn.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Oq", "Qora"],
    rating: 4.8,
    reviews: 42,
    stock: 21,
  },
  {
    id: 6,
    name: "Luxury Red Collection",
    category: "Sexy lingerie",
    price: 219000,
    oldPrice: 289000,
    discount: 24,
    image:
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85",
    description: "Maxsus kunlar uchun premium kolleksiya.",
    sizes: ["S", "M", "L"],
    colors: ["Qizil", "Qora"],
    rating: 5,
    reviews: 37,
    stock: 9,
    featured: true,
  },
];

const CATEGORIES = [
  { name: "Barchasi", icon: "✨" },
  { name: "Byustgalter", icon: "👙" },
  { name: "Trusik", icon: "🩲" },
  { name: "Komplektlar", icon: "🎀" },
  { name: "Uy kiyimlari", icon: "🌙" },
  { name: "Sexy lingerie", icon: "🔥" },
];

const formatPrice = (value: number) =>
  `${value.toLocaleString("uz-UZ")} so'm`;

const getTelegram = () => window.Telegram?.WebApp;

export default function App() {
  const [page, setPage] = useState<
    "home" | "catalog" | "wishlist" | "cart" | "profile" | "checkout" | "orders"
  >("home");

  const [products] = useState<Product[]>(PRODUCTS);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("wishlist") || "[]");
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("orders") || "[]");
    } catch {
      return [];
    }
  });

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState("cash");

  const [address, setAddress] = useState<Address>({});
  const [locationLoading, setLocationLoading] = useState(false);

  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const telegramUser = getTelegram()?.initDataUnsafe?.user;

  useEffect(() => {
    const tg = getTelegram();

    if (tg) {
      tg.ready();
      tg.expand();
    }
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

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch =
        selectedCategory === "Barchasi" ||
        product.category === selectedCategory;

      const searchMatch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase());

      return categoryMatch && searchMatch;
    });
  }, [products, selectedCategory, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const deliveryPrice = cartSubtotal >= 300000 ? 0 : 20000;

  const discount = promoApplied ? Math.round(cartSubtotal * 0.1) : 0;

  const cartTotal = Math.max(
    0,
    cartSubtotal + deliveryPrice - discount
  );

  const haptic = () => {
    getTelegram()?.HapticFeedback?.impactOccurred("light");
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedSize(product.sizes[0]);
    setSelectedColor(product.colors[0]);
    haptic();
  };

  const addToCart = (
    product: Product,
    size = product.sizes[0],
    color = product.colors[0]
  ) => {
    setCart((current) => {
      const existing = current.find(
        (item) =>
          item.product.id === product.id &&
          item.size === size &&
          item.color === color
      );

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id &&
          item.size === size &&
          item.color === color
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          product,
          size,
          color,
          quantity: 1,
        },
      ];
    });

    haptic();
  };

  const changeQuantity = (index: number, amount: number) => {
    setCart((current) =>
      current
        .map((item, i) =>
          i === index
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const toggleWishlist = (productId: number) => {
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );

    haptic();
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      alert("Telefoningiz lokatsiyani qo‘llab-quvvatlamaydi.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddress((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));

        setLocationLoading(false);
        getTelegram()?.HapticFeedback?.notificationOccurred("success");
      },
      () => {
        setLocationLoading(false);
        alert(
          "Lokatsiyani olishga ruxsat berilmadi. Telefon sozlamalaridan Location ruxsatini yoqing."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === "WELCOME10") {
      setPromoApplied(true);
      alert("🎉 Promo kod qabul qilindi! 10% chegirma.");
    } else {
      setPromoApplied(false);
      alert("❌ Promo kod noto‘g‘ri yoki mavjud emas.");
    }
  };

  const createOrder = () => {
    if (cart.length === 0) {
      alert("Savatchangiz bo‘sh.");
      return;
    }

    if (!phone.trim()) {
      alert("Telefon raqamingizni kiriting.");
      return;
    }

    if (!address.latitude || !address.longitude) {
      alert("Yetkazib berish lokatsiyasini yuboring.");
      return;
    }

    const order: Order = {
      id: `GULI-${Date.now().toString().slice(-8)}`,
      items: cart,
      subtotal: cartSubtotal,
      delivery: deliveryPrice,
      discount,
      total: cartTotal,
      address,
      phone,
      payment,
      status: "Qabul qilindi",
      createdAt: new Date().toLocaleString("uz-UZ"),
    };

    setOrders((current) => [order, ...current]);
    setCart([]);
    setPromo("");
    setPromoApplied(false);

    getTelegram()?.HapticFeedback?.notificationOccurred("success");

    alert(`✅ Buyurtma qabul qilindi!\n\n№ ${order.id}`);

    setPage("orders");
  };

  const openCatalog = (category = "Barchasi") => {
    setSelectedCategory(category);
    setSearch("");
    setPage("catalog");
  };

  const userName =
    telegramUser?.first_name ||
    telegramUser?.username ||
    "Mehmon";

  return (
    <div className="app">
      {/* HEADER */}

      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setPage("home");
            setSelectedProduct(null);
          }}
        >
          <span className="brandIcon">♡</span>
          <span>
            <b>GULI</b>
            <small>LINGERIE</small>
          </span>
        </button>

        <div className="headerActions">
          <button
            className="iconButton"
            onClick={() => setPage("catalog")}
          >
            🔎
          </button>

          <button
            className="iconButton cartButton"
            onClick={() => setPage("cart")}
          >
            🛒
            {cartCount > 0 && (
              <span className="badge">{cartCount}</span>
            )}
          </button>
        </div>
      </header>

      {/* PRODUCT DETAIL */}

      {selectedProduct && (
        <div className="productDetail">
          <button
            className="backButton"
            onClick={() => setSelectedProduct(null)}
          >
            ← Orqaga
          </button>

          <div className="detailImageWrap">
            <img
              src={selectedProduct.image}
              alt={selectedProduct.name}
              className="detailImage"
            />

            {selectedProduct.discount && (
              <span className="discountBadge">
                -{selectedProduct.discount}%
              </span>
            )}

            <button
              className="detailHeart"
              onClick={() => toggleWishlist(selectedProduct.id)}
            >
              {wishlist.includes(selectedProduct.id) ? "♥" : "♡"}
            </button>
          </div>

          <div className="detailContent">
            <span className="categoryLabel">
              {selectedProduct.category}
            </span>

            <h1>{selectedProduct.name}</h1>

            <div className="rating">
              ⭐ {selectedProduct.rating}{" "}
              <span>({selectedProduct.reviews} ta sharh)</span>
            </div>

            <div className="priceRow">
              <strong>{formatPrice(selectedProduct.price)}</strong>

              {selectedProduct.oldPrice && (
                <del>{formatPrice(selectedProduct.oldPrice)}</del>
              )}
            </div>

            <p className="description">
              {selectedProduct.description}
            </p>

            <h3>Razmer</h3>

            <div className="options">
              {selectedProduct.sizes.map((size) => (
                <button
                  key={size}
                  className={
                    selectedSize === size ? "option active" : "option"
                  }
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>

            <h3>Rang</h3>

            <div className="options">
              {selectedProduct.colors.map((color) => (
                <button
                  key={color}
                  className={
                    selectedColor === color ? "option active" : "option"
                  }
                  onClick={() => setSelectedColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>

            <div className="stock">
              📦 Omborda: <b>{selectedProduct.stock} dona</b>
            </div>

            <button
              className="primaryButton large"
              onClick={() => {
                addToCart(
                  selectedProduct,
                  selectedSize,
                  selectedColor
                );
                setSelectedProduct(null);
                setPage("cart");
              }}
            >
              🛒 SAVATGA QO‘SHISH
            </button>
          </div>
        </div>
      )}

      {/* HOME */}

      {!selectedProduct && page === "home" && (
        <main>
          <section className="hero">
            <div className="heroOverlay">
              <span>YANGI KOLLEKSIYA</span>

              <h1>
                Nafislik.
                <br />
                O‘zingiz uchun.
              </h1>

              <p>Premium lingerie kolleksiyasi</p>

              <button
                className="heroButton"
                onClick={() => openCatalog()}
              >
                🛍 KO‘RISH
              </button>
            </div>
          </section>

          <section className="section">
            <div className="sectionTitle">
              <h2>Kategoriyalar</h2>

              <button onClick={() => openCatalog()}>
                Barchasi →
              </button>
            </div>

            <div className="categoryScroll">
              {CATEGORIES.slice(1).map((category) => (
                <button
                  key={category.name}
                  className="categoryCard"
                  onClick={() => openCatalog(category.name)}
                >
                  <span>{category.icon}</span>
                  <b>{category.name}</b>
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="sectionTitle">
              <h2>🔥 Mashhur</h2>

              <button onClick={() => openCatalog()}>
                Barchasi →
              </button>
            </div>

            <div className="productGrid">
              {products
                .filter((product) => product.featured)
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    wishlist={wishlist}
                    onOpen={openProduct}
                    onWishlist={toggleWishlist}
                    onAdd={addToCart}
                  />
                ))}
            </div>
          </section>

          <section className="deliveryBanner">
            <div>
              <span>🚚</span>
              <div>
                <b>Yetkazib berish</b>
                <p>300 000 so‘mdan yuqori buyurtmaga bepul</p>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* CATALOG */}

      {!selectedProduct && page === "catalog" && (
        <main className="page">
          <div className="pageHeader">
            <div>
              <span>GULI LINGERIE</span>
              <h1>Katalog</h1>
            </div>
          </div>

          <div className="searchBox">
            🔎
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish..."
            />
            {search && (
              <button onClick={() => setSearch("")}>×</button>
            )}
          </div>

          <div className="categoryTabs">
            {CATEGORIES.map((category) => (
              <button
                key={category.name}
                className={
                  selectedCategory === category.name
                    ? "tab active"
                    : "tab"
                }
                onClick={() => setSelectedCategory(category.name)}
              >
                {category.icon} {category.name}
              </button>
            ))}
          </div>

          <div className="productGrid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                wishlist={wishlist}
                onOpen={openProduct}
                onWishlist={toggleWishlist}
                onAdd={addToCart}
              />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="empty">
              <div>🔍</div>
              <h3>Mahsulot topilmadi</h3>
              <p>Boshqa nom yoki kategoriyani sinab ko‘ring.</p>
                      </div>
      )}
    </main>
  )}

  {/* WISHLIST */}

  {!selectedProduct && page === "wishlist" && (
    <main className="page">
      <div className="pageHeader">
        <span>SAQLANGANLAR</span>
        <h1>❤️ Sevimlilar</h1>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty">
          <div>♡</div>
          <h3>Sevimli mahsulotlar yo‘q</h3>
          <p>Mahsulotlarni yurakcha orqali saqlang.</p>

          <button
            className="primaryButton"
            onClick={() => setPage("catalog")}
          >
            Katalogni ko‘rish
          </button>
        </div>
      ) : (
        <div className="productGrid">
          {products
            .filter((product) => wishlist.includes(product.id))
            .map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                wishlist={wishlist}
                onOpen={openProduct}
                onWishlist={toggleWishlist}
                onAdd={addToCart}
              />
            ))}
        </div>
      )}
    </main>
  )}

  {/* CART */}

  {!selectedProduct && page === "cart" && (
    <main className="page">
      <div className="pageHeader">
        <span>BUYURTMANGIZ</span>
        <h1>🛒 Savat</h1>
      </div>

      {cart.length === 0 ? (
        <div className="empty">
          <div>🛒</div>
          <h3>Savatingiz bo‘sh</h3>
          <p>Mahsulot tanlab savatga qo‘shing.</p>

          <button
            className="primaryButton"
            onClick={() => setPage("catalog")}
          >
            Xarid qilish
          </button>
        </div>
      ) : (
        <>
          <div className="cartList">
            {cart.map((item, index) => (
              <div
                className="cartItem"
                key={`${item.product.id}-${index}`}
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                />

                <div className="cartInfo">
                  <b>{item.product.name}</b>

                  <small>
                    {item.color} • {item.size}
                  </small>

                  <strong>
                    {formatPrice(item.product.price)}
                  </strong>

                  <div className="quantity">
                    <button
                      onClick={() => changeQuantity(index, -1)}
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() => changeQuantity(index, 1)}
                    >
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
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Promo kod"
            />

            <button onClick={applyPromo}>
              Qo‘llash
            </button>
          </div>

          <div className="summary">
            <div>
              <span>Mahsulotlar</span>
              <b>{formatPrice(cartSubtotal)}</b>
            </div>

            <div>
              <span>Dostavka</span>
              <b>
                {deliveryPrice === 0
                  ? "BEPUL"
                  : formatPrice(deliveryPrice)}
              </b>
            </div>

            {discount > 0 && (
              <div className="discountLine">
                <span>Chegirma</span>
                <b>−{formatPrice(discount)}</b>
              </div>
            )}

            <hr />

            <div className="total">
              <span>Jami</span>
              <b>{formatPrice(cartTotal)}</b>
            </div>
          </div>

          <button
            className="primaryButton large"
            onClick={() => setPage("checkout")}
          >
            BUYURTMA BERISH →
          </button>
        </>
      )}
    </main>
  )}

  {/* CHECKOUT */}

  {!selectedProduct && page === "checkout" && (
    <main className="page">
      <div className="pageHeader">
        <span>BUYURTMANI RASMIYLASHTIRISH</span>
        <h1>📦 Checkout</h1>
      </div>

      <section className="checkoutCard">
        <h3>👤 Aloqa</h3>

        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998 90 123 45 67"
          type="tel"
        />
      </section>

      <section className="checkoutCard">
        <h3>📍 Yetkazib berish manzili</h3>

        <button
          className="locationButton"
          onClick={requestLocation}
          disabled={locationLoading}
        >
          {locationLoading
            ? "📍 Aniqlanmoqda..."
            : address.latitude
            ? "✅ Lokatsiya olindi"
            : "📍 LOKATSIYAMNI YUBORISH"}
        </button>

        {address.latitude && (
          <div className="locationSuccess">
            <b>📍 Manzil saqlandi</b>
            <small>
              {address.latitude.toFixed(6)},{" "}
              {address.longitude?.toFixed(6)}
            </small>
          </div>
        )}

        <input
          className="input"
          placeholder="Viloyat"
          value={address.region || ""}
          onChange={(e) =>
            setAddress({
              ...address,
              region: e.target.value,
            })
          }
        />

        <input
          className="input"
          placeholder="Tuman / shahar"
          value={address.district || ""}
          onChange={(e) =>
            setAddress({
              ...address,
              district: e.target.value,
            })
          }
        />

        <input
          className="input"
          placeholder="Ko‘cha"
          value={address.street || ""}
          onChange={(e) =>
            setAddress({
              ...address,
              street: e.target.value,
            })
          }
        />

        <div className="twoInputs">
          <input
            className="input"
            placeholder="Uy"
            value={address.house || ""}
            onChange={(e) =>
              setAddress({
                ...address,
                house: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="Kvartira"
            value={address.apartment || ""}
            onChange={(e) =>
              setAddress({
                ...address,
                apartment: e.target.value,
              })
            }
          />
        </div>

        <input
          className="input"
          placeholder="Mo‘ljal"
          value={address.landmark || ""}
          onChange={(e) =>
            setAddress({
              ...address,
              landmark: e.target.value,
            })
          }
        />
      </section>

      <section className="checkoutCard">
        <h3>💳 To‘lov usuli</h3>

        <label className="paymentOption">
          <input
            type="radio"
            checked={payment === "cash"}
            onChange={() => setPayment("cash")}
          />

          <span>💵</span>

          <div>
            <b>Yetkazib berishda</b>
            <small>Naqd yoki karta</small>
          </div>
        </label>

        <label className="paymentOption">
          <input
            type="radio"
            checked={payment === "online"}
            onChange={() => setPayment("online")}
          />

          <span>💳</span>

          <div>
            <b>Online to‘lov</b>
            <small>Click / Payme / boshqa provayder</small>
          </div>
        </label>
      </section>

      <div className="summary compact">
        <div>
          <span>Jami</span>
          <b>{formatPrice(cartTotal)}</b>
        </div>
      </div>

      <button
        className="primaryButton large"
        onClick={createOrder}
      >
        ✅ BUYURTMANI TASDIQLASH
      </button>
    </main>
  )}

  {/* ORDERS */}

  {!selectedProduct && page === "orders" && (
    <main className="page">
      <div className="pageHeader">
        <span>BUYURTMALAR TARIXI</span>
        <h1>📦 Buyurtmalarim</h1>
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <div>📦</div>
          <h3>Buyurtmalar yo‘q</h3>

          <button
            className="primaryButton"
            onClick={() => setPage("catalog")}
          >
            Xaridni boshlash
          </button>
        </div>
      ) : (
        <div className="orders">
          {orders.map((order) => (
            <div className="orderCard" key={order.id}>
              <div className="orderTop">
                <div>
                  <small>BUYURTMA</small>
                  <b>#{order.id}</b>
                </div>

                <span className="status">
                  🟢 {order.status}
                </span>
              </div>

              <div className="orderProducts">
                {order.items.slice(0, 3).map((item, index) => (
                  <img
                    key={index}
                    src={item.product.image}
                    alt={item.product.name}
                  />
                ))}
              </div>

              <div className="orderBottom">
                <span>{order.createdAt}</span>
                <strong>{formatPrice(order.total)}</strong>
              </div>

              <div className="tracking">
                <div className="track active">
                  <span>✓</span>
                  <small>Qabul qilindi</small>
                </div>

                <div className="track">
                  <span>2</span>
                  <small>Tayyorlanmoqda</small>
                </div>

                <div className="track">
                  <span>3</span>
                  <small>Kuryerda</small>
                </div>

                <div className="track">
                  <span>4</span>
                  <small>Yetkazildi</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )}

  {/* PROFILE */}

  {!selectedProduct && page === "profile" && (
    <main className="page">
      <div className="profileHeader">
        {telegramUser?.photo_url ? (
          <img
            src={telegramUser.photo_url}
            alt="profile"
            className="avatar"
          />
        ) : (
          <div className="avatar placeholder">
            👤
          </div>
        )}

        <h1>{userName}</h1>

        {telegramUser?.username && (
          <p>@{telegramUser.username}</p>
        )}
      </div>

      <div className="profileMenu">
        <button onClick={() => setPage("orders")}>
          <span>📦</span>

          <div>
            <b>Mening buyurtmalarim</b>
            <small>{orders.length} ta buyurtma</small>
          </div>

          <span>›</span>
        </button>

        <button onClick={() => setPage("wishlist")}>
          <span>❤️</span>

          <div>
            <b>Sevimlilar</b>
            <small>{wishlist.length} ta mahsulot</small>
          </div>

          <span>›</span>
        </button>

        <button onClick={() => setPage("checkout")}>
          <span>📍</span>

          <div>
            <b>Yetkazib berish</b>
            <small>Manzilni boshqarish</small>
          </div>

          <span>›</span>
        </button>

        <button
          onClick={() =>
            alert(
              "Yordam uchun Telegram operatorimizga murojaat qiling."
            )
          }
        >
          <span>💬</span>

          <div>
            <b>Yordam</b>
            <small>Operator bilan bog‘lanish</small>
          </div>

          <span>›</span>
        </button>
      </div>
    </main>
  )}

  {/* BOTTOM NAV */}

  {!selectedProduct && (
    <nav className="bottomNav">
      <NavButton
        icon="⌂"
        label="Bosh sahifa"
        active={page === "home"}
        onClick={() => setPage("home")}
      />

      <NavButton
        icon="🛍"
        label="Katalog"
        active={page === "catalog"}
        onClick={() => setPage("catalog")}
      />

      <NavButton
        icon="♡"
        label="Sevimli"
        active={page === "wishlist"}
        onClick={() => setPage("wishlist")}
        badge={wishlist.length}
      />

      <NavButton
        icon="🛒"
        label="Savat"
        active={page === "cart"}
        onClick={() => setPage("cart")}
        badge={cartCount}
      />

      <NavButton
        icon="♙"
        label="Profil"
        active={page === "profile"}
        onClick={() => setPage("profile")}
      />
    </nav>
  )}
</div>
);
}

function ProductCard({
product,
wishlist,
onOpen,
onWishlist,
onAdd,
}: {
product: Product;
wishlist: number[];
onOpen: (product: Product) => void;
onWishlist: (id: number) => void;
onAdd: (product: Product) => void;
}) {
return (
<article className="productCard">
  <div className="productImageWrap">
    <img
      src={product.image}
      alt={product.name}
      onClick={() => onOpen(product)}
    />

    {product.discount && (
      <span className="discountBadge">
        -{product.discount}%
      </span>
    )}

    <button
      className="heartButton"
      onClick={() => onWishlist(product.id)}
    >
      {wishlist.includes(product.id) ? "♥" : "♡"}
    </button>
  </div>

  <div className="productInfo">
    <span>{product.category}</span>

    <h3 onClick={() => onOpen(product)}>
      {product.name}
    </h3>

    <div className="smallRating">
      ⭐ {product.rating} ({product.reviews})
    </div>

    <div className="cardBottom">
      <div>
        <strong>{formatPrice(product.price)}</strong>

        {product.oldPrice && (
          <del>{formatPrice(product.oldPrice)}</del>
        )}
      </div>

      <button
        className="addButton"
        onClick={() => onAdd(product)}
      >
        +
      </button>
    </div>
  </div>
</article>
);
}

function NavButton({
icon,
label,
active,
onClick,
badge,
}: {
icon: string;
label: string;
active: boolean;
onClick: () => void;
badge?: number;
}) {
return (
<button
  className={active ? "navItem active" : "navItem"}
  onClick={onClick}
>
  <span className="navIcon">
    {icon}

    {!!badge && badge > 0 && (
      <small className="navBadge">
        {badge}
      </small>
    )}
  </span>

  <span>{label}</span>
</button>
);
          }
