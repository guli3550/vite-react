# GULI MARKET --- VIDEO REKLAMALAR BO'LIMINI PROFESSIONAL UI/UX DARAJASIGA OLIB CHIQISH UCHUN MASTER PROMPT

## 1. Vazifa va rol

Sen senior UI/UX designer, frontend engineer va e-commerce admin-panel
mutaxassisi sifatida ishlaysan. Guli Market loyihasidagi mavjud
**"Marketing → Video reklamalar"** bo'limini to'liq audit qilib, uni
qulay, zamonaviy, mobil qurilmada mukammal ishlaydigan va Guli Market
brendiga mos professional boshqaruv paneliga aylantir.

Loyiha: - Sayt: https://gulii.uz - Repository:
https://github.com/guli3550/vite-react - Frontend: React + TypeScript +
Vite - Backend: Node.js + Express - Database: Supabase - Hosting: Vercel
va Render - Qo'shimcha mijoz interfeysi: Telegram Mini App

**Asosiy maqsad:** faqat chiroyli maket chizish emas. Mavjud kod ichida
haqiqiy, ishlaydigan, responsive UI'ni yaratish; mavjud API va
funksiyalarni saqlash; barcha o'zgarishlarni build/test orqali
tekshirish.

## 2. Muhim cheklovlar

Senda Supabase, Render, Vercel yoki boshqa serverlarni bevosita
boshqarish imkoniyati bo'lmasligi mumkin. Shuning uchun: - Repository
ichida bajarish mumkin bo'lgan ishlarni haqiqatan bajar. - Serverga
kirish, database migratsiyasi yoki deployni bajardim deb ko'rsatma. -
Serverga bog'liq ishlar qolsa, ularni yakuniy hisobotda alohida yoz. -
Production ma'lumotlarini o'zgartirma va production deployni
o'zboshimchalik bilan bajarma. - API javoblari bo'lmasa, soxta
statistika yoki demo ma'lumotlarni haqiqiy ma'lumotdek ko'rsatma. -
Mavjud admin autentifikatsiyasi, mahsulotlar, buyurtmalar, bannerlar,
Social Promo, PWA va boshqa bo'limlarga zarar yetkazma. - Keraksiz katta
refaktoring qilma; faqat tegishli qismlarni xavfsiz o'zgartir. - Avval
joriy repository holatini tekshir. Fayl nomlari yoki komponentlar
o'zgargan bo'lishi mumkin.

## 3. Hozirgi interfeysdagi muammolar

Foydalanuvchi taqdim etgan mobil ekran tasvirlarida quyidagi
kamchiliklar ko'rinadi:

1.  **Matn va fon kontrasti yomon.** Ba'zi sarlavha va izohlar och
    pushti fon ustida deyarli ko'rinmaydi.
2.  **Uslublar izchil emas.** Ayrim tugmalar va inputlar standart
    brauzer ko'rinishida; qolgan elementlar esa to'q rangli bloklarda.
    Butun sahifada yagona dizayn tizimi sezilmaydi.
3.  **Statistika kartalari haddan tashqari baland va katta.** Telefon
    ekranida ko'p joy egallaydi, asosiy ishlar pastga suriladi.
4.  **Vizual ierarxiya zaif.** Sarlavha, yordamchi matn, KPI, grafik va
    reklama ro'yxati bir-biridan yetarlicha ajratilmagan.
5.  **Grafik va tavsiya bo'limi ortiqcha joy egallaydi.** Foydalanuvchi
    reklama boshqarishga kelganda avval katta izohlar blokini ko'rmoqda.
6.  **Reklama kartalari ma'lumoti tartibsiz.** Status, joylashuv, CTA,
    ustuvorlik, manzil va statistika oddiy matn qatorlari sifatida
    ko'rsatilgan.
7.  **Yangi reklama formasi mobil ekranda noqulay.** Label'lar,
    inputlar, fayl tanlash, CTA variantlari va joylashuv sozlamalari
    bir-biriga yaqin; hizalanish va kengliklar izchil emas.
8.  **Video preview va media boshqaruvi aniq emas.** Fayl tanlash, URL
    kiritish, poster yuklash va video holatini tushunish oson bo'lishi
    kerak.
9.  **Mobil admin navigatsiyasi bilan sahifa kontenti raqobatlashadi.**
    Pastki navigatsiya va boshqa doimiy elementlar forma yoki kartalar
    ustini yopib qo'ymasligi kerak.
10. **Accessibility va holat xabarlari yetarlicha ravshan emas.** Fokus
    holati, validatsiya, loading, bo'sh holat va server xatolari
    tushunarli ko'rsatilishi kerak.

Bu kuzatuvlar screenshot'larda ko'rinadigan holatlarga asoslangan.
Repository'ni tekshirib, qaysilari CSS, layout, komponent yoki umumiy
admin shell sababli ekanini aniqlagin.

## 4. Avval audit qilinadigan fayllar

Repository'dagi joriy holatni tekshir. Quyidagilar mavjud bo'lsa, avval
ularni o'rgan: - `src/admin/components/VideoAdsAdminTab.tsx` -
`src/admin/components/VideoAdModal.tsx` -
`src/components/videoAds/VideoAdCard.tsx` -
`src/components/videoAds/VideoAdCard.css` - `src/types/videoAd.ts` -
`src/admin/AdminPro.tsx` - `src/admin/components/AdminSidebarData.ts`
yoki hozirgi sidebar/navigation fayli - `src/App.tsx` - tegishli global
CSS, admin layout, theme va responsive breakpoint fayllari -
`backend/videoAdsRuntime.js` --- UI'ga kerakli API contract'larni
tushunish uchun - `docs/VIDEO_ADS_SETUP.md` --- mavjud funksiyalarni
anglash uchun

Fayl yo'llari farq qilsa, `rg`, repository search yoki mavjud kod
navigatsiyasi orqali haqiqiy joylashuvni top. Kodni ko'rmasdan taxmin
asosida komponentni qayta yozma.

## 5. Maqsadli vizual yo'nalish

Guli Market'ning premium, nafis, ayollar moda/e-commerce brendiga mos
uslubini saqla: - Rose pink va bordo --- faqat asosiy CTA va muhim
aksentlar uchun. - Oqartirilgan issiq fon yoki loyihada mavjud bo'lsa
amaldagi surface ranglari. - Matnlar uchun yuqori kontrastli, o'qilishi
oson ranglar. - Toza kartalar, nozik chegaralar, yumshoq radiuslar va
me'yoridagi soya. - Sarlavha, yordamchi matn va raqamlar o'rtasida aniq
tipografik ierarxiya. - Kichik, maqsadli ikonalar; emoji'larni asosiy UI
ikonasi o'rnida haddan tashqari ishlatma. - Animatsiyalar minimal, qisqa
va foydalanuvchi ishiga xalaqit bermaydigan bo'lsin. - Mavjud admin
panel dizayn tizimi bo'lsa, uni qayta ishlat; butun adminni boshqa
uslubga o'tkazma.

**Qat'iyan man etiladi:** - Oqartirilgan matnni och pushti fon ustida
deyarli ko'rinmaydigan qilish. - Bir sahifada tasodifiy oq, qora, pushti
va brauzer default komponentlarini aralashtirish. - Barcha elementlarni
katta gradientlar va soyalar bilan bezash. - KPI kartalarini keragidan
ortiq baland qilish. - Mobil ekran uchun desktop jadvalini siqib
qo'yish. - Ishlamaydigan tugmalar yoki faqat dekorativ, soxta
interaktivlik yaratish.

## 6. Yangi sahifa tuzilishi

Sahifani quyidagi ierarxiya bo'yicha qayta tashkil et.

### A. Sahifa sarlavhasi

-   Breadcrumb: `Marketing / Video reklamalar`.
-   Sarlavha: `Video reklamalar`.
-   Bir qatorli qisqa tavsif.
-   Asosiy CTA: `+ Yangi video reklama`.
-   Ikkilamchi amal: `Yangilash`.
-   Agar foydali bo'lsa, faqat shu sahifaga tegishli kichik yordam/holat
    belgisi.

Sarlavha telefon ekranida ham ixcham bo'lsin. Ikki-uch qatorli ortiqcha
matn ishlatma.

### B. KPI kartalari

Desktop'da 4 ta ixcham kartani bir qatorda yoki mos grid'da, telefonda
2×2 grid'da ko'rsat: 1. Faol reklamalar. 2. Ko'rishlar (impressions). 3.
CTA bosishlar. 4. CTR.

Har bir kartada: - Aniq label. - Katta, ammo ixcham qiymat. - Kichik
ikon yoki nozik vizual aksent. - Kerak bo'lsa qisqa tooltip/izoh.

Mobil ekranda KPI kartalari kontentning asosiy qismini siqib
chiqarmasin. `height` qat'iy belgilashdan qoch; padding va typography
orqali ixcham qil.

Ma'lumot yuklanayotganida skeleton yoki loading holatini ko'rsat. API
xato qilsa, qiymatlarni noldan farqli soxta sonlar bilan to'ldirma.
Haqiqiy qiymat yo'qligini ravshan ko'rsat.

### C. Vizual analitika

Grafikni ikkinchi darajali, ixcham bo'limga aylantir: - `Analitika`
sarlavhasi. - Ko'rishlar va CTA bosishlarni solishtirish. - CTR
ko'rsatkichi. - Agar ma'lumotlar mavjud bo'lsa, sana oralig'i yoki davr
tanlash. - Grafikni ko'rsatish/yashirish tugmasi ishlasin. - Mobil ekran
uchun grafik konteyneri `width: 100%`, `min-width` muammosisiz va
o'qilishi oson bo'lsin.

Agar haqiqiy tarixiy data yo'q bo'lsa, grafikni soxta nuqtalar bilan
to'ldirma. Bo'sh holat:
`Hozircha analitika uchun yetarli ma’lumot yo‘q`.

Rejadagi "2.4 baravar yuqori konversiya" kabi tasdiqlanmagan marketing
da'volarini real statistika sifatida ko'rsatma. Bunday ma'lumot manbasi
bo'lmasa, olib tashla yoki neytral yordamchi matn bilan almashtir.

### D. Qidiruv va filtrlar

Reklama ro'yxatidan oldin ixcham toolbar: - Reklama nomi bo'yicha
qidiruv. - Joylashuv filtri: Barchasi / Bosh sahifa / In-feed. - Holat
filtri: Barchasi / Faol / Faol emas. - Saralash: Yangi, ustuvorlik,
ko'rishlar, CTR. - Ko'rinish almashtirgichi: `Kartalar` / `Jadval`, agar
ikkala ko'rinish ham amalda qo'llab-quvvatlansa.

Qidiruv va filtrlar real ro'yxatga ta'sir qilsin. UI'da mavjud, lekin
ishlamaydigan filtr yaratma. Telefon ekranida filtrlarni ixcham panel
yoki ochiladigan sheet ichiga joylashtirish mumkin.

### E. Reklama kartalari

Har bir reklama kartasini aniq, o'qilishi oson va skanerlashga qulay
qil.

**Desktop:** - Media preview va ma'lumotlar yonma-yon. - O'ng tomonda
asosiy amallar. - Muhim statistika ixcham ko'rinishda.

**Mobil:** - Poster/video preview yuqorida, lekin keragidan ortiq baland
bo'lmasin. - Nomi va tavsifi. - Holat badge'i. - Joylashuv va platforma
badge'lari. - Boshlanish/tugash vaqti, agar belgilangan bo'lsa. -
Ko'rishlar, bosishlar va CTR uchun kichik statistik qator. - CTA matni
va manzilni ikkilamchi ma'lumot sifatida ko'rsat. - `Tahrirlash`,
`Faollashtirish/O‘chirish`, `Arxivlash` amallari aniq va qulay bo'lsin.

Barcha amallar haqiqiy API'ga ulangan bo'lishi kerak.
Arxivlash/o'chirish uchun tasdiqlash so'ralsin. API muvaffaqiyatsiz
bo'lsa, UI noto'g'ri ravishda muvaffaqiyat xabarini ko'rsatmasin.

Statusni faqat rang bilan ifodalab qo'yma; matnli badge ham bo'lsin.

### F. Yangi reklama yaratish va tahrirlash

Hozirgi forma ekran tasvirlarida noto'g'ri hizalangan va brauzerning
standart input ko'rinishlari bilan aralashgan. Formani qayta loyihala.

Desktop'da keng modal yoki side panel ishlatish mumkin; mobil qurilmada
esa to'liq kenglikdagi, scroll qilinadigan va pastda amallar uchun
yetarli joy qoldiradigan sheet/modal afzal. Mavjud admin shell bilan
to'qnashmasin.

Formani mantiqiy bo'limlarga ajrat:

#### 1. Asosiy ma'lumotlar

-   Reklama nomi.
-   Qisqa tavsif.
-   CTA matni.

#### 2. Video va poster

-   `Video fayl yuklash` / `Video URL kiritish` tab yoki segmented
    control.
-   Fayl tanlash uchun katta, ammo ixcham dropzone.
-   Qabul qilinadigan format va hajm limitini haqiqiy backend
    cheklovlariga mos ko'rsat.
-   Tanlangan fayl nomi, hajmi va yuklash progressi.
-   Poster rasmni yuklash yoki URL berish.
-   Video preview, xatolik va qayta urinish holatlari.
-   Upload mexanizmi real ishlasin. Agar server integratsiyasi mavjud
    bo'lmasa, buni yashirma va UI'da yolg'on "Yuklandi" holatini
    ko'rsatma.

#### 3. Yo'naltirish

-   Ichki manzil/mahsulotni tanlash.
-   Yoki xavfsiz `https://` URL kiritish.
-   Destination preview yoki "Havolani tekshirish" funksiyasi, agar
    xavfsiz amalga oshirilsa.
-   `javascript:` va `data:` kabi sxemalarni rad etish.
-   Mavjud ichki routing bilan moslikni saqlash.

#### 4. Joylashuv va platforma

-   Joylashuv: Bosh sahifa / Mahsulotlar oqimi / Barchasi.
-   Platforma: Web / Telegram Mini App / Barchasi.
-   Joylashuv va platformani badge yoki tushunarli tanlov komponentlari
    orqali ko'rsat.

#### 5. Rejalashtirish

-   Boshlanish va tugash vaqti.
-   Prioritet.
-   Frequency cap, agar backend haqiqatan qo'llab-quvvatlasa.
-   Faollik holati.

#### 6. Preview va saqlash

-   Saqlashdan oldin reklamaning haqiqiy mijoz kartasi qanday
    ko'rinishini ko'rsat.
-   `Bekor qilish` va `Reklamani saqlash` tugmalari.
-   Saqlash vaqtida loading va takroriy bosishni bloklash.
-   Validatsiya xatolarini tegishli maydon yonida ko'rsat.
-   Modal yopilganda kiritilgan ma'lumotni yo'qotish xavfi bo'lsa,
    tasdiqlash so'ra.

Barcha form maydonlari telefon ekranida bir ustunda, to'liq kenglikda
bo'lsin. Desktop'da kerak bo'lsa ikki ustun ishlat. Label'lar input'dan
yuqorida tursin. Formani tasodifiy inline text/input'lar ketma-ketligiga
aylantirma.

## 7. Responsive va mobil UX

Eng avval 360--390 px kenglikdagi Android telefonlarda ishlashini
hisobga ol.

Talablar: - Gorizontal scroll bo'lmasin. - Tugmalar barmoq bilan
bosishga qulay bo'lsin (taxminan 44 px yoki undan katta). - Inputlar
bir-biriga yopishib ketmasin. - Modal ichidagi barcha maydonlarga scroll
orqali yetish mumkin bo'lsin. - Pastki doimiy admin navigatsiyasi
kontent yoki modal tugmalarini yopmasin. - `z-index` qatlamlari tartibli
bo'lsin. - Safe-area va pastki padding hisobga olinsin. - Mobil
klaviatura ochilganda forma amallari ko'rinmay qolmasligi uchun mos
layout qo'llansin. - Desktop jadvali telefonda siqilmasin; mobil
kartalar ko'rinishidan foydalan. - Katta poster/video o'lchamlari
sahifani keragidan ortiq uzaytirmasin.

## 8. Accessibility va holatlar

Quyidagilarni qo'llab-quvvatla: - Label'lar inputlarga to'g'ri
bog'langan bo'lsin. - Klaviatura bilan boshqarish va ko'rinadigan focus
ring. - Tugmalarda tushunarli matn yoki `aria-label`. - Rang kontrasti
yetarli bo'lsin. - Status rang bilan birga matn orqali ham
ko'rsatilsin. - Loading, empty, success va error holatlari. - API
xatolarida foydalanuvchi tushunadigan o'zbekcha xabar. - Video
yuklanmasa poster fallback. - Reduced-motion sozlamasiga hurmat. - Video
uchun `playsInline`, tegishli `muted`/autoplay fallback va resursni
tejovchi `preload` ishlatish.

## 9. Texnik cheklovlar va integratsiya

-   React + TypeScript'dagi mavjud kod uslubiga rioya qil.
-   Mavjud CSS, design token va UI komponentlarini qayta ishlat.
-   Yangi UI framework yoki katta kutubxona qo'shishdan oldin mavjud
    dependencies'ni tekshir.
-   Backend API contract'larini o'rganib, frontendni ularga mosla.
-   Admin autentifikatsiyasini chetlab o'tma.
-   Supabase service role yoki boshqa maxfiy kalitlarni frontendga
    qo'shma.
-   Faqat ko'rinishni yaxshilash uchun database schema'ni keraksiz
    o'zgartirma.
-   Soxta statistika, demo video yoki fake success state'larni
    production interfeysida ko'rsatma.
-   Agar real API xato qilsa, aniq error/empty state ko'rsat.
-   Mavjud bannerlar, mahsulotlar, savat, buyurtmalar, Social Promo va
    PWA funksiyalarini saqlab qol.
-   `src/App.tsx` kabi katta fayllarda aloqasiz qatorlarni o'chirma.
-   Admin panelning boshqa sahifalarini global CSS orqali tasodifan
    buzma; imkon qadar komponentga scoped CSS yoki mavjud tokenlardan
    foydalan.
-   API va serverga bog'liq ishlarni amalda bajara olmasang, ularni
    bajarilgan deb ko'rsatma.

## 10. Amalga oshirish rejasi

1.  Repository va mavjud video reklama komponentlarini audit qil.
2.  Hozirgi dizayn muammolarini komponent/CSS darajasida xaritalashtir.
3.  Qisqa implementatsiya rejasini tuz, lekin reja bilan to'xtab qolma.
4.  Sahifa header'i, KPI, analitika, filter toolbar va reklama
    kartalarini qayta tuz.
5.  Yaratish/tahrirlash formasini responsive va qulay qil.
6.  Loading, empty, error, success va validation holatlarini to'ldir.
7.  API bilan integratsiyani tekshir.
8.  Mavjud funksiyalarni saqlagan holda minimal, maqsadli diff yarat.
9.  Build, lint va mavjud testlarni bajar.
10. Imkon bo'lsa, 360 px mobil, 390 px mobil, planshet va desktop
    breakpointlarini tekshir.
11. Xatolarni tuzatib, testlarni qayta bajar.
12. Yakunda o'zgartirilgan fayllar va qolgan server vazifalari haqida
    aniq hisobot ber.

## 11. Qabul qilish mezonlari

Ish faqat quyidagi shartlar bajarilganda kod darajasida tayyor
hisoblanadi:

-   [ ] Sahifa premium va izchil Guli Market dizayniga ega.
-   [ ] Barcha matnlar o'qilishi oson va kontrast yetarli.
-   [ ] Mobil layout'da gorizontal scroll yo'q.
-   [ ] KPI kartalari ixcham va tartibli.
-   [ ] Grafik yig'iladigan/yoyiladigan bo'lsa, tugma to'g'ri ishlaydi.
-   [ ] Qidiruv, saralash va filtrlar haqiqiy ma'lumotga ta'sir qiladi.
-   [ ] Reklama kartalaridagi amallar ishlaydi.
-   [ ] Yangi reklama modalida barcha maydonlar tartibli va mobilga mos.
-   [ ] Video/poster preview, validatsiya va upload holatlari
    tushunarli.
-   [ ] Saqlashda haqiqiy API natijasi tekshiriladi.
-   [ ] Demo ma'lumotlar production'da haqiqiy statistika sifatida
    ko'rsatilmaydi.
-   [ ] Mavjud bannerlar, katalog, buyurtmalar, Social Promo va PWA
    funksiyalari buzilmagan.
-   [ ] TypeScript/build/lint/test natijalari haqiqiy ravishda
    tekshirilgan.
-   [ ] Serverda bajarilmagan ishlar ochiq ko'rsatilgan.

## 12. Yakuniy hisobot

Ishni yakunlagach, quyidagi bo'limlar bilan qisqa, lekin aniq hisobot
ber:

### A. Bajarilgan ishlar

-   Qaysi komponentlar va CSS fayllari o'zgardi.
-   Qanday UX muammolari hal qilindi.
-   Mobil va desktop uchun nimalar yaxshilandi.

### B. Testlar

Har birini `PASS`, `FAIL` yoki `NOT RUN` deb belgila. Haqiqiy
bajarilmagan testni `PASS` deb yozma.

### C. Qolgan muammolar

-   API yoki database cheklovlari.
-   Serverga kirish kerak bo'lgan ishlar.
-   Tekshirish imkoni bo'lmagan joylar.

### D. Production holati

Kod o'zgargani, GitHub'ga push qilingani, migration bajarilgani va
production deploy qilingani --- bularni alohida ajrat. Birini boshqasi
bajarilganining dalili sifatida ko'rsatma.

------------------------------------------------------------------------

# YAKUNIY TOPSHIRIQ

Endi mavjud repository'ni tekshir va **Video reklamalar admin
bo'limining haqiqiy kodini professional darajada qayta ishlab chiq**.
Foydalanuvchi bergan screenshot'larni hozirgi UX holatining asosiy
vizual manbasi sifatida ol. Faqat dizayn tavsiyasi yoki maket bermagin:
mavjud React/TypeScript/CSS kodiga kerakli o'zgarishlarni kirit, imkon
qadar build va testlarni bajar, barcha o'zgarishlarni yakuniy hisobotda
ko'rsat.

Ustuvorlik tartibi: 1. O'qilishi va foydalanish qulayligi. 2. Mobil
responsive dizayn. 3. Reklama yaratish/tahrirlash formasining soddaligi.
4. Real API bilan to'g'ri ishlash. 5. Mavjud Guli Market funksiyalarini
saqlash. 6. Performance, accessibility va testlar.

**Eng muhim talab: chiroyli ko'rinish bilan cheklanma --- har bir
boshqaruv elementi ishlasin, real ma'lumotlar soxtalashtirilmasin va
mavjud production funksiyalari buzilmasin.**
