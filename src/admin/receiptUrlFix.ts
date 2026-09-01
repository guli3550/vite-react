// Shared browser receipt URL resolver.
// Private Supabase receipts must be opened through the admin API so the browser
// receives a short-lived signed URL instead of trying to render the storage path.
export async function resolveAdminReceiptUrl(apiBase: string, orderId: string | number, token: string, fallback = "") {
  if (!orderId || !token) return fallback;
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/admin/orders/${encodeURIComponent(String(orderId))}/payment-receipt`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => null);
    return res.ok ? String(json?.data?.receipt_url || fallback || "") : fallback;
  } catch {
    return fallback;
  }
}
