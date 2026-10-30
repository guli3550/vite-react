# GULI MARKET --- PROFIL DIZAYNINI INSTAGRAMGA MOSLASHTIRISH VA DUMALOQ REKLAMA LENTASINI JOYLASHTIRISH

## 1. Vazifa

Guli Market profil sahifasining hozirgi dizaynini foydalanuvchi yuborgan
Instagram profil screenshotiga yanada yaqinlashtir. Profilning
aktualniy/highlights qatorida hozir turgan **Yangi, Kataloglar, Promo,
Yetkazish** elementlarini olib tashlab, ularning o'rniga Guli Market
kategoriya bo'limida avval yaratilgan **dumaloq reklama lentasini**
joylashtir.

Foydalanuvchi yuborgan rasmlar: - **1-rasm:** Guli Market profilining
hozirgi holati. Hozirgi o'lchamlar, joylashuv va aktualniy qatori shu
rasmda. - **2-rasm:** Instagram profilining dizayn namunasi. Shrift,
raqamlar, tugmalar, doiralar, masofalar va umumiy o'lchamlar uchun
asosiy vizual mezon.

Maqsad --- Guli Market profilini Instagram'ga o'xshash ixcham va tanish
UX bilan, lekin o'z brend dizaynida ko'rsatish.

## 2. Eng muhim talab: mavjud dumaloq reklama lentasini qayta ishlatish

Guli Market kategoriya bo'limida dumaloq reklama lentasi allaqachon
yaratilgan va ishlamoqda.

**Yangi reklama lentasini noldan yaratma.** Avval kategoriya
sahifasidagi mavjud komponentni, CSS'ni, animatsiya mexanizmini, data
source'ni va admin panel sozlamalarini topib tekshir. So'ng aynan shu
komponentni qayta ishlatish yoki umumiy reusable komponentga ajratish
orqali profil sahifasiga integratsiya qil.

Profil sahifasidagi eski aktualniy qatorida: - Yangi - Kataloglar -
Promo - Yetkazish

elementlari o'rniga kategoriya bo'limidagi haqiqiy dumaloq reklama
lentasi chiqsin.

Talablar: - Lenta Instagram highlights qatori joylashgan hududda
tursin. - Kategoriya bo'limidagi dumaloq shakl, animatsiya, harakat
yo'nalishi, tezligi, bosish xatti-harakati va admin sozlamalari
saqlansin. - Reklamalar admin panelda boshqariladigan ma'lumotlar va
tartib asosida ko'rsatilsin. - Har bir element bosilganda mavjud reklama
yo'nalishi yoki tegishli kontent ochilsin. - Mobil ekranda gorizontal
lenta sifatida ko'rinsin; scroll va animatsiya bir-biriga xalaqit
bermasin. - Elementlar kesilmasin, bir-biriga yopishmasin. - Kategoriya
sahifasidagi lenta avvalgidek ishlashda davom etsin. - Profil va
kategoriya sahifalarida bir xil ma'lumot manbasi ishlatilsin; ortiqcha
takroriy API so'rovlarini yaratma.

Bu qator statik Stories/Highlights emas, balki kategoriya sahifasidagi
mavjud dumaloq reklama lentasining profil sahifasidagi ko'rinishi
bo'lishi shart.

## 3. Instagram'ga mos o'lchamlar va tipografika

Hozirgi Guli Market profil screenshotidagi matnlar, tugmalar va ayrim
elementlar Instagram namunasiga nisbatan kattaroq yoki oraliqlari
boshqacha. Ularni Instagram'dagi vizual nisbatlarga moslashtir.

### Profil headeri

-   Navigatsiya satri balandligi va ichki bo'shliqlarini ixchamlashtir.
-   Profil rasmi Instagram namunasidagi kabi dumaloq, aniq va
    muvozanatli o'lchamda bo'lsin.
-   Avatar va statistika bloklari bir qatorda tartibli joylashsin.
-   Profil nomi va tasdiqlash belgisi bir chiziqda tekis tursin.

### Statistikalar

-   Tovarlar, Obunachilar va Kuzatilmoqda raqamlari Instagram'dagi kabi
    o'qilishi oson va me'yoriy o'lchamda bo'lsin.
-   Raqamlar izoh matnidan kattaroq bo'lsin.
-   Uchta blok teng masofada joylashsin.
-   Raqam va izoh orasidagi vertikal masofa ixcham bo'lsin.
-   Faqat real ma'lumotlardan foydalan; soxta statistikalar qo'shma.

### Bio va havolalar

-   Profil tavsifi Instagram bio kabi ixcham qatorlarda joylashsin.
-   Shrift o'lchami, qator oralig'i va satrlar orasidagi masofa
    Instagram namunasiga yaqin bo'lsin.
-   Havolalar ajralib tursin, ammo haddan tashqari katta bo'lmasin.
-   Emoji va ikonka o'lchamlari matnga mutanosib bo'lsin.
-   Keraksiz katta vertikal bo'shliqlarni kamaytir.

### Tugmalar

-   "Obuna bo'lish", "Do'kon", "Xabar" va ulashish tugmalarining
    balandligi, radiusi, matn o'lchami va oraliqlarini Instagram
    namunasiga moslashtir.
-   Barcha tugmalar bir xil balandlikda bo'lsin.
-   Tugma ichidagi matn va ikonka vertikal/gorizontal markazda tursin.
-   Mobil ekranda tugmalar sig'sin, matnlar kesilmasin.
-   Mavjud tugma funksiyalarini saqla.

### Dumaloq reklama lentasi

-   Dumaloq element diametri, ichki rasm, tashqi ring qalinligi va nom
    yozuvi Instagram highlights o'lchamlariga yaqin bo'lsin.
-   Nomi doira ostida markazda joylashsin.
-   Nom matni kichik, lekin o'qilishi oson bo'lsin.
-   Elementlar orasidagi masofa teng bo'lsin.
-   Lenta ekran chetida chiroyli ko'rinsin va gorizontal harakatlanish
    imkonini saqlasin.

### Kontent tablari

-   Tovarlar, Reels va Reklamalar tablari Instagram profilidagi
    grid/Reels tablari kabi ixcham bo'lsin.
-   Ikonkalar o'lchami, tab balandligi va oraliqlar bir xil bo'lsin.
-   Tanlangan tab indikatori aniq ko'rinsin.
-   Tab nomlari va sonlari kichik, o'qilishi oson bo'lsin.

## 4. Responsive dizayn

Asosiy qurilma --- Android telefon. Quyidagi viewport kengliklarida
tekshir: - 360 px - 375 px - 390 px - 412 px - 430 px

Talablar: - Header gorizontal scroll talab qilmasin. - Statistikalar bir
qatorda sig'sin. - Tugmalar ekran kengligiga moslashsin. - Dumaloq
reklama lentasi gorizontal scroll/animatsiya bilan ishlasin. - Tovarlar,
Reels va Reklamalar gridlari 3 ustunli bo'lsin. - Pastki navigatsiya
kontentni yopmasin. - Android brauzer viewport va safe-area hisobga
olinsin.

## 5. Texnik integratsiya va regressiya xavfsizligi

-   Kategoriya sahifasidagi mavjud reklama lentasini buzma.
-   Admin paneldagi reklama tartibi, kontenti va animatsiya
    sozlamalarini saqla.
-   Profil uchun reklama ma'lumotlarini alohida takroriy tizimda
    saqlama.
-   Keraksiz yangi kutubxona qo'shma.
-   Guli Market'ning mavjud logo, rang va dizayn tokenlaridan foydalan.
-   Reels, Tovarlar, Reklamalar tablari va profil navigatsiyasini buzma.
-   Kategoriya va profil sahifalaridagi lenta bir xil manbadan
    yangilansin.
-   Loading, empty va error holatlari to'g'ri ko'rsatilsin.

## 6. Ishni bajarish bosqichlari

### 1-bosqich --- Audit

1.  Profil sahifasi komponentlari va CSS'ini top.
2.  Kategoriya bo'limidagi dumaloq reklama lentasining komponenti,
    animatsiyasi, data source'i va admin sozlamalarini aniqlagin.
3.  Profil sahifasidagi eski aktualniy qatori qayerda yaratilganini top.
4.  Instagram namunasiga nisbatan shrift, o'lcham va spacing farqlarini
    aniqlagin.
5.  O'zgaradigan fayllar va implementatsiya rejasini taqdim et.

### 2-bosqich --- Implementatsiya

1.  Eski Yangi/Kataloglar/Promo/Yetkazish qatorini olib tashla.
2.  Kategoriya bo'limidagi dumaloq reklama lentasini profilga
    integratsiya qil.
3.  Profil shriftlari, statistikalar, tugmalar, doiralar, tablar va
    spacing'ni Instagram namunasiga moslashtir.
4.  Mobil responsive holatni yaxshila.
5.  Barcha mavjud funksiyalarni saqla.

### 3-bosqich --- Test

-   Build, lint va mavjud testlarni ishga tushir.
-   Kategoriya sahifasidagi lenta avvalgidek ishlashini tekshir.
-   Profil sahifasidagi lenta bir xil reklama ma'lumotlari bilan
    ishlashini tekshir.
-   Reklama elementlariga bosish ishlashini tekshir.
-   Android ekran kengliklarida vizual tekshiruv o'tkaz.
-   Tovarlar/Reels/Reklamalar tablari va Reels'dan profilga o'tishni
    qayta tekshir.
-   Console va network xatolarini tekshir.

### 4-bosqich --- Natija

-   O'zgartirilgan fayllar ro'yxatini ber.
-   Kategoriya lentasi qaysi komponent orqali qayta ishlatilganini
    ko'rsat.
-   Test natijalarini PASS/FAIL ko'rinishida ber.
-   Bajarilmagan talab yoki texnik cheklovlarni ochiq yoz.
-   Production deployment faqat tegishli ruxsat va loyiha ish tartibi
    asosida bajarilsin.

## 7. Qat'iy talablar

-   Faqat ranglarni o'zgartirib, o'lcham va spacing muammolarini
    qoldirma.
-   Mavjud lentani o'rganmasdan yangidan yozma.
-   Eski aktualniy elementlarini yangi reklama lentasi bilan birga
    qoldirma.
-   Soxta reklama yoki demo kontent qo'shma.
-   Kategoriya lentasining animatsiya tezligi va admin sozlamalarini
    buzma.
-   Profilning boshqa funksiyalariga regressiya kiritma.

## 8. Yakuniy maqsad

Guli Market profil sahifasi Instagram namunasidagi shrift, raqam, tugma,
doira va joylashuv nisbatlariga ega bo'lsin.

Aktualniy qatorida "Yangi / Kataloglar / Promo / Yetkazish" o'rniga
kategoriya bo'limida allaqachon ishlayotgan **dumaloq reklama lentasi**
joylashsin.

Natija ixcham, chiroyli, mobilga mos va Instagram'dan foydalanishga
tanish tajriba berishi kerak.
