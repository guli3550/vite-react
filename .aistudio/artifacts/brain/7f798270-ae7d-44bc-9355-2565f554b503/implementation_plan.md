# Guli Market — Professional Video Ads Moduli

Guli Market (gulii.uz) va Telegram Mini App uchun to‘liq funksional, yuqori konversiyali va resurslarni tejovchi professional video reklama moduli. Modul Admin Panel orqali video reklamalarni yaratish, tahrirlash, statistikasini (ko‘rishlar, bosishlar, CTR) tahlil qilish va ularni xaridorlarga bosh sahifada hamda mahsulotlar oqimida (In-feed) ko‘rsatish imkoniyatini taqdim etadi.

---

## Foydalanuvchi tanlovlari va muhim qarorlar

> [!IMPORTANT]
> 1-bosqichda foydalanuvchi tomonidan tasdiqlangan talablar:
> - **Reklama joylashuvi**: Bosh sahifada (Home - asosiy bannerlar ostida) va Mahsulotlar oqimida (In-feed katalog/featured kartalari orasida).
> - **Video manbasi**: Ikkala usul ham to‘liq qo‘llab-quvvatlanadi — Supabase Storage orqali video fayllarni yuklash va to‘g‘ridan-to‘g‘ri video URL (CDN, R2 yoki tashqi video havola) kiritish.
> - **Ijro va boshqaruv mexanizmi**: Ovozli avtomatik ijroga intilish (zamonaviy brauzerlar va Telegram WebApp siyosati talab qilganda ovozsiz avtomatik ijro va 1-bosishda ovozni faollashtirish bilan); qulay ovozni o‘chirish/yoqish (`Mute/Unmute`) tugmasi hamda foydalanuvchi xohishiga ko‘ra reklamani yashirish (`Dismiss/Yopish`) funksiyasi.

---

## 1. Umumiy tushuncha va mahsulot qiymati

- **Nima vazifani bajaradi**: Guli Market ma'muriyati uchun maxsus aksiyalar, yangi to‘plamlar va brend videolarini boshqarish tizimi. Mijozlar e'tiborini tortuvchi harakatlanuvchi video reklamalarni ko‘rsatadi va “Batafsil” tugmasi orqali bevosita mahsulot, toifa yoki aksiya sahifasiga yo‘naltiradi.
- **Maqsadli auditoriya**: gulii.uz veb-sayti va Telegram Mini App orqali xarid qiluvchi mijozlar hamda ularni boshqaruvchi do‘kon ma'murlari.
- **Asosiy qiymat**: Statik bannerlarga nisbatan 3–5 barobar yuqori konversiya, mahsulotlarni jonli ko‘rsatish imkoniyati, trafik va mobil internet sarfini tejovchi optimallashtirilgan video arxitektura.

---

## 2. Foydalanuvchi tajribasi va vizual dizayn (UI/UX)

Guli Market'ning mavjud premium uslubiga (rose pink, bordo, toza oq va neytral silliq yuzalar) to‘liq mos keluvchi dizayn:

### A. Mijozlar tomoni (Storefront & Telegram Mini App)

1. **Bosh sahifa video reklama kartasi (`home` placement)**:
   - 16:9 yoki 4:3 nisbatdagi nafis video ramka, silliq burchaklar (`rounded-2xl`).
   - Video yuklangunga qadar yengil gradientli poster/cover ko‘rinadi (flicker va bo‘sh joy yo‘q).
   - Video tepasida: “Reklama” yozuvi va o‘ng tomonda reklamani yopish (`X`) tugmasi.
   - Video pastki qismida: Ovozni boshqarish (`Mute / Unmute`) piktogrammasi.
   - Matn qatlami: Reklama sarlavhasi, qisqa ta'rif va asosiy harakatga chaqiruvchi “Batafsil” (yoki admin belgilagan maxsus matn) tugmasi.
   - Reklama yopilganda joriy sessiyada foydalanuvchiga qayta xalaqit bermaydi.

2. **Mahsulotlar oqimidagi in-feed video karta (`product_feed` placement)**:
   - Katalog yoki saralangan mahsulotlar to‘rida (Product Grid) mahsulot kartasi bilan bir xil proporsiyada tabiiy ravishda uyg‘unlashgan karta.
   - Scroll qilib reklama ko‘ringanda (Intersection Observer yordamida) ijro boshlanadi, ekrandan chiqqanda pauza bo‘lib batareya va trafikni tejaydi.
   - Bosilganda tegishli mahsulot tafsiloti sahifasiga ravon o‘tadi.

### B. Admin Panel (`Marketing → Video reklamalar`)

1. **Statistika va KPI ko‘rsatkichlari (4 ta ixcham karta)**:
   - Jami faol video reklamalar soni.
   - Haqiqiy ko‘rishlar soni (Impressions).
   - “Batafsil” tugmasi bosilishlari (Clicks).
   - CTR samaradorlik foizi (`(clicks / impressions) * 100%`).

2. **Reklamalar jadvali va boshqaruv ro‘yxati**:
   - Poster va video preview eskizi.
   - Reklama nomi va joylashuvi (`Bosh sahifa`, `Mahsulotlar oqimi`, `Barchasi`).
   - Platforma nishoni (`Sayt`, `Telegram Mini App`, `Barchasi`).
   - Amal qilish muddati (Boshlanish — Tugash sanalari).
   - Faollik holatini bitta bosishda yoqish/o‘chirish (Toggle switch).
   - Ko‘rishlar va bosishlar hisoblagichi.
   - Harakatlar: `Tahrirlash`, `Holatni o‘zgartirish`, `Arxivlash/O‘chirish`.

3. **Yangi reklama yaratish va tahrirlash modali**:
   - Reklama nomi va qisqa matni.
   - Video kiritish tanlovi: Fayl yuklash (MP4, WebM) yoki to‘g‘ridan-to‘g‘ri Video URL.
   - Poster (muqova) rasmini tanlash yoki videodan avtomatik kadr olish.
   - Destination: Ichki mahsulotni tanlash (dropdown orqali) yoki tashqi xavfsiz URL (`https://...`).
   - CTA tugmasi matni (masalan: `Batafsil`, `Xarid qilish`, `Aksiyani ko‘rish`).
   - Joylashuv (`home`, `product_feed`, `all`) va Platforma (`all`, `web`, `telegram`).
   - Ko‘rsatish davri: boshlanish va tugash sanasi/vaqti.
   - Prioritet (tartiblash darajasi) va chastota chegarasi (frequency cap).
   - Saqlashdan oldin jonli interaktiv Video Preview (o‘lcham, davomiylik va poster ko‘rinishi).

---

## 3. Asosiy texnik qarorlar va afzalliklar

1. **Video fayllarni saqlash strategiyasi**:
   - *Tanlangan yechim*: Supabase Storage `video-ads` public bucketi + CDN URL manbalarini to‘g‘ridan-to‘g‘ri kiritish.
   - *Afzalligi*: Ma'lumotlar bazasida og‘ir Base64 fayllar saqlanmaydi; database hajmi shishib ketmaydi; xalqaro CDN orqali tezkor streaming ta'minlanadi.

2. **Brauzer va Telegram WebApp Autoplay siyosati**:
   - *Tanlangan yechim*: Dastlab ovozli ijroga urinish (`play()` bilan audio yoqilgan holda). Agar brauzer/qurilma xavfsizlik siyosati tufayli unmuted autoplay bloklansa, darhol xatosiz muted rejimiga o‘tib, foydalanuvchiga ovozni 1 ta bosish bilan yoqish taklif qilinadi.
   - *Afzalligi*: Sahifa muzlab qolmaydi, mobil foydalanuvchilarda audio kutilmaganda quloqni og‘ritmaydi, lekin ruxsat berilgan muhitlarda ovozli to‘liq tajriba ishlaydi.

3. **Trafik va Resurslarni tejash (Intersection Observer & Lazy Loading)**:
   - *Tanlangan yechim*: `preload="none"` yoki `preload="metadata"`, videoni faqat u ekranning 40% ko‘rinadigan qismiga kelgandagina yuklash va ijro etish. Foydalanuvchi skroll qilib o‘tib ketganda ijro avtomatik to‘xtatiladi.
   - *Afzalligi*: Ortiqcha internet sarflanmaydi, sayt yuklanish tezligi pasaymaydi.

4. **Statistika va spamdan himoya**:
   - *Tanlangan yechim*: Har bir renderda emas, faqat foydalanuvchi videoni kamida 1.5 soniya ko‘rganda 1 marta impression yuboriladi (sessiya bo‘yicha deduplication bilan). Bosishlar soni alohida qayd etiladi.

---

## 4. Texnik arxitektura va ma'lumotlar oqimi

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GULI MARKET STOREFRONT                        │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │  Home Video Ad Card       │      │  In-Feed Video Card         │   │
│   │  (Intersection Observer)  │      │  (Catalog Product Stream)   │   │
│   └─────────────┬─────────────┘      └──────────────┬──────────────┘   │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │                   
                  │ GET /api/video-ads?placement=...  │ POST /events      
                  ▼                                   ▼                   
┌────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS BACKEND RUNTIME                         │
│                     (backend/videoAdsRuntime.js)                       │
│                                                                        │
│  • Public Routes:                                                      │
│    - GET  /api/video-ads (Active, unexpired, filtered by placement)    │
│    - POST /api/video-ads/:id/events (Impression, click, view)          │
│                                                                        │
│  • Protected Admin Routes (requireAdmin middleware):                   │
│    - GET    /api/admin/video-ads                                       │
│    - POST   /api/admin/video-ads                                       │
│    - PUT    /api/admin/video-ads/:id                                   │
│    - PATCH  /api/admin/video-ads/:id/status                            │
│    - DELETE /api/admin/video-ads/:id                                   │
│    - GET    /api/admin/video-ads/stats                                 │
│    - POST   /api/admin/video-ads/upload (video & poster upload)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE POSTGRESQL & STORAGE                     │
│                                                                        │
│  • Tables: public.video_ads, public.video_ad_events                    │
│  • Storage Bucket: 'video-ads' (Public videos & posters)               │
│  • Row Level Security (RLS): Read active ads, admin writes only        │
└────────────────────────────────────────────────────────────────────────┘
```

### Yangi yaratiladigan va integratsiya qilinadigan fayllar:

1. **Ma'lumotlar bazasi**:
   - `supabase/migrations/20261028_video_ads.sql` — `video_ads` va `video_ad_events` jadvallari, indekslar, RLS qoidalari va xavfsizlik cheklovlari.
2. **Backend**:
   - `backend/videoAdsRuntime.js` — Barcha public va admin API endpointlari, Supabase ulanishi, validatsiya va xavfsizlik filtrlari.
   - `backend/index.js` — Modulni ro‘yxatdan o‘tkazish (`require("./videoAdsRuntime");`).
3. **Frontend mijoz komponentlari**:
   - `src/types/videoAd.ts` — TypeScript interfeyslari va turlari.
   - `src/components/videoAds/VideoAdCard.tsx` — Qayta ishlatiluvchi, ovoz va yopish boshqaruviga ega video reklama komponenti.
   - `src/components/videoAds/VideoAdCard.css` — Premium animatsiyalar, hover effektlar va mobil moslashuvchanlik.
   - `src/App.tsx` — Bosh sahifa va Mahsulotlar katalogiga video kartalarni integratsiya qilish.
4. **Admin Panel**:
   - `src/admin/components/VideoAdsAdminTab.tsx` — Video reklamalar boshqaruv paneli, KPI statistika kartalari, ro‘yxat, yoqish/o‘chirish.
   - `src/admin/components/VideoAdModal.tsx` — Yaratish va tahrirlash modali, video yuklash/URL kiritish va jonli ko‘rish.
   - `src/admin/AdminSidebarData.ts` & `src/admin/AdminPro.tsx` — Navigatsiya va Marketing bo‘limiga integratsiya.
5. **Testlar va Hujjatlar**:
   - `tests/videoAdsLogic.test.mjs` — Validatsiya, statistika hisoblash, vaqt filtrlash va xavfsiz URL tekshiruvlari testlari.
   - `docs/VIDEO_ADS_SETUP.md` — Supabase SQL migratsiyasini bajarish, Storage bucket sozlash va Render/Vercel yo‘riqnomasi.

---

## 5. Test va tekshiruv strategiyasi

1. **TypeScript & Build tekshiruvi**: `npm run build` orqali to‘liq kompilyatsiyani tekshirish (`0 errors`).
2. **Linter tekshiruvi**: `npm run lint` orqali sintaksis va importlar tozaligini ta'minlash.
3. **Mantiqiy va integratsion testlar**:
   - Faol bo‘lmagan yoki muddati o‘tgan reklamalar public API javobida chiqmasligi.
   - Xavfli URL manzillar (`javascript:`, `data:`) server tomonidan qat'iy rad etilishi.
   - CTR formulasi (`clicks / impressions * 100%`) nol holatlarida xato bermasdan `0%` qaytarishi.
   - Ovozli avtomatik ijro imkoni bo‘lmaganda poster va ovozsiz fallback to‘g‘ri ishlashi.
   - Video yuklashda hajmni cheklash (masalan, 25MB limit) va xatolik matnlarini to‘g‘ri ko‘rsatish.
   - Mavjud rasmli bannerlar va mahsulotlar oqimining xatosiz ishlashini saqlab qolish.

---

## 6. Serverga bog‘liq ishlarni bajarish qo‘llanmasi

Deploy paytida foydalanuvchi bajarishi kerak bo‘lgan aniq qadamlar `docs/VIDEO_ADS_SETUP.md` faylida to‘liq tayyorlanadi:
1. Supabase SQL Editor'da `supabase/migrations/20261028_video_ads.sql` skriptini ishga tushirish.
2. Supabase Storage bo‘limida `video-ads` nomli public bucket yaratish (agar yo‘q bo‘lsa).
3. Mavjud Render va Vercel environment o‘zgaruvchilariga tegilmaydi (mavjud `SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` yetarli).
