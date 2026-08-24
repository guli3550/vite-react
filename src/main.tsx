import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Admin from './admin/Admin.tsx'
import './index.css'

if (typeof window !== 'undefined') {
  const webApp = window.Telegram?.WebApp
  webApp?.ready()
  webApp?.expand()
}

const isAdmin = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)
