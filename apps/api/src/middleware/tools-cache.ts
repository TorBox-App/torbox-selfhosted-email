/**
 * Tools Response Cache
 *
 * Simple in-memory cache for email check results.
 * Works well with Lambda instance reuse - provides benefit without external dependencies.
 */

// Cache entry with TTL
type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

// In-memory cache (persists across Lambda invocations in warm instances)
const cache = new Map<string, CacheEntry<unknown>>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Max cache size to prevent memory issues
const MAX_CACHE_SIZE = 1000;

/**
 * Get cached value if it exists and hasn't expired
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Set cached value with TTL
 */
export function setCache<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  // Evict old entries if cache is too large
  if (cache.size >= MAX_CACHE_SIZE) {
    evictExpired();

    // If still too large, remove oldest entries
    if (cache.size >= MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(cache.keys()).slice(0, 100);
      for (const k of keysToDelete) {
        cache.delete(k);
      }
    }
  }

  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Remove expired entries from cache
 */
function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}

/**
 * Generate cache key for email check
 */
export function getEmailCheckCacheKey(
  domain: string,
  options: { quick?: boolean; dkimSelectors?: string[] }
): string {
  const parts = [
    "email-check",
    domain.toLowerCase(),
    options.quick ? "quick" : "full",
  ];

  if (options.dkimSelectors?.length) {
    parts.push(`dkim:${options.dkimSelectors.sort().join(",")}`);
  }

  return parts.join(":");
}

/**
 * Get cache stats (for debugging/monitoring)
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
