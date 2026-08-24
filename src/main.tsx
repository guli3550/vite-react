import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Production backend. VITE_API_URL can override this value when configured
// in Vercel/another hosting provider.
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://guli-lingerie-api.onrender.com'

// App currently keeps orders in localStorage.
// This bridge sends each new local order to the backend once.
if (typeof window !== 'undefined') {
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage)

  window.localStorage.setItem = (key: string, value: string) => {
    originalSetItem(key, value)

    if (key !== 'orders') return

    try {
      const orders = JSON.parse(value)
      const latestOrder = Array.isArray(orders) ? orders[0] : null

      if (!latestOrder?.id) return

      const syncedIds = JSON.parse(
        window.localStorage.getItem('guli_synced_order_ids') || '[]',
      ) as string[]

      if (syncedIds.includes(latestOrder.id)) return

      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user

      void fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: latestOrder.id,
          telegram_id: telegramUser?.id,
          username: telegramUser?.username,
          first_name: telegramUser?.first_name,
          phone: latestOrder.phone,
          items: latestOrder.items,
          subtotal: latestOrder.subtotal,
          delivery: latestOrder.delivery,
          discount: latestOrder.discount,
          total: latestOrder.total,
          address: latestOrder.address,
          payment: latestOrder.payment,
          status: latestOrder.status,
          created_at: new Date().toISOString(),
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const message = await response.text()
            throw new Error(`HTTP ${response.status}: ${message}`)
          }

          const nextSyncedIds = [...syncedIds, latestOrder.id].slice(-100)
          originalSetItem(
            'guli_synced_order_ids',
            JSON.stringify(nextSyncedIds),
          )
        })
        .catch((error) => {
          console.error('GULI API order sync failed:', error)
        })
    } catch (error) {
      console.error('GULI order sync parse failed:', error)
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
