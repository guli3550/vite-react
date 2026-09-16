import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase is the data/storage layer only. Customer authentication is handled
// exclusively by the canonical GULI Telegram auth server.
export const DEFAULT_SUPABASE_URL = "https://qttwufydrvdwmhxcpgjb.supabase.co";
export const BACKEND_API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://guli-gateway.parizodabaxtiyorov.workers.dev"
).replace(/\/$/, "");

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const winUrl = (window as unknown as { __GULI_SUPABASE_URL?: string })?.__GULI_SUPABASE_URL?.trim();
  const winKey = (window as unknown as { __GULI_SUPABASE_ANON_KEY?: string })?.__GULI_SUPABASE_ANON_KEY?.trim();
  return { url: envUrl || winUrl || DEFAULT_SUPABASE_URL, anonKey: envKey || winKey || "" };
}

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  try {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase data client:", err);
    return null;
  }
}

export function initSupabaseWithKey(anonKey: string, url?: string): SupabaseClient | null {
  if (!anonKey) return null;
  const targetUrl = url || getSupabaseConfig().url || DEFAULT_SUPABASE_URL;
  (window as unknown as { __GULI_SUPABASE_URL?: string }).__GULI_SUPABASE_URL = targetUrl;
  (window as unknown as { __GULI_SUPABASE_ANON_KEY?: string }).__GULI_SUPABASE_ANON_KEY = anonKey;
  cachedClient = null;
  return getSupabase();
}

/** Refresh the canonical customer profile using only the signed GULI JWT. */
export async function syncCustomerProfile(
  _user: unknown,
  accessToken: string,
  _extra?: { full_name?: string; phone?: string; avatar_url?: string; auth_provider?: string }
): Promise<void> {
  if (!accessToken) return;
  try {
    await fetch(`${BACKEND_API_URL}/api/customer/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      body: "{}",
    });
  } catch {}
}

/** Clear the canonical GULI client session locally. */
export async function signOutEverywhere(): Promise<void> {
  try {
    localStorage.removeItem("guli_access_token");
    localStorage.removeItem("guli_refresh_token");
    localStorage.removeItem("guli_auth_user");
    localStorage.removeItem("guli_supabase_auth_token");
    localStorage.removeItem("guli_registered_users");
    localStorage.removeItem("guli_guest_token");
    try { delete (window as any).__GULI_SUPABASE_ACCESS_TOKEN; } catch {}
  } catch {}
}

export const supabase = getSupabase();
