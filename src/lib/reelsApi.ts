import type { ReelItem } from "../types/reels";
import { getSupabase } from "./supabaseClient";
import { buildApiUrl } from "./apiOrigin";

type ApiResponse<T> = { success?: boolean; data?: T; message?: string };

const PUBLIC_REELS_CACHE_KEY = "guli_published_reels_cache_v1";

export function loadCachedPublicReels(): ReelItem[] {
  try {
    const raw = localStorage.getItem(PUBLIC_REELS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is ReelItem => Boolean(item && item.id && item.videoUrl && item.status === "active"))
      : [];
  } catch {
    return [];
  }
}

export function saveCachedPublicReels(reels: ReelItem[]): void {
  try {
    const safe = reels.filter((item) => item && item.status === "active" && item.videoUrl);
    localStorage.setItem(PUBLIC_REELS_CACHE_KEY, JSON.stringify(safe));
  } catch {
    // Cache is optional; server remains the source of truth.
  }
}

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

export async function fetchPublicReels(): Promise<ReelItem[]> {
  return request<ReelItem[]>(`/api/reels?viewerKey=${encodeURIComponent(getViewerKey())}`);
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
    author: reel.author,
    productId: reel.productId ?? null,
    productName: reel.productName ?? null,
    productPrice: reel.productPrice ?? null,
    productImage: reel.productImage ?? null,
    status: reel.status,
    displayLikesCount: reel.displayLikesCount ?? 100,
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

const USER_LIKES_KEY = "guli_reels_user_likes_v1";

function getLocalLikedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(USER_LIKES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveLocalLikedIds(set: Set<string>): void {
  try {
    localStorage.setItem(USER_LIKES_KEY, JSON.stringify([...set]));
  } catch {
    // LocalStorage quota may be full
  }
}

export function toggleLocalReelLike(reelId: string): { isLiked: boolean; likesCount: number } {
  const liked = getLocalLikedIds();
  const willBeLiked = !liked.has(reelId);
  if (willBeLiked) {
    liked.add(reelId);
  } else {
    liked.delete(reelId);
  }
  saveLocalLikedIds(liked);

  let likesCount = willBeLiked ? 1 : 0;

  // Sync into cached published reels
  try {
    const cached = loadCachedPublicReels();
    const item = cached.find((r) => r.id === reelId);
    if (item) {
      item.isLiked = willBeLiked;
      item.likesCount = Math.max(0, (item.likesCount || 0) + (willBeLiked ? 1 : -1));
      likesCount = item.likesCount;
      saveCachedPublicReels(cached);
    }
  } catch {
    // Ignore cache error
  }

  // Sync into demo reels storage
  try {
    const raw = localStorage.getItem("guli_demo_reels_v2");
    if (raw) {
      const demoList = JSON.parse(raw);
      if (Array.isArray(demoList)) {
        const demoItem = demoList.find((r: any) => r && r.id === reelId);
        if (demoItem) {
          demoItem.isLiked = willBeLiked;
          demoItem.likesCount = Math.max(0, (demoItem.likesCount || 0) + (willBeLiked ? 1 : -1));
          likesCount = demoItem.likesCount;
          localStorage.setItem("guli_demo_reels_v2", JSON.stringify(demoList));
        }
      }
    }
  } catch {
    // Ignore demo storage error
  }

  return { isLiked: willBeLiked, likesCount };
}

export async function toggleServerReelLike(reelId: string): Promise<{ isLiked: boolean; likesCount: number }> {
  try {
    return await request<{ isLiked: boolean; likesCount: number }>(`/api/reels/${encodeURIComponent(reelId)}/like`, {
      method: "POST",
      body: JSON.stringify({ viewerKey: getViewerKey() }),
    });
  } catch (error) {
    console.warn("[Reels] Server like unreachable, using local storage fallback:", error);
    return toggleLocalReelLike(reelId);
  }
}

function getGuestCommentKey(): string {
  const keyName = "guli_reels_guest_comment_key_v1";
  try {
    let key = localStorage.getItem(keyName) || "";
    if (!/^guest_[a-f0-9-]{20,64}$/i.test(key)) {
      key = "guest_" + (window.crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2)));
      localStorage.setItem(keyName, key);
    }
    return key;
  } catch {
    return "guest_" + (Date.now() + "-" + Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2));
  }
}

export async function fetchServerReelComments(reelId: string): Promise<ReelItem["comments"]> {
  return request<ReelItem["comments"]>(`/api/reels/${encodeURIComponent(reelId)}/comments`);
}

export async function addServerReelComment(reelId: string, text: string): Promise<ReelItem["comments"][number]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("guli_access_token") || "" : "";
  const guestKey = getGuestCommentKey();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return request<ReelItem["comments"][number]>(`/api/reels/${encodeURIComponent(reelId)}/comments`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: text.trim(), guestKey }),
  });
}

export async function recordServerReelView(reelId: string): Promise<{ viewsCount: number }> {
  try {
    return await request<{ viewsCount: number }>(`/api/reels/${encodeURIComponent(reelId)}/view`, {
      method: "POST",
      body: "{}",
    });
  } catch {
    let viewsCount = 1;
    try {
      const cached = loadCachedPublicReels();
      const item = cached.find((r) => r.id === reelId);
      if (item) {
        item.viewsCount = (item.viewsCount || 0) + 1;
        viewsCount = item.viewsCount;
        saveCachedPublicReels(cached);
      }
    } catch {
      // Ignore cache error
    }
    return { viewsCount };
  }
}

export async function uploadReelMedia(file: File): Promise<string> {
  if (file.size > 100 * 1024 * 1024) throw new Error("Fayl hajmi 100 MB dan oshmasligi kerak");
  const contentType = file.type || (file.name.toLowerCase().endsWith(".mp4") ? "video/mp4" : "");
  const signed = await request<{ path: string; token: string; publicUrl: string; bucket: string }>("/api/admin/reels/upload-url", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType }),
  }, true);
  const client = getSupabase();
  if (!client) throw new Error("Supabase public key sozlanmagan; VITE_SUPABASE_ANON_KEY ni tekshiring");
  const { error } = await client.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return signed.publicUrl;
}
