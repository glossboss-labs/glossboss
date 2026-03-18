/**
 * Fuzzy search utility wrapping Fuse.js.
 *
 * Provides a consistent fuzzy matching API across the app.
 * Falls back to substring matching for very short queries (1-2 chars).
 */

import Fuse, { type IFuseOptions } from 'fuse.js';

const DEFAULT_OPTIONS: IFuseOptions<unknown> = {
  threshold: 0.35,
  distance: 200,
  minMatchCharLength: 1,
  ignoreLocation: true,
};

/**
 * Create a Fuse instance with sensible defaults.
 * Re-create when the dataset changes (new Fuse is cheap for < 10k items).
 */
export function createFuseSearch<T>(
  items: T[],
  keys: IFuseOptions<T>['keys'],
  options?: Partial<IFuseOptions<T>>,
): Fuse<T> {
  return new Fuse(items, { ...DEFAULT_OPTIONS, ...options, keys });
}

/**
 * Run a fuzzy search, returning matched items in relevance order.
 * For empty/blank queries, returns all items unchanged.
 * For 1–2 char queries, falls back to case-insensitive substring matching
 * (fuzzy is too noisy at that length).
 */
export function fuzzyFilter<T>(fuse: Fuse<T>, items: T[], query: string, keys: string[]): T[] {
  const q = query.trim();
  if (!q) return items;

  // Short queries: fall back to substring match for precision
  if (q.length <= 2) {
    const lower = q.toLowerCase();
    return items.filter((item) =>
      keys.some((key) => {
        const val = getNestedValue(item, key);
        return typeof val === 'string' && val.toLowerCase().includes(lower);
      }),
    );
  }

  return fuse.search(q).map((r) => r.item);
}

/** Safely access a potentially nested key like "foo.bar" */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Lightweight fuzzy match for per-string checking (no Fuse instance needed).
 * Checks if all query characters appear in order in the target string.
 * For short queries (1-2 chars) falls back to substring match.
 */
export function fuzzyMatch(target: string, query: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  const text = target.toLowerCase();

  // Short queries: exact substring
  if (lower.length <= 2) return text.includes(lower);

  // Check exact substring first (fast path)
  if (text.includes(lower)) return true;

  // Character-by-character fuzzy: all chars must appear in order
  let qi = 0;
  for (let i = 0; i < text.length && qi < lower.length; i++) {
    if (text[i] === lower[qi]) qi++;
  }
  return qi === lower.length;
}
