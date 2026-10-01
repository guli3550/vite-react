export type SocialPlatform = "instagram" | "telegram" | "youtube" | "custom";

export interface SocialPromoItem {
  id: string;
  title: string;
  platform: SocialPlatform;
  label: string;
  target_url: string;
  logo_url?: string | null;
  row_number: 1 | 2 | 3;
  sort_order: number;
  is_active: boolean;
  open_in_new_tab: boolean;
  mobile_visible: boolean;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SocialPromoRowSetting {
  row_number: 1 | 2 | 3;
  is_enabled: boolean;
  direction: "left" | "right";
  duration_seconds: number;
  updated_at?: string;
}

export interface SocialPromosApiResponse {
  success: boolean;
  source?: string;
  data: {
    items: SocialPromoItem[];
    settings: SocialPromoRowSetting[];
  };
}
