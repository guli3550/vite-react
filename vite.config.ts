import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> };

function guliSourceFixes() {
  return {
    name: 'guli-source-fixes',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      let out = code
      if (id.endsWith('/src/admin/AdminPro.tsx')) {
        const oldReceipt = 'const receiptImg = (order as any).receiptUrl || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80";'
        const newReceipt = `const [receiptImg, setReceiptImg] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    const adminToken = sessionStorage.getItem("guli_admin_token") || "";
    const existing = String((order as any).receipt_url || (order as any).receiptUrl || "");
    const receiptPath = String((order as any).payment_receipt_path || "");
    if (!receiptPath) { setReceiptImg(existing); return () => { cancelled = true; }; }
    const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\\/$/, "");
    fetch(\`\${base}/api/admin/orders/\${encodeURIComponent(String(order.id))}/payment-receipt\`, { headers: { Authorization: \`Bearer \${adminToken}\` } })
      .then((r) => r.json().catch(() => null))
      .then((j) => { if (!cancelled) setReceiptImg(String(j?.data?.receipt_url || existing || "")); })
      .catch(() => { if (!cancelled) setReceiptImg(existing); });
    return () => { cancelled = true; };
  }, [order.id]);`
        if (out.includes(oldReceipt)) out = out.replace(oldReceipt, newReceipt)
        return { code: out, map: null }
      }
      if (id.endsWith('/src/components/ModernProfileView.tsx')) {
        out = out.replace('authUser ? "🔑 Hisobni almashtirish" : "✨ Ro‘yxatdan o‘tish"', '"✨ Ro‘yxatdan o‘tish"')
        out = out.replace('onClick={() => onOpenAuth?.(authUser ? "signin" : "signup")}', 'onClick={() => !authUser && onOpenAuth?.("signup")}')
        return { code: out, map: null }
      }
      if (id.endsWith('/src/App.tsx')) {
        out = out.replace('if (!telegramUser?.id) return [];', 'if (!telegramUser?.id && !localStorage.getItem("guli_access_token")) return [];')
        const marker = 'import '
        if (!out.includes('__guliCustomerFetchPatched')) {
          const bootstrap = `\n// Customer identity bridge: attach the current Supabase/Telegram identity to legacy API calls.\nif (!(globalThis as any).__guliCustomerFetchPatched) {\n  (globalThis as any).__guliCustomerFetchPatched = true;\n  const nativeFetch = window.fetch.bind(window);\n  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {\n    const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);\n    if (url.includes("/api/orders") || url.includes("/api/customer/")) {\n      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));\n      const token = localStorage.getItem("guli_access_token") || "";\n      const tg = (window as any).Telegram?.WebApp?.initData || "";\n      if (token && !headers.has("Authorization")) headers.set("Authorization", \`Bearer \${token}\`);\n      if (tg && !headers.has("X-Telegram-Init-Data")) headers.set("X-Telegram-Init-Data", tg);\n      init = { ...(init || {}), headers };\n    }\n    return nativeFetch(input, init);\n  };\n  const tg = (window as any).Telegram?.WebApp?.initData || "";\n  if (tg) nativeFetch("/api/customer/sync", { method: "POST", headers: { "X-Telegram-Init-Data": tg, "Content-Type": "application/json" }, body: "{}" }).catch(() => {});\n  const token = localStorage.getItem("guli_access_token") || "";\n  if (token) nativeFetch("/api/customer/sync", { method: "POST", headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" }, body: JSON.stringify({ phone: localStorage.getItem("guli_phone") || "" }) }).catch(() => {});\n}\n`
          const firstImport = out.indexOf(marker)
          if (firstImport >= 0) { const lineEnd = out.indexOf('\n', firstImport); out = out.slice(0, lineEnd + 1) + bootstrap + out.slice(lineEnd + 1) }
        }
        return { code: out, map: null }
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [guliSourceFixes(), react()],
  server: {
    host: '0.0.0.0', port: 3000, allowedHosts: true,
    proxy: { '/api': { target: process.env.VITE_API_URL || 'https://guli-lingerie-api.onrender.com', changeOrigin: true, secure: false } },
  },
  preview: { host: '0.0.0.0', port: 3000 },
})
