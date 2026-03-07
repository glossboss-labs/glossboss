/**
 * LocalStorage Persistence Utilities
 *
 * Handles saving and loading editor state from LocalStorage.
 * Used by Zustand persist middleware and for manual state management.
 */

/** Storage key for editor state */
export const STORAGE_KEY = 'po-editor-state';

/** Storage version for migration support */
export const STORAGE_VERSION = 1;

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get approximate storage usage in bytes
 */
export function getStorageUsage(): number {
  let total = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += localStorage.getItem(key)?.length ?? 0;
    }
  }
  return total * 2; // UTF-16 = 2 bytes per char
}

/**
 * Get storage limit (approximate, varies by browser)
 */
export function getStorageLimit(): number {
  return 5 * 1024 * 1024; // 5MB typical limit
}

/**
 * Check if we're approaching storage limit
 */
export function isStorageNearLimit(threshold = 0.9): boolean {
  const usage = getStorageUsage();
  const limit = getStorageLimit();
  return usage / limit > threshold;
}

/**
 * Clear all editor-related storage
 */
export function clearEditorStorage(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('po-editor-')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Export current storage state for backup
 */
export function exportStorageState(): string {
  const state: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('po-editor-')) {
      const value = localStorage.getItem(key);
      if (value) {
        state[key] = value;
      }
    }
  }

  return JSON.stringify(state, null, 2);
}

/**
 * Import storage state from backup
 */
export function importStorageState(backup: string): boolean {
  try {
    const state = JSON.parse(backup);

    for (const [key, value] of Object.entries(state)) {
      if (key.startsWith('po-editor-') && typeof value === 'string') {
        localStorage.setItem(key, value);
      }
    }

    return true;
  } catch {
    return false;
  }
}
