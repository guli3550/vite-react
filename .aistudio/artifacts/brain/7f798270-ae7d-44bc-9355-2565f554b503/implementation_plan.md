# Reels Sequential Index, Share Sheet Alignment, and Instagram Comments Enhancements

## Bajarilgan ishlar:

1. **Reels Ketma-ketligi va Boshlang'ich Indeks Tiklanishi (Flicker / Delay Fix)**:
   - Reels ro'yxatining tartibini bir xil va barqaror ketma-ketlikda saqlash ta'minlandi (tasodifiy qayta aralashtirish va indeks to'qnashuvi olib tashlandi).
   - Keshdagi Reels videolardan yuklanayotganda `resolveInitialIndex` birinchi marta (sinxron) bajarilishi va `initialConfigAppliedRef.current = true` darhol o'rnatilishi yo'lga qo'yildi.
   - Natijada, boshqa sahifadan Reels'ga qaytganda oxirgi ko'rilgan video birinchi millisekunddanoq darhol ochiladi — 1-2 soniyali tasodifiy video sakrashi to'liq bartaraf etildi.

2. **Ulashish (Share) va Izohlar Panellarini Navigatsiya Paneli Bilan Tekislash**:
   - Ulashish paneli (`.reelsShareSheet.instagramShareSheet`) va Izohlar paneli (`.reelsCommentsSheet`) pastki marjini `margin: 0 auto calc(68px + env(safe-area-inset-bottom, 0px)) auto !important;` qilib sozlandi.
   - Ulashish va Izohlar panellarining ostki qismi pastki navigatsiya panelining yuqori chegarasi bilan tekis va chiroyli tutashadi.

3. **Instagram Uslubidagi Kommentariya Paneli va Haqiqiy Profil Ma'lumotlari**:
   - Izohlar oynasi Instagram to'q rejimiga (`#1c1c1e`) moslashtirildi, tutqich va kirish maydoni zamonaviylashtirildi.
   - `getCurrentUserProfile()` funksiyasi qo'shildi: foydalanuvchining haqiqiy ismi va profil rasmi `localStorage` hamda Telegram WebApp'dan olinadi.
   - Mijoz izohlar oynasini ochganda va yangi izoh yozganda uning haqiqiy ismi hamda profil rasmi (yoki monogramma avatari) ko'rsatiladi.

4. **Tekshiruv**:
   - `lint_applet`: 0 xato.
   - `compile_applet`: Muvaffaqiyatli build.
   - `npm test`: Barcha 51 ta test mukammal o'tdi.
