import type { ReelItem } from "../types/reels";

export const INITIAL_DEMO_REELS: ReelItem[] = [
  {
    id: "reel-1",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    posterUrl: "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=900&q=80",
    caption: "Yangi fasl kolleksiyasi: Fransuz ipak va nozik baxmal to‘plamlari ✨ Guli Market do‘konlarida chegirma bilan! #gulimarket #fashion #luxe #yangilik",
    musicTitle: "Guli Boutique — Silk & Elegance",
    author: {
      name: "Guli Market",
      username: "gulii.uz",
      avatar: "/guli-logo.png",
      verified: true,
    },
    productId: 101,
    productName: "Velvet Elegance Push-Up To‘plami",
    productPrice: 340000,
    productImage: "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=400&q=80",
    likesCount: 1420,
    commentsCount: 38,
    sharesCount: 114,
    viewsCount: 18450,
    isLiked: false,
    status: "active",
    createdAt: "2026-03-24T10:30:00.000Z",
    comments: [
      {
        id: "c1",
        authorName: "Madinabonu",
        authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
        text: "Kiyimi juda chiroyli ekan, o'lchamlari bormi? 😍",
        createdAt: "2 soat oldin",
        likesCount: 12,
      },
      {
        id: "c2",
        authorName: "Shahzoda Karimova",
        authorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80",
        text: "Toshkent bo‘ylab yetkazib berish qancha vaqt oladi?",
        createdAt: "4 soat oldin",
        likesCount: 5,
      },
      {
        id: "c3",
        authorName: "Guli Market Support",
        authorAvatar: "/guli-logo.png",
        text: "Assalomu alaykum! Toshkent shahrida 2 soat ichida yetkazib beramiz 🚀",
        createdAt: "3 soat oldin",
        likesCount: 8,
      },
    ],
  },
  {
    id: "reel-2",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    posterUrl: "https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?auto=format&fit=crop&w=900&q=80",
    caption: "Silk Satin Romantic — kundalik qulaylik va eng yuqori sifat uyg‘unligi 🌸 Narxi: 260 000 so‘m. Barcha razmerlar mavjud!",
    musicTitle: "Acoustic Romantic Vibes — Lounge",
    author: {
      name: "Guli Market",
      username: "gulii.uz",
      avatar: "/guli-logo.png",
      verified: true,
    },
    productId: 102,
    productName: "Silk Satin Romantic Bezgalter",
    productPrice: 260000,
    productImage: "https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?auto=format&fit=crop&w=400&q=80",
    likesCount: 980,
    commentsCount: 19,
    sharesCount: 72,
    viewsCount: 12300,
    isLiked: true,
    status: "active",
    createdAt: "2026-03-22T14:15:00.000Z",
    comments: [
      {
        id: "c4",
        authorName: "Nilufar Azimova",
        authorAvatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80",
        text: "Ranglari juda yoqdi, buyurtma qildim!",
        createdAt: "1 kun oldin",
        likesCount: 7,
      },
      {
        id: "c5",
        authorName: "Dilorom Yusupova",
        authorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80",
        text: "Mato sifati ajoyib, rahmat!",
        createdAt: "1 kun oldin",
        likesCount: 4,
      },
    ],
  },
  {
    id: "reel-3",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    posterUrl: "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=900&q=80",
    caption: "Pure Silk Sleepwear Pijama — kechki dam olish uchun maxsus yaratilgan nafislik 🌙 Toshkent bo‘ylab bepul yetkazib berish!",
    musicTitle: "Chill Lo-Fi Dreams — Night Edition",
    author: {
      name: "Guli Market",
      username: "gulii.uz",
      avatar: "/guli-logo.png",
      verified: true,
    },
    productId: 104,
    productName: "Pure Silk Sleepwear Pijama",
    productPrice: 420000,
    productImage: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=400&q=80",
    likesCount: 2310,
    commentsCount: 64,
    sharesCount: 310,
    viewsCount: 34100,
    isLiked: false,
    status: "active",
    createdAt: "2026-03-20T09:00:00.000Z",
    comments: [
      {
        id: "c6",
        authorName: "Zilola Usmonova",
        authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
        text: "Pijama to‘plami qanday matodan tikilgan?",
        createdAt: "2 kun oldin",
        likesCount: 3,
      },
      {
        id: "c7",
        authorName: "Guli Market Support",
        authorAvatar: "/guli-logo.png",
        text: "Tabiiy 100% ipak mato, tanaga juda yoqimli va yengil tushadi 💫",
        createdAt: "2 kun oldin",
        likesCount: 9,
      },
    ],
  },
  {
    id: "reel-4",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    posterUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80",
    caption: "Qadoqlash jarayoni 🎁 Har bir buyurtma maxsus atir xushbo‘yligi va nozik qutida jo‘natiladi!",
    musicTitle: "Soft Ambient Acoustic Vibes",
    author: {
      name: "Guli Market",
      username: "gulii.uz",
      avatar: "/guli-logo.png",
      verified: true,
    },
    productId: 103,
    productName: "Lace Temptation Bodysuit",
    productPrice: 390000,
    productImage: "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80",
    likesCount: 840,
    commentsCount: 14,
    sharesCount: 45,
    viewsCount: 9400,
    isLiked: false,
    status: "draft",
    createdAt: "2026-03-25T11:00:00.000Z",
    comments: [],
  },
];

const STORAGE_KEY = "guli_demo_reels_v2";

export function loadReelsFromStorage(): ReelItem[] {
  if (typeof window === "undefined") return INITIAL_DEMO_REELS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_REELS));
      return INITIAL_DEMO_REELS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: ReelItem) => ({
        ...item,
        author: {
          name: "Guli Market",
          username: "gulii.uz",
          avatar: "/guli-logo.png",
          verified: true,
        },
      }));
    }
    return INITIAL_DEMO_REELS;
  } catch {
    return INITIAL_DEMO_REELS;
  }
}

export function saveReelsToStorage(reels: ReelItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reels));
    window.dispatchEvent(new CustomEvent("guli_reels_updated", { detail: reels }));
  } catch (err) {
    console.warn("Could not save reels to localStorage:", err);
  }
}

export function getActiveReels(): ReelItem[] {
  const all = loadReelsFromStorage();
  return all.filter((r) => r.status === "active");
}
