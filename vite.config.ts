import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Small source-level compatibility fixes for the legacy admin screens.
// Private payment receipts live in a private Supabase bucket, so the browser
// must use the admin endpoint to obtain a short-lived signed URL.
function receiptPreviewFix() {
  return {
    name: 'guli-receipt-preview-fix',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.endsWith('/src/admin/AdminPro.tsx')) {
        let out = code
        const oldReceipt = 'const receiptImg = (order as any).receiptUrl || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80";'
        const newReceipt = `const [receiptImg, setReceiptImg] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    const adminToken = sessionStorage.getItem("guli_admin_token") || "";
    const existing = String((order as any).receipt_url || (order as any).receiptUrl || "");
    const receiptPath = String((order as any).payment_receipt_path || "");
    if (!receiptPath) {
      setReceiptImg(existing);
      return () => { cancelled = true; };
    }
    const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\\/$/, "");
    fetch(\`\${base}/api/admin/orders/\${encodeURIComponent(String(order.id))}/payment-receipt\`, {
      headers: { Authorization: \`Bearer \${adminToken}\` },
    })
      .then((r) => r.json().catch(() => null))
      .then((j) => {
        if (!cancelled) setReceiptImg(String(j?.data?.receipt_url || existing || ""));
      })
      .catch(() => {
        if (!cancelled) setReceiptImg(existing);
      });
    return () => { cancelled = true; };
  }, [order.id]);`
        if (out.includes(oldReceipt)) out = out.replace(oldReceipt, newReceipt)
        return { code: out, map: null }
      }

      if (id.endsWith('/src/admin/components/AdminPaymentsTab.tsx')) {
        let out = code
        const oldBlock = `            // If order has receipt path, fetch signed receipt URL
            if (!receiptUrl && o.id && o.payment_receipt_path) {`
        const newBlock = `            // Private receipts must always be resolved through the signed-URL endpoint.
            // Do not trust a stale/public receipt_url when payment_receipt_path exists.
            if (o.id && o.payment_receipt_path) {`
        if (out.includes(oldBlock)) out = out.replace(oldBlock, newBlock)
        return { code: out, map: null }
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [receiptPreviewFix(), react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})
