# GULI MARKET --- VIDEO REKLAMA QOTISHI VA BUFFERING MUAMMOSINI CHUQUR TEXNIK AUDIT QILISH

## 1. Muammo tavsifi

Admin panelida video reklama muvaffaqiyatli yuklanmoqda va saqlanmoqda.
Ammo asosiy Guli Market sahifasida video ijro vaqtida to'xtab-to'xtab
o'ynayapti (buffering, stuttering, playback freeze). Muammo Android
telefonlarda, ayniqsa 4G mobil internetda kuzatilmoqda.

Faqat internet tezligini aybdor deb taxmin qilma. Haqiqiy sababni
dalillar bilan aniqlash kerak.

## 2. Loyiha texnologiyalari

-   Frontend: React + TypeScript + Vite
-   Backend: Node.js + Express
-   Database va video saqlash: Supabase / Supabase Storage
-   Frontend hosting: Vercel
-   Backend hosting: Render
-   Asosiy domen: https://gulii.uz
-   Foydalanish muhiti: Android Chrome va Telegram Mini App

## 3. Audit yo'nalishlari

### A. Video fayllarining texnik xususiyatlari

Supabase Storage'dagi video fayllarni tekshir:

-   Format: MP4, WebM yoki boshqa
-   Video kodeki: H.264, H.265 yoki boshqa
-   Audio kodeki: AAC yoki boshqa
-   Resolution, FPS, bitrate va fayl hajmi
-   Keyframe interval
-   MP4 ichidagi `moov atom` joylashuvi
-   Progressive playback uchun `fast start` mavjudligi

Video fayllarning o'zi mobil qurilmada ravon ijro etishga mosligini
aniqlash. Yuqori bitrate, katta resolution yoki mos kelmaydigan kodek
muammoga sabab bo'layotgan bo'lsa, dalil bilan ko'rsat.

### B. Supabase Storage va CDN auditi

Har bir video URL uchun quyidagilarni tekshir:

-   HTTP status code, `Content-Type`, `Content-Length`
-   `Accept-Ranges: bytes`
-   `Content-Range` va HTTP Range Request
-   `206 Partial Content` javobi
-   `Cache-Control` va CDN cache holati
-   Video yuklanish tezligi
-   Bir video bir necha marta yuklanmayotgani
-   Supabase egress quota va trafik cheklovlari

Mobil qurilma videoni to'liq yuklab bo'lishini kutmasdan ijro eta
olishini tekshir.

### C. Frontend video player auditi

Repository ichidan asosiy sahifadagi video reklama ijrosiga tegishli
barcha komponentlarni top. Quyidagilarni tekshir:

-   HTML5 `<video>` elementining sozlamalari
-   `preload`, `autoplay`, `muted`, `playsInline`
-   `src` va `poster` yuklanish tartibi
-   Video qayta-qayta mount/unmount bo'lishi
-   React state o'zgarishlari sababli player qayta yaratilishi
-   `useEffect` va event listenerlarning boshqarilishi
-   Bitta video uchun bir nechta player yaratilishi
-   Keraksiz React renderlar va API so'rovlari

Quyidagi eventlarni diagnostika qil:

`waiting`, `stalled`, `playing`, `canplay`, `canplaythrough`,
`progress`, `suspend`, `error`, `timeupdate`.

`readyState`, `networkState`, `buffered` va `currentTime` qiymatlarini
kuzatib, video nima sababdan to'xtayotganini aniqlashga harakat qil.

### D. Android va performance auditi

Android Chrome va Telegram Mini App muhitlarini alohida tekshir:

-   CPU yoki RAM yetishmasligi
-   GPU va video decoding muammolari
-   Bir vaqtda bir nechta video yuklanishi
-   Orqa fonda ishlayotgan videolar
-   Keraksiz animatsiyalar
-   Video ustidagi overlay va CSS effektlari
-   Internet tezligi o'zgarishiga player javobi
-   Buffer to'lish va video dekodlash tezligi

### E. Backend va API auditi

Backend orqali video URL qayta ishlansa, quyidagilarni tekshir:

-   Video URL noto'g'ri o'zgartirilishi
-   API video faylni keraksiz qayta uzatishi
-   Redirect yoki proxy sababli ortiqcha kechikish
-   Video URL uchun ortiqcha API so'rovlari
-   Render serveriga video uzatish sababli keraksiz yuk tushishi

Video to'g'ridan-to'g'ri Supabase Storage'dan yuklansa, backendni video
uzatish jarayoniga ortiqcha jalb qilma.

### F. Oldingi optimizatsiyalar

GitHub'dagi `main` branch, video ijrosiga oid PR va commitlarni tekshir.
Ayniqsa quyidagilarni ko'rib chiq:

-   Faqat faol video preload qilinishi
-   `timeupdate` sababli keraksiz React renderlar kamaytirilishi
-   Progress bar CSS transform orqali yangilanishi
-   Mobil buffering holatidan tiklanish mexanizmi

Bu o'zgarishlar production'da mavjud yoki mavjud emasligini aniq
tekshir. Mavjud bo'lmagan kodni ishlab chiqarilgan deb hisoblama.

## 4. Asosiy diagnostika savollari

1.  Video bitrate yoki kodeki sabab bo'lyaptimi?
2.  Supabase Storage yoki CDN ma'lumotlarni sekin uzatyaptimi?
3.  HTTP Range Request to'g'ri ishlayaptimi?
4.  Frontend video player noto'g'ri sozlanganmi?
5.  React renderlari yoki JavaScript asosiy oqimi ijroni to'xtatyaptimi?
6.  Android video decoding imkoniyati bilan bog'liq muammo bormi?
7.  Video bir necha marta yuklanib, tarmoqni band qilyaptimi?
8.  Supabase egress limiti yoki hosting cheklovi bormi?

Har bir ehtimolni quyidagilardan biri bilan belgila:

-   `TASDIQLANGAN`
-   `RAD ETILGAN`
-   `TEKSHIRISH UCHUN MA'LUMOT YETARLI EMAS`

Taxminni fakt sifatida ko'rsatma.

## 5. Audit hisoboti formati

Natijani quyidagi tartibda taqdim et:

1.  Muammoning asosiy sababi
2.  Sababni tasdiqlovchi kod, log, HTTP javob yoki o'lchovlar
3.  Muammoga ta'sir qilayotgan fayllar va komponentlar
4.  Ikkinchi darajali sabablar
5.  Tavsiya etiladigan yechimlar
6.  Yechimlarning ustuvorlik tartibi
7.  Kutilayotgan performance yaxshilanishi
8.  Tekshirish uchun zarur bo'lgan qo'shimcha ma'lumotlar

## 6. Qat'iy cheklovlar

-   Hozircha hech qanday kodni o'zgartirma.
-   Hech qanday faylni o'chirma.
-   Database strukturasi yoki mavjud videolarni o'zgartirma.
-   Production deployment qilma.
-   Avval faqat chuqur audit va diagnostika o'tkaz.
-   Har bir xulosani real kod, log yoki texnik o'lchov bilan asosla.
-   Real qurilmada tekshirish imkoni bo'lmasa, buni ochiq yoz.
-   Ishlayotgan Reels, video reklama, admin panel va boshqa
    funksiyalarga zarar yetkazishi mumkin bo'lgan yechimlarni taklif
    qilma.

## Yakuniy maqsad

Guli Market asosiy sahifasidagi video reklamalar Android telefonlarda,
ayniqsa 4G mobil internet orqali, to'xtamasdan, ravon va tez yuklanib
ijro etilishi kerak.

**Hozirgi vazifa --- kodni shunchaki optimallashtirish emas, balki video
nima sababdan qotayotganini aniq topish va dalillarga asoslangan
tuzatish rejasini ishlab chiqish.**
