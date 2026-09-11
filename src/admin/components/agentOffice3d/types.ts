export type AgentRole = "orchestrator" | "sales" | "order" | "payment" | "support" | "security";

export type AgentStatus = "working" | "idle" | "thinking" | "error" | "offline";

export interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  status: "working" | "idle";
}

export interface AgentTask {
  id: string;
  agent_id: string;
  command: string;
  status: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  error?: string;
  result?: unknown;
}

export interface AgentEvent {
  id: string;
  task_id: string;
  agent_id: string;
  event_type: string;
  message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface OfficeZone {
  id: string;
  nameUz: string;
  icon: string;
  descriptionUz: string;
  x: number;
  z: number;
}

export interface AgentConfig {
  id: string;
  nameUz: string;
  roleUz: string;
  icon: string;
  color: string;
  zone: string;
  deskPos: [number, number, number];
  deskRotY: number;
  outfitColor: number;
  hairColor: number;
  skinTone: number;
  hasGlasses?: boolean;
  hasHeadset?: boolean;
  hasTie?: boolean;
  descriptionUz: string;
}

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  orchestrator: {
    id: "orchestrator",
    nameUz: "Boshqaruvchi Agent",
    roleUz: "Boshqaruv va marshrutlash",
    icon: "🎯",
    color: "#d946ef", // Fuchsia
    zone: "Boshqaruv markazi",
    deskPos: [0, 0, -1.2],
    deskRotY: 0,
    outfitColor: 0x1e1b4b, // Deep indigo suit
    hairColor: 0x1c1917,
    skinTone: 0xf5d0b5,
    hasTie: true,
    descriptionUz: "Barcha agentlar faoliyatini muvofiqlashtiradi, vazifalarni avtomatik taqsimlaydi va operatsiyalar xavfsizligini ta'minlaydi."
  },
  sales: {
    id: "sales",
    nameUz: "Savdo Agenti",
    roleUz: "Mahsulotlar va katalog tahlili",
    icon: "🛍️",
    color: "#f43f5e", // Rose
    zone: "Savdo bo‘limi",
    deskPos: [-5.8, 0, -2.5],
    deskRotY: Math.PI * 0.15,
    outfitColor: 0xbe123c, // Rose red blazer
    hairColor: 0x451a03,
    skinTone: 0xfcd34d,
    descriptionUz: "Mahsulotlar katalogini, ombor qoldig‘ini, narxlarni va sotuv tavsiyalarini doimiy tahlil qiladi."
  },
  order: {
    id: "order",
    nameUz: "Buyurtmalar Agenti",
    roleUz: "Buyurtmalar va logistika",
    icon: "📦",
    color: "#0284c7", // Sky
    zone: "Logistika zonasi",
    deskPos: [-5.8, 0, 3.2],
    deskRotY: -Math.PI * 0.15,
    outfitColor: 0x0369a1, // Navy blue uniform
    hairColor: 0x171717,
    skinTone: 0xf3c19d,
    descriptionUz: "Yangi buyurtmalarni tekshiradi, yetkazib berish holatini kuzatadi va manzil aniqligini nazorat qiladi."
  },
  payment: {
    id: "payment",
    nameUz: "To‘lovlar Agenti",
    roleUz: "To‘lov va cheklar auditi",
    icon: "💳",
    color: "#10b981", // Emerald
    zone: "Moliya stoli",
    deskPos: [5.8, 0, -2.5],
    deskRotY: -Math.PI * 0.15,
    outfitColor: 0x065f46, // Emerald dark vest
    hairColor: 0x292524,
    skinTone: 0xf7d3ba,
    hasGlasses: true,
    descriptionUz: "Karta orqali to‘lovlar, bank cheklari va to‘lov holatlarini qat'iy moliya standartlari asosida tekshiradi."
  },
  support: {
    id: "support",
    nameUz: "Mijozlar Agenti",
    roleUz: "Chat va mijozlar xizmati",
    icon: "💬",
    color: "#8b5cf6", // Violet
    zone: "Muloqot markazi",
    deskPos: [5.8, 0, 3.2],
    deskRotY: Math.PI * 0.15,
    outfitColor: 0x6d28d9, // Violet blazer
    hairColor: 0x581c87,
    skinTone: 0xf5c9a6,
    hasHeadset: true,
    descriptionUz: "Mijozlar savollari, chat xabarlari va operator navbatini uzluksiz tahlil qilib, tezkor yordam ko‘rsatadi."
  },
  security: {
    id: "security",
    nameUz: "Xavfsizlik Agenti",
    roleUz: "Kiberxavfsizlik va server auditi",
    icon: "🛡️",
    color: "#f59e0b", // Amber
    zone: "Server va xavfsizlik zonasi",
    deskPos: [1.8, 0, -5.6],
    deskRotY: 0,
    outfitColor: 0x1f2937, // Tactical dark grey
    hairColor: 0x0f172a,
    skinTone: 0xdfb497,
    hasGlasses: true,
    descriptionUz: "Tizim audit eventlarini, ruxsatsiz urinishlarni, API token xavfsizligini va server holatini tekshiradi."
  }
};

export const OFFICE_ZONES: OfficeZone[] = [
  { id: "command", nameUz: "Markaziy boshqaruv", icon: "🎯", descriptionUz: "Boshqaruvchi agent ish stoli va markaziy boshqaruv konsoli", x: 0, z: -1.2 },
  { id: "sales", nameUz: "Savdo bo‘limi", icon: "🛍️", descriptionUz: "Katalog va mahsulotlar monitoring stantsiyasi", x: -5.8, z: -2.5 },
  { id: "orders", nameUz: "Logistika & Buyurtmalar", icon: "📦", descriptionUz: "Yetkazib berish va buyurtma holatlari stoli", x: -5.8, z: 3.2 },
  { id: "finance", nameUz: "Moliya & To‘lovlar", icon: "💳", descriptionUz: "Tranzaksiyalar va cheklar xavfsiz audit stoli", x: 5.8, z: -2.5 },
  { id: "support", nameUz: "Mijozlar bilan aloqa", icon: "💬", descriptionUz: "Jonli chat va operator yordam stantsiyasi", x: 5.8, z: 3.2 },
  { id: "server", nameUz: "Server & Kiber xavfsizlik", icon: "🛡️", descriptionUz: "Baland server stoykalari va ma'lumotlar ombori", x: 1.8, z: -5.6 },
  { id: "meeting", nameUz: "Kengash & Strategiya zonasi", icon: "👥", descriptionUz: "Katta dumaloq muzokara stoli va taqdimot ekrani", x: 0, z: 4.8 }
];

export type CameraPresetKey = "overview" | "command" | "meeting" | "server" | "sales" | "payment";

export interface CameraPreset {
  key: CameraPresetKey;
  labelUz: string;
  icon: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    key: "overview",
    labelUz: "Umumiy ko‘rinish",
    icon: "🏛️",
    position: [0, 14, 16],
    target: [0, 1, 0]
  },
  {
    key: "command",
    labelUz: "Boshqaruv markazi",
    icon: "🎯",
    position: [0, 4.5, 3.5],
    target: [0, 1.2, -1.2]
  },
  {
    key: "meeting",
    labelUz: "Muzokara zonasi",
    icon: "👥",
    position: [0, 4.8, 9.5],
    target: [0, 1.2, 4.8]
  },
  {
    key: "server",
    labelUz: "Server zonasi",
    icon: "🛡️",
    position: [2.5, 3.8, -2.5],
    target: [1.8, 1.8, -5.6]
  }
];
