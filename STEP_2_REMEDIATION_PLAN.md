# GULI STEP 2 — PRODUCTION REMEDIATION PLAN
**Security-First / Zero Blind Patching / Deep Root-Cause Trace**  
**Remote main baseline:** `b6f827257b050bcc76f20615b6bce997b1bbeb38`  
**Document version:** `2026-09-16.1`  
**Execution rule:** Reja tasdiqlanmaguncha kod o'zgartirilmaydi, push/deploy qilinmaydi.

---

## 1. Executive Summary

GULI platformasida STEP 1 auditida aniqlangan 3 ta kritik P1 nosozlik bo'yicha to'liq kod trace'i va arxitektura tahlili o'tkazildi:

1. **P1-A (Browser Buyurtmalarim = 0):** Telegram Mini App orqali buyurtma bergan mijoz brauzerda tizimga kirganda uning buyurtmalari ko'rinmaydi. Sababi: Telegram orqali yaratilgan buyurtmalarda `telegram_id` yoziladi, lekin `auth_user_id` ustuni `NULL` qoladi. Brauzer foydalanuvchisi `Authorization: Bearer <GULI_JWT>` bilan `GET /api/orders` ga so'rov yuborganida, runtime handler (`customerOrdersSyncPatch.js`) faqat `orders.auth_user_id = user.id` bo'yicha filter qiladi va foydalanuvchiga tegishli bog'langan `telegram_id` buyurtmalarini hisobga olmaydi. Natijada `data: []` qaytadi.
2. **P1-B (To'lov cheki yuklash xatosi / Failed to fetch):** Mijoz karta orqali to'lov chekini yuklaganda xatolik beradi. Sababi: `POST /api/orders/:orderNumber/receipt` endpointining haqiqiy runtime egasi `paymentReceiptFinalRuntime.js` bo'lib, u qat'iy `order.payment === 'card_manual'` shartini tekshiradi, holbuki frontend `payment: "Karta (Uzcard / Humo)"` yuboradi. Bundan tashqari, ushbu runtime brauzer JWT sessiyasini umuman tanimaydi (faqat Telegram `initData` tekshiradi). Xatolik yuz berganda esa frontend mavjud bo'lmagan `/api/customer/orders/...` route'iga fallback qiladi va `public/customer-auth-bridge.js` URL'ni noto'g'ri o'zgartirib, brauzerda CORS/404 tufayli "Failed to fetch" (Tarmoq xatosi) yuzaga keltiradi.
3. **P1-C (Telegram Admin bildirishnomalari dublikati):** Har bir buyurtma uchun admin bot bir necha bor bildirishnoma yuboradi. Sababi: `telegramAdminBotProduction.js` bildirishnomalar holatini faqat operativ xotirada (`state.sigs = new Map()`) saqlaydi. Render'da jarayon restart bo'lganda yoki bir vaqtning o'zida bir nechta worker/instance ishlaganda, xotiradagi Map bo'sh bo'ladi va barcha instance'lar ayni bitta buyurtma uchun Telegram API'ga qayta-qayta xabar jo'natadi. Supabase'da ushbu muammo uchun yaratilgan `telegram_admin_bot_events` jadvali mavjud bo'lsa-da, aktiv production runtime undan foydalanmaydi.

Quyida ushbu muammolarning chuqur trace'i, IDOR xavfsizlik matritsasi va minimal, xavfsiz remediation rejasining barcha tafsilotlari keltirilgan.

---

## 2. Runtime Route Truth (Haqiqiy Route Egalari)

Server `backend/package.json` faylidagi 44 ta preloaded patch orqali ishga tushadi. Har bir patch `backend/routeRegistry.js` orqali marshrutlarni o'rnatadi. `routeRegistry.js` bir xil metod va yo'l bo'yicha **faqat birinchi yuklangan** handlerni Express'ga mount qiladi (`app.__guliMountedRoutes.has(key)` tekshiruvi orqali):

| Endpoint | Qaysi fayllarda e'lon qilingan? | Haqiqiy Runtime Egasi | Nima uchun bu fayl yutib chiqadi? |
| :--- | :--- | :--- | :--- |
| `GET /api/orders` | `index.js`, `unifiedCustomerBridgePatch.js`, `customerOrdersSyncPatch.js` | **`backend/customerOrdersSyncPatch.js`** | `package.json` preload zanjirida #27 o'rinda. `unifiedCustomerBridgePatch.js` esa preload'da yo'q. `index.js` dagi route'lar registry'dan keyin yuklangani uchun bostiriladi. |
| `POST /api/orders` | `index.js`, `orderCreationIntegrityPatch.js`, `orderSecurityPatch.js` | **`backend/index.js`** (wrapped by `orderCreationIntegrityPatch` & `orderSecurityPatch`) | Preload patchlar Express `post` metodini oraliq tekshiruvlar bilan o'raydi, lekin asosiy biznes mantiq `index.js` da `create_secure_order` RPC chaqiradi. |
| `POST /api/orders/:orderNumber/receipt` | `paymentReceiptFinalRuntime.js` (#15), `manualCardPaymentRuntime.js` (#16), `customerOrdersSyncPatch.js` (#27), `receiptWindowRuntime.js` (preload'da yo'q) | **`backend/paymentReceiptFinalRuntime.js`** | Preload tartibida #15 o'rinda birinchi bo'lib `installPost` chaqirgan. Keyingi patchlar (#16 va #27) `routeRegistry` tomonidan inkor etiladi. |
| `GET /api/orders/:orderNumber/receipt` | `paymentConfirmationRuntime.js` (#20), `manualCardPaymentRuntime.js` (#16) | **`backend/manualCardPaymentRuntime.js`** | Preload zanjirida #16 o'rinda birinchi bo'lib registratsiyadan o'tgan. |
| `GET /api/customer/profile` | `unifiedCustomerBridgePatch.js`, `canonicalCustomerProfileRuntime.js` (#28) | **`backend/canonicalCustomerProfileRuntime.js`** | `unifiedCustomerBridgePatch.js` yuklanmaydi, preload'dagi #28 fayl registratsiya qiladi. |
| `POST /api/customer/sync` | `unifiedCustomerBridgePatch.js`, `canonicalCustomerProfileRuntime.js` (#28) | **`backend/canonicalCustomerProfileRuntime.js`** | Preload'dagi #28 fayl yagona aktiv owner. |
| Telegram Admin Bot Polling / Notifications | `telegramAdminBotProduction.js` (#38), `telegramAdminBotFinalPatch.js` (yuklanmaydi) | **`backend/telegramAdminBotProduction.js`** | Preload zanjirida #38 o'rinda faollashgan yagona bot sikli. |

---

## 3. P1-A — Browser Orders = 0: Trace va Tahlil

### 3.1. Savollarga Aniq Javoblar

1. **Browser JWT ichidagi canonical identity nima?**  
   `backend/guliCustomAuth.js` dagi `issueAccessToken(user)` tomonidan yaratilgan JWT:
   - `sub`: `public.users.id` (UUID formatida).
   - `phone`: Mijozning tasdiqlangan telefon raqami (`phone_number`).
   - `telegram_id`: Agar mavjud bo'lsa, foydalanuvchiga bog'langan Telegram ID (`user.telegram_id != null ? Number(user.telegram_id) : null`).
   - `role`: `"customer"`.
   - `iat`, `exp` (15 daqiqalik yashash muddati), `jti`.  
   Shunday qilib, JWT ichidagi asosiy identifikator `sub` (UUID) hisoblanadi.

2. **Telegram Mini App order yaratganda qaysi identity field saqlanadi?**  
   Telegram Mini App orqali `POST /api/orders` chaqirilganda `create_secure_order` RPC yoki `index.js` fallbaci ishga tushadi:
   - `orders.telegram_id` = `p_telegram_id` (Telegram BigInt ID) to'ldiriladi.
   - `orders.auth_user_id` esa **umuman yozilmaydi (`NULL` qoladi)**.
   - `supabase/production_checkout_fix_20260901.sql` faylidagi `insert into public.orders` operatorida `auth_user_id` ustuni hatto ko'rsatilmagan.

3. **auth_user_id qayerda yaratiladi?**  
   `auth_user_id` mijoz birinchi marta brauzer orqali Telegram sessiyasini ulanganda (`backend/canonicalTelegramSessionAuthPatch.js` dagi `/api/v1/auth/exchange` marshruti orqali `resolveCanonicalUser` funksiyasida) yaratiladi:
   - Supabase Auth tizimida `supabase.auth.admin.createUser()` orqali UUID olinadi.
   - `public.users` jadvaliga `id = newId` (UUID) sifatida kiritiladi.

4. **telegram_id qayerda bog'lanadi?**  
   `telegram_id` foydalanuvchining `public.users` yozuvida saqlanadi (`public.users.telegram_id`). Bu bog'lanish `canonicalTelegramSessionAuthPatch.js` dagi auth exchange jarayonida yoki bot orqali telefon raqami tasdiqlanganda amalga oshiriladi.

5. **unified_customers jadvali/bridge qanday ishlaydi?**  
   `supabase/migrations/20260911_unified_customers_schema.sql` faylida `public.customers` jadvali yaratilgan bo'lib, u `auth_user_id` va `telegram_id` ustunlariga ega. Lekin bu jadval bilan ishlashga mo'ljallangan `backend/unifiedCustomerBridgePatch.js` fayli `backend/package.json` ning preload ro'yxatiga **kiritilmagan**. Hozirgi aktiv tizimda bu bridge ishlamaydi; aktiv profil moduli `backend/canonicalCustomerProfileRuntime.js` bo'lib, u `public.users` jadvalidan foydalanadi.

6. **Browser GET /api/orders qaysi field bilan filter qiladi?**  
   Aktiv runtime bo'lgan `backend/customerOrdersSyncPatch.js` (qator 46-56 va 104-106):
   ```js
   function browserUser(req) {
     const header = String(req.headers.authorization || '');
     if (!header.startsWith('Bearer ')) return null;
     try {
       const claims = verifyAccessToken(header.slice(7).trim());
       return claims?.sub ? { type: 'auth', id: String(claims.sub) } : null;
     } catch { return null; }
   }
   // ...
   query = user.type === 'auth'
     ? query.eq('auth_user_id', user.id)
     : query.eq('telegram_id', user.id);
   ```
   Brauzer JWT yuborgani sababli `user.type === 'auth'` bo'ladi va so'rov qat'iy ravishda faqat `orders.auth_user_id = user.id` bo'yicha filterlanadi!

7. **Nima sababli Telegram orqali yaratilgan order browserda 0 bo'lib qoladi?**  
   Chunki Telegram orqali yaratilgan buyurtmalarning `auth_user_id` ustuni `NULL`. Brauzer foydalanuvchisi o'z JWT tokeni bilan so'rov yuborganda, server `orders.auth_user_id = '<user-uuid>'` shartini qo'yadi. `NULL` hech qachon UUID ga teng bo'lmaganligi sababli, SQL so'rovi 0 ta qator qaytaradi. Server foydalanuvchining bog'langan `telegram_id`sini tekshirmaydi va birlashtirmaydi.

---

## 4. P1-B — Receipt Upload: Route Conflict va Payment Enum

### 4.1. Savollarga Aniq Javoblar

1. **POST /api/orders/:orderNumber/receipt ning haqiqiy runtime egasi qaysi fayl?**  
   Haqiqiy egasi: **`backend/paymentReceiptFinalRuntime.js`** (#15).  
   `backend/customerOrdersSyncPatch.js` (#27) ham ushbu marshrutga ega, ammo `routeRegistry.js` birinchi bo'lib ro'yxatdan o'tgan (#15) handlerni qoldiradi.

2. **Fayl qaysi fieldlarni tekshiryapti va nima uchun reject qilyapti?**  
   `paymentReceiptFinalRuntime.js` ichida quyidagi rad etish nuqtalari mavjud:
   - **Mijoz sessiyasi:** `function customer(req) { return tg(req.headers['x-telegram-init-data']||'') || guest(...) }`. Ushbu funksiya `Authorization: Bearer <JWT>` sarlavhasini tekshirmaydi! Brauzer foydalanuvchisi chek yuborganida darhol `401 "Mijoz sessiyasi topilmadi."` qaytadi.
   - **Payment qiymati:** `if (String(order.payment || '') !== 'card_manual') return res.status(400).json({ success: false, message: 'Bu buyurtma karta to‘lovi uchun yaratilmagan' });`. Buyurtmada `payment` boshqa nomda bo'lsa (masalan, `'Karta (Uzcard / Humo)'` yoki `'card'`), 400 xatosi qaytadi.
   - **Telegram ID egaligi:** So'rov bazadan `.eq('telegram_id', u.id)` orqali buyurtmani qidiradi. Brauzer foydalanuvchisining `telegram_id`si bo'lmasa yoki `u.id` Telegram ID formatida bo'lmasa, `404 "Buyurtma topilmadi"` qaytadi.
   - **Mavjud chek holati:** Agar `payment_receipt_path` allaqachon to'ldirilgan bo'lsa, `409 "Chek allaqachon yuklangan"` qaytadi.

3. **Frontend va backend o'rtasidagi payment enum nomutanosibligi nima?**  
   - Frontend (`src/App.tsx` qator 2575 va `src/components/CheckoutView.tsx`):
     Foydalanuvchi karta tanlaganda backendga `payment: "Karta (Uzcard / Humo)"` matnini yuboradi.
   - Backend ma'lumotlar bazasi va chek handleri:
     `orders.payment` ustunida qat'iy ravishda `'card_manual'` yoki `'cash'` qiymatini kutadi.
   - Agar buyurtma RPC orqali normalizatsiya qilinmasdan to'g'ridan-to'g'ri `orders` jadvaliga tushib qolsa, bazada `"Karta (Uzcard / Humo)"` yozilib qoladi va chek yuklash kodi `order.payment !== 'card_manual'` tufayli uni rad etadi.

4. **Frontenddagi fallback fetchlar nima uchun muammoni battar chalkashtiryapti?**  
   - `src/App.tsx` (qator 1580-1600):
     `/api/orders/:orderNumber/receipt` 400 yoki 401 qaytarganda, frontend ikkinchi marta `/api/customer/orders/:orderNumber/receipt` ga so'rov yuboradi.
   - `public/customer-auth-bridge.js` (qator 28):
     Ushbu skript global `fetch`ni intercept qilib, `/api/orders/:id/receipt` so'rovlarini majburiy ravishda `/api/customer/orders/:id/receipt` ga o'zgartiradi.
   - **Lekin backendda `/api/customer/orders/...` degan route umuman mavjud emas!** Express server bu so'rovga 404 HTML qaytaradi.
   - Brauzer HTML javobni JSON sifatida parse qilishda yoki CORS preflight xatosida sinadi va ekranda `TypeError: Failed to fetch` ("Tarmoq xatosi: Serverga ulanib bo‘lmadi") paydo bo'ladi. Asl backend xatosi esa butunlay yashirilib qoladi.

---

## 5. P1-C — Telegram Admin Duplicate: Trace va Idempotency

### 5.1. Savollarga Aniq Javoblar

1. **Notification duplication qaysi holatlarda yuz beradi?**  
   - **Render Multi-instance / Zero-downtime deploy:** Render yangi versiyani deploy qilayotganda yoki bir vaqtning o'zida ikkita konteyner ishlab turganda, ikkala konteyner ham bir vaqtda `backend/telegramAdminBotProduction.js` dagi `sync()` siklini yurgizadi. Har ikki jarayonda ham yangi buyurtma uchun xotira bo'sh bo'lgani sababli, ikkala jarayon ham Telegram botiga `sendAlbum` yuboradi.
   - **Server restartlari:** Server o'chib-yonganida `state.sigs` tozalangan bo'ladi.
   - **Network race condition:** `sendAlbum` Telegram API'ga so'rov yuboradi va javob qaytguncha bazaga yozilmaydi. Agar ikkita iteratsiya qisqa vaqt ichida parallel yurgizilsa, ikkalasi ham xabarni jo'natib yuboradi.

2. **Hozirgi state mexanizmi qayerda saqlanadi va nega Render muhitida yetarli emas?**  
   Hozirgi state faqat bitta Node.js jarayonining RAM xotirasida (`globalThis.__GULI_ADMIN_PROD_BOT__.sigs = new Map()`) saqlanadi. Render konteynerlari ephemeral (vaqtinchalik) va taqsimlangan (stateless) bo'lgani sababli, xotiradagi Map jarayonlar o'rtasida sinxronlashmaydi.

3. **DB-backed idempotency uchun qanday jadval yoki lock kerak?**  
   Baza sxemasida ushbu muammo uchun allaqachon tayyor jadvallar mavjud:
   - `public.telegram_admin_bot_events`: `event_key text not null unique`, `event_type text not null`, `order_id uuid null`.
   - `public.telegram_admin_bot_order_messages`: `order_id uuid not null`, `chat_id bigint not null`, `message_id bigint not null`, `unique(order_id, chat_id)`.
   
   **To'g'ri atomik claim mexanizmi:**
   Telegram API'ga xabar yuborishdan **AVVAL**, worker bazadagi `telegram_admin_bot_events` jadvaliga quyidagi atomik yozuvni kiritishga urinadi:
   `event_key: 'admin_order_album:' + order.id + ':' + chatId`.
   - Agar insert muvaffaqiyatli bo'lsa (`error == null`): worker qulflashni qo'lga kiritadi va Telegram'ga xabar jo'natib, `telegram_admin_bot_order_messages` jadvaliga xabar ID'larini yozadi.
   - Agar xatolik kodi `23505` (unique_violation) bo'lsa: bu xabar boshqa worker tomonidan allaqachon yuborilgan yoki yuborilmoqda. Xabar takror yuborilmaydi!

---

## 6. IDOR / Adversarial Test Matrix

Har bir mijoz endpointi uchun xavfsizlik va ruxsatlar tekshiruvi matritsasi:

| # | Endpoint & Metod | Test Holati (Scenario) | Kiruvchi Ma'lumot / Header | Kutilgan Xavfsiz Natija | Hozirgi Tizim Natijasi | Xavfsizlik Bahosi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `GET /api/orders` | Mijoz o'z buyurtmalarini so'raydi | Yaroqli JWT (`sub: UserA_UUID`) | Faqat User A ning buyurtmalari (200 OK) | 0 ta buyurtma qaytadi (P1-A defekti) | Xavfsiz, lekin funksional buzilgan |
| 2 | `GET /api/orders` | User B User A ning buyurtmalarini so'raydi | User B JWT tokeni | Faqat User B ning buyurtmalari, User A yo'q | Faqat User B tekshiriladi (200 OK, User A yo'q) | IDOR mavjud emas (himoyalangan) |
| 3 | `GET /api/orders` | Auth sarlavhasi yo'q | Bo'sh header | `401 Unauthorized` | `401 Unauthorized` (`guliOrderAuthBoundaryRuntime`) | Xavfsiz |
| 4 | `GET /api/orders` | Expired / buzilgan JWT | `Bearer invalid_jwt` | `401 Unauthorized` | `401 Unauthorized` | Xavfsiz |
| 5 | `GET /api/orders` | Kliyent fake `telegram_id` yoki `phone` query yuboradi | `GET /api/orders?telegram_id=9999&phone=99890111` | Client parametrlariga umuman ishonmaslik, faqat JWT bo'yicha filter | `customerOrdersSyncPatch` query parametrlarini inkor qiladi | Xavfsiz (IDOR yo'q) |
| 6 | `POST /api/orders/:orderNumber/receipt` | Mijoz o'z buyurtmasiga chek yuklaydi | Yaroqli sessiya + o'z orderNumber | Chek Storage'ga yoziladi, status yangilanadi (200 OK) | `401` (JWT tanimaydi) yoki `400` (enum mos emas) | P1-B defekti |
| 7 | `POST /api/orders/:orderNumber/receipt` | User B User A ning buyurtmasiga chek yuklamoqchi | User B tokeni + User A orderNumber | `403 Forbidden` yoki `404 Not Found` | `404` (chunki order User B'ga tegishli emas) | IDOR mavjud emas (himoyalangan) |
| 8 | `POST /api/orders/:orderNumber/receipt` | Auth yo'q | Bo'sh header | `401 Unauthorized` | `401 Unauthorized` | Xavfsiz |
| 9 | `POST /api/orders/:orderNumber/receipt` | Client body'da fake `telegram_id` yuboradi | Body: `{ telegram_id: 12345 }` | Tizim body'dagi ID'ga qaramasligi shart | Server faqat `req.telegramUser` yoki JWT `sub`ga qaraydi | Xavfsiz (body ID inkor qilinadi) |
| 10 | `POST /api/orders` | Oddiy buyurtma yaratish | Yaroqli sessiya + to'g'ri savat | Buyurtma yaratiladi, `telegram_id` va `auth_user_id` to'g'ri yoziladi (201 Created) | `auth_user_id` yozilmaydi (`NULL`) | Identity bog'lanishida nuqson bor |
| 11 | `POST /api/orders` | Boshqa birovning nomidan buyurtma berish | Body: `{ telegram_id: UserB_ID }` | Body'dagi `telegram_id` inkor etiladi, faqat server tekshirgan sessiya yoziladi | Server faqat `req.telegramUser.id`ni oladi | Xavfsiz (spoofing imkonsiz) |
| 12 | `GET /api/customer/profile` | O'z profilini ko'rish | Yaroqli JWT yoki Telegram initData | Faqat o'z profili (200 OK) | O'z profili qaytadi (200 OK) | Xavfsiz |
| 13 | `GET /api/customer/profile` | Autentifikatsiyasiz profil so'rash | Headersiz | `401 Unauthorized` | `401 Unauthorized` | Xavfsiz |
| 14 | `POST /api/customer/sync` | Profilni sinxronlash | Yaroqli sessiya | O'z yozuvi yangilanadi (200 OK) | Serverda xavfsiz update bo'ladi | Xavfsiz |
| 15 | `POST /api/customer/sync` | Token A bilan Telegram B ni ulashga urinish | JWT(UserA) + initData(UserB) | `409 Identity Mismatch` | `409 IDENTITY_MISMATCH` qaytadi | Xavfsiz (Account takeover imkonsiz) |

---

## 7. Root Cause Summary (Asosiy Sabablar Xulosasi)

1. **P1-A Asosiy Sababi:**  
   `orders` jadvali ikki xil identifikatorga ega (`telegram_id` va `auth_user_id`). Telegram Mini App faqat `telegram_id`ni yozadi, brauzer esa faqat `auth_user_id`ni qidiradi. Ushbu ikki identifikator o'rtasidagi ko'prik (`public.users` orqali bog'langan `users.telegram_id`) `customerOrdersSyncPatch.js` da hisobga olinmagan.
2. **P1-B Asosiy Sababi:**  
   - Frontend `payment: "Karta (Uzcard / Humo)"` yuboradi, chek handleri esa `order.payment === 'card_manual'` shartini talab qiladi.
   - Chek handleri (`paymentReceiptFinalRuntime.js`) faqat Telegram `initData`ni tekshiradi, brauzerning GULI JWT tokenini qo'llab-quvvatlamaydi.
   - Frontenddagi fallback (`/api/customer/orders/...`) va `customer-auth-bridge.js` dagi URL rewrite backendda mavjud bo'lmagan marshrutga so'rov yuborib, asl xatoni "Failed to fetch" xatosiga aylantiradi.
3. **P1-C Asosiy Sababi:**  
   `telegramAdminBotProduction.js` serverning ephemeral xotirasida ishlaydi. U bazadagi `telegram_admin_bot_events` va `telegram_admin_bot_order_messages` jadvallaridan xabarni yuborishdan oldin atomik qulflash (distributed lock) sifatida foydalanmaydi.

---

## 8. Minimal Remediation Design (Minimal va Xavfsiz Tuzatish Arxitekturasi)

Hech qanday yangi arxitektura yoki yirik dependency kiritilmaydi. Mavjud patchlar minimal darajada to'g'rilanadi:

### 8.1. P1-A Yechimi (`backend/customerOrdersSyncPatch.js`)
- `listOrders` funksiyasida, agar so'rov brauzer foydalanuvchisidan kelsa (`user.type === 'auth'`):
  - Server foydalanuvchining server tomonidan tekshirilgan ma'lumotlarini oladi: JWT claims ichidagi `claims.telegram_id` yoki `public.users` jadvalidan `telegram_id WHERE id = user.id`. (Mijoz yuborgan query yoki body parametrlariga **aslo ishonilmaydi**).
  - Agar foydalanuvchida bog'langan `telegram_id` mavjud bo'lsa:
    SQL so'rovi quyidagicha tuziladi:
    `query.or('auth_user_id.eq.' + user.id + ',telegram_id.eq.' + linkedTelegramId)`
  - Agar `telegram_id` bo'lmasa:
    `query.eq('auth_user_id', user.id)`
- Shuningdek, buyurtma yaratishda (`backend/index.js` va checkout RPC): agar mijozning ham `auth_user_id`, ham `telegram_id`si ma'lum bo'lsa, har ikkala ustun ham to'ldirilishi ta'minlanadi.

### 8.2. P1-B Yechimi (`backend/paymentReceiptFinalRuntime.js` & `src/App.tsx`)
- **Backend Auth kengaytirish:** `paymentReceiptFinalRuntime.js` dagi `customer(req)` funksiyasiga `verifyAccessToken(bearerToken)` qo'shiladi. Natijada brauzer mijozlari ham chek yuklay oladi.
- **Payment Enum normalizatsiyasi:** `order.payment` tekshiruvi faqat qat'iy `'card_manual'` bilan cheklanmay, karta to'lovining barcha standart variantlarini taniydi:
  ```js
  const isCard = ['card_manual', 'card', 'karta', 'karta (uzcard / humo)'].includes(String(order.payment || '').toLowerCase()) || String(order.payment || '').toLowerCase().includes('card') || String(order.payment || '').toLowerCase().includes('karta');
  if (!isCard) return res.status(400).json({ success: false, message: 'Bu buyurtma karta to‘lovi uchun yaratilmagan' });
  ```
- **Ownership tekshiruvi:** Agar so'rov JWT orqali kelsa va buyurtmada `auth_user_id` bo'lsa, `auth_user_id` solishtiriladi; agar buyurtma Telegram orqali yaratilgan bo'lsa, foydalanuvchining bog'langan `telegram_id`si solishtiriladi. Hech qanday boshqa shaxsning chekiga teginib bo'lmaydi.
- **Frontend soxta fallbacklarni tozalash:** `src/App.tsx` dagi mavjud bo'lmagan `/api/customer/orders/.../receipt` ga bo'lgan fallback fetchlar olib tashlanadi; haqiqiy server xatosi foydalanuvchiga to'g'ri ko'rsatiladi. `public/customer-auth-bridge.js` faylidagi buzg'unchi URL rewrite qoidasi o'chiriladi.

### 8.3. P1-C Yechimi (`backend/telegramAdminBotProduction.js`)
- `sync()` funksiyasida xabar yuborishdan oldin bazaga atomik qulflash kiritiladi:
  ```js
  const lockKey = `admin_order_album:${o.id}:${chat}`;
  const { error: lockErr } = await db.from('telegram_admin_bot_events').insert({
    event_key: lockKey,
    event_type: 'admin_order_notification',
    order_id: o.id
  });
  if (lockErr) {
    // Agar 23505 bo'lsa, demak boshqa instance allaqachon jo'natgan yoki jo'natmoqda
    continue;
  }
  ```
- Muvaffaqiyatli jo'natilgach, `telegram_admin_bot_order_messages` jadvaliga `(order_id, chat_id, message_id)` saqlanadi.
- Yangilanishlar (chek yuklanganda, status o'zgarganda) yangi xabar yubormasdan, mavjud `message_id`ni tahrirlaydi (`editMessageCaption` / `editMessageMedia`).

---

## 9. Files to Change & Files NOT to Change

### 9.1. O'zgartiriladigan Fayllar (Faqat minimal va zarur fayllar)
1. `backend/customerOrdersSyncPatch.js` — Brauzer JWT foydalanuvchisi uchun bog'langan `telegram_id` buyurtmalarini ham ko'rsatish (`P1-A`).
2. `backend/paymentReceiptFinalRuntime.js` — Brauzer JWT sessiyasini qabul qilish, payment string normalizatsiyasi, xavfsiz ownership check (`P1-B`).
3. `src/App.tsx` — Checkout'da payment qiymatini canonical enumga moslash (`card_manual`), chek yuklashda mavjud bo'lmagan `/api/customer/...` fallbackini olib tashlash (`P1-B`).
4. `public/customer-auth-bridge.js` — Receipt URL'larini mavjud bo'lmagan route'ga yo'naltiruvchi noto'g'ri regex replaceni olib tashlash (`P1-B`).
5. `backend/telegramAdminBotProduction.js` — Telegram xabarlarini yuborishdan oldin `telegram_admin_bot_events` orqali DB-backed atomik claim o'rnatish (`P1-C`).

### 9.2. O'ZGARTIRILMASLIGI KERAK BO'LGAN Fayllar
- `backend/guliCustomAuth.js` — Token yaratish va verifikatsiya mantig'i barqaror, o'zgartirilmaydi.
- `backend/canonicalAuthOnlyGuard.js` — Xavfsizlik guard'i buzilmasligi kerak.
- `backend/canonicalTelegramSessionAuthPatch.js` — Telegram auth exchange ishonchli ishlamoqda.
- `backend/adminAuth.js` — Admin autentifikatsiyasiga tegilmaydi.
- `backend/routeRegistry.js` — Markaziy registry arxitekturasi o'zgartirilmaydi.
- `backend/package.json` — Hozirgi preload zanjiri strukturasini buzmaslik uchun unga tegilmaydi (barcha o'zgarishlar faol fayllar ichida bajariladi).
- `supabase/**` — Hech qanday SQL migratsiya yoki schema o'zgarishi talab qilinmaydi.

---

## 10. Database / Schema Impact

- **Schema o'zgarishlari:** **0% (Mutlaqo yo'q).**
- Yangi jadvallar yoki ustunlar talab qilinmaydi.
- Mavjud `public.orders` jadvali (`telegram_id`, `auth_user_id`, `payment`, `payment_status`, `payment_receipt_path`), `public.users` jadvali (`id`, `telegram_id`), `public.telegram_admin_bot_events` va `public.telegram_admin_bot_order_messages` jadvallari remediation uchun 100% yetarli.
- Mavjud ma'lumotlarga zarar yetmaydi, ma'lumotlar migratsiyasi talab qilinmaydi.

---

## 11. Security Impact Analysis

1. **Autentifikatsiyani chetlab o'tish xavfi (Bypass Prevention):**
   - Kliyentdan kelgan hech qanday `auth_user_id`, `telegram_id` yoki `phone` parametriga ishonilmaydi.
   - Barcha identifikatorlar faqat serverda kriptografik jihatdan tasdiqlangan JWT tokeni yoki Telegram HMAC `initData` orqali aniqlanadi.
2. **IDOR (Insecure Direct Object Reference) oldini olish:**
   - Har bir buyurtma so'rovi va chek yuklash amali qat'iy ravishda:
     `orders.auth_user_id == verified_auth_id OR orders.telegram_id == verified_telegram_id`
     sharti bilan tekshiriladi. Begona foydalanuvchi boshqa shaxsning buyurtma raqamini bilsa ham unga kira olmaydi va chek yuklay olmaydi.
3. **Secretlar xavfsizligi:**
   - `AUTH_JWT_SECRET`, `TELEGRAM_BOT_TOKEN` yoki Supabase secret kalitlari frontendga chiqmaydi va o'zgartirilmaydi.
4. **Feyk muvaffaqiyatlar (No Fake Success):**
   - Soxta 200 OK yoki feyk `success: true` javoblari berilmaydi. Har bir xatolik haqiqiy HTTP status kodi (400, 401, 403, 404, 409) va aniq xabar bilan qaytariladi.

---

## 12. Rollback Plan (Ortga Qaytish Rejasi)

Agar kutilmagan regressiya yuzaga kelsa:
1. `git diff` orqali kiritilgan minimal o'zgarishlar darhol ko'rib chiqiladi.
2. Har bir fayl uchun Git darajasida bitta buyruq bilan ortga qaytish mumkin:
   `git checkout b6f827257b050bcc76f20615b6bce997b1bbeb38 -- <fayl_yo'li>`
3. Baza sxemasiga hech qanday DDL o'zgarish kiritilmagani sababli, ma'lumotlar bazasida hech qanday rollback skriptini yurgizish talab etilmaydi.

---

## 13. Implementation Order (Bosqichma-bosqich Amalga Oshirish)

Foydalanuvchi ruxsat berganidan so'ng quyidagi qat'iy tartibda amalga oshiriladi:

- [ ] **1-bosqich: P1-B Payment Enum & Frontend Cleanup**
  - `src/App.tsx` va `public/customer-auth-bridge.js` fayllaridagi noto'g'ri fallback va URL replace'larni olib tashlash.
  - Karta to'lovi paytida backendga canonical qiymat yuborilishini ta'minlash.
- [ ] **2-bosqich: P1-B Backend Receipt Runtime Hardening**
  - `backend/paymentReceiptFinalRuntime.js` faylida JWT autentifikatsiyasini qo'llab-quvvatlash.
  - Payment formatini normalizatsiya qilish va xavfsiz ownership tekshiruvini kiritish.
- [ ] **3-bosqich: P1-A Customer Orders Sync (Browser Orders = 0)**
  - `backend/customerOrdersSyncPatch.js` faylida brauzer JWT foydalanuvchisi uchun unga bog'langan `telegram_id` buyurtmalarini xavfsiz birlashtirish.
- [ ] **4-bosqich: P1-C Telegram Admin Notification Idempotency**
  - `backend/telegramAdminBotProduction.js` faylida `telegram_admin_bot_events` orqali xabar yuborishdan oldingi atomik DB claim mantig'ini o'rnatish.
- [ ] **5-bosqich: Lint va Build Tekshiruvi**
  - `lint_applet` va `compile_applet` orqali kod tozaligi va sintaksis to'g'riligini tasdiqlash.
- [ ] **6-bosqich: Yakuniy Xulosa va Qabul Qilish**
  - Barcha o'zgarishlar va test natijalarini foydalanuvchiga taqdim etish.

---

## 14. Remaining Unknowns / Edge Cases

1. **Eski/Meros Buyurtmalar (Legacy Orders):**
   Tizimda ilgari yaratilgan va `auth_user_id` ustuni `NULL` bo'lgan, lekin foydalanuvchisi brauzerda boshqa telefon raqami bilan ro'yxatdan o'tgan holatlar bo'lishi mumkin. Bunday hollarda faqat Telegram ID bo'yicha bog'lanish ishlaydi.
2. **Kesh va CDN holati:**
   Brauzer keshida eski `customer-auth-bridge.js` qolib ketgan bo'lsa, foydalanuvchi keshni tozalashi talab qilinishi mumkin (`Cache-Control: no-cache` orqali profilaktika qilinadi).
3. **Telegram Rate Limits:**
   Admin bot juda ko'p rasmlarni bir vaqtda yuborganida Telegram API `429 Too Many Requests` qaytarishi mumkin. Atomik claim lock'i ushbu xabarlarni qayta yuborish uchun qulflashni xavfsiz yechib yuborish mexanizmiga ega bo'lishi kerak.
