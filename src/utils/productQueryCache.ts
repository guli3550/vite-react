export const PRODUCT_QUERY_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 16;

export interface ProductQueryPayload<T = unknown> {
  rows: T[];
  hasMore: boolean;
}

interface CacheEntry<T = unknown> {
  payload: ProductQueryPayload<T>;
  cachedAt: number;
}

const queryCache = new Map<string, CacheEntry<unknown>>();
const inFlightQueries = new Map<string, Promise<ProductQueryPayload<unknown>>>();

export function buildProductQueryKey(params: {
  category?: string;
  search?: string;
  limit: number;
  offset: number;
}): string {
  const cat = (params.category || "Barchasi").trim() || "Barchasi";
  const q = (params.search || "").trim().toLowerCase();
  return `${cat}|${q}|${params.limit}|${params.offset}`;
}

export function getCachedProductQuery<T>(
  key: string,
  now = Date.now(),
  ttlMs = PRODUCT_QUERY_CACHE_TTL_MS,
): ProductQueryPayload<T> | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (now - entry.cachedAt >= ttlMs) {
    queryCache.delete(key);
    return null;
  }
  return entry.payload as ProductQueryPayload<T>;
}

export function setCachedProductQuery<T>(
  key: string,
  payload: ProductQueryPayload<T>,
  now = Date.now(),
): void {
  if (queryCache.has(key)) {
    queryCache.delete(key);
  } else if (queryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey !== undefined) {
      queryCache.delete(oldestKey);
    }
  }
  queryCache.set(key, { payload: payload as ProductQueryPayload<unknown>, cachedAt: now });
}

export function invalidateProductQueryCache(): void {
  queryCache.clear();
}

export async function runDeduplicatedProductQuery<T>(
  key: string,
  fetcher: () => Promise<ProductQueryPayload<T>>,
  options?: { forceRefresh?: boolean; now?: number; ttlMs?: number },
): Promise<ProductQueryPayload<T>> {
  const forceRefresh = Boolean(options?.forceRefresh);
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? PRODUCT_QUERY_CACHE_TTL_MS;

  if (!forceRefresh) {
    const cached = getCachedProductQuery<T>(key, now, ttlMs);
    if (cached) return cached;
  }

  const existingInFlight = inFlightQueries.get(key);
  if (existingInFlight && !forceRefresh) {
    return existingInFlight as Promise<ProductQueryPayload<T>>;
  }

  const promise = fetcher()
    .then((payload) => {
      setCachedProductQuery(key, payload, Date.now());
      return payload;
    })
    .finally(() => {
      if (inFlightQueries.get(key) === promise) {
        inFlightQueries.delete(key);
      }
    });

  inFlightQueries.set(key, promise as Promise<ProductQueryPayload<unknown>>);
  return promise;
}
