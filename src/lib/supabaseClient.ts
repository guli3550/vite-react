import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

// Production Supabase URL for GULI web app
export const DEFAULT_SUPABASE_URL = "https://qttwufydrvdwmhxcpgjb.supabase.co";
export const BACKEND_API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://guli-lingerie-api.onrender.com"
).replace(/\/$/, "");

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const winUrl = (window as unknown as { __GULI_SUPABASE_URL?: string })?.__GULI_SUPABASE_URL?.trim();
  const winKey = (window as unknown as { __GULI_SUPABASE_ANON_KEY?: string })?.__GULI_SUPABASE_ANON_KEY?.trim();

  const url = envUrl || winUrl || DEFAULT_SUPABASE_URL;
  const anonKey = envKey || winKey || "";

  return { url, anonKey };
}

function mirrorSession(session: { access_token?: string | null; refresh_token?: string | null } | null) {
  try {
    const accessToken = String(session?.access_token || "").trim();
    if (accessToken) {
      localStorage.setItem("guli_access_token", accessToken);
      (window as any).__GULI_SUPABASE_ACCESS_TOKEN = accessToken;
      if (session?.refresh_token) localStorage.setItem("guli_refresh_token", session.refresh_token);
    } else {
      delete (window as any).__GULI_SUPABASE_ACCESS_TOKEN;
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "guli_supabase_auth_token",
      },
    });

    // Immediately mirror the current Supabase session. This is intentionally
    // exposed only in memory for browser runtime patches that cannot import TS.
    void cachedClient.auth.getSession().then(({ data: { session } }) => mirrorSession(session));

    // Supabase can silently refresh the JWT while the app is open. Keep the
    // legacy GULI token mirrors synchronized so backend API calls do not keep
    // sending an expired access token.
    cachedClient.auth.onAuthStateChange((_event, session) => {
      mirrorSession(session);
      try {
        if (session?.access_token) {
          if (session.refresh_token) {
            localStorage.setItem("guli_refresh_token", session.refresh_token);
          }
        } else if (_event === "SIGNED_OUT") {
          localStorage.removeItem("guli_access_token");
          localStorage.removeItem("guli_refresh_token");
          localStorage.removeItem("guli_auth_user");
        }
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
    });

    return cachedClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
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

/**
 * Loads dynamic auth config from backend if needed
 */
export async function loadSupabaseConfigAsync(): Promise<SupabaseClient | null> {
  const existing = getSupabase();
  if (existing) return existing;

  const candidateUrls = [
    `${BACKEND_API_URL}/api/auth/config`,
    "/api/auth/config",
  ];

  for (const endpoint of candidateUrls) {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        continue;
      }
      const json = await res.json();
      if (json?.success && json?.data?.supabase_anon_key) {
        return initSupabaseWithKey(json.data.supabase_anon_key, json.data.supabase_url);
      }
    } catch {
      // Network or offline fallback
    }
  }

  return getSupabase();
}

/**
 * Syncs user to unified customers table via backend
 */
export async function syncCustomerProfile(
  user: User,
  accessToken: string,
  extra?: { full_name?: string; phone?: string; avatar_url?: string; auth_provider?: string }
): Promise<void> {
  if (!accessToken || !user) return;
  const candidateUrls = [
    `${BACKEND_API_URL}/api/customer/sync`,
    "/api/customer/sync",
  ];
  const payload = JSON.stringify({
    email: user.email,
    full_name: extra?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "",
    phone: extra?.phone || user.phone || user.user_metadata?.phone || "",
    avatar_url: extra?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    auth_provider: extra?.auth_provider || user.app_metadata?.provider || "email",
  });

  for (const endpoint of candidateUrls) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: payload,
      });
      if (res.ok) break;
    } catch {
      // Continue to next candidate
    }
  }
}

/**
 * Clean sign out across Supabase and local storage
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    const client = getSupabase();
    if (client) {
      await client.auth.signOut().catch(() => {});
    }
  } finally {
    localStorage.removeItem("guli_access_token");
    localStorage.removeItem("guli_refresh_token");
    localStorage.removeItem("guli_auth_user");
    localStorage.removeItem("guli_supabase_auth_token");
    try { delete (window as any).__GULI_SUPABASE_ACCESS_TOKEN; } catch {}
    // Clean up any legacy plain text passwords or tokens if found
    localStorage.removeItem("guli_registered_users");
    localStorage.removeItem("guli_guest_token");
  }
}

export const supabase = getSupabase();
