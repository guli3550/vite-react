import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Admin from './admin/AdminPro.tsx'
import './index.css'
import './admin/AdminNaming.css'
import './admin/CustomerIdentity.css'

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

  // Save the Telegram identity/profile-photo history in the CRM whenever the Mini App opens.
  if (window.location.pathname.replace(/\/$/, '') !== '/admin' && webApp?.initData) {
    void originalFetch(`${apiBase}/api/profile/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': webApp.initData },
      body: '{}',
    }).catch(() => {})
  }

  // Mobile keyboards may append digits to the initial `0` in controlled number inputs
  // (for example `0` + `12` -> `012`). Normalize before React receives the input event.
  document.addEventListener('input', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') return
    const value = target.value
    if (/^0+\d/.test(value)) {
      target.value = value.replace(/^0+(?=\d)/, '')
    }
  }, true)
}

const isAdmin = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)
