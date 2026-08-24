import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL as string | undefined

// The current App stores orders in localStorage.
// This bridge keeps that UI behaviour while syncing new orders to the backend.
if (API_URL && typeof window !== 'undefined') {
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage)

  window.localStorage.setItem = (key: string, value: string) => {
    originalSetItem(key, value)

    if (key !== 'orders') return

    try {
      const orders = JSON.parse(value)
      const latestOrder = Array.isArray(orders) ? orders[0] : null

      if (!latestOrder || latestOrder.__synced) return

      const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user

      void fetch(`${API_URL.replace(/\/$/, '')}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          created_at: latestOrder.createdAt,
        }),
      }).catch((error) => {
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
