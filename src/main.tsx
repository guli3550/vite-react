import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Admin from './admin/AdminPro.tsx'
import './index.css'
import './admin/AdminNaming.css'
import './admin/CustomerIdentity.css'

type Props = { children: ReactNode }
type State = { failed: boolean; message: string }

class StorefrontErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, message: error instanceof Error ? error.message : String(error || 'Noma’lum xatolik') }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('GULI storefront boot/render error', error, info)
    try {
      const key = 'guli_storefront_recovery_v1'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        // Clear only client-side storefront caches. Do not touch auth/admin data.
        for (const name of ['guli_catalog_cache_v4', 'cart', 'wishlist', 'orders', 'guli_address', 'guli_phone']) {
          localStorage.removeItem(name)
        }
        window.setTimeout(() => window.location.reload(), 50)
      } else {
        sessionStorage.removeItem(key)
      }
    } catch {
      // Telegram WebView may restrict storage; the visible recovery screen below remains usable.
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#fff9fa', color: '#2b2024', fontFamily: 'system-ui, sans-serif' }}>
        <section style={{ width: '100%', maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #f0dfe3', borderRadius: 24, padding: 24, boxShadow: '0 14px 40px rgba(70,35,45,.08)' }}>
          <img src="/guli_logo.jpg" alt="Guli Premium" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', display: 'block', boxShadow: '0 6px 16px rgba(0,0,0,0.1)' }} />
          <h1 style={{ margin: '10px 0 8px', fontSize: 22 }}>GULI vaqtincha yuklanmadi</h1>
          <p style={{ margin: '0 0 16px', color: '#806f75', fontSize: 13, lineHeight: 1.5 }}>Ilovani qayta yuklab ko‘ring. Xatolik qaytarsa, diagnostika uchun quyidagi kod saqlanadi.</p>
          <small style={{ display: 'block', marginBottom: 16, color: '#a04e64', wordBreak: 'break-word' }}>{this.state.message || 'STORE_FRONT_BOOT_ERROR'}</small>
          <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '14px 18px', border: 0, borderRadius: 14, background: '#c9526b', color: '#fff', fontWeight: 800 }}>Qayta yuklash</button>
        </section>
      </main>
    )
  }
}

if (typeof window !== 'undefined') {
  const webApp = window.Telegram?.WebApp
  try {
    webApp?.ready()
    webApp?.expand()
  } catch {}

  const originalFetch = window.fetch.bind(window)
  const apiBase = (import.meta.env.VITE_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '')
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.startsWith(apiBase) && webApp?.initData) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
      if (!headers.has('X-Telegram-Init-Data')) headers.set('X-Telegram-Init-Data', webApp.initData)
      return originalFetch(input, { ...init, headers })
    }
    return originalFetch(input, init)
  }

  try {
    window.fetch = customFetch
  } catch {
    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true,
      })
    } catch {
      try {
        (globalThis as any).fetch = customFetch
      } catch (err) {
        console.warn('Could not intercept fetch:', err)
      }
    }
  }

  if (window.location.pathname.replace(/\/$/, '') !== '/admin' && webApp?.initData) {
    void originalFetch(`${apiBase}/api/profile/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': webApp.initData },
      body: '{}',
    }).catch(() => {})
  }

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

    const attachPhotos = (element: HTMLElement, photos: Array<{ url: string; current?: boolean }>) => {
      if (!photos.length) return
      galleryPhotos = photos
      galleryIndex = Math.max(0, photos.findIndex((p) => p.current))
      const photo = photos[galleryIndex]
      const image = document.createElement('img')
      image.src = photo.url
      image.alt = 'Telegram profil rasmi'
      image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block'
      image.onerror = () => { element.dataset.photoEnhanced = '0'; image.remove() }
      element.replaceChildren(image)
      element.style.cursor = 'pointer'
      element.title = 'Telegram profil rasmlarini ko‘rish'
      element.addEventListener('click', renderGallery, { once: true })
      const parent = element.parentElement
      if (parent && !parent.querySelector('[data-crm-photo-counter]')) {
        const counter = document.createElement('small')
        counter.dataset.crmPhotoCounter = '1'
        counter.textContent = `${photos.length} ta rasm · ko‘rish →`
        counter.style.cssText = 'display:block;margin-top:5px;color:#9b7d86;font-size:11px;cursor:pointer'
        parent.appendChild(counter)
        counter.addEventListener('click', renderGallery)
      }
    }

    const enhanceCustomerAvatar = async (avatar: HTMLElement) => {
      if (avatar.dataset.photoEnhanced === '1') return
      const drawer = avatar.closest('.drawer')
      if (!drawer) return
      const explicitId = avatar.dataset.telegramId || ''
      const text = drawer.textContent || ''
      const match = text.match(/ID:\s*(\d+)/)
      const telegramId = explicitId || match?.[1] || ''
      if (!telegramId) return
      avatar.dataset.photoEnhanced = '1'
      try {
        const token = sessionStorage.getItem('guli_admin_token') || ''
        const response = await originalFetch(`${apiBase}/api/admin/users/${encodeURIComponent(telegramId)}/details`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await response.json()
        const photos = Array.isArray(json?.data?.photos) ? json.data.photos.filter((p: any) => p?.url) : []
        if (photos.length) attachPhotos(avatar, photos)
        else avatar.dataset.photoEnhanced = '0'
      } catch {
        avatar.dataset.photoEnhanced = '0'
      }
    }

    const enhanceOrderPhoto = async (icon: HTMLElement) => {
      if (icon.dataset.photoEnhanced === '1') return
      const drawer = icon.closest('.drawer')
      if (!drawer) return
      const heading = drawer.querySelector('.drawerHead h2')?.textContent || ''
      const match = heading.match(/(?:№|#)\s*(GULI-\d{6})/i)
      if (!match) return
      icon.dataset.photoEnhanced = '1'
      try {
        const token = sessionStorage.getItem('guli_admin_token') || ''
        const response = await originalFetch(`${apiBase}/api/admin/order/${encodeURIComponent(match[1])}/customer-photos`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await response.json()
        const photos = Array.isArray(json?.data?.photos) ? json.data.photos.filter((p: any) => p?.url) : []
        if (photos.length) attachPhotos(icon, photos)
        else icon.dataset.photoEnhanced = '0'
      } catch {
        icon.dataset.photoEnhanced = '0'
      }
    }

    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('.avatarLarge').forEach((avatar) => void enhanceCustomerAvatar(avatar))
      document.querySelectorAll<HTMLElement>('.orderIcon').forEach((icon) => void enhanceOrderPhoto(icon))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('keydown', (event) => {
      if (!galleryPhotos.length || !document.getElementById('crm-photo-gallery')) return
      if (event.key === 'Escape') closeGallery()
      if (event.key === 'ArrowLeft') { galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length; renderGallery() }
      if (event.key === 'ArrowRight') { galleryIndex = (galleryIndex + 1) % galleryPhotos.length; renderGallery() }
    })
  }

  document.addEventListener('input', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') return
    const value = target.value
    if (/^0+\d/.test(value)) target.value = value.replace(/^0+(?=\d)/, '')
  }, true)
}

const isAdmin = typeof window !== 'undefined' && (
  window.location.pathname.replace(/\/$/, '').endsWith('/admin') ||
  window.location.search.includes('admin') ||
  window.location.hash === '#admin'
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <StorefrontErrorBoundary><App /></StorefrontErrorBoundary>}
  </StrictMode>,
)
