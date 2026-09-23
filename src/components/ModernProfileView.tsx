import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { buildApiUrl } from "../lib/apiOrigin";
import type { Order } from "../App";
import type { Language } from "../utils/translations";
import type { Currency } from "../utils/currency";
import type { AuthUser } from "./CustomerAuthModal";

// Promo modal types and definitions
type PromoModalType = "cashback" | "chat" | "call" | "vip" | null;

// Persistent background images for Guli Premium customer card (Day / Night mode embedded in Base64 CSS)
import "./ModernProfileCardBg.css";
import { GULI_LOGO_BASE64 } from "../utils/guliLogoBase64";

export const TelegramLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 240 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="120" cy="120" r="120" fill="url(#tg_logo_icon_grad)" />
    <path
      d="M183.9 61.2L35.6 118.4C25.4 122.5 25.5 128.2 33.8 130.8L71.9 142.7L160.1 87C164.3 84.4 168.1 85.9 164.9 88.7L93.5 153.2L90.7 195.4C94.8 195.4 96.6 193.5 98.9 191.3L120.5 170.3L165.4 203.4C173.7 208 179.6 205.6 181.7 195.7L211.1 57.5C214.1 45.4 206.5 40 183.9 61.2Z"
      fill="white"
    />
    <defs>
      <linearGradient id="tg_logo_icon_grad" x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2AABEE" />
        <stop offset="1" stopColor="#229ED9" />
      </linearGradient>
    </defs>
  </svg>
);

export const CashbackLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#cashback_badge_grad)" stroke="#FDE68A" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" strokeDasharray="2 1.5" />
    <path
      d="M9 9.5a1.5 1.5 0 1 1 3 0c0 1.5-3 1.8-3 3.5h3.5M12 17v-1M15.5 8.5l-7 7"
      stroke="#FFFFFF"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="cashback_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F59E0B" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>
  </svg>
);

export const LiveChatLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#livechat_badge_grad)" stroke="#BAE6FD" strokeWidth="1.2" />
    <path
      d="M7.5 14.5L6 17.5l3.2-1c.9.3 1.8.5 2.8.5 4 0 7-2.6 7-6s-3-6-7-6-7 2.6-7 6c0 1.5.6 2.9 1.5 4v0z"
      fill="#FFFFFF"
    />
    <circle cx="9.5" cy="10.5" r="1" fill="#0284C7" />
    <circle cx="12" cy="10.5" r="1" fill="#0284C7" />
    <circle cx="14.5" cy="10.5" r="1" fill="#0284C7" />
    <defs>
      <linearGradient id="livechat_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#0284C7" />
      </linearGradient>
    </defs>
  </svg>
);

export const CallCenterLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#callcenter_badge_grad)" stroke="#A7F3D0" strokeWidth="1.2" />
    <path
      d="M7 13.5v-2a5 5 0 0 1 10 0v2"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect x="5.5" y="12" width="3" height="4.5" rx="1.5" fill="#FFFFFF" />
    <rect x="15.5" y="12" width="3" height="4.5" rx="1.5" fill="#FFFFFF" />
    <path
      d="M17 14.5v1.2a2 2 0 0 1-2 2h-2.5"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17.7" r="1" fill="#FFFFFF" />
    <defs>
      <linearGradient id="callcenter_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

export const VipCrownLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#vipcrown_badge_grad)" stroke="#E9D5FF" strokeWidth="1.2" />
    <path
      d="M6 16.5h12l-1.5-6.5-3 3.5-1.5-5-1.5 5-3-3.5L6 16.5z"
      fill="#FEF08A"
      stroke="#F59E0B"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="8" r="0.9" fill="#FFFFFF" />
    <circle cx="7.5" cy="9.5" r="0.8" fill="#FFFFFF" />
    <circle cx="16.5" cy="9.5" r="0.8" fill="#FFFFFF" />
    <rect x="7" y="15" width="10" height="1.2" rx="0.6" fill="#F59E0B" />
    <defs>
      <linearGradient id="vipcrown_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7" />
        <stop offset="1" stopColor="#7E22CE" />
      </linearGradient>
    </defs>
  </svg>
);

const getPromoModalData = (lang: Language) => {
  return {
    cashback: {
      bgClass: "guli-promo-bg-cashback",
      badge: lang === "ru" ? "2% Реальный кэшбэк" : lang === "en" ? "2% Real Cashback" : "2% Real Keshbek",
      badgeColor: "#fef08a",
      badgeBg: "rgba(245, 158, 11, 0.35)",
      badgeBorder: "rgba(245, 158, 11, 0.65)",
      glowColor: "rgba(245, 158, 11, 0.45)",
      icon: CashbackLogoIcon,
      title: lang === "ru" 
        ? "Получайте 2% реального кэшбэка с каждой покупки!" 
        : lang === "en" 
        ? "Get 2% Real Cashback on Every Purchase!" 
        : "Har bir xaridingizdan 2% Naqd Keshbek oling!",
      subtitle: lang === "ru" 
        ? "2% от суммы каждого заказа автоматически начисляются в ваш личный кошелек GULI." 
        : lang === "en" 
        ? "2% of every purchase is automatically credited back to your personal secure wallet." 
        : "GULI shaxsiy hisobingizga har bir to‘lovingizdan avtomatik 2% qaytadi va shaxsiy hamyoningizda xavfsiz jamg‘ariladi.",
      urgencyText: lang === "ru" 
        ? "⚡ Каждый 1 сум кэшбэка — это 100% реальные деньги для следующих покупок!" 
        : lang === "en" 
        ? "⚡ Every 1 UZS cashback is 100% real value for your future orders!" 
        : "⚡ Har 1 so‘m keshbek — bu keyingi xaridingiz uchun 100% real pul!",
      benefits: [
        {
          emoji: "💰",
          title: lang === "ru" ? "Мгновенное начисление" : lang === "en" ? "Instant Calculation" : "Darhol va avtomatik hisoblash",
          desc: lang === "ru" ? "Как только заказ подтверждается, 2% кэшбэк переводится на баланс без задержек." : lang === "en" ? "As soon as your order is approved, full 2% cashback is credited to your balance." : "Buyurtmangiz tasdiqlanishi bilanoq 2% to‘liq keshbek balansingizga o‘tadi. Hech qanday kutish va murakkab shartlarsiz!",
        },
        {
          emoji: "💸",
          title: lang === "ru" ? "Тратьте как настоящие деньги" : lang === "en" ? "Spend Like Real Cash" : "100% Haqiqiy puldek sarflang",
          desc: lang === "ru" ? "Кэшбэк — это не просто баллы. Вы можете полностью покрыть сумму следующей покупки." : lang === "en" ? "Cashback is not just virtual points. You can cover up to 100% of future orders." : "Keshbek shunchaki virtual ball emas. Keyingi istalgan xaridingizda buyurtma summasini keshbek bilan to‘liq qoplashingiz mumkin.",
        },
        {
          emoji: "📊",
          title: lang === "ru" ? "Прозрачный кошелек" : lang === "en" ? "Transparent Wallet" : "Shaffof keshbek hamyoni",
          desc: lang === "ru" ? "Вся история начислений и списаний всегда доступна в вашем профиле." : lang === "en" ? "Track all incoming credits, used funds, and total balance directly in your profile." : "Shaxsiy profilingizda keshbek tushumlari, sarflangan summalar va umumiy jamg‘armaning to‘liq hisob-kitobi doimo ko‘rinib turadi.",
        },
        {
          emoji: "🎁",
          title: lang === "ru" ? "Суммируется со скидками" : lang === "en" ? "Combines with Discounts" : "Chegirmalar ustiga qo‘shiladi",
          desc: lang === "ru" ? "Кэшбэк начисляется поверх всех сезонных акций, распродаж и промокодов." : lang === "en" ? "Earn 2% cashback on top of all discounts, secret sales, and promo codes." : "Do‘kondagi barcha mavsumiy aksiyalar, yopiq sotuvlar va maxsus narxlar ustiga qo‘shimcha 2% keshbek hisoblanadi.",
        },
      ],
      ctaText: lang === "ru" ? "Зарегистрироваться и получить кэшбэк" : lang === "en" ? "Sign Up & Earn Cashback" : "Ro‘yxatdan o‘tish va Keshbek olish",
      ctaSubtext: lang === "ru" ? "Создайте аккаунт за секунды и экономьте с первого заказа" : lang === "en" ? "Create an account in seconds and start saving on your first purchase" : "Bir zumda hisob yarating va birinchi xariddanoq tejashni boshlang",
    },
    chat: {
      bgClass: "guli-promo-bg-chat",
      badge: lang === "ru" ? "24/7 Онлайн Чат" : lang === "en" ? "24/7 Live Chat" : "24/7 Shaxsiy Online Chat",
      badgeColor: "#7dd3fc",
      badgeBg: "rgba(14, 165, 233, 0.35)",
      badgeBorder: "rgba(56, 189, 248, 0.65)",
      glowColor: "rgba(14, 165, 233, 0.45)",
      icon: LiveChatLogoIcon,
      title: lang === "ru" 
        ? "24/7 Персональный стилист и приватный онлайн чат" 
        : lang === "en" 
        ? "24/7 Personal Stylist & Private Live Chat" 
        : "24/7 Shaxsiy Stilist va Maxfiy Online Chat",
      subtitle: lang === "ru" 
        ? "Наши стилисты помогут подобрать точный размер и фасон нижнего белья 24/7." 
        : lang === "en" 
        ? "Professional stylists available 24/7 to assist with sizing, delicate designs, and sets." 
        : "O‘lcham (razmer), fason va nozik ichki kiyim to‘plamini tanlashda professional stilistimiz 24 soat siz bilan muloqotda.",
      urgencyText: lang === "ru" 
        ? "⚡ Зарегистрированным клиентам личный консультант отвечает в течение 1 минуты!" 
        : lang === "en" 
        ? "⚡ Registered members receive priority replies within 1 minute!" 
        : "⚡ Ro‘yxatdan o‘tgan a'zolarga shaxsiy konsultant 1 daqiqa ichida javob beradi!",
      benefits: [
        {
          emoji: "🔒",
          title: lang === "ru" ? "100% Конфиденциальный диалог" : lang === "en" ? "100% Confidential Dialogue" : "100% Maxfiy va shaxsiy muloqot",
          desc: lang === "ru" ? "Все вопросы и параметры остаются строго между вами и стилистом." : lang === "en" ? "All questions and sizing parameters are kept strictly confidential." : "Sizning barcha savollaringiz, tana o‘lchamlaringiz va tanlovingiz qat'iy maxfiy saqlanadi. Faqat siz va stilist-konsultant.",
        },
        {
          emoji: "📸",
          title: lang === "ru" ? "Отправка фото и аудио" : lang === "en" ? "Photo & Audio Messages" : "Foto va audio xabarlar almashish",
          desc: lang === "ru" ? "Присылайте фото понравившихся моделей или голосовые вопросы в чат." : lang === "en" ? "Share photos of designs or voice notes directly in the chat." : "Yoqtirgan modelingiz rasmini yoki ovozli savolingizni to‘g‘ridan-to‘g‘ri chatga yuboring — mutaxassis darhol aniqlik kiritadi.",
        },
        {
          emoji: "🧵",
          title: lang === "ru" ? "Точный подбор размера" : lang === "en" ? "Guaranteed Size Match" : "Kafolatlangan o‘lcham (razmer) tanlash",
          desc: lang === "ru" ? "Исключите риск ошибки: консультант подберет модель под вашу фигуру." : lang === "en" ? "Zero risk: our specialist helps you choose the perfect fit for your body." : "Mos kelmay qolish xavfi 0%! Mutaxassisimiz sizning parametrlaringizga ideal tushadigan to‘plamni tanlab beradi.",
        },
        {
          emoji: "💾",
          title: lang === "ru" ? "Сохранение истории" : lang === "en" ? "Saved Chat History" : "Suhbat tarixi doim saqlanadi",
          desc: lang === "ru" ? "Рекомендации и выбранные размеры сохраняются в профиле." : lang === "en" ? "Past recommendations and sizes remain saved for hassle-free shopping." : "Tavsiya etilgan modellar, o‘lchamlar va yozishmalar shaxsiy kabinetingizda saqlanadi — har safar qayta tushuntirish shart emas.",
        },
      ],
      ctaText: lang === "ru" ? "Зарегистрироваться и открыть чат" : lang === "en" ? "Sign Up & Open Live Chat" : "Ro‘yxatdan o‘tish va Chatni ochish",
      ctaSubtext: lang === "ru" ? "Получите быструю консультацию прямо сейчас" : lang === "en" ? "Connect instantly and get guidance from our personal stylists" : "Bir zumda ulaning va shaxsiy stilistingizdan maslahat oling",
    },
    call: {
      bgClass: "guli-promo-bg-call",
      badge: lang === "ru" ? "Call-Центр & Оператор" : lang === "en" ? "Call-Center & Operator" : "Operator & Call-Center",
      badgeColor: "#86efac",
      badgeBg: "rgba(16, 185, 129, 0.35)",
      badgeBorder: "rgba(74, 222, 128, 0.65)",
      glowColor: "rgba(16, 185, 129, 0.45)",
      icon: CallCenterLogoIcon,
      title: lang === "ru" 
        ? "Быстрый Call-Центр и поддержка без очередей" 
        : lang === "en" 
        ? "Priority Call-Center & Direct Customer Support" 
        : "Navbatsiz Tezkor Call-Center va Qo‘llab-quvvatlash",
      subtitle: lang === "ru" 
        ? "Прямой звонок оператору, быстрая проверка чеков и отслеживание курьера." 
        : lang === "en" 
        ? "Direct phone line to operators, instant receipt verification, and courier updates." 
        : "Shaxsiy operator bilan to‘g‘ridan-to‘g‘ri qo‘ng‘iroq, to‘lov cheklarini tekshirish va kuryerni daqiqasigacha kuzatish.",
      urgencyText: lang === "ru" 
        ? "⚡ Обращения зарегистрированных клиентов обрабатываются в первую очередь!" 
        : lang === "en" 
        ? "⚡ Registered inquiries are prioritized with zero hold time!" 
        : "⚡ Ro‘yxatdan o‘tgan mijozlarning barcha murojaatlari birinchi navbatda hal etiladi!",
      benefits: [
        {
          emoji: "🚀",
          title: lang === "ru" ? "Соединение без ожидания" : lang === "en" ? "Zero Wait Times" : "Navbatsiz darhol ulanish",
          desc: lang === "ru" ? "Звонки от авторизованных клиентов принимаются по VIP очереди." : lang === "en" ? "Calls and questions are routed directly to frontline support specialists." : "Ro‘yxatdan o‘tgan mijozlar qo‘ng‘irog‘i va so‘rovlari tizimda ustuvor tartibda (VIP navbatda) birinchi o‘rinda qabul qilinadi.",
        },
        {
          emoji: "🧾",
          title: lang === "ru" ? "Контроль чеков и заказов" : lang === "en" ? "Receipt & Order Control" : "To‘lov cheklari va buyurtma nazorati",
          desc: lang === "ru" ? "Оператор подтвердит чек за считанные секунды и передаст заказ на сборку." : lang === "en" ? "Operators confirm your receipt in minutes and expedite assembly." : "To‘lov qildingizmi? Operatorimiz chekingizni soniyalar ichida tasdiqlab, buyurtmangizni jo‘natishga tayyorlaydi.",
        },
        {
          emoji: "🛵",
          title: lang === "ru" ? "Быстрое изменение адреса" : lang === "en" ? "Quick Address & Time Change" : "Kuryer va manzilni tezkor o‘zgartirish",
          desc: lang === "ru" ? "Перенесите время доставки или смените адрес одним звонком." : lang === "en" ? "Change destination or schedule delivery time easily via a phone call." : "Yetkazib berish manzili yoki vaqtini istalgan paytda bitta qo‘ng‘iroq orqali qulay vaqtga ko‘chira olasiz.",
        },
        {
          emoji: "🛡️",
          title: lang === "ru" ? "Защита прав покупателя" : lang === "en" ? "Buyer Guarantee & Protection" : "Kafolat va xaridor huquqlari himoyasi",
          desc: lang === "ru" ? "Оператор лично контролирует качество каждого отправления." : lang === "en" ? "Dedicated support ensures top product quality and customer rights." : "Har bir xaridingiz, tovar sifati va almashtirish masalalarida operator shaxsan sizning manfaatingizni himoya qiladi.",
        },
      ],
      ctaText: lang === "ru" ? "Зарегистрироваться и связаться" : lang === "en" ? "Sign Up & Contact Support" : "Ro‘yxatdan o‘tish va Bog‘lanish",
      ctaSubtext: lang === "ru" ? "Откройте личный кабинет для премиального обслуживания" : lang === "en" ? "Create an account to unlock dedicated concierge support" : "Shaxsiy kabinet oching va premium yordamdan foydalaning",
    },
    vip: {
      bgClass: "guli-promo-bg-vip",
      badge: lang === "ru" ? "Королевские VIP Привилегии" : lang === "en" ? "Royal VIP Privileges" : "VIP Qirollik Imtiyozlari",
      badgeColor: "#d8b4fe",
      badgeBg: "rgba(168, 85, 247, 0.35)",
      badgeBorder: "rgba(192, 132, 252, 0.65)",
      glowColor: "rgba(168, 85, 247, 0.45)",
      icon: VipCrownLogoIcon,
      title: lang === "ru" 
        ? "VIP Членство GULI — Королевский уровень сервиса!" 
        : lang === "en" 
        ? "GULI VIP Membership — Royal Level Service!" 
        : "GULI VIP A'zoligi — Qirollik Darajasidagi Xizmat!",
      subtitle: lang === "ru" 
        ? "При покупках от 2 000 000 сум вы автоматически получаете статус VIP." 
        : lang === "en" 
        ? "Reach 2,000,000 UZS in total purchases to unlock VIP status and closed club perks." 
        : "Jami xaridlaringiz 2 000 000 so‘mga yetganda avtomatik VIP darajaga o‘tasiz va yopiq elita klubiga a'zo bo‘lasiz.",
      urgencyText: lang === "ru" 
        ? "⚡ Зарегистрируйтесь — каждая покупка приближает вас к VIP статусу!" 
        : lang === "en" 
        ? "⚡ Sign up now — every purchase counts towards your VIP status!" 
        : "⚡ Ro‘yxatdan o‘ting — birinchi xaridingizdanoq VIP maqomiga hisoblanishni boshlaydi!",
      benefits: [
        {
          emoji: "👑",
          title: lang === "ru" ? "Закрытые VIP скидки и акции" : lang === "en" ? "Private VIP Deals & Offers" : "Yopiq VIP chegirmalar va aksiyalar",
          desc: lang === "ru" ? "Эксклюзивные распродажи, недоступные обычным покупателям." : lang === "en" ? "Access unlisted promotions and elite club prices." : "Oddiy foydalanuvchilarga ko‘rinmaydigan maxsus yashirin chegirmalar va elita aksiyalarga cheksiz ruxsat.",
        },
        {
          emoji: "🌟",
          title: lang === "ru" ? "Ранний доступ к новым коллекциям" : lang === "en" ? "Early Access to New Drops" : "Yangi kolleksiyalarga birinchi bo‘lib kirish",
          desc: lang === "ru" ? "Заказывайте новые премиальные модели до официального релиза." : lang === "en" ? "Pre-order Parisian and Milanese designs before general release." : "Parij va Milan uslubidagi yangi eksklyuziv to‘plamlarni ommaviy sotuvdan oldin tanlab buyurtma berish imkoniyati.",
        },
        {
          emoji: "📦",
          title: lang === "ru" ? "Бесплатная экспресс-доставка" : lang === "en" ? "Free Express Delivery" : "Mutlaqo bepul ekspress yetkazib berish",
          desc: lang === "ru" ? "Все заказы VIP клиентов доставляются самыми быстрыми курьерами бесплатно." : lang === "en" ? "VIP orders enjoy complimentary fastest priority courier shipping." : "VIP mijozlarning barcha buyurtmalari butun O‘zbekiston bo‘ylab eng tezyurar kuryerlar bilan bepul yetkaziladi.",
        },
        {
          emoji: "🎁",
          title: lang === "ru" ? "Подарки на праздники и день рождения" : lang === "en" ? "Birthday & Holiday Gifts" : "Bayram va tug‘ilgan kun sovg‘alari",
          desc: lang === "ru" ? "Персональные подарки и праздничные сертификаты от GULI." : lang === "en" ? "Curated gift sets and surprise vouchers delivered on your special days." : "Tug‘ilgan kuningizda va bayramlarda GULI brendidan maxsus sovg‘a to‘plamlari va shaxsiy kuponlar tuhfa etiladi.",
        },
      ],
      ctaText: lang === "ru" ? "Зарегистрироваться и стать VIP" : lang === "en" ? "Sign Up & Become VIP" : "Ro‘yxatdan o‘tish va VIP bo‘lish",
      ctaSubtext: lang === "ru" ? "Присоединяйтесь и наслаждайтесь привилегиями" : lang === "en" ? "Join today and enjoy royal perks on all purchases" : "Hozir a'zo bo‘ling va elita imtiyozlari sari ilk qadamni tashlang",
    },
  };
};

interface ModernProfileViewProps {
  authUser: AuthUser | null;
  telegramUser?: any;
  userAvatar?: string;
  orders: Order[];
  wishlistCount: number;
  unreadChatCount: number;
  language: Language;
  currency: Currency;
  theme: "light" | "dark";
  onNavigate: (page: any) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenSocial: () => void;
  onOpenPromos: () => void;
  onOpenDeliveryTerms: () => void;
  onOpenSizeGuide: () => void;
  onOpenAboutBrand: () => void;
  onExportPdf: () => void;
  onShare: () => void;
  onClearCache: () => void;
  onLogout: () => void;
  onUpdateProfile: (updated: Partial<AuthUser>) => void;
  onSelectOrderFilter?: (filter: "all" | "recent" | "in_progress" | "completed" | "cancelled") => void;
  onOpenAuth?: (tab?: "signin" | "signup") => void;
  t: (key: any) => string;
}

export const ModernProfileView: React.FC<ModernProfileViewProps> = ({
  authUser,
  telegramUser,
  userAvatar: customAvatar,
  orders,
  wishlistCount,
  unreadChatCount,
  language,
  currency,
  theme,
  onNavigate,
  onOpenSettings,
  onOpenHelp,
  onOpenSocial,
  onOpenPromos,
  onOpenDeliveryTerms,
  onOpenSizeGuide,
  onOpenAboutBrand,
  onExportPdf,
  onShare,
  onClearCache,
  onLogout,
  onUpdateProfile,
  onSelectOrderFilter,
  onOpenAuth,
  t,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [activePromoModal, setActivePromoModal] = useState<PromoModalType>(null);

  // Close promo modal on Escape key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePromoModal) {
        setActivePromoModal(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [activePromoModal]);

  // Automatic Day / Night Theme synchronizer (syncs with prop, document data-theme, and theme change events)
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const domTheme = document.documentElement.getAttribute("data-theme");
      if (domTheme === "dark" || domTheme === "light") return domTheme;
    }
    return theme || "light";
  });

  useEffect(() => {
    if (theme === "dark" || theme === "light") {
      setActiveTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      const mode = e?.detail || (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")) || "light";
      if (mode === "dark" || mode === "light") {
        setActiveTheme(mode);
      }
    };
    window.addEventListener("guli_theme_changed", handleThemeChange);

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      observer = new MutationObserver(() => {
        const domTheme = document.documentElement.getAttribute("data-theme");
        if (domTheme === "dark" || domTheme === "light") {
          setActiveTheme(domTheme);
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    return () => {
      window.removeEventListener("guli_theme_changed", handleThemeChange);
      if (observer) observer.disconnect();
    };
  }, []);

  const isDark = activeTheme === "dark";

  const isAuthenticated = Boolean(authUser?.id || telegramUser?.id);
  const userKey = authUser?.id || (telegramUser?.id ? `tg_${telegramUser.id}` : "");

  // Clean up legacy global avatar keys so they do not leak across accounts
  try {
    localStorage.removeItem("guli_custom_avatar");
    localStorage.removeItem("guli_avatar_url");
    localStorage.removeItem("guli_customer_photo");
  } catch {}

  const savedUserAvatar = userKey ? localStorage.getItem(`guli_avatar_${userKey}`) : "";
  const initialAvatar = authUser?.avatar_url || savedUserAvatar || customAvatar || telegramUser?.photo_url || "";
  const [currentAvatar, setCurrentAvatar] = useState(initialAvatar);
  const [editAvatar, setEditAvatar] = useState(initialAvatar);

  // Edit fields scoped to authenticated user
  const [editName, setEditName] = useState(
    authUser?.full_name || telegramUser?.first_name || (userKey ? localStorage.getItem(`guli_name_${userKey}`) || "" : "")
  );
  const [editPhone, setEditPhone] = useState(
    authUser?.phone || (userKey ? localStorage.getItem(`guli_phone_${userKey}`) || "" : "")
  );
  const [editBirthDate, setEditBirthDate] = useState(
    userKey ? localStorage.getItem(`guli_dob_${userKey}`) || "" : ""
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Derive display values
  const displayName = authUser?.full_name || 
    [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || 
    (userKey ? localStorage.getItem(`guli_name_${userKey}`) : "") || 
    "Mijoz";

  // NOTE: email auth has been removed from GULI. There is no real email
  // address anywhere in this flow. `telegramUsername` below is the ONLY
  // "handle" we display, and it is rendered as an @username - never
  // disguised as an email address with an envelope icon (that was the
  // previous bug: the Telegram username was being shown as a fake email).
  const telegramUsername =
    (authUser?.telegram_username || telegramUser?.username || "").toString().trim().replace(/^@+/, "") || null;
  const userPhone = authUser?.phone || (userKey ? localStorage.getItem(`guli_phone_${userKey}`) : "") || "+998 -- --- -- --";
  const userAvatar = currentAvatar || authUser?.avatar_url || customAvatar || telegramUser?.photo_url || "";

  // Price formatter helper
  const formatPrice = (val: number) => `${Number(val || 0).toLocaleString("uz-UZ")} so'm`;

  // Real verified orders calculation (no fake numbers)
  const pendingOrders = orders.filter((o) => o.status !== "Yetkazildi" && o.status !== "Bekor qilindi");
  const completedOrders = orders.filter(
    (o) =>
      o.status === "Yetkazildi" ||
      o.status === "Qabul qilindi" ||
      o.status === "To'lov tasdiqlandi" ||
      o.status === "Yo‘lda" ||
      o.status === "Tayyorlanmoqda"
  );

  // Real total money spent
  const realTotalSpent = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // Real 2% Cashback strictly calculated
  const REAL_CASHBACK_PERCENT = 0.02; // exactly 2%
  const realCashbackEarned = Math.round(realTotalSpent * REAL_CASHBACK_PERCENT);
  const usedCashback = orders.reduce((sum, o) => sum + (Number((o as any).cashback_used) || 0), 0);
  const cashbackBalance = Math.max(0, realCashbackEarned - usedCashback);

  // Real VIP threshold: 2,000,000 UZS
  const VIP_THRESHOLD = 2000000;
  const isVip = realTotalSpent >= VIP_THRESHOLD;
  const vipProgressPercent = Math.min(100, Math.round((realTotalSpent / VIP_THRESHOLD) * 100));
  const remainingForVip = Math.max(0, VIP_THRESHOLD - realTotalSpent);

  // Real active admin promos count
  const [activePromosCount, setActivePromosCount] = useState<number | null>(null);
  useEffect(() => {
    let isMounted = true;
    fetch(buildApiUrl("/api/promos"))
      .then((r) => r.json())
      .then((d) => {
        if (isMounted && d.success && Array.isArray(d.data)) {
          const activeList = d.data.filter((p: any) => p.status === "active");
          setActivePromosCount(activeList.length);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const openEditModal = () => {
    const currentName =
      authUser?.full_name ||
      (userKey ? localStorage.getItem(`guli_name_${userKey}`) : "") ||
      (displayName === "Mijoz" ? "" : displayName);
    setEditName(currentName);
    const currentPhone =
      authUser?.phone ||
      (userKey ? localStorage.getItem(`guli_phone_${userKey}`) : "") ||
      (userPhone === "+998 -- --- -- --" ? "" : userPhone);
    setEditPhone(currentPhone);
    const currentDob =
      (authUser as any)?.birth_date ||
      (userKey ? localStorage.getItem(`guli_dob_${userKey}`) : "") ||
      localStorage.getItem("guli_birth_date") ||
      "";
    setEditBirthDate(currentDob);
    setEditAvatar(userAvatar);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const trimmedName = editName.trim();
      const trimmedPhone = editPhone.trim();
      const trimmedDob = editBirthDate.trim();

      // Ism va familiyani ajratish
      const nameParts = trimmedName.split(/\s+/);
      const fName = nameParts[0] || "";
      const lName = nameParts.slice(1).join(" ") || "";

      // 1. Foydalanuvchiga biriktirilgan saqlash
      if (userKey) {
        localStorage.setItem(`guli_name_${userKey}`, trimmedName);
        localStorage.setItem(`guli_phone_${userKey}`, trimmedPhone);
        localStorage.setItem(`guli_dob_${userKey}`, trimmedDob);
        if (editAvatar) {
          localStorage.setItem(`guli_avatar_${userKey}`, editAvatar);
        } else {
          localStorage.removeItem(`guli_avatar_${userKey}`);
        }
      }

      // 2. Buyurtma rasmiylashtirish (Checkout) sahifasi uchun global saqlash
      if (fName) localStorage.setItem("guli_first_name", fName);
      if (lName) localStorage.setItem("guli_last_name", lName);
      if (trimmedPhone) localStorage.setItem("guli_phone", trimmedPhone);
      if (trimmedDob) localStorage.setItem("guli_birth_date", trimmedDob);

      // 3. Real vaqtda barcha bo'limlar bilan sinxronlash hodisasi
      window.dispatchEvent(
        new CustomEvent("guli_profile_updated", {
          detail: {
            fullName: trimmedName,
            firstName: fName,
            lastName: lName,
            phone: trimmedPhone,
            birthDate: trimmedDob,
            avatar: editAvatar,
          },
        })
      );
      window.dispatchEvent(new CustomEvent("guli_avatar_updated", { detail: { avatar: editAvatar } }));
      setCurrentAvatar(editAvatar);

      // 4. Backend server yangilash
      const token = localStorage.getItem("guli_access_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const tgData = (window as any).Telegram?.WebApp?.initData;
      if (tgData) headers["X-Telegram-Init-Data"] = tgData;

      await fetch(buildApiUrl("/api/customer/profile"), {
        method: "PUT",
        headers,
        body: JSON.stringify({
          full_name: trimmedName,
          phone: trimmedPhone,
          avatar_url: editAvatar || null,
          birth_date: trimmedDob || null,
        }),
      }).catch(() => null);

      onUpdateProfile({
        full_name: trimmedName,
        phone: trimmedPhone,
        avatar_url: editAvatar,
        ...(trimmedDob ? { birth_date: trimmedDob } : {}),
      } as any);

      setIsEditModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Rasm hajmi 5MB dan oshmasligi kerak");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to 320x320 max for optimal storage and rendering
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setEditAvatar(compressed);
        } else {
          setEditAvatar(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="page modernProfilePage" style={{ paddingBottom: "110px", maxWidth: "680px", margin: "0 auto" }}>
      {!isAuthenticated ? (
        /* Bright, Radiant, Beautiful Guest Card */
        <section
          style={{
            background: isDark
              ? "linear-gradient(135deg, #1f0b18 0%, #430c22 40%, #1e1b4b 100%)"
              : "linear-gradient(135deg, #9d174d 0%, #be123c 35%, #e11d48 70%, #fb7185 100%)",
            borderRadius: "28px",
            padding: "32px 20px",
            color: "#ffffff",
            boxShadow: isDark
              ? "0 18px 40px -10px rgba(0, 0, 0, 0.75), 0 0 24px rgba(225, 29, 72, 0.25)"
              : "0 18px 40px -10px rgba(225, 29, 72, 0.45), 0 0 24px rgba(251, 113, 133, 0.35)",
            position: "relative",
            overflow: "hidden",
            marginBottom: "22px",
            textAlign: "center",
            border: isDark ? "1.5px solid rgba(255, 255, 255, 0.18)" : "1.5px solid rgba(255, 255, 255, 0.3)",
          }}
        >
          {/* Ambient luminous spots */}
          <div
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-40px",
              left: "-40px",
              width: "140px",
              height: "140px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(253, 164, 175, 0.3) 0%, rgba(253, 164, 175, 0) 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Official Web App Logo in glowing circular rim */}
          <div
            className="guli-brand-circle-logo"
            style={{
              width: "68px",
              height: "68px",
              minWidth: "68px",
              minHeight: "68px",
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              overflow: "hidden",
              margin: "0 auto 16px auto",
              boxShadow: "0 10px 26px rgba(0, 0, 0, 0.22)",
              border: "3px solid #ffffff",
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={GULI_LOGO_BASE64}
              alt="GULI Logo"
              style={{
                width: "100%",
                height: "100%",
                aspectRatio: "1 / 1",
                objectFit: "contain",
                padding: "4px",
                borderRadius: "50%",
                display: "block",
              }}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 16px 0", textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            {t("welcome_title")}
          </h2>

          {/* Key Advantages & Services Ads Showcase with Real Photographic Backgrounds & Crisp Vector Logos */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "10px",
              marginBottom: "22px",
              textAlign: "left",
            }}
          >
            {/* Card 1: 2% Real Keshbek (Base64 CSS fon va interaktiv ochilish) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActivePromoModal("cashback")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActivePromoModal("cashback");
                }
              }}
              title="Batafsil ma'lumot va afzalliklar uchun bosing"
              className="guli-promo-interactive-card"
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "14px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
                cursor: "pointer",
              }}
            >
              <div
                className="guli-promo-bg-cashback"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <CashbackLogoIcon size={24} />
                </div>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  {t("card_cashback_title")}
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  {t("card_cashback_sub")}
                </div>
              </div>
            </div>

            {/* Card 2: 24/7 Shaxsiy Online Chat (Base64 CSS fon va interaktiv ochilish) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActivePromoModal("chat")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActivePromoModal("chat");
                }
              }}
              title="Batafsil ma'lumot va afzalliklar uchun bosing"
              className="guli-promo-interactive-card"
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "14px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
                cursor: "pointer",
              }}
            >
              <div
                className="guli-promo-bg-chat"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <LiveChatLogoIcon size={24} />
                </div>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  {t("card_chat_title")}
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  {t("card_chat_sub")}
                </div>
              </div>
            </div>

            {/* Card 3: Call-Center (Base64 CSS fon va interaktiv ochilish) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActivePromoModal("call")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActivePromoModal("call");
                }
              }}
              title="Batafsil ma'lumot va afzalliklar uchun bosing"
              className="guli-promo-interactive-card"
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "14px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
                cursor: "pointer",
              }}
            >
              <div
                className="guli-promo-bg-call"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <CallCenterLogoIcon size={24} />
                </div>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  {t("card_call_title")}
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  {t("card_call_sub")}
                </div>
              </div>
            </div>

            {/* Card 4: VIP Mijoz (Base64 CSS fon va interaktiv ochilish) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActivePromoModal("vip")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActivePromoModal("vip");
                }
              }}
              title="Batafsil ma'lumot va afzalliklar uchun bosing"
              className="guli-promo-interactive-card"
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "14px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
                cursor: "pointer",
              }}
            >
              <div
                className="guli-promo-bg-vip"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <VipCrownLogoIcon size={24} />
                </div>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  {t("card_vip_title")}
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  {t("card_vip_sub")}
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Login Button (Tun va Kun rejimiga moslangan) */}
          <button
            onClick={() => onOpenAuth?.("signin")}
            id="guest-telegram-login-btn"
            style={{
              backgroundColor: isDark ? "#0f172a" : "#ffffff",
              color: isDark ? "#38bdf8" : "#0284c7",
              border: isDark ? "1.5px solid rgba(56, 189, 248, 0.45)" : "1px solid rgba(255, 255, 255, 0.85)",
              borderRadius: "16px",
              padding: "14px 24px",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: isDark
                ? "0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(42, 171, 238, 0.3)"
                : "0 8px 24px rgba(0, 0, 0, 0.22)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "transform 0.15s ease, box-shadow 0.15s ease, background-color 0.2s ease",
              width: "100%",
            }}
          >
            <TelegramLogoIcon size={24} />
            <span style={{ color: isDark ? "#f8fafc" : "#0284c7" }}>{t("tg_login_btn")}</span>
          </button>
        </section>
      ) : (
        <>
          {/* Customer Profile Card (Standard vs Glowing VIP Card) */}
          {isVip ? (
            /* VIBRANT & BRIGHT LUXURY VIP CARD (Spent >= 2,000,000 UZS) */
            <section
              className="vipGlowingCard"
              style={{
                background: "linear-gradient(180deg, rgba(20, 8, 12, 0.16) 0%, rgba(20, 8, 12, 0.56) 100%), url(\"/vip-card-bg.jpg\") center / cover no-repeat",
                borderRadius: "28px",
                padding: "26px 22px",
                color: "#ffffff",
                border: "2px solid #fef08a",
                boxShadow: "0 18px 45px -8px rgba(245, 158, 11, 0.48), 0 0 30px rgba(251, 191, 36, 0.35)",
                position: "relative",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              {/* Shimmering radiant light reflections */}
              <div
                style={{
                  position: "absolute",
                  top: "-50px",
                  right: "-50px",
                  width: "200px",
                  height: "200px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "-60px",
                  left: "-40px",
                  width: "180px",
                  height: "180px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(254, 240, 138, 0.35) 0%, rgba(254, 240, 138, 0) 70%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", position: "relative", zIndex: 2, paddingRight: "80px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "#ffffff",
                      color: "#b45309",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "0.6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    👑 OLTIN VIP MAQOMI
                  </span>
                  <span
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      color: "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "18px",
                      fontSize: "11px",
                      fontWeight: 800,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    ✨ 2 000 000+ so'm
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openEditModal}
                  aria-label="Profilni tahrirlash"
                  title="Profilni tahrirlash"
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-2px",
                    backgroundColor: "rgba(255, 255, 255, 0.32)",
                    border: "1px solid rgba(255, 255, 255, 0.6)",
                    color: "#ffffff",
                    padding: "5px 11px",
                    borderRadius: "14px",
                    fontSize: "11.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>✏️</span>
                  <span>Tahrirlash</span>
                </button>
              </div>

              {/* VIP Member Info Row */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    position: "relative",
                    width: "74px",
                    height: "74px",
                    minWidth: "74px",
                    minHeight: "74px",
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    padding: "3px",
                    background: "#ffffff",
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
                    flexShrink: 0,
                  }}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={displayName}
                      style={{
                        width: "100%",
                        height: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "#f59e0b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "28px",
                        fontWeight: 900,
                      }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      width: "24px",
                      height: "24px",
                      backgroundColor: "#fbbf24",
                      color: "#78350f",
                      fontSize: "12px",
                      fontWeight: 900,
                      border: "2px solid #ffffff",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    }}
                    title="VIP a'zo"
                  >
                    ★
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1
                    style={{
                      fontSize: "22px",
                      fontWeight: 900,
                      margin: "0 0 4px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#ffffff",
                      textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    }}
                  >
                    {displayName}
                  </h1>
                  {telegramUsername && (
                    <p style={{ fontSize: "13px", margin: "0 0 2px", opacity: 0.95, color: "#fffbeb", fontWeight: 600 }}>
                      @{telegramUsername}
                    </p>
                  )}
                  <p style={{ fontSize: "12px", margin: 0, opacity: 0.95, color: "#fef3c7", fontWeight: 600 }}>
                    📞 {userPhone}
                  </p>
                </div>
              </div>

              {/* VIP Extra Privileges Grid (Qo'shimcha Imkoniyatlar) */}
              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "16px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.3)",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#ffffff", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px", textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
                  <span>👑 VIP A'ZONING MAXSUS IMTIYOZLARI:</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "11.5px",
                    color: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>🚀</span> Bepul Ekspress Yetkazish
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>💎</span> Shaxsiy VIP Menejer
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>⚡</span> Navbatsiz Birinchi Yig'ish
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>🎁</span> Yopiq VIP Aksiyalar
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "12.5px", color: "#ffffff", backgroundColor: "rgba(0, 0, 0, 0.16)", padding: "8px 12px", borderRadius: "12px" }}>
                  <span>Tasdiqlangan xaridlar: <b>{formatPrice(realTotalSpent)}</b></span>
                  <span>Keshbek: <b style={{ color: "#fef08a", fontSize: "13px" }}>{formatPrice(cashbackBalance)}</b></span>
                </div>
              </div>
            </section>
          ) : (
            /* STANDARD NON-VIP CUSTOMER CARD (Full-bleed 16:9 Day & Night Background with zero dividing lines) */
            <section
              style={{
                borderRadius: "26px",
                padding: "22px 18px",
                color: isDark ? "#ffffff" : "#1c1917",
                boxShadow: isDark
                  ? "0 18px 40px -10px rgba(0, 0, 0, 0.75), 0 2px 12px rgba(0, 0, 0, 0.5)"
                  : "0 14px 34px -8px rgba(225, 29, 72, 0.18), 0 2px 10px rgba(0, 0, 0, 0.04)",
                position: "relative",
                overflow: "hidden",
                marginBottom: "18px",
                border: isDark
                  ? "1.5px solid rgba(255, 255, 255, 0.18)"
                  : "1.5px solid rgba(244, 114, 182, 0.45)",
                backgroundColor: isDark ? "#12030a" : "#fff1f2",
                transition: "border-color 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              {/* Full-bleed 16:9 Persistent Day/Night Background Images (Cached in bundle, zero flicker, offline ready) */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  overflow: "hidden",
                  zIndex: 1,
                  backgroundColor: isDark ? "#12030a" : "#fff1f2",
                }}
              >
                {/* Night Mode Background Image Layer (Embedded Base64 in CSS) */}
                <div
                  className="guli-premium-card-bg-night"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: isDark ? 1 : 0,
                    transition: "opacity 0.4s ease-in-out",
                    pointerEvents: "none",
                  }}
                />

                {/* Day Mode Background Image Layer (Embedded Base64 in CSS) */}
                <div
                  className="guli-premium-card-bg-day"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: isDark ? 0 : 1,
                    transition: "opacity 0.4s ease-in-out",
                    pointerEvents: "none",
                  }}
                />

                {/* Scrim overlay for text contrast and readability */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: isDark
                      ? "linear-gradient(180deg, rgba(12, 2, 7, 0.35) 0%, rgba(12, 2, 7, 0.6) 100%)"
                      : "linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.42) 100%)",
                    transition: "background 0.4s ease",
                  }}
                />
              </div>

              {/* Header Badge & Corner Edit Button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", position: "relative", zIndex: 2, paddingRight: "80px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      backgroundColor: isDark ? "rgba(20, 4, 12, 0.76)" : "rgba(255, 255, 255, 0.88)",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(225, 29, 72, 0.28)",
                      color: isDark ? "#ffffff" : "#9f1239",
                      padding: "5px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(159, 18, 57, 0.12)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    🌸 GULI PREMIUM MIJOZ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openEditModal}
                  aria-label="Profilni tahrirlash"
                  title="Profilni tahrirlash"
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-2px",
                    backgroundColor: isDark ? "rgba(20, 4, 12, 0.78)" : "rgba(255, 255, 255, 0.92)",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(225, 29, 72, 0.28)",
                    color: isDark ? "#ffffff" : "#9f1239",
                    padding: "5px 11px",
                    borderRadius: "14px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(159, 18, 57, 0.12)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>✏️</span>
                  <span>Tahrirlash</span>
                </button>
              </div>

              {/* Standard Member Info Row */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    position: "relative",
                    width: "66px",
                    height: "66px",
                    minWidth: "66px",
                    minHeight: "66px",
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    padding: "3px",
                    background: "linear-gradient(135deg, #f472b6, #fb7185)",
                    flexShrink: 0,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                  }}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={displayName}
                      style={{
                        width: "100%",
                        height: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "#831843",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "24px",
                        fontWeight: 800,
                      }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "0",
                      right: "0",
                      width: "18px",
                      height: "18px",
                      backgroundColor: "#10b981",
                      border: "2px solid #500724",
                      borderRadius: "50%",
                    }}
                    title="Faol a'zo"
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1
                    style={{
                      fontSize: "21px",
                      fontWeight: 800,
                      margin: "0 0 4px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: isDark ? "#ffffff" : "#831843",
                      textShadow: isDark ? "0 2px 8px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)" : "0 1px 4px rgba(255,255,255,0.9)",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {displayName}
                  </h1>
                  {telegramUsername && (
                    <p style={{ fontSize: "13px", margin: "0 0 3px", opacity: 0.95, color: isDark ? "#fce7f3" : "#9f1239", fontWeight: 700, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.8)" : "0 1px 3px rgba(255,255,255,0.85)", transition: "color 0.3s ease" }}>
                      @{telegramUsername}
                    </p>
                  )}
                  <p style={{ fontSize: "12.5px", margin: 0, opacity: 0.95, color: isDark ? "#fbcfe8" : "#9f1239", fontWeight: 600, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.8)" : "0 1px 3px rgba(255,255,255,0.85)", transition: "color 0.3s ease" }}>
                    📞 {userPhone}
                  </p>
                </div>
              </div>

              {/* Real VIP Progression: 2,000,000 UZS target (clean background-free layout per user request) */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "0",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px", color: isDark ? "#ffffff" : "#831843", fontWeight: 700, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.95)" : "0 1px 3px rgba(255,255,255,0.9)", transition: "color 0.3s ease" }}>
                  <span>
                    VIP Maqomi: <b>{vipProgressPercent}%</b> (Xarid: {formatPrice(realTotalSpent)})
                  </span>
                  <span>Maqsad: 2 000 000 so'm</span>
                </div>
                <div style={{ height: "7px", width: "100%", backgroundColor: isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(225, 29, 72, 0.22)", borderRadius: "4px", overflow: "hidden", boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.6)" : "none", transition: "background 0.3s ease" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${vipProgressPercent}%`,
                      background: isDark ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : "linear-gradient(90deg, #f43f5e, #be123c)",
                      borderRadius: "4px",
                      transition: "width 0.4s ease, background 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: "11px", color: isDark ? "#fce7f3" : "#9f1239", marginTop: "8px", lineHeight: 1.4, fontWeight: 600, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.95)" : "0 1px 3px rgba(255,255,255,0.9)", transition: "color 0.3s ease" }}>
                  VIP maqomi va bepul ekspress yetkazish uchun yana <b>{formatPrice(remainingForVip)}</b> lik xarid yetarli.
                </div>
              </div>
            </section>
          )}

          {/* Account status note removed per user request */}

      {/* 2. Wallet & Loyalty Points Widget (Uzum / Amazon Market Style) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        {/* Cashback Balance */}
        <div
          onClick={() => setIsWalletModalOpen(true)}
          style={{
            backgroundColor: "var(--bg-card, #ffffff)",
            borderRadius: "20px",
            padding: "14px 12px",
            border: "1px solid var(--border-color, #f1f5f9)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            textAlign: "center",
            transition: "transform 0.15s ease",
          }}
        >
          <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>💰</span>
          <b style={{ fontSize: "14px", display: "block", color: "var(--primary, #be185d)" }}>
            {cashbackBalance.toLocaleString()} so'm
          </b>
          <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Keshbek balansi</span>
        </div>

        {/* Coupons */}
        <div
          onClick={onOpenPromos}
          style={{
            backgroundColor: "var(--bg-card, #ffffff)",
            borderRadius: "20px",
            padding: "14px 12px",
            border: "1px solid var(--border-color, #f1f5f9)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>🎟️</span>
          <b style={{ fontSize: "14px", display: "block", color: "#d97706" }}>
            {activePromosCount !== null ? `${activePromosCount} ta faol` : "Kuponlar"}
          </b>
          <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Promokodlar</span>
        </div>

        {/* Wishlist */}
        <div
          onClick={() => onNavigate("wishlist")}
          style={{
            backgroundColor: "var(--bg-card, #ffffff)",
            borderRadius: "20px",
            padding: "14px 12px",
            border: "1px solid var(--border-color, #f1f5f9)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>💖</span>
          <b style={{ fontSize: "14px", display: "block", color: "#ec4899" }}>
            {wishlistCount} ta
          </b>
          <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Saralanganlar</span>
        </div>
      </section>

      {/* 3. Quick Orders Tracker Widget (Online Market Essential) */}
      <section
        style={{
          backgroundColor: "var(--bg-card, #ffffff)",
          borderRadius: "24px",
          padding: "18px",
          border: "1px solid var(--border-color, #f1f5f9)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text-main, #1e293b)" }}>
              Buyurtmalar holati
            </h2>
            <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
              Jami {orders.length} ta buyurtma
            </span>
          </div>
          <button
            onClick={() => onNavigate("orders")}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "var(--primary, #be185d)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "8px",
            }}
          >
            Barchasi ›
          </button>
        </div>

        {/* 4 Interactive Order Status Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "8px",
            textAlign: "center",
          }}
        >
          {/* 1. To'lov / Kutilmoqda */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("in_progress");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              position: "relative",
            }}
          >
            <span style={{ fontSize: "22px" }}>⏳</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Kutilmoqda</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-pending-color, #d97706)",
                backgroundColor: "var(--status-pending-bg, #fef3c7)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {pendingOrders.length}
            </span>
          </button>

          {/* 2. Tayyorlanmoqda */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("in_progress");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "22px" }}>📦</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Yig'ilmoqda</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-processing-color, #2563eb)",
                backgroundColor: "var(--status-processing-bg, #dbeafe)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {pendingOrders.filter((o) => o.status === "Qabul qilindi" || o.status === "Tayyorlanmoqda").length}
            </span>
          </button>

          {/* 3. Yo'lda / Kuryerda */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("in_progress");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "22px" }}>🚚</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Yo'lda</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-shipping-color, #7c3aed)",
                backgroundColor: "var(--status-shipping-bg, #ede9fe)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {pendingOrders.filter((o) => o.status === "Yetkazilmoqda" || o.status === "Yo'lda").length}
            </span>
          </button>

          {/* 4. Yetkazildi */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("completed");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "22px" }}>✓</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Yetkazildi</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-delivered-color, #16a34a)",
                backgroundColor: "var(--status-delivered-bg, #dcfce7)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {completedOrders.length}
            </span>
          </button>
        </div>
      </section>

      {/* 4. Asosiy Bo'limlar (Structured Online Market List) */}
      <section className="profileSection" style={{ marginBottom: "16px" }}>
        <h2>🛍️ Xaridlar va Ma'lumotlar</h2>

        <button
          className="menuRow"
          id="profile-orders-btn"
          onClick={() => onNavigate("orders")}
        >
          <span className="profileSticker3D">📦</span>
          <div>
            <b>{t("my_orders")}</b>
            <small>Barcha buyurtmalar tarixi va cheklar ({orders.length} ta)</small>
          </div>
          <i>›</i>
        </button>

        {orders.length > 0 && (
          <button
            className="menuRow"
            id="profile-pdf-btn"
            onClick={onExportPdf}
          >
            <span className="profileSticker3D">📄</span>
            <div>
              <b>{t("pdf_report")}</b>
              <small>Shaxsiy xaridlar hisobotini PDF formatida yuklab olish</small>
            </div>
            <i>›</i>
          </button>
        )}

        <button
          className="menuRow"
          id="profile-wishlist-btn"
          onClick={() => onNavigate("wishlist")}
        >
          <span className="profileSticker3D">💖</span>
          <div>
            <b>{t("my_wishlist")}</b>
            <small>
              {language === "ru"
                ? `${wishlistCount} сохраненных товаров`
                : language === "en"
                ? `${wishlistCount} saved items`
                : `${wishlistCount} ta saralangan mahsulot`}
            </small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-addresses-btn"
          onClick={() => onNavigate("addresses")}
        >
          <span className="profileSticker3D">📍</span>
          <div>
            <b>{t("my_addresses")}</b>
            <small>
              {language === "ru"
                ? "Управление адресами доставки"
                : language === "en"
                ? "Manage delivery addresses"
                : "Yetkazib berish manzillarini boshqarish"}
            </small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-promos-btn"
          onClick={onOpenPromos}
        >
          <span className="profileSticker3D">🏷️</span>
          <div>
            <b>
              {language === "ru"
                ? "Купоны и промокоды"
                : language === "en"
                ? "Coupons & Promo Codes"
                : "Kuponlar va Aksiya promokodlari"}
            </b>
            <small>
              {language === "ru"
                ? "Персональные скидки и акции"
                : language === "en"
                ? "Personal discounts and new deals"
                : "Shaxsiy chegirmalar va yangi aksiyalar"}
            </small>
          </div>
          <i>›</i>
        </button>
      </section>
      </>
      )}

      {/* 5. Mijozlarga Xizmat Ko'rsatish (Customer Care) */}
      <section className="profileSection" style={{ marginBottom: "16px" }}>
        <h2>💬 {t("service_and_contact")}</h2>

        {/* Faqat ro'yxatdan o'tgan foydalanuvchilarga ko'rinadi */}
        {isAuthenticated && (
          <>
            <button
              className="menuRow"
              id="profile-chat-btn"
              onClick={() => onNavigate("chat")}
            >
              <span className="profileSticker3D">💬</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <b>GULI Chat</b>
                </div>
                {unreadChatCount > 0 ? (
                  <span className="badgePill" style={{ backgroundColor: "#ef4444" }}>{unreadChatCount} yangi</span>
                ) : null}
                <small>{t("guli_chat_sub")}</small>
              </div>
              <i>›</i>
            </button>

            <button
              className="menuRow"
              id="profile-help-btn"
              onClick={onOpenHelp}
            >
              <span className="profileSticker3D">📞</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <b>{t("help_support")}</b>
                </div>
                <small>{t("help_support_sub")}</small>
              </div>
              <i>›</i>
            </button>
          </>
        )}

        <button
          className="menuRow"
          id="profile-size-guide-btn"
          onClick={onOpenSizeGuide}
        >
          <span className="profileSticker3D">📏</span>
          <div>
            <b>{t("size_guide")}</b>
            <small>{t("size_guide_sub")}</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-delivery-terms-btn"
          onClick={onOpenDeliveryTerms}
        >
          <span className="profileSticker3D">🚚</span>
          <div>
            <b>{t("delivery_and_returns")}</b>
            <small>{t("delivery_and_returns_sub")}</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-about-brand-btn"
          onClick={onOpenAboutBrand}
        >
          <span className="profileSticker3D">👑</span>
          <div>
            <b>{t("about_guli")}</b>
            <small>{t("about_guli_sub")}</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-social-btn"
          onClick={onOpenSocial}
        >
          <span className="profileSticker3D">🌐</span>
          <div>
            <b>{t("social_media")}</b>
            <small>{t("social_media_sub")}</small>
          </div>
          <i>›</i>
        </button>
      </section>

      {/* 6. Sozlamalar va Xavfsizlik */}
      <section className="profileSection" style={{ marginBottom: "20px" }}>
        <h2>⚙️ {t("settings_and_account")}</h2>

        <button
          className="menuRow"
          id="profile-settings-btn"
          onClick={onOpenSettings}
        >
          <span>⚙️</span>
          <div>
            <b>{t("settings")}</b>
            <small>
              {theme === "dark" ? t("theme_dark") : t("theme_light")} · {currency} · {language.toUpperCase()}
            </small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-share-btn"
          onClick={onShare}
        >
          <span>↗</span>
          <div>
            <b>{t("share_guli")}</b>
            <small>{t("share_guli_sub")}</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-clear-cache-btn"
          onClick={onClearCache}
        >
          <span>🗑️</span>
          <div>
            <b>{t("clear_cache")}</b>
            <small>{t("clear_cache_sub")}</small>
          </div>
          <i>›</i>
        </button>

        {/* Safe Logout Button - Only for authenticated users */}
        {authUser && (
          <button
            className="menuRow"
            id="profile-logout-btn"
            onClick={() => setIsLogoutConfirmOpen(true)}
            style={{
              borderLeft: "4px solid #ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.04)",
            }}
          >
            <span style={{ fontSize: "20px" }}>🚪</span>
            <div>
              <b style={{ color: "#ef4444" }}>{t("logout_btn")}</b>
              <small>{t("logout_btn_sub")}</small>
            </div>
            <i style={{ color: "#ef4444" }}>›</i>
          </button>
        )}
      </section>

      {/* Watermark */}
      <div
        style={{
          textAlign: "center",
          padding: "16px 0",
          color: "var(--text-muted, #94a3b8)",
          opacity: 0.6,
          fontSize: "12px",
          letterSpacing: "0.5px",
        }}
      >
        GULI Lingerie & Homewear · Online Market v3.0
      </div>

      {/* MODAL 1: Edit Profile Modal (Centered, Attractive, Real Photo Only, Synced to Checkout) */}
      {isEditModalOpen && typeof document !== "undefined" && createPortal(
        <div
          id="profile-edit-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: isDark ? "rgba(5, 2, 4, 0.82)" : "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            id="profile-edit-modal-card"
            className="guli-profile-edit-modal"
            style={{
              width: "100%",
              maxWidth: "430px",
              maxHeight: "92vh",
              overflowY: "auto",
              backgroundColor: isDark ? "#1a0f14" : "#ffffff",
              color: isDark ? "#fbeff2" : "#1e293b",
              borderRadius: "28px",
              padding: "24px 22px",
              boxShadow: isDark
                ? "0 25px 80px rgba(0, 0, 0, 0.95), 0 0 35px rgba(225, 29, 72, 0.22)"
                : "0 25px 70px rgba(190, 24, 93, 0.22), 0 0 25px rgba(225, 29, 72, 0.08)",
              border: isDark ? "1.5px solid rgba(225, 29, 72, 0.35)" : "1.5px solid rgba(225, 29, 72, 0.16)",
              margin: "auto",
              boxSizing: "border-box",
            }}
          >
            {/* Header: Title + Close Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #e11d48, #be123c)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontSize: "18px",
                    boxShadow: "0 4px 12px rgba(225, 29, 72, 0.3)",
                  }}
                >
                  🌸
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "17.5px",
                      fontWeight: 800,
                      margin: 0,
                      color: isDark ? "#ffffff" : "#0f172a",
                      letterSpacing: "-0.2px",
                    }}
                  >
                    Profilni tahrirlash
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      color: isDark ? "#c4a3ad" : "#64748b",
                      marginTop: "1px",
                    }}
                  >
                    Shaxsiy ma'lumotlaringiz
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="profile-edit-modal-close"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Yopish"
                style={{
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                  color: isDark ? "#e2d9dc" : "#64748b",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.2s ease",
                }}
              >
                ✕
              </button>
            </div>

            {/* Smart Checkout Sync Info Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "16px",
                backgroundColor: isDark ? "rgba(225, 29, 72, 0.12)" : "rgba(255, 241, 245, 0.95)",
                border: isDark ? "1px solid rgba(225, 29, 72, 0.28)" : "1px solid rgba(225, 29, 72, 0.2)",
                marginBottom: "18px",
              }}
            >
              <span style={{ fontSize: "16px", lineHeight: "1.2" }}>✨</span>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  lineHeight: "1.45",
                  fontWeight: 500,
                  color: isDark ? "#fed7e2" : "#9f1239",
                }}
              >
                <b>Avtomatik to'ldirish:</b> Kiritilgan ism, familiya, telefon va tug'ilgan kun xarid paytida buyurtma ma'lumotlariga avtomatik kiritiladi.
              </p>
            </div>

            <form onSubmit={handleSaveProfile}>
              {/* REAL PROFILE PHOTO ONLY (No face presets) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px 14px",
                  borderRadius: "22px",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#fdf2f4",
                  border: isDark ? "1px solid rgba(225, 29, 72, 0.25)" : "1px solid rgba(225, 29, 72, 0.15)",
                  marginBottom: "18px",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "88px",
                    height: "88px",
                    borderRadius: "50%",
                    padding: "3px",
                    background: "linear-gradient(135deg, #fbbf24 0%, #f43f5e 50%, #be123c 100%)",
                    boxShadow: "0 8px 24px rgba(225, 29, 72, 0.35)",
                  }}
                >
                  {editAvatar ? (
                    <img
                      src={editAvatar}
                      alt="Haqiqiy profil rasmi"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                        backgroundColor: isDark ? "#1a0f14" : "#ffffff",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background: isDark ? "linear-gradient(135deg, #be185d, #881337)" : "linear-gradient(135deg, #f43f5e, #be123c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "30px",
                        fontWeight: 800,
                      }}
                    >
                      {editName ? editName.trim().charAt(0).toUpperCase() : "👤"}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <label
                    id="profile-upload-real-photo-btn"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #e11d48, #be123c)",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>📷</span> Real rasm yuklash
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      style={{ display: "none" }}
                    />
                  </label>

                  {editAvatar && (
                    <button
                      type="button"
                      id="profile-remove-photo-btn"
                      onClick={() => setEditAvatar("")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "14px",
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fee2e2",
                        border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#ef4444",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>🗑️</span> O'chirish
                    </button>
                  )}
                </div>

                <span
                  style={{
                    fontSize: "11px",
                    color: isDark ? "#c4a3ad" : "#64748b",
                    textAlign: "center",
                    lineHeight: "1.3",
                  }}
                >
                  Galereyangizdan yoki kameradan shaxsiy real rasmingizni yuklang
                </span>
              </div>

              {/* FIELD 1: Ism va Familiya */}
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    fontWeight: 750,
                    color: isDark ? "#f3e8eb" : "#334155",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>👤</span> Ism va Familiya <span style={{ color: "#e11d48" }}>*</span>
                  </span>
                  <span style={{ fontSize: "10.5px", fontWeight: 500, color: isDark ? "#9e848e" : "#94a3b8" }}>
                    Masalan: Malika Rahimova
                  </span>
                </label>
                <input
                  type="text"
                  required
                  id="profile-edit-name-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ism va familiyangizni kiriting"
                  style={{
                    width: "100%",
                    height: "46px",
                    padding: "0 14px",
                    borderRadius: "15px",
                    backgroundColor: isDark ? "#24171e" : "#f8fafc",
                    color: isDark ? "#fbeff2" : "#0f172a",
                    border: isDark ? "1.5px solid #3d2932" : "1.5px solid #e2e8f0",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    boxSizing: "border-box",
                    outline: "none",
                    colorScheme: isDark ? "dark" : "light",
                    transition: "border-color 0.2s ease",
                  }}
                />
              </div>

              {/* FIELD 2: Telefon raqam */}
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    fontWeight: 750,
                    color: isDark ? "#f3e8eb" : "#334155",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>📱</span> Telefon raqam
                  </span>
                  <span style={{ fontSize: "10.5px", fontWeight: 500, color: isDark ? "#9e848e" : "#94a3b8" }}>
                    Kuryer bog'lanishi uchun
                  </span>
                </label>
                <input
                  type="tel"
                  id="profile-edit-phone-input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  style={{
                    width: "100%",
                    height: "46px",
                    padding: "0 14px",
                    borderRadius: "15px",
                    backgroundColor: isDark ? "#24171e" : "#f8fafc",
                    color: isDark ? "#fbeff2" : "#0f172a",
                    border: isDark ? "1.5px solid #3d2932" : "1.5px solid #e2e8f0",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    boxSizing: "border-box",
                    outline: "none",
                    colorScheme: isDark ? "dark" : "light",
                    transition: "border-color 0.2s ease",
                  }}
                />
              </div>

              {/* FIELD 3: Tug'ulgan kun */}
              <div style={{ marginBottom: "22px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    fontWeight: 750,
                    color: isDark ? "#f3e8eb" : "#334155",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span>🎂</span> Tug‘ilgan sana
                  </span>
                  <span style={{ fontSize: "10.5px", fontWeight: 500, color: isDark ? "#9e848e" : "#94a3b8" }}>
                    Bayram sovg'asi uchun
                  </span>
                </label>
                <input
                  type="date"
                  id="profile-edit-dob-input"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: "46px",
                    padding: "0 14px",
                    borderRadius: "15px",
                    backgroundColor: isDark ? "#24171e" : "#f8fafc",
                    color: isDark ? "#fbeff2" : "#0f172a",
                    border: isDark ? "1.5px solid #3d2932" : "1.5px solid #e2e8f0",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    boxSizing: "border-box",
                    outline: "none",
                    colorScheme: isDark ? "dark" : "light",
                    transition: "border-color 0.2s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: isDark ? "#c4a3ad" : "#64748b",
                    display: "block",
                    marginTop: "5px",
                    lineHeight: "1.35",
                  }}
                >
                  🎁 Tug‘ilgan kuningizda GULI brendidan maxsus bayram chegirmalari va kutilmagan sovg‘alarni taqdim etamiz.
                </span>
              </div>

              {/* Submit / Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="submit"
                  id="profile-save-changes-btn"
                  disabled={savingProfile}
                  style={{
                    width: "100%",
                    height: "48px",
                    borderRadius: "16px",
                    border: "none",
                    background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                    color: "#ffffff",
                    fontSize: "14.5px",
                    fontWeight: 800,
                    cursor: savingProfile ? "not-allowed" : "pointer",
                    boxShadow: "0 6px 20px rgba(225, 29, 72, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    opacity: savingProfile ? 0.8 : 1,
                  }}
                >
                  {savingProfile ? (
                    <>
                      <span>⏳</span> Saqlanmoqda...
                    </>
                  ) : (
                    <>
                      <span>💾</span> O'zgarishlarni saqlash ✓
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="profile-cancel-edit-btn"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    width: "100%",
                    height: "40px",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                    backgroundColor: "transparent",
                    color: isDark ? "#c4a3ad" : "#64748b",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Wallet & Cashback details */}
      {isWalletModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWalletModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.82)" : "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: isDark ? "#1c1317" : "#ffffff",
              color: isDark ? "#fbeff2" : "#1e293b",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.8)" : "0 24px 80px rgba(0,0,0,0.25)",
              border: isDark ? "1px solid #38262d" : "1px solid rgba(0,0,0,0.08)",
              textAlign: "center",
              margin: "auto",
            }}
          >
            <span style={{ fontSize: "42px" }}>💰</span>
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "10px 0 6px", color: isDark ? "#fbeff2" : "#1e293b" }}>
              GULI Keshbek Hamyoni
            </h3>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: isDark ? "#f472b6" : "#be185d",
                margin: "12px 0 16px",
              }}
            >
              {formatPrice(cashbackBalance)}
            </div>

            <div
              style={{
                backgroundColor: isDark ? "#23171d" : "#f8fafc",
                borderRadius: "16px",
                padding: "14px",
                textAlign: "left",
                marginBottom: "16px",
                border: isDark ? "1px solid #38262d" : "1px solid #e2e8f0",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#b89ea6" : "#64748b" }}>Tasdiqlangan xaridlar:</span>
                <b>{formatPrice(realTotalSpent)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#b89ea6" : "#64748b" }}>2% Keshbek darajasi:</span>
                <b style={{ color: "var(--success-badge-color, #16a34a)" }}>+{formatPrice(realCashbackEarned)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#b89ea6" : "#64748b" }}>Avval ishlatilgan:</span>
                <b style={{ color: "#dc2626" }}>-{formatPrice(usedCashback)}</b>
              </div>
              <div style={{ borderTop: isDark ? "1px dashed #4a323c" : "1px dashed #cbd5e1", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ fontWeight: 700, color: isDark ? "#fbeff2" : "#1e293b" }}>Mavjud foydalanish balansi:</span>
                <b style={{ color: isDark ? "#f472b6" : "#be185d", fontWeight: 800 }}>{formatPrice(cashbackBalance)}</b>
              </div>
            </div>

            <p style={{ fontSize: "12.5px", color: isDark ? "#b89ea6" : "#64748b", lineHeight: 1.5, margin: "0 0 18px" }}>
              Har bir xaridingizdan <b>2% kafolatlangan keshbek</b> hisoblanadi. Buyurtma rasmiylashtirishda ushbu summani to‘lovdan chegirib tovar sotib olishingiz mumkin!
            </p>
            <button
              type="button"
              onClick={() => setIsWalletModalOpen(false)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: isDark ? "1px solid #38262d" : "none",
                backgroundColor: isDark ? "#2a1e24" : "#1e293b",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Logout Confirmation (Rendered directly into body for perfect viewport centering) */}
      {isLogoutConfirmOpen && typeof document !== "undefined" && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLogoutConfirmOpen(false);
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.78)" : "rgba(15, 23, 42, 0.58)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 99999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "350px",
              backgroundColor: isDark ? "#1c1317" : "#ffffff",
              color: isDark ? "#fbeff2" : "#1e293b",
              borderRadius: "24px",
              padding: "24px 20px",
              boxShadow: isDark ? "0 24px 80px rgba(0, 0, 0, 0.85)" : "0 20px 60px rgba(0, 0, 0, 0.22)",
              border: isDark ? "1px solid #38262d" : "1px solid #e2e8f0",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            {/* Elegant Danger Icon Circle */}
            <div
              style={{
                width: "52px",
                height: "52px",
                minWidth: "52px",
                minHeight: "52px",
                borderRadius: "50%",
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px auto",
                boxShadow: "0 4px 14px rgba(239, 68, 68, 0.15)",
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 8px", color: isDark ? "#fbeff2" : "#1e293b" }}>
              Tizimdan chiqish
            </h3>
            <p style={{ fontSize: "13px", color: isDark ? "#b89ea6" : "#64748b", lineHeight: 1.5, margin: "0 0 20px" }}>
              Haqiqatan ham GULI hisobingizdan chiqmoqchimisiz? Barcha xaridlar tarixi va keshbek balansingiz saqlanib qoladi.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                style={{
                  padding: "13px 16px",
                  borderRadius: "14px",
                  border: isDark ? "1px solid #38262d" : "1px solid #cbd5e1",
                  backgroundColor: isDark ? "#2a1e24" : "#f8fafc",
                  color: isDark ? "#fbeff2" : "#475569",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  onLogout();
                }}
                style={{
                  padding: "13px 16px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                Ha, chiqish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: 3D Spin & Zoom Center Expanded Promo Modal */}
      {(() => {
        const promoData = getPromoModalData(language);
        if (!activePromoModal || !promoData[activePromoModal]) return null;
        const currentModal = promoData[activePromoModal];
        return typeof document !== "undefined" && createPortal(
          <div
            className="guli-promo-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              backgroundColor: "rgba(0, 0, 0, 0.78)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              overflowY: "auto",
            }}
            onClick={() => setActivePromoModal(null)}
          >
            <div
              className="guli-promo-modal-card"
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "460px",
                borderRadius: "26px",
                overflow: "hidden",
                border: `1.5px solid ${currentModal.badgeBorder}`,
                boxShadow: `0 24px 60px -10px rgba(0, 0, 0, 0.85), 0 0 32px ${currentModal.glowColor}`,
                color: "#ffffff",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Photographic Base64 Background Layer */}
              <div
                className={currentModal.bgClass}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  transform: "scale(1.08)",
                  filter: "brightness(0.72) contrast(1.15)",
                  pointerEvents: "none",
                }}
              />

              {/* Dark luxury gradient overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(10, 15, 29, 0.94) 40%, rgba(6, 9, 18, 0.98) 100%)",
                  pointerEvents: "none",
                }}
              />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActivePromoModal(null)}
                style={{
                  position: "absolute",
                  top: "14px",
                  right: "14px",
                  zIndex: 10,
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.16)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontSize: "18px",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.32)";
                  e.currentTarget.style.transform = "scale(1.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.16)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                aria-label="Yopish"
              >
                ✕
              </button>

              {/* Scrollable Content Body */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: "24px 20px 20px 20px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Top Badge & Icon */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "14px",
                      backgroundColor: "rgba(255, 255, 255, 0.14)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      border: `1px solid ${currentModal.badgeBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 4px 14px ${currentModal.glowColor}`,
                      flexShrink: 0,
                    }}
                  >
                    {React.createElement(currentModal.icon, { size: 26 })}
                  </div>
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        color: currentModal.badgeColor,
                        backgroundColor: currentModal.badgeBg,
                        border: `1px solid ${currentModal.badgeBorder}`,
                        padding: "3px 10px",
                        borderRadius: "20px",
                      }}
                    >
                      {currentModal.badge}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    lineHeight: 1.3,
                    margin: "0 0 8px 0",
                    color: "#ffffff",
                    textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  {currentModal.title}
                </h3>

                {/* Subtitle */}
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "rgba(255, 255, 255, 0.88)",
                    margin: "0 0 14px 0",
                  }}
                >
                  {currentModal.subtitle}
                </p>

                {/* Urgency Highlight Box */}
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    border: `1px solid ${currentModal.badgeBorder}`,
                    borderRadius: "14px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: currentModal.badgeColor,
                    lineHeight: 1.4,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {currentModal.urgencyText}
                </div>

                {/* Tailored Benefits List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
                  {currentModal.benefits.map((benefit, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        padding: "10px 12px",
                        borderRadius: "14px",
                      }}
                    >
                      <span style={{ fontSize: "18px", lineHeight: 1.2, flexShrink: 0 }}>{benefit.emoji}</span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", marginBottom: "2px" }}>
                          {benefit.title}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "rgba(255, 255, 255, 0.78)", lineHeight: 1.45 }}>
                          {benefit.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* High-Converting CTA Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePromoModal(null);
                    onOpenAuth?.("signup");
                  }}
                  style={{
                    width: "100%",
                    padding: "15px 18px",
                    borderRadius: "16px",
                    border: "none",
                    background: "linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%)",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(225, 29, 72, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "2px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 14px 30px rgba(225, 29, 72, 0.65)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 10px 25px rgba(225, 29, 72, 0.5)";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{currentModal.ctaText}</span>
                    <span>→</span>
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255, 255, 255, 0.85)" }}>
                    {currentModal.ctaSubtext}
                  </span>
                </button>

                {/* Secondary Sign-in Link */}
                <div style={{ textAlign: "center", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePromoModal(null);
                      onOpenAuth?.("signin");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: "12px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: "4px 8px",
                    }}
                  >
                    {language === "ru"
                      ? "Уже есть аккаунт? Войти в систему"
                      : language === "en"
                      ? "Already have an account? Sign in"
                      : "Allaqachon hisobingiz bormi? Tizimga kirish"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </main>
  );
};
