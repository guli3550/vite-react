# Guli Market Reels — O‘ng panelni soddalashtirish va Instagram-uslubidagi izohlar

## Maqsad
Mavjud Guli Market Reels frontend prototipida foydalanuvchi yuborgan skrinshotlarga mos ravishda ikkita o‘zgarishni amalga oshir:
1. Reels ustidagi ortiqcha navigatsiya elementlarini olib tashlash.
2. Izohlar oynasini Instagram Reels’dagi kabi pastdan ochiladigan, yuqoriga tortib kengaytiriladigan izohlar lentasiga aylantirish.

Avval mavjud Reels va comments komponentlari, state, modal/sheet mexanizmi hamda CSS’ni tekshir. Mavjud arxitekturani kengaytir; yangi parallel tizim yaratma. Bu bosqichda faqat frontend/UI prototipi. Backend, Supabase, Telegram yoki haqiqiy foydalanuvchilar izohlarini saqlash integratsiyasini qo‘shma.

## 1. Reels’dagi ortiqcha elementlarni olib tashlash
- Reels’ning o‘ng tomonida joylashgan yuqoriga/pastga strelkalar va `3 / 3` kabi Reels raqamini ko‘rsatuvchi boshqaruvni olib tashla.
- Reels oynasining yuqori chap burchagidagi `REELS` yorlig‘i va neon/yashil indikator chirog‘ini olib tashla.
- Ushbu elementlar olib tashlangandan keyin qolgan UI elementlarini qayta joylashtir: o‘ngdagi profil, like, comment, share va musiqa belgilarining joylashuvi bir tekis, bosishga qulay bo‘lsin.
- Video yuzasi, profil nomi, tavsif, mahsulot kartasi va boshqa ishlayotgan funksiyalarni buzma.
- Instagram logotipi yoki boshqa brend aktivlarini nusxalama; faqat umumiy UX tamoyillaridan foydalan.

## 2. Instagram-uslubidagi izohlar oynasi
Mavjud izohlar modali oddiy kichik oynaga o‘xshab qolmasin. Uni Instagram’dagi Reels izohlari kabi pastdan ochiladigan **bottom sheet** ko‘rinishiga keltir.

### 2.1 Ochilish va o‘lchamlar
- Comment tugmasi bosilganda izohlar oynasi pastdan silliq animatsiya bilan ochilsin.
- Yopiq holatda kichik emas, foydalanishga qulay balandlikda — ekran balandligining taxminan 55–65% qismida ochilsin.
- Oynaning yuqori markazida qisqa `—` tutqich (drag handle) bo‘lsin. Foydalanuvchi aynan shu tutqichni yuqoriga tortganda sheet taxminan 90–95% balandlikkacha kengaysin.
- To‘liq kengaytirilgan holatda pastga tortish sheet’ni avvalgi balandlikka qaytarsin; yana pastga tortish yoki yopish tugmasi orqali oynani yopsin.
- Tutqich uchun touch va mouse drag ishlasin. Gesture izohlar lentasining odatiy vertikal scroll’iga xalaqit bermasin: drag faqat handle’dan boshlanganda sheet balandligi o‘zgarsin.
- Mobil ekran o‘lchamlari, safe-area va virtual klaviatura hisobga olinsin. Desktop’da ham moslashuvchan modal ko‘rinishi saqlansin.
- Orqa fon Instagram’dagi kabi qoraytirilgan/blur qilingan overlay bo‘lsin, lekin asosiy Reels konteksti ko‘rinib tursin.

### 2.2 Izohlar lentasi
- Sheet ichida sarlavha ko‘rinsin: **Izohlar (N)**. `N` joriy lokal izohlar sonidan dinamik hisoblansin.
- Izohlar vertikal scroll qilinadigan alohida lentada ko‘rinsin. Ko‘p izoh bo‘lsa, faqat izohlar ro‘yxati scroll bo‘lsin; sarlavha va pastki yozish paneli o‘z joyida qolsin.
- Har bir izohda quyidagilar bo‘lsin:
  - Muallifning dumaloq profil rasmi/avatar’i.
  - Username yoki ko‘rinadigan foydalanuvchi nomi.
  - Izoh matni.
  - Nisbiy vaqt belgisi (masalan, `2 daqiqa oldin`) — demo ma’lumotlarda vaqt bo‘lsa hisobla, aks holda sun’iy aniq vaqt uydirma.
  - Izohga like qo‘yish uchun yurak belgisi va mavjud bo‘lsa like soni.
- Guli Market’ning javob izohlarida rasmiy Guli Market logotipi va `Guli Market Support` yoki loyihada mavjud bo‘lgan rasmiy support nomi ko‘rsatilsin.
- Oddiy foydalanuvchi izohlarida mavjud demo avatar va username ishlatilsin. Har bir foydalanuvchiga bir xil avatar yoki umumiy `Guli Market` nomini majburan qo‘llama.
- Uzun izohlar o‘qilishi oson bo‘lsin, satrga sig‘masa tabiiy o‘ralsin.
- Demo izohlar soni, ro‘yxati va like qiymatlari mavjud lokal ma’lumotlardan olinsin; tasodifiy raqamlar bilan to‘ldirma.

### 2.3 Izoh yozish paneli
- Sheet’ning eng pastida doimiy yozish paneli bo‘lsin; izohlar ro‘yxati uning ostiga kirib ketmasin.
- Yozish panelida joriy foydalanuvchi avatari, matn kiritish maydoni va yuborish tugmasi bo‘lsin.
- Matn maydoni bo‘sh bo‘lsa yuborish tugmasi o‘chiq yoki nofaol bo‘lsin; matn kiritilgach faol bo‘lsin.
- Yuborilganda yangi izoh darhol lokal state’ga qo‘shilsin, `Izohlar (N)` soni yangilansin, input tozalansin va yangi izoh ro‘yxat oxirida ko‘rinsin.
- Emoji tezkor reaksiyalari (masalan ❤️, 🔥, 👏, 😍) input ustida yoki uning yonida gorizontal qatorda bo‘lsin. Emoji bosilganda matn maydoniga qo‘shilsin yoki aniq belgilangan lokal reaksiya sifatida ishlasin.
- Mobil klaviatura ochilganda yozish paneli ko‘rinib tursin; `safe-area-inset-bottom` va viewport resize’ni hisobga ol.
- `Enter` bilan yuborish xatti-harakatini xavfsiz tashkil et; agar ko‘p qatorli izoh qo‘llansa, `Shift+Enter` yangi qator kiritishi mumkin.

### 2.4 Foydalanish qulayligi va holatlar
- Sheet’ni `Escape` tugmasi yoki yopish tugmasi orqali yopish mumkin bo‘lsin.
- Overlay bosilganda yopish xatti-harakati mavjud loyiha odatlariga mos bo‘lsin.
- Izohlar yo‘q holatda `Hozircha izohlar yo‘q` kabi empty state ko‘rsat.
- Modal ochiq paytda sahifaning orqa qismi keraksiz scroll bo‘lmasin; yopilganda scroll holati tiklansin.
- Accessibility: tugmalarda aniq `aria-label`, sheet’da mos dialog semantikasi, keyboard focus’ni to‘g‘ri boshqarish va yetarli kontrast bo‘lsin.

## 3. Saqlanishi kerak bo‘lgan funksiyalar
Quyidagilarni o‘zgartirma:
- Reels’ning to‘liq ekran layout’i va vertikal swipe/scroll.
- Ovozsiz autoplay va Play/Pause overlay.
- Profil nomi va tasdiqlash belgisi.
- Like, share va bog‘langan mahsulot kartasi.
- Dastlabki 3 ta Reels uchun preload va navbat mantig‘i.
- Pastki navigatsiya tartibi va boshqa sahifalar dizayni.

## 4. Texnik qabul mezonlari
1. Reels’ning o‘ng tomonida yuqoriga/pastga strelkalar va `3 / 3` raqami ko‘rinmaydi.
2. Yuqori chap burchakdagi `REELS` yorlig‘i va neon indikator yo‘q.
3. Comment tugmasi Instagram-uslubidagi bottom sheet’ni ochadi.
4. Sheet dastlab taxminan 55–65% balandlikda ochiladi va `—` tutqichini yuqoriga tortish bilan 90–95% gacha kengayadi.
5. Sheet pastga tortilganda avvalgi o‘lchamga qaytadi va keyingi pastga gesture bilan yopilishi mumkin.
6. Izohlar ro‘yxati mustaqil scroll bo‘ladi; header va composer pastda mahkam turadi.
7. Har bir izohda avatar, username, matn, vaqt (faqat ma’lumot mavjud bo‘lsa) va like ko‘rinadi.
8. Izoh yozish, emoji qo‘shish va lokal yuborish ishlaydi; son yangilanadi.
9. Virtual klaviatura, safe-area va kichik ekranlarda composer ko‘rinib turadi.
10. Boshqa Reels funksiyalari regressiyaga uchramaydi.
11. Build, lint va mavjud testlar ishga tushiriladi; comments sheet drag/expand, lokal comment submit va count yangilanishi uchun testlar qo‘shiladi yoki yangilanadi.
12. Backend, Supabase, Telegram yoki real-time comment API ulanmaydi.

## 5. Bajarish tartibi va yakuniy hisobot
- Avval mavjud `ReelsCommentsModal` yoki unga mos komponentni topib, uning state va style’larini qayta ishlat.
- Faqat kerakli komponent/CSS/test fayllarini o‘zgartir.
- Build/lint/test natijalarini taxmin qilmay, real bajarilgan natijalarni ko‘rsat.
- Preview URL faqat yangi deployment `READY` holatida bo‘lib, havola tasdiqlanganidan keyin berilsin.
- Yakunda o‘zgargan fayllar, amalga oshirilgan funksiyalar, test natijalari va qolgan cheklovlarni qisqa yoz.
