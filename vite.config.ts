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
        out = out.replace('onClick={() => onOpenAuth?.(authUser ? "signin" : "signup")}', 'onClick={() => onOpenAuth?.("signup")}')
        out = out.replace('{authUser && <button', '{authUser ? <button')
        return { code: out, map: null }
      }
      if (id.endsWith('/src/App.tsx')) {
        out = out.replace('if (!telegramUser?.id) return [];', 'if (!telegramUser?.id && !localStorage.getItem("guli_access_token")) return [];')
        return { code: out, map: null }
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [guliSourceFixes(), react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://guli-lingerie-api.onrender.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: { host: '0.0.0.0', port: 3000 },
})
