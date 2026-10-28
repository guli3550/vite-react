# Guli Market Reels — Dizayn va funksional prototip uchun prompt

## Vazifa
Guli Market (`gulii.uz`) uchun Instagram Reels uslubidagi video lentasi va unga mos Admin Panel bo‘limining **faqat dizayni hamda frontend funksional prototipini** yarat. Hozircha backend, Supabase, Telegram, autentifikatsiya, media hosting va production integratsiyalarini amalga oshirma. Mavjud loyiha arxitekturasi va dizayn tizimiga mos ishlagin.

## 1. Reels foydalanuvchi bo‘limi
- Foydalanuvchi Reels sahifasini ochganda Instagram Reels’dan ilhomlangan, mobil qurilmaga mos vertikal video interfeysi ko‘rinsin.
- Video ekranning asosiy qismini egallasin; video ustida profil rasmi/nomi, qisqa tavsif va overlay elementlari joylashsin.
- O‘ng tomonda vertikal amallar ustuni bo‘lsin:
  - **Like ❤️** — bosilganda holati almashsin, like soni yangilansin.
  - **Comment 💬** — izohlar paneli/modal ochilsin; prototipda izohlarni ko‘rish va lokal yangi izoh kiritish mumkin bo‘lsin.
  - **Share ↗️** — ulashish paneli ochilsin; “Havolani nusxalash” kabi demo amali ishlasin.
- Video ustiga bosish play/pause holatini almashtirsin. Ovoz boshqaruvi tushunarli bo‘lsin; avtomatik ovozli ijro shart emas.
- Vertikal swipe yoki yuqoriga/pastga boshqaruv orqali keyingi/oldingi Reels’ga o‘tish prototipi bo‘lsin. Desktop’da mos boshqaruvlar va responsive layout ishlasin.
- Video mavjud bo‘lmasa yoki yuklanmasa, poster va tushunarli placeholder ko‘rsatilsin.
- Loading, empty, error va video tugagan holatlar uchun UI holatlari ko‘zda tutilsin.
- Faqat Reels sahifasining kontent qismini o‘zgartir; saytning qolgan sahifalari va navigatsiyasini qayta loyihalama.

## 2. Pastki navigatsiya
- **Mavjud navigatsiya tartibi, o‘lchami, joylashuvi va boshqa barcha ikonkalari o‘zgarmasin.**
- Faqat hozirgi yurak (`❤️`) ikonkasini Reels ikonkasiga almashtir.
- Shu ikonka bosilganda Reels sahifasiga yo‘naltirsin.
- Navigatsiyaning qolgan tugmalari, marshrutlari va xatti-harakatlariga tegma.

## 3. Admin Panel — Reels boshqaruvi
Admin Panel’da **Marketing → Reels** (yoki mavjud admin menyusi uslubiga mos yangi “Reels” bo‘limi) yarat. Bu bosqichda frontend-only demo ma’lumotlari bilan ishlasin.

Kerakli interfeys va prototip funksiyalari:
- Reels ro‘yxati: poster/thumbnail, sarlavha yoki tavsif, status, ko‘rishlar, like va izohlar soni, yaratilgan sana.
- **Yangi Reels qo‘shish** formasi:
  - Video fayl tanlash yoki video URL kiritish.
  - Poster/cover fayl tanlash yoki rasm URL kiritish.
  - Tavsif/caption.
  - Mahsulotga bog‘lash (ixtiyoriy demo select).
  - Holat: qoralama/faol/faol emas.
- Mavjud Reels’ni tahrirlash, faollashtirish/o‘chirish, qoralama sifatida saqlash va o‘chirishdan oldin tasdiqlash.
- Preview: video/poster va caption qanday ko‘rinishini oldindan ko‘rish.
- Qidirish, status bo‘yicha filtrlash va ro‘yxatni yangilash boshqaruvlari.
- Bo‘sh holat, form validation, xato va muvaffaqiyat xabarlari ko‘rinsin.
- Prototipdagi o‘zgarishlar frontend state’da saqlansin; sahifani yangilaganda saqlanib qolishi hozircha majburiy emas. Demo ma’lumotlar ekanini kodda va UI’da aniq ajrat.

## 4. Dizayn yo‘nalishi
- Foydalanuvchi yuborgan Instagram Reels skrinshotini **vizual yo‘nalish** sifatida ishlat: to‘liq bo‘yli vertikal video, ustki metadata, o‘ng tomonda action ikonkalari va pastroqda caption/profil ma’lumotlari.
- Instagram logotipi yoki brend aktivlarini nusxalama; faqat umumiy UX g‘oyasidan foydalan.
- Guli Market’ning mavjud ranglari, tipografiyasi, tugma uslubi va yumshoq pushti/oq ranglar palitrasiga moslashtir.
- Mobil ekranlarda asosiy tajriba ustuvor bo‘lsin; safe-area, pastki navigatsiya va kontent to‘qnashuvlarini oldini ol.
- Ikonkalar bir xil o‘lcham va vizual og‘irlikda, bosish maydonlari qulay bo‘lsin.
- Admin panel dizayni mavjud admin panel komponentlari va uslubiga mos bo‘lsin.

## 5. Texnik chegaralar
- Avval repository’ni tekshir: mavjud React/TypeScript/Vite tuzilmasi, routing, shared navigation, admin panel menyusi va UI komponentlarini top.
- Mavjud kodni qayta ishlat; parallel yoki takroriy navigatsiya yaratma.
- Backend/API, Supabase jadvallari, Storage bucket, Telegram bot, analitika backend’i yoki tashqi servislar bilan integratsiya **qilma**.
- Mavjud video reklama (Video Ads) funksiyasini o‘zgartirma va Reels bilan aralashtirma.
- Mavjud mahsulotlar, buyurtmalar, kategoriyalar, autentifikatsiya va boshqa funksiyalarni buzma.
- Demo video/rasmlar faqat mavjud xavfsiz assetlardan yoki foydalanuvchi kiritgan URL’lardan foydalansin; tasodifiy tashqi resurslarga qattiq bog‘lanma.
- TypeScript turlari, accessibility, keyboard controls va mobil responsive holatlarini hisobga ol.

## 6. Yakuniy qabul mezonlari
1. Pastki navigatsiyadagi faqat yurak ikonkasigina Reels ikonkasiga almashgan; qolgan navigatsiya aynan saqlangan.
2. Ikonkani bosganda Reels sahifasi ochiladi.
3. Like bosilganda holat va soni yangilanadi.
4. Comment paneli ochilib, demo izoh qo‘shish mumkin.
5. Share paneli ochilib, demo “havolani nusxalash” amali ishlaydi.
6. Video play/pause va Reels’lar orasida navigatsiya ishlaydi.
7. Admin Panel’da Reels ro‘yxati, yaratish, tahrirlash, faollashtirish, qoralama, o‘chirish va preview prototipi ishlaydi.
8. Loading/empty/error holatlari dizayni mavjud.
9. Mobil va desktop layout buzilmaydi.
10. Build va mavjud testlar o‘tadi.
11. Backend yoki tashqi integratsiyalar qo‘shilmagan; keyingi bosqichga qoldirilgani hisobotda aniq yoziladi.

## 7. Ish yakuni
- O‘zgartirilgan fayllar ro‘yxatini va prototipda ishlaydigan funksiyalarni qisqacha bayon qil.
- Build/test natijalarini ko‘rsat.
- Backend/Supabase/Telegram/hosting integratsiyasi bajarilmaganini alohida qayd et.
- Preview havolasini faqat yangi deployment haqiqatan `READY` bo‘lib, uning URL’i tasdiqlangandan keyin ber.
