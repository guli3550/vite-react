from pathlib import Path
import re

# Backend: product code + six digit order number + code copied into order items.
p = Path('backend/index.js')
s = p.read_text()
if 'product_code: /^\\d{6}$/.test' not in s:
    s = s.replace(
        'sort_order: Number(body.sort_order) || 0, updated_at: new Date().toISOString() };',
        'sort_order: Number(body.sort_order) || 0, product_code: /^\\d{6}$/.test(String(body.product_code || "")) ? String(body.product_code) : "", updated_at: new Date().toISOString() };'
    )
helper = '''\nasync function generateSixDigitCode(table, column, prefix = "") {\n  for (let i = 0; i < 40; i++) {\n    const code = String(Math.floor(100000 + Math.random() * 900000));\n    const { data, error } = await supabase.from(table).select(column).eq(column, prefix + code).maybeSingle();\n    if (error && !/column|schema cache/i.test(error.message || "")) throw error;\n    if (!data) return prefix + code;\n  }\n  throw new Error("6 xonali kod yaratilmadi");\n}\nasync function ensureProductCode(payload) {\n  if (/^\\d{6}$/.test(String(payload.product_code || ""))) return payload.product_code;\n  return generateSixDigitCode("products", "product_code");\n}\n'''
if 'async function generateSixDigitCode' not in s:
    marker = 'app.get("/", (req, res) =>'
    s = s.replace(marker, helper + '\n' + marker)

# Admin POST/PUT product routes.
for marker, suffix in [
    ('app.post("/api/admin/products", requireAdmin, async (req, res) => {', 'await ensureProductCode(payload)'),
    ('app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {', 'await ensureProductCode(payload)')
]:
    if marker in s:
        start = s.index(marker); end = s.index('\n});', start) + 3; block = s[start:end]
        if 'ensureProductCode(payload)' not in block:
            block = block.replace('const payload = productPayload(req.body);', 'const payload = productPayload(req.body);\n    payload.product_code = await ensureProductCode(payload);')
            block = block.replace('const payload=productPayload(req.body);', 'const payload=productPayload(req.body);\n    payload.product_code = await ensureProductCode(payload);')
            s = s[:start] + block + s[end:]

# Orders: normalize to GULI-XXXXXX and append product code to order item product name.
marker = 'app.post("/api/orders", requireTelegramUser, async (req, res) => {'
if marker in s:
    start = s.index(marker); end = s.index('\n});', start) + 3; block = s[start:end]
    if 'sixDigitOrderNumber' not in block:
        needle = 'const { order_number, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at } = req.body;'
        add = needle + '''\n    const sixDigitOrderNumber = /^GULI-\\d{6}$/.test(String(order_number || "")) ? String(order_number) : `GULI-${await generateSixDigitCode("orders", "order_number")}`;\n    const normalizedItems = await Promise.all(items.map(async (item) => {\n      const raw = item?.product || {};\n      let code = raw.product_code || item?.product_code || "";\n      if (!/^\\d{6}$/.test(String(code)) && raw.id) {\n        const found = await supabase.from("products").select("product_code").eq("id", raw.id).maybeSingle();\n        code = found.data?.product_code || "";\n      }\n      const copy = { ...item, product_code: code || null };\n      if (copy.product) copy.product = { ...copy.product, product_code: code || null, name: code ? `${copy.product.name || "Mahsulot"} • GULI-${code}` : copy.product.name };\n      return copy;\n    }));'''
        if needle in block:
            block = block.replace(needle, add)
            block = block.replace('order_number: order_number || null,', 'order_number: sixDigitOrderNumber,')
            block = block.replace('items, subtotal: Number(subtotal) || 0,', 'items: normalizedItems, subtotal: Number(subtotal) || 0,')
            s = s[:start] + block + s[end:]
p.write_text(s)

# Admin product modal is moved into a dedicated component for easier mobile UI maintenance.
p = Path('src/admin/AdminPro.tsx')
s = p.read_text()
s = s.replace('import { FormEvent, useEffect, useMemo, useState } from "react";', 'import { FormEvent, useEffect, useMemo, useState } from "react";\nimport ProductModalV2 from "./ProductModalV2";')
s = s.replace('type Product={id?:number;name:string;', 'type Product={id?:number;product_code?:string;name:string;')
s = s.replace('const emptyProduct:Product={name:"",category:"Byustgalter"', 'const emptyProduct:Product={product_code:"",name:"",category:"Byustgalter"')
s = s.replace('sort_order:Number(product.sort_order||0)};', 'sort_order:Number(product.sort_order||0)||(!product.id?Math.max(0,...products.map(p=>Number(p.sort_order)||0))+1:0)};')
s = s.replace('<ProductModal value={product} busy={busy} onClose={()=>setProductOpen(false)} onChange={setProduct} onSave={saveProduct} onUpload={uploadImage}/>', '<ProductModalV2 value={product} busy={busy} onClose={()=>setProductOpen(false)} onChange={setProduct} onSave={saveProduct} onUpload={uploadImage}/>')
# Remove old embedded modal function so the imported component is the only one.
if 'function ProductModal(' in s:
    start = s.index('function ProductModal('); end = s.index('function PromoModal(', start); s = s[:start] + s[end:]
p.write_text(s)

# App: product codes and six digit GULI order numbers; date includes time.
p = Path('src/App.tsx')
s = p.read_text()
s = s.replace('type Product = { id: number; name: string;', 'type Product = { id: number; product_code?: string; name: string;')
s = s.replace('const orderNumber = () => `GULI-${Math.floor(1000000 + Math.random() * 9000000)}`;', 'const orderNumber = () => `GULI-${Math.floor(100000 + Math.random() * 900000)}`;')
s = re.sub(r'const formatDate = \(v: string\) => \{ const d = new Date\(v\); return Number\.isNaN\(d\.getTime\(\)\) \? "Sana noma\'lum" : d\.toLocaleDateString\("uz-UZ"\); \};', 'const formatDate = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "Sana noma\'lum" : d.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" }); };', s)
p.write_text(s)
