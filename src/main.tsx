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

  // Save Telegram's current avatar and profile-photo history whenever the Mini App opens.
  if (window.location.pathname.replace(/\/$/, '') !== '/admin' && webApp?.initData) {
    void originalFetch(`${apiBase}/api/profile/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': webApp.initData },
      body: '{}',
    }).catch(() => {})
  }

  // CRM photo enhancement: the legacy drawer is kept intact, while this small
  // DOM adapter loads the richer photo gallery endpoint and upgrades its avatar.
  if (window.location.pathname.replace(/\/$/, '') === '/admin') {
    let galleryPhotos: Array<{ url: string; current?: boolean }> = []
    let galleryIndex = 0

    const closeGallery = () => document.getElementById('crm-photo-gallery')?.remove()
    const renderGallery = () => {
      closeGallery()
      if (!galleryPhotos.length) return
      const photo = galleryPhotos[galleryIndex]
      const overlay = document.createElement('div')
      overlay.id = 'crm-photo-gallery'
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(20,12,16,.88);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px)'
      overlay.innerHTML = `<button data-close style="position:absolute;right:18px;top:18px;width:44px;height:44px;border:0;border-radius:50%;font-size:28px;background:rgba(255,255,255,.12);color:#fff">×</button><button data-prev style="position:absolute;left:14px;top:50%;width:46px;height:46px;border:0;border-radius:50%;font-size:28px;background:rgba(255,255,255,.14);color:#fff">‹</button><img src="${photo.url}" style="max-width:92vw;max-height:82vh;object-fit:contain;border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.45)"/><button data-next style="position:absolute;right:14px;top:50%;width:46px;height:46px;border:0;border-radius:50%;font-size:28px;background:rgba(255,255,255,.14);color:#fff">›</button><div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:#fff;font:600 14px system-ui;background:rgba(0,0,0,.35);padding:8px 13px;border-radius:999px">${galleryIndex + 1} / ${galleryPhotos.length}</div>`
      overlay.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        if (target === overlay || target.dataset.close !== undefined) return closeGallery()
        if (target.dataset.prev !== undefined) { galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length; renderGallery() }
        if (target.dataset.next !== undefined) { galleryIndex = (galleryIndex + 1) % galleryPhotos.length; renderGallery() }
      })
      document.body.appendChild(overlay)
    }

    const enhanceCustomerAvatar = async (avatar: HTMLElement) => {
      if (avatar.dataset.photoEnhanced === '1') return
      const drawer = avatar.closest('.drawer')
      if (!drawer) return
      const text = drawer.textContent || ''
      const match = text.match(/ID:\s*(\d+)/)
      if (!match) return
      avatar.dataset.photoEnhanced = '1'
      try {
        const token = sessionStorage.getItem('guli_admin_token') || ''
        const response = await originalFetch(`${apiBase}/api/admin/users/${match[1]}/details`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await response.json()
        const photos = Array.isArray(json?.data?.photos) ? json.data.photos.filter((p: any) => p?.url) : []
        if (!photos.length) return
        galleryPhotos = photos
        galleryIndex = Math.max(0, photos.findIndex((p: any) => p.current))
        avatar.innerHTML = `<img src="${photos[galleryIndex].url}" alt="Telegram profil rasmi" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block"/>`
        avatar.style.cursor = 'pointer'
        avatar.title = 'Telegram profil rasmlarini ko‘rish'
        avatar.addEventListener('click', renderGallery)
        const counter = document.createElement('small')
        counter.textContent = `${photos.length} ta rasm · ko‘rish →`
        counter.style.cssText = 'display:block;margin-top:5px;color:#9b7d86;font-size:11px;cursor:pointer'
        avatar.parentElement?.appendChild(counter)
        counter.addEventListener('click', renderGallery)
      } catch {
        avatar.dataset.photoEnhanced = '0'
      }
    }

    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('.avatarLarge').forEach((avatar) => void enhanceCustomerAvatar(avatar))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('keydown', (event) => {
      if (!galleryPhotos.length || !document.getElementById('crm-photo-gallery')) return
      if (event.key === 'Escape') closeGallery()
      if (event.key === 'ArrowLeft') { galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length; renderGallery() }
      if (event.key === 'ArrowRight') { galleryIndex = (galleryIndex + 1) % galleryPhotos.length; renderGallery() }
    })
  }

  // Mobile keyboards may append digits to the initial `0` in controlled number inputs.
  document.addEventListener('input', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') return
    const value = target.value
    if (/^0+\d/.test(value)) target.value = value.replace(/^0+(?=\d)/, '')
  }, true)
}

const isAdmin = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)
