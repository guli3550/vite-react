import type { ReelItem } from "../types/reels";
import { buildApiUrl } from "./apiOrigin";

type ApiResponse<T> = { success?: boolean; data?: T; message?: string };

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (admin && typeof window !== "undefined") {
    const token = sessionStorage.getItem("guli_admin_token") || "";
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(buildApiUrl(path), { ...init, headers });
  const payload = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Server xatosi (${response.status})`);
  }
  return payload.data as T;
}

let publicReelsRequest: Promise<ReelItem[]> | null = null;

export async function fetchPublicReels(): Promise<ReelItem[]> {
  if (!publicReelsRequest) {
    const pending = request<ReelItem[]>("/api/reels");
    publicReelsRequest = pending;
    try {
      return await pending;
    } finally {
      if (publicReelsRequest === pending) publicReelsRequest = null;
    }
  }
  return publicReelsRequest;
}

export async function prefetchPublicReels(): Promise<void> {
  try {
    const reels = await fetchPublicReels();
    const activeReels = reels.filter((reel) => reel.status === "active");
    localStorage.setItem("guli_public_reels_cache_v1", JSON.stringify({ savedAt: Date.now(), reels: activeReels }));
  } catch (error) {
    console.warn("[Reels] Fon rejimida oldindan yuklash bajarilmadi:", error);
  }
}

export async function fetchAdminReels(): Promise<ReelItem[]> {
  return request<ReelItem[]>("/api/admin/reels", {}, true);
}

export async function saveServerReel(reel: ReelItem, isEditing: boolean): Promise<ReelItem> {
  const body = JSON.stringify({
    id: reel.id,
    caption: reel.caption,
    videoUrl: reel.videoUrl,
    posterUrl: reel.posterUrl,
    musicTitle: reel.musicTitle,
    displayLikesCount: reel.displayLikesCount ?? 100,
    author: reel.author,
    productId: reel.productId,
    productName: reel.productName,
    productPrice: reel.productPrice,
    productImage: reel.productImage,
    status: reel.status,
  });
  return request<ReelItem>(isEditing ? `/api/admin/reels/${encodeURIComponent(reel.id)}` : "/api/admin/reels", {
    method: isEditing ? "PUT" : "POST",
    body,
  }, true);
}

export async function deleteServerReel(reelId: string): Promise<void> {
  await request<unknown>(`/api/admin/reels/${encodeURIComponent(reelId)}`, { method: "DELETE" }, true);
}

function getViewerKey(): string {
  const keyName = "guli_reels_viewer_key_v1";
  try {
    let key = localStorage.getItem(keyName) || "";
    if (!/^[a-zA-Z0-9_-]{12,128}$/.test(key)) {
      key = `viewer_${window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(keyName, key);
    }
    return key;
  } catch {
    return `viewer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export async function toggleServerReelLike(reelId: string): Promise<{ isLiked: boolean; likesCount: number }> {
  return request<{ isLiked: boolean; likesCount: number }>(`/api/reels/${encodeURIComponent(reelId)}/like`, {
    method: "POST",
    body: JSON.stringify({ viewerKey: getViewerKey() }),
  });
}

export async function addServerReelComment(reelId: string, text: string) {
  return request<ReelItem["comments"][number]>(`/api/reels/${encodeURIComponent(reelId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function recordServerReelView(reelId: string): Promise<{ viewsCount: number }> {
  return request<{ viewsCount: number }>(`/api/reels/${encodeURIComponent(reelId)}/view`, {
    method: "POST",
    body: "{}",
  });
}

export async function uploadReelMedia(file: File): Promise<string> {
  if (file.size > 100 * 1024 * 1024) throw new Error("Fayl hajmi 100 MB dan oshmasligi kerak");
  const contentType = file.type || (file.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "");
  if (!/^(video\/(mp4|webm|quicktime)|image\/(jpeg|png|webp|avif))$/.test(contentType)) {
    throw new Error("Faqat MP4, WebM, MOV, JPG, PNG, WebP yoki AVIF formatlari qollab-quvvatlanadi");
  }
  const headers = new Headers({ "Content-Type": contentType, Accept: "application/json" });
  const token = typeof window !== "undefined" ? sessionStorage.getItem("guli_admin_token") || "" : "";
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await fetch(buildApiUrl("/api/admin/reels/upload"), { method: "POST", headers, body: file });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false || !payload?.data?.publicUrl) {
    throw new Error(payload?.message || ("Fayl serverga yuklanmadi (HTTP " + response.status + ")"));
  }
  return payload.data.publicUrl as string;
}
