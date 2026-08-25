import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Admin from './admin/AdminPro.tsx'
import './index.css'

if (typeof window !== 'undefined') {
  const webApp = window.Telegram?.WebApp
  webApp?.ready()
  webApp?.expand()

  const originalFetch = window.fetch.bind(window)
  const apiBase = (import.meta.env.VITE_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '')
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.startsWith(apiBase) && webApp?.initData) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      if (!headers.has('X-Telegram-Init-Data')) headers.set('X-Telegram-Init-Data', webApp.initData)
      return originalFetch(input, { ...init, headers })
    }
    return originalFetch(input, init)
  }
}

const isAdmin = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)
