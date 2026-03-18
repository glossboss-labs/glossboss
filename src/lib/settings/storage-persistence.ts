/**
 * Generic Settings Persistence Manager
 *
 * Extracts the common session/localStorage persistence pattern used across
 * provider settings (DeepL, Azure, Gemini, GitHub, GitLab, LLM, TTS).
 *
 * Each settings module stores data in sessionStorage by default. When the
 * user opts into persistence, data migrates to localStorage. A persist
 * flag in localStorage tracks the opt-in.
 *
 * An optional in-memory cache (opt-in via `cache: true`) avoids repeated
 * JSON.parse calls for hot-path settings like TTS.
 */

export interface PersistenceManagerOptions<T> {
  /** The storage key for the settings data. */
  storageKey: string;
  /** The storage key for the persist-enabled flag. */
  persistKey: string;
  /** The default settings object. */
  defaults: T;
  /** Optional label for log/warn/error messages (e.g. 'DeepL Settings'). */
  label?: string;
  /**
   * Optional parser to validate/migrate stored data.
   * Receives the raw parsed object merged with defaults.
   * Return the validated settings object.
   * If omitted, a simple spread merge is used.
   */
  parse?: (raw: Record<string, unknown>, defaults: T) => T;
  /**
   * Enable in-memory caching of settings. When true, get() returns a
   * cached value instead of reading from storage on every call.
   * Default: false (reads from storage each time).
   */
  cache?: boolean;
}

export interface PersistenceManager<T> {
  /** Check if persistent (localStorage) storage is enabled. */
  isPersistEnabled: () => boolean;

  /** Enable or disable persistent storage, migrating data between backends. */
  setPersistEnabled: (enabled: boolean) => void;

  /** Get current settings. Reads from storage (or cache if enabled). */
  get: () => T;

  /** Save a partial settings update. Merges with current, sets updatedAt. */
  save: (partial: Partial<T>) => void;

  /** Clear all settings from both storage backends. */
  clear: () => void;

  /**
   * Subscribe to settings changes (both same-tab custom events and
   * cross-tab storage events). Returns an unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void;

  /** The storage key for the settings data. */
  storageKey: string;

  /** The storage key for the persist-enabled flag. */
  persistKey: string;

  /** Invalidate the in-memory cache, forcing a re-read on next get(). */
  invalidateCache: () => void;
}

export function createPersistenceManager<T extends { updatedAt: number }>(
  options: PersistenceManagerOptions<T>,
): PersistenceManager<T> {
  const { storageKey, persistKey, defaults, label, parse, cache: useCache = false } = options;
  const eventName = `glossboss:${storageKey}-changed`;

  let cached: T | null = null;

  function isPersistEnabled(): boolean {
    try {
      return localStorage.getItem(persistKey) === 'true';
    } catch {
      return false;
    }
  }

  function getStore(): Storage {
    return isPersistEnabled() ? localStorage : sessionStorage;
  }

  function readFromStorage(): T {
    try {
      const stored = getStore().getItem(storageKey);
      if (stored) {
        const raw = JSON.parse(stored);
        if (parse) {
          return parse(raw, defaults);
        }
        return { ...defaults, ...raw };
      }
    } catch (error) {
      if (label) {
        console.warn(`[${label}] Failed to load settings:`, error);
      }
    }
    return { ...defaults };
  }

  function notify(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(eventName));
  }

  function setPersistEnabled(enabled: boolean): void {
    try {
      if (enabled) {
        const session = sessionStorage.getItem(storageKey);
        if (session) {
          localStorage.setItem(storageKey, session);
          sessionStorage.removeItem(storageKey);
        }
        localStorage.setItem(persistKey, 'true');
      } else {
        const persisted = localStorage.getItem(storageKey);
        if (persisted) {
          sessionStorage.setItem(storageKey, persisted);
          localStorage.removeItem(storageKey);
        }
        localStorage.removeItem(persistKey);
      }
    } catch {
      return;
    }

    if (useCache) {
      cached = readFromStorage();
    }
    notify();
  }

  function get(): T {
    if (useCache) {
      if (!cached) {
        cached = readFromStorage();
      }
      return cached;
    }
    return readFromStorage();
  }

  function save(partial: Partial<T>): void {
    try {
      const current = get();
      const updated = {
        ...current,
        ...partial,
        updatedAt: Date.now(),
      };
      if (useCache) {
        cached = updated;
      }
      getStore().setItem(storageKey, JSON.stringify(updated));
    } catch (error) {
      if (label) {
        console.error(`[${label}] Failed to save settings:`, error);
      }
    }
    notify();
  }

  function clear(): void {
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(persistKey);
    } catch (error) {
      if (label) {
        console.error(`[${label}] Failed to clear settings:`, error);
      }
    }
    cached = null;
    notify();
  }

  function invalidateCache(): void {
    cached = null;
  }

  function subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === storageKey || event.key === persistKey) {
        cached = readFromStorage();
        listener();
      }
    };

    window.addEventListener(eventName, listener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(eventName, listener);
      window.removeEventListener('storage', handleStorage);
    };
  }

  return {
    isPersistEnabled,
    setPersistEnabled,
    get,
    save,
    clear,
    subscribe,
    storageKey,
    persistKey,
    invalidateCache,
  };
}
