export interface SocialLinks {
  instagram: string;
  telegram: string;
  tiktok: string;
}

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  instagram: "https://www.instagram.com/guli_3550_?igsi=NXRsM2tsamFvNzNo",
  telegram: "https://t.me/pijama3550",
  tiktok: "https://www.tiktok.com/@guli_3550?_r=1&_d=f4j11cea3ij622&sec_uid=MS4wLjABAAAAGjHnRu7FjFanmAY2CAhE116NE0lmSwq1UUHBf4VWxOKnqw5JtzVeZiHnVF2Ib3PW&share_author_id=7671352724126680082&sharer_language=ru&source=h5_m&u_code=f516i4kdcf9aii&timestamp=1787954736&user_id=7671352724126680082&sec_user_id=MS4wLjABAAAAGjHnRu7FjFanmAY2CAhE116NE0lmSwq1UUHBf4VWxOKnqw5JtzVeZiHnVF2Ib3PW&item_author_type=1&utm_source=copy&utm_campaign=client_share&utm_medium=android&share_iid=7679135329097746184&share_link_id=bbd3617a-7062-42ab-ab86-2035da75587f&share_app_id=1233&ugbiz_name=ACCOUNT&ug_btm=b8727%2Cb7360&social_share_type=5&enable_checksum=1",
};

export const SOCIAL_STORAGE_KEY = "guli_social_links";

export function getSocialLinks(): SocialLinks {
  try {
    const raw = localStorage.getItem(SOCIAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        instagram: parsed.instagram || DEFAULT_SOCIAL_LINKS.instagram,
        telegram: parsed.telegram || DEFAULT_SOCIAL_LINKS.telegram,
        tiktok: parsed.tiktok || DEFAULT_SOCIAL_LINKS.tiktok,
      };
    }
  } catch {}
  return { ...DEFAULT_SOCIAL_LINKS };
}

export function saveSocialLinks(links: SocialLinks): void {
  try {
    const payload = {
      instagram: links.instagram?.trim() || DEFAULT_SOCIAL_LINKS.instagram,
      telegram: links.telegram?.trim() || DEFAULT_SOCIAL_LINKS.telegram,
      tiktok: links.tiktok?.trim() || DEFAULT_SOCIAL_LINKS.tiktok,
    };
    localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("guli_social_links_updated", { detail: payload }));
  } catch (e) {
    console.error("Failed to save social links:", e);
  }
}
