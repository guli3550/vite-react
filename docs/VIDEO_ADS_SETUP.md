# Guli Market — Video Reklamalar Modulini O‘rnatish va Ishga Tushirish Qo‘llanmasi

Ushbu qo‘llanma **Guli Market (gulii.uz)** loyihasiga qo‘shilgan yangi professional Video Ads (video reklama) modulini Supabase, Render va Vercel serverlarida xavfsiz ishga tushirish uchun mo‘ljallangan.

---

## 1. Supabase Ma'lumotlar Bazasida Migratsiyani Bajarish

Ushbu qadam mavjud ma'lumotlarga zarar yetkazmagan holda yangi `video_ads` va `video_ad_events` jadvallarini, indekslarini hamda RLS xavfsizlik qoidalarini yaratadi.

### Qadamlar:
1. [Supabase boshqaruv paneliga](https://app.supabase.com) kiring va Guli Market loyihasini oching.
2. Chap menyudan **SQL Editor** bo‘limiga o‘ting.
3. Yangi so‘rov (New Query) yarating.
4. Repository ichidagi `supabase/migrations/20261028_video_ads.sql` fayli tarkibini to‘liq nusxalab, SQL Editor'ga joylashtiring.
5. **Run** (bajarish) tugmasini bosing.
6. Natijada `Success. No rows returned` xabari chiqadi.

---

## 2. Supabase Storage Bucketini Tekshirish / Yaratish

Video fayllar va poster rasmlarini yuklash uchun `video-ads` nomli public bucket kerak bo‘ladi. (Yuqoridagi migratsiya skripti bu bucketni avtomatik ro‘yxatga oladi).

### Qo‘lda tekshirish:
1. Supabase chap menyusidan **Storage** bo‘limiga kiring.
2. `video-ads` nomli bucket mavjudligini va **Public bucket: ON** holatida ekanligini tasdiqlang.
3. Agar mavjud bo‘lmasa, **New bucket** tugmasini bosing:
   - Name: `video-ads`
   - Public bucket: **Yoqilgan (Checked)**
   - Save tugmasini bosing.

---

## 3. Environment O‘zgaruvchilari (Render & Vercel)

Video reklama moduli mavjud Supabase va Admin autentifikatsiyasidan foydalanadi. Yangi o‘zgaruvchilar qo‘shish shart emas.

### Mavjud talab qilinuvchi o‘zgaruvchilar (Render):
- `SUPABASE_URL` — Supabase loyihangiz URL manzili.
- `SUPABASE_SECRET_KEY` (yoki `SUPABASE_SERVICE_ROLE_KEY`) — Supabase backend service roli kaliti.
- `ADMIN_PASSWORD` va `ADMIN_USERNAME` — Admin panelga kirish hisob ma'lumotlari.

### Vercel (Frontend):
- `VITE_API_URL` — Backend gateway manzili (masalan: `https://guli-gateway.parizodabaxtiyorov.workers.dev`).

---

## 4. Production Deploy’dan Oldingi Tekshiruv (Pre-flight Checklist)

- [x] TypeScript kompilyatsiyasi xatosiz o‘tdi (`npm run build`).
- [x] Linter qoidalari tekshirildi (`npm run lint`).
- [x] Mantiqiy testlar muvaffaqiyatli yakunlandi (`npm test`).
- [x] Public API faqat faol va muddati o‘tmagan reklamalarni ko‘rsatadi.
- [x] Xavfli URL manzillar (`javascript:`, `data:`) qat'iy rad etiladi.
- [x] CTR hisoblashda 0 ko‘rish bo‘lganda bo‘linish xatosi bo‘lmaydi.
- [x] Ovozli avtomatik ijro bloklanganda avtomatik ovozsiz rejimga xatosiz o‘tiladi.
- [x] Mavjud bannerlar va mahsulotlar oqimiga zarar yetkazilmagan.

---

## 5. Deploy’dan Keyingi Sinov (Post-Deploy Health Check)

1. **Admin Panelga kirish**:
   - `gulii.uz/admin` yoki admin sahifasini oching.
   - Chap menyudan **Marketing → Video reklamalar** bo‘limiga o‘ting.
   - 4 ta KPI kartasi (`Jami faol reklamalar`, `Ko‘rishlar`, `Bosishlar`, `CTR`) chiqayotganini tekshiring.
2. **Yangi reklama yaratish**:
   - “+ Yangi video reklama” tugmasini bosing.
   - MP4 video yuklang yoki to‘g‘ridan-to‘g‘ri video URL kiriting.
   - Jonli videoni preview oynasida ko‘rib, “Reklamani yaratish” tugmasini bosing.
3. **Mijoz tomonida tekshirish**:
   - gulii.uz bosh sahifasini brauzerda oching: Rotating Categories ostida video reklama kartasi ko‘rinadi.
   - Ovozni yoqish (`🔊`) va reklamani yopish (`✕`) tugmalarini tekshiring.
   - “Batafsil” tugmasi bosilganda tegishli manzilga to‘g‘ri o‘tishini tasdiqlang.
   - Katalog sahifasida mahsulotlar oqimi (in-feed) orasida ham video karta chiqishini tekshiring.

---

## 6. Rollback (Ortga Qaytarish) Rejasi

Agar kutilmagan holat yuz bersa:
1. **Frontend/Backend**: Git orqali oldingi commit'ga qaytarish yoki Vercel/Render boshqaruv panelida oldingi deployment'ni `Instant Rollback` qilish mumkin.
2. **Database**: Migratsiyani bekor qilish uchun Supabase SQL Editor'da quyidagilarni bajarish kifoya:
   ```sql
   DROP TABLE IF EXISTS public.video_ad_events CASCADE;
   DROP TABLE IF EXISTS public.video_ads CASCADE;
   ```
Mavjud buyurtmalar, mijozlar va bannerlar ma'lumotlariga mutlaqo daxl qilinmaydi.
