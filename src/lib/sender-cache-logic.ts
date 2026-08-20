import type { Category } from "@/lib/db/schema";

export const CACHE_MIN_SAMPLES = 3;
export const NEVER_CACHE_CATEGORIES = new Set<Category>(["money", "security"]);

export type CacheRow = {
  category: Category;
  sampleCount: number;
  userOverride: boolean;
};

/** Money/Security are never applied from cache — always classify them fresh. */
export function shouldApplyCachedCategory(row: CacheRow | null | undefined): Category | null {
  if (!row) return null;
  if (row.userOverride) return row.category;
  if (NEVER_CACHE_CATEGORIES.has(row.category)) return null;
  if (row.sampleCount < CACHE_MIN_SAMPLES) return null;
  return row.category;
}

/**
 * One observation is never enough. A new label resets the streak.
 * Money/Security are not written unless this is an explicit user override
 * (and even then recategorize prefers to drop the row entirely).
 */
export function nextCacheState(
  existing: CacheRow | null | undefined,
  incoming: Category,
  userOverride = false,
): CacheRow | null {
  if (!userOverride && NEVER_CACHE_CATEGORIES.has(incoming)) return null;
  if (existing?.userOverride && !userOverride) return existing;

  if (userOverride) {
    return { category: incoming, sampleCount: CACHE_MIN_SAMPLES, userOverride: true };
  }

  if (existing && existing.category === incoming) {
    return {
      category: incoming,
      sampleCount: existing.sampleCount + 1,
      userOverride: false,
    };
  }

  return { category: incoming, sampleCount: 1, userOverride: false };
}
