# Guli Market Reels — To‘liq ekran rejimi va tasdiqlangan profil nomini tuzatish

## Vazifa
Mavjud Reels frontend kodidagi faqat quyidagi ikki muammoni tuzat. Qolgan ishlayotgan dizayn va funksiyalarni o‘zgartirma. Avval amaldagi komponentlar, routing, CSS va testlarni tekshir; taxmin asosida yangi parallel komponent yaratma.

## 1. Reels sahifasi haqiqiy to‘liq ekran ko‘rinishida ochilsin
Hozirgi Preview’da Reels hanuz markazda joylashgan kichik, yumaloq burchakli karta ichida ko‘rinmoqda, atrofida katta qora bo‘sh joy qolgan. Bu talab bajarilmagan.

Talablar:
- Reels sahifasi ochilganda mobil viewport’ning butun mavjud veb-sahifa maydonini chetdan-chetgacha egallasin (`edge-to-edge`); markazlangan telefon maketi/karta kabi ko‘rinmasin.
- Reels konteyneriga berilgan `max-width`, `max-height`, fixed aspect ratio, katta margin/padding, `border-radius`, `box-shadow` yoki qora tashqi fon sababli paydo bo‘layotgan kartacha effektini topib, faqat Reels sahifasi uchun olib tashla yoki moslashtir.
- Mobil CSS’da `width: 100%`, `max-width: none`, `height: 100dvh` va eski brauzerlar uchun `100vh` fallback’dan foydalan. `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` bilan notch va pastki xavfsiz maydonni hisobga ol.
- `html`, `body`, root yoki umumiy app layout’ning global uslublarini o‘zgartirib boshqa sahifalarni buzma. To‘liq ekran stillarini faqat Reels route/container klassiga scope qil.
- Reels route’ga kirganda odatiy sahifa padding/margin va karta wrapper’i qo‘llanmayotganini tekshir. Agar Reels modal emas, mustaqil route bo‘lsa, route-level layout to‘g‘ri sozlansin.
- Video `object-fit: cover` bilan viewport’ni to‘ldirsin; videoning muhim qismini kesish muammosini kamaytirish uchun kerak bo‘lsa `object-position: center` qo‘llansin.
- Reels overlay elementlari (yuqori “REELS” va X, o‘ngdagi like/comment/share, pastdagi muallif/tavsif) video ustida to‘g‘ri joylashsin va ekran chetlariga yopishib qolmasin.
- Saytning pastki navigatsiyasini global ravishda o‘zgartirma. Reels sahifasida u videoni qisqartirayotgan yoki kontent ustiga chiqayotgan bo‘lsa, faqat Reels route layout’ida to‘g‘ri hisobga ol; qolgan sahifalarda o‘zgarish bo‘lmasin.
- Brauzerning o‘z adres satri, Android status bar va OS navigatsiyasini oddiy web CSS bilan yashirishga urinma. Maqsad — sayt ichidagi Reels kontentini mavjud viewport bo‘ylab to‘liq yoyish.
- Desktop’da ham kartacha o‘rniga katta, moslashuvchan Reels ko‘rinishi bo‘lsin, lekin saytning boshqa sahifalariga tegma.

## 2. Muallif nomi va tasdiqlash belgisi
Hozirgi screenshot’da muallif qatori **“Guli Market @gulii.uz ✓”** ko‘rinishida. Tasdiqlash belgisi `@gulii.uz` yonida turibdi; bu noto‘g‘ri.

Talablar:
- Muallif satrida quyidagi tartib bo‘lsin:
  **[Guli Market logotipi]  Guli Market  [tasdiqlash belgisi]**
- `@gulii.uz` matnini muallif satridan olib tashla.
- Tasdiqlash belgisi faqat **Guli Market** nomidan keyin ko‘rinsin; username yoki boshqa matn yonida bo‘lmasin.
- Agar tasdiqlash belgisi ikonka bo‘lsa, nom bilan vertikal tekislangan, o‘qilishi oson va kichik o‘lchamda bo‘lsin. Rang va stil mavjud Guli Market dizayniga mos bo‘lsin.
- Har bir Reels’da aynan bir xil muallif qatori ko‘rsatilsin. Demo ma’lumotlarda username yoki muallif nomi turlicha bo‘lsa ham, UI’da yagona standartdan foydalan.
- Logotip rasm manbai loyihada mavjud haqiqiy Guli Market logo fayliga bog‘lansin. Fayl yo‘lini taxmin qilib yangi buzilgan rasm manbai kiritma; mavjud public asset va import’larni tekshir.

## 3. O‘zgarmasligi kerak bo‘lgan qismlar
Quyidagilarni qayta ishlab chiqma, chunki ular hozir ishlayapti:
- ovozsiz avtomatik ijro;
- Play/Pause overlay animatsiyasi;
- vertikal swipe/scroll va keyingi/oldingi Reels o‘tishi;
- dastlabki 3 ta rolikni preload qilish va keyingi roliklar navbati;
- like, comment, share, mahsulot kartasi;
- “REELS” yorlig‘i va neon indikator;
- boshqa sahifalarning navigatsiyasi va dizayni.

## 4. Tekshiruv va qabul mezonlari
1. Mobil Preview’da Reels atrofida katta qora bo‘sh joy va markazlangan kichik karta qolmaydi; kontent viewport’ni chetdan-chetgacha to‘ldiradi.
2. Reels kartasida telefon ramkasi ko‘rinishi, sun’iy `max-width` yoki keraksiz yumaloq burchaklar qolmaydi.
3. Pastki navigatsiya boshqa sahifalarda avvalgidek ishlaydi.
4. Muallif qatori **Guli Market ✓** ko‘rinishida; `@gulii.uz` ko‘rinmaydi va tasdiqlash belgisi faqat nomdan keyin turadi.
5. Video yuklanmagan holatdagi error/retry ko‘rinishi ham full-screen layout’da to‘g‘ri ko‘rinadi.
6. Mavjud funksiyalar regressiyaga uchramaydi.
7. Build, lint va barcha mavjud testlar ishga tushirilib, natijalari hisobotda aniq ko‘rsatiladi.
8. Faqat ushbu ikki muammoga aloqador fayllarni o‘zgartir; backend, Supabase, Telegram yoki media hosting integratsiyasini qo‘shma.
9. Agar Preview deployment qilinsa, faqat yangi deployment `READY` bo‘lib, URL tasdiqlangandan keyin yangi preview havolasini ber.

## Yakuniy hisobot
- O‘zgartirilgan fayllar ro‘yxati.
- Full-screen muammoning aniq root cause’i va qanday tuzatilgani.
- Muallif satrining oldingi/yangi ko‘rinishi.
- Build/lint/test natijalari.
- Yangi Preview URL faqat tekshirilgan bo‘lsa.
