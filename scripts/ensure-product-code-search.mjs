import { readFileSync, writeFileSync } from "node:fs";

function patch(path, replacements) {
  let text = readFileSync(path, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) {
      console.log(`Product-code patch skipped: ${path}`);
      continue;
    }
    text = text.replace(from, to);
    changed = true;
  }
  if (changed) writeFileSync(path, text);
}

patch("src/App.tsx", [
  [
    'const [cart, setCart] = useState<CartItem[]>(() => readStorage("cart", [])); const [wishlist, setWishlist] = useState<number[]>(() => readStorage("wishlist", [])); const [orders, setOrders] = useState<Order[]>(() => readStorage("orders", [])); const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);',
    'const [cart, setCart] = useState<CartItem[]>(() => readStorage("cart", [])); const [wishlist, setWishlist] = useState<number[]>(() => readStorage("wishlist", [])); const [orders, setOrders] = useState<Order[]>(() => readStorage("orders", [])); const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null); const [orderSearch, setOrderSearch] = useState("");'
  ],
  [
    'const filtered = useMemo(() => products.filter((p) => (selectedCategory === "Barchasi" || p.category === selectedCategory) && (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()) || p.category.toLowerCase().includes(search.trim().toLowerCase()))), [products, selectedCategory, search]);',
    'const filtered = useMemo(() => products.filter((p) => (selectedCategory === "Barchasi" || p.category === selectedCategory) && (!search.trim() || p.product_code?.includes(search.trim()) || p.name.toLowerCase().includes(search.trim().toLowerCase()) || p.category.toLowerCase().includes(search.trim().toLowerCase()))), [products, selectedCategory, search]);'
  ],
  [
    '<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot qidirish..." />',
    '<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot nomi, kategoriya yoki 6 xonali kod..." />'
  ],
  [
    '<div className="productBody"><span>{p.category}</span><h3>{p.name}</h3><div className="priceLine">',
    '<div className="productBody"><span>{p.category}</span><h3>{p.name}</h3>{p.product_code ? <small>Kod: {p.product_code}</small> : null}<div className="priceLine">'
  ],
  [
    '<p>Buyurtma holati va tafsilotlarini shu yerda ko‘ring.</p></div>{ordersLoading ?',
    '<p>Buyurtma holati va tafsilotlarini shu yerda ko‘ring.</p><div className="searchBox">⌕<input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="6 xonali mahsulot kodi yoki buyurtma №" /></div></div>{ordersLoading ?'
  ],
  [
    '{orders.map((o) => <article className={`orderCard ${selectedOrderId === o.id ? "expanded" : ""}`} key={o.id}>',
    '{orders.filter((o) => { const q = orderSearch.trim().toLowerCase(); if (!q) return true; const codes = (o.items || []).map((it) => it?.product?.product_code || it?.product_code || "").join(" ").toLowerCase(); return codes.includes(q) || String(o.id).toLowerCase().includes(q); }).map((o) => <article className={`orderCard ${selectedOrderId === o.id ? "expanded" : ""}`} key={o.id}>'
  ],
  [
    '<div className="orderTop"><b>№ {o.id}</b><span>{formatDate(o.createdAt)}</span></div>',
    '<div className="orderTop"><div><b>№ {o.id}</b>{o.items?.[0]?.product?.product_code ? <small>Kod: {o.items[0].product.product_code}</small> : null}</div><span>{formatDate(o.createdAt)}</span></div>'
  ],
  [
    '<div><h3>{o.items?.[0]?.product?.name || "Buyurtma"}</h3><p>{o.items?.length || 0} ta mahsulot · {o.payment === "card" ? "Karta" : "Naqd"}</p>',
    '<div><h3>{o.items?.[0]?.product?.name || "Buyurtma"}</h3><p>{o.items?.[0]?.product?.product_code ? `Kod: ${o.items[0].product.product_code} · ` : ""}{o.items?.length || 0} ta mahsulot · {o.payment === "card" ? "Karta" : "Naqd"}</p>'
  ],
  [
    '<div className="orderDetailGrid"><div><small>Telefon</small>',
    '<div className="orderDetailGrid"><div><small>Mahsulot kodi</small><b>{(o.items||[]).map((it) => it?.product?.product_code || it?.product_code).filter(Boolean).join(", ") || "—"}</b></div><div><small>Telefon</small>'
  ]
]);
