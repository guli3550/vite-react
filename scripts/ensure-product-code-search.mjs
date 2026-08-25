import { readFileSync, writeFileSync } from "node:fs";

function patch(path, replacements) {
  let text = readFileSync(path, "utf8");
  for (const [from, to] of replacements) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) throw new Error(`Product-code patch target not found: ${path}`);
    text = text.replace(from, to);
  }
  writeFileSync(path, text);
}

patch("src/admin/AdminPro.tsx", [
  [
    'const productsFiltered=useMemo(()=>products.filter(p=>`${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())),[products,query]);',
    'const productsFiltered=useMemo(()=>products.filter(p=>`${p.product_code||""} ${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())),[products,query]);'
  ],
  [
    'const ordersFiltered=useMemo(()=>orders.filter(o=>(statusFilter==="all"||o.status===statusFilter)&&`${o.order_number||o.id} ${o.first_name||""} ${o.username||""} ${o.phone||""}`.toLowerCase().includes(query.toLowerCase())),[orders,statusFilter,query]);',
    'const ordersFiltered=useMemo(()=>orders.filter(o=>{const codes=(o.items||[]).map((it:any)=>it?.product?.product_code||it?.product_code||"").join(" ");return (statusFilter==="all"||o.status===statusFilter)&&`${codes} ${o.order_number||o.id} ${o.first_name||""} ${o.username||""} ${o.phone||""}`.toLowerCase().includes(query.toLowerCase())}),[orders,statusFilter,query]);'
  ],
  [
    '<div className="entityCell"><img src={p.image||"https://placehold.co/72x72/f6e8eb/b95a70?text=G"}/><div><b>{p.name}</b><small>ID {p.id}</small></div></div>',
    '<div className="entityCell"><img src={p.image||"https://placehold.co/72x72/f6e8eb/b95a70?text=G"}/><div><b>{p.name}</b><small>{p.product_code?`GULI-${p.product_code}`:"Kod yo‘q"}</small><small>ID {p.id}</small></div></div>'
  ],
  [
    '<th>№</th><th>Mijoz</th><th>Mahsulot</th><th>Jami</th><th>To‘lov</th><th>Status</th><th>Sana</th>',
    '<th>Kod</th><th>№</th><th>Mijoz</th><th>Mahsulot</th><th>Jami</th><th>To‘lov</th><th>Status</th><th>Sana</th>'
  ],
  [
    '<td><b>{o.order_number||o.id}</b></td><td><b>{o.first_name||"Mijoz"}</b>',
    '<td><b>{o.items?.[0]?.product?.product_code||o.items?.[0]?.product_code||"—"}</b></td><td><b>{o.order_number||o.id}</b></td><td><b>{o.first_name||"Mijoz"}</b>'
  ],
  [
    '<td>{o.items?.[0]?.product?.name||"Buyurtma"}{o.items?.length>1?` +${o.items.length-1}`:""}</td>',
    '<td>{o.items?.[0]?.product?.name||"Buyurtma"}{o.items?.[0]?.product?.product_code?` · ${o.items[0].product.product_code}`:""}{o.items?.length>1?` +${o.items.length-1}`:""}</td>'
  ],
  [
    '<div className="lineItem" key={i}>{it.product?.image&&<img src={it.product.image} alt=""/>}<div><b>{it.product?.name||"Mahsulot"}</b><small>{it.size||"—"} · {it.color||"—"} · {it.quantity||1} dona</small></div><strong>{money(Number(it.product?.price||0)*Number(it.quantity||1))}</strong></div>',
    '<div className="lineItem" key={i}>{it.product?.image&&<img src={it.product.image} alt=""/>}<div><b>{it.product?.name||"Mahsulot"}</b><small>{it.product?.product_code?`Kod: ${it.product.product_code} · `:""}{it.size||"—"} · {it.color||"—"} · {it.quantity||1} dona</small></div><strong>{money(Number(it.product?.price||0)*Number(it.quantity||1))}</strong></div>'
  ]
]);

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
  ],
  [
    '<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot qidirish..." />',
    '<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot nomi, kategoriya yoki 6 xonali kod..." />'
  ],
  [
    '<div className="productBody"><span>{p.category}</span><h3>{p.name}</h3>',
    '<div className="productBody"><span>{p.category}</span><h3>{p.name}</h3>{p.product_code ? <small>Kod: {p.product_code}</small> : null}'
  ]
]);
