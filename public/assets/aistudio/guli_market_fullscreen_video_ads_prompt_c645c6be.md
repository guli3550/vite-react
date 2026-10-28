# Guli Market --- Fullscreen Video Ads uchun qisqa prompt

Guli Market (`gulii.uz`) dagi video reklama pleerini audit qiling va
quyidagi talablar asosida tuzating. Asosiy ustuvorlik --- videoni mobil
telefonda haqiqiy full-screen ko'rinishda ochish va dizaynni
3-skrinshotdagi Tolstoy reklama pleeriga o'xshatish.

## Talablar

1.  **Asosiy ekranda:** video avtomatik, ovozsiz ijro etilsin. Ovoz
    yoqish/o'chirish tugmasi asosiy reklama kartasidan butunlay olib
    tashlansin.
2.  **Full-screen ochish:** foydalanuvchi video ustiga bosganda video
    butun ekran ustida ochilsin (oddiy kartani shunchaki kattalashtirish
    emas). Mobil ekran balandligi va safe-area hisobga olinsin; video
    markazda `object-fit: contain` bilan ko'rinsin. Orqa sahifa skrolli
    bloklansin.
3.  **Full-screen dizayn:** 3-skrinshotdagi namunaga yaqin vertikal
    reklama interfeysi yarating: yuqorida yopish (X) tugmasi; asosiy
    qismda video; pastki qismda reklama rasmi/thumbnail, sarlavha va
    qisqa tavsif (bio), CTA ("Batafsil" yoki admin belgilagan matn).
    Elementlar ekran o'lchamlariga moslashsin va muhim tugmalar video
    ustini to'smasin.
4.  **Ovoz:** full-screen ochilish faqat foydalanuvchining bosish
    harakati bilan amalga oshsin; shu harakatda ovozni yoqishga urinsin.
    Brauzer audio ijrosini bloklasa, pleer ochiq qolsin va foydalanuvchi
    yana bosib ovozni yoqa olsin. Full-screen rejimda alohida ovoz
    tugmasi talab qilinmaydi.
5.  **Pauza/davom ettirish:** full-screen videoning o'ziga bosilganda
    pauza bo'lsin; pauzadagi videoga qayta bosilganda davom etsin. Agar
    pauza bo'lsa, nozik play belgisi ko'rsatilsin.
6.  **Yopish:** X tugmasi full-screen oynani yopsin va foydalanuvchini
    oldingi sahifadagi reklama kartasiga qaytarsin. Asosiy kartadagi
    video ovozsiz holatda qolishi kerak.
7.  **Moslik va sifat:** Android Chrome hamda Telegram Mini App
    brauzerida tekshiring; mobil va desktop ko'rinishlarini buzmasin.
    Mavjud reklama analitikasi, CTA manzili, yopish funksiyasi va
    xatolik holatlari saqlansin.

## Qabul qilish mezonlari

-   Asosiy sahifada video ovozsiz avtomatik ijro etiladi va ovoz tugmasi
    yo'q.
-   Video ustiga bosilganda haqiqiy full-screen reklama ko'rinishi
    ochiladi.
-   Full-screen ko'rinishda video, sarlavha, bio va CTA mavjud.
-   Full-screen videoga bosish pauza/davom ettirishni ishlatadi.
-   Yopish tugmasi reklama kartasiga qaytaradi.
-   `tsc -b`, `vite build` va tegishli testlar muvaffaqiyatli o'tadi.
-   Ish yakunida production deploy holati va real qurilmadagi tekshiruv
    natijalari aniq hisobot qilinadi.

Avval mavjud video reklama komponenti, CSS va full-screen
xatti-harakatini tekshiring. So'ng kichik, xavfsiz o'zgarishlar bilan
implementatsiya qiling. Faqat screenshot yoki CSS'da `position: fixed`
qo'shishni "haqiqiy full-screen" deb hisoblamang; imkon qadar Fullscreen
API yoki mobilga mos modal overlay ishlating. Production'ga chiqarishdan
oldin build va regressiya testlarini bajaring.
