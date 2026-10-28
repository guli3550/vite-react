# Guli Market Reels — Dizayn farqlarini tuzatish va Instagram-uslubidagi lenta

## Maqsad
Mavjud Guli Market Reels frontend prototipini foydalanuvchi yuborgan Instagram Reels skrinshotlariga yaqin UX bilan takomillashtir. Avval mavjud repository va Reels komponentlarini tekshir, so‘ng quyidagi o‘zgarishlarni mavjud arxitekturaga mos ravishda amalga oshir. **Bu bosqichda faqat dizayn va frontend xatti-harakatlari**: backend, Supabase, Telegram, media hosting yoki production integratsiyasini qo‘shma.

## 1. Ovoz va pause belgisi
- Reels interfeysidan ovozni yoqish/o‘chirish tugmasini butunlay olib tashla.
- Reels dastlab ovozsiz ijro etilsin. Ovoz boshqaruvi uchun alohida tugma ko‘rsatilmasin; brauzer autoplay cheklovlariga rioya qil.
- Video pause bo‘lganda oddiy, kichik va doimiy ko‘rinadigan belgi qoldirma. Video markazida zamonaviy, aniq Play/Pause overlay ko‘rsat:
  - Pause holatida foydalanuvchi videoga tegsa, video davom etsin va Play belgisi qisqa animatsiya bilan yo‘qolsin.
  - Ijro holatida foydalanuvchi videoga tegsa, video pauza bo‘lsin va Pause indikatori qisqa muddat ko‘rinsin.
- Belgining o‘lchami, kontrasti va animatsiyasi mobil ekranda tushunarli bo‘lsin; video ustidagi matn va amallarni to‘sib qo‘ymasin.

## 2. Profil / muallif ko‘rinishi
- Har bir Reels muallifi qismi bir xil standartda ko‘rinsin: Guli Market logotipi profil rasmi sifatida va profil nomi **Guli Market**.
- Profil rasmi ostida, yonida yoki ustida kichik “+” belgisi ko‘rsatilmasin; faqat Guli Market logotipi va “Guli Market” nomi qolsin.
- Barcha Reels’larda muallif nomi bir xil **Guli Market** bo‘lsin; demo ma’lumotlarda turli nomlar bo‘lsa, foydalanuvchi interfeysida yagona brend nomiga normalizatsiya qil.
- Profil rasmi bosilganda hozircha maxsus profil sahifasiga o‘tish shart emas; keraksiz interaktivlik qo‘shma.

## 3. Yuqori sarlavha
- Reels oynasining yuqorisidagi **“GULI”** matnini olib tashla.
- Yuqorida faqat **“REELS”** belgisi va yonidagi kichik neon/yashil indikator chirog‘i qolsin.
- Joylashuv, padding va kontrast telefon ekranlarida qulay bo‘lsin.

## 4. Reels to‘liq ekran tajribasi
- Hozirgi Reels alohida kichik, yumaloq burchakli karta/oynacha ichida ko‘rinmoqda. Ushbu konteyner ko‘rinishini olib tashla.
- Mobil qurilmada Reels sahifasi Instagram Reels kabi **to‘liq ekran (edge-to-edge)** tajribasiga o‘tsin: video oynasi ekranning mavjud ko‘rinadigan maydonini to‘liq egallasin, ortiqcha qora tashqi fon, markazlangan kichik karta, katta margin va kartaga xos yumaloq burchaklar bo‘lmasin.
- Status bar, brauzer interfeysi va operatsion tizim navigatsiyasi veb-sahifa tomonidan boshqarib bo‘lmaydigan joylarda majburan yashirilmasin; CSS safe-area va `100dvh`/fallback’lardan foydalan.
- Saytning mavjud pastki navigatsiyasini o‘zgartirma. Reels sahifasida u video ustiga chiqib ketmasin; layout’da to‘g‘ri hisobga olinsin. Navigatsiya tugmalari va marshrutlarini qayta loyihalama.

## 5. Instagram-uslubidagi vertikal lenta va o‘tish animatsiyasi
- Bitta video markazda turgan statik karta o‘rniga vertikal, uzluksiz Reels lentasini yarat.
- Foydalanuvchi yuqoriga swipe qilganda keyingi Reels pastdan yuqoriga silliq kirib kelsin; pastga swipe qilganda oldingi Reels qaytsin.
- O‘tish paytida keyingi/oldingi videoning bir qismi ko‘rinib, Instagram’dagi kabi tabiiy scroll hissi berilsin. Keskin sahifa almashishi yoki bo‘sh qora ekran bo‘lmasin.
- Touch swipe, mouse/touchpad scroll, klaviatura ↑/↓ va Space boshqaruvlarini qo‘llab-quvvatla; gesture ishlatilganda like, comment va share tugmalarining bosilishi buzilmasin.
- Faol Reels ijro etilsin; ekrandan chiqib ketgan videolar pauza qilinsin. Bir vaqtning o‘zida faqat faol Reels ijro etishga harakat qilsin.
- Animatsiya `prefers-reduced-motion` sozlamasini hurmat qilsin.

## 6. Dastlabki va keyingi videolarni oldindan yuklash
- Reels bo‘limi ochilishi bilan dastlabki **3 ta Reels** uchun metadata, poster va video preload boshlansin.
- Lenta indekslari quyidagicha siljisin:
  - 1-rolik faol: 1, 2, 3 oldindan yuklangan.
  - 2-rolik faol: 2, 3, 4 yuklangan bo‘lsin.
  - 3-rolik faol: 3, 4, 5 yuklangan bo‘lsin.
- Joriy rolikdan keyingi 2 ta rolikni oldindan tayyorla; kerak bo‘lsa oldingi bitta rolik metadata/posterini saqla. Barcha videolarni birdaniga to‘liq yuklab olma.
- Video elementlarida `preload="metadata"` yoki mos ehtiyotkor strategiyani qo‘llab, joriy videoni tez ishga tushirish va mobil trafikni tejash o‘rtasida muvozanat saqla.
- Poster va metadata tezkor ko‘rsatilishi uchun brauzer keshlashidan foydalan. Agar vaqtinchalik `blob:` URL yaratilsa, undan foydalanish tugagach `URL.revokeObjectURL` chaqir.
- Bu bosqichda maxsus Service Worker, IndexedDB, Cache API yoki server-side caching arxitekturasini qo‘shma, agar loyiha allaqachon shunday qatlamga ega bo‘lmasa. Haqiqiy persistent cache va cache invalidation keyingi backend/media integratsiyasi bosqichida ko‘rib chiqilsin.
- Video URL yuklanmasa, xatoni ushla va poster bilan qayta urinish UI’ini ko‘rsat; lenta boshqa videolarga o‘tish imkonini yo‘qotmasin.

## 7. Responsive dizayn va mavjud funksiyalar
- Mobil qurilmada Reels kontenti to‘liq ekran tajribasiga ega bo‘lsin; desktop’da esa mavjud sayt konteyneriga mos, video imkon qadar katta ko‘rinsin.
- Like, comment, share, mahsulot kartasi va izoh modallarining mavjud prototip funksiyalarini saqla.
- Mavjud pastki navigatsiyada faqat avval belgilangan Reels ikonkasiga oid o‘zgarish saqlanadi; boshqa ikonka, tartib yoki navigatsiya xatti-harakatlarini o‘zgartirma.
- Guli Market rang palitrasi va tipografiyasini saqla; Instagram logotipi yoki boshqa brend aktivlarini nusxalama.

## 8. Texnik va funksional qabul mezonlari
1. Ovoz yoqish/o‘chirish tugmasi Reels interfeysida ko‘rinmaydi.
2. Video dastlab ovozsiz ijro etiladi.
3. Video tegilganda Play/Pause almashadi va indikator chiroyli, qisqa animatsiya bilan ko‘rinadi.
4. Har bir rolikda Guli Market logotipi va **Guli Market** nomi ko‘rinadi; profil yonidagi “+” belgisi yo‘q.
5. Yuqorida “GULI” matni yo‘q; faqat “REELS” va neon indikator qoladi.
6. Mobil Reels karta ko‘rinishidan chiqib, edge-to-edge to‘liq ekran layout’ga o‘tadi.
7. Vertikal swipe/scroll bilan oldingi-keyingi Reels silliq almashadi; o‘tish vaqtida keyingi video ko‘rina boshlaydi.
8. Dastlab 1–3, keyin indeksga mos ravishda joriy + keyingi 2 ta rolik oldindan tayyorlanadi.
9. Barcha videolar birdaniga to‘liq yuklanmaydi; mobil trafik ehtiyotkor ishlatiladi.
10. Like, izoh, ulashish va mahsulotga o‘tish funksiyalari regressiyasiz ishlaydi.
11. Loading/error/empty holatlari saqlanadi va video xatosi butun lentani to‘xtatmaydi.
12. `npm run build` va mavjud testlar o‘tadi; imkon bo‘lsa Reels uchun gesture, preload navbati va Play/Pause testlarini qo‘sh.
13. Backend/Supabase/Telegram/media hosting integratsiyasi qo‘shilmaganini yakuniy hisobotda alohida ko‘rsat.

## 9. Ishni bajarish tartibi va hisobot
- Avval mavjud Reels komponentlari va routing’ni o‘rgan; noldan parallel Reels tizimi yaratma.
- Har bir o‘zgarishdan so‘ng build va testlarni bajargin.
- O‘zgartirilgan fayllar, ishlaydigan xususiyatlar, test natijalari va qolgan cheklovlarni qisqacha sanab ber.
- Preview havolasini faqat yangi deployment haqiqatan `READY` holatida bo‘lsa va URL tasdiqlansa ber.
