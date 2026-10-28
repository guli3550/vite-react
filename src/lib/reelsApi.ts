import type { ReelItem } from "../types/reels";
import { BACKEND_API_URL } from "./supabaseClient";

type ApiResponse<T> = { success?: boolean; data?: T; message?: string };

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (admin && typeof window !== "undefined") {
    const token = sessionStorage.getItem("guli_admin_token") || "";
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${BACKEND_API_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Server xatosi (${response.status})`);
  }
  return payload.data as T;
}

export async function fetchPublicReels(): Promise<ReelItem[]> {
  return request<ReelItem[]>("/api/reels");
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
