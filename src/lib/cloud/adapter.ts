/**
 * Storage Adapter Interface
 *
 * Defines the contract for editor persistence backends.
 * Extends Zustand's StateStorage so adapters can be passed directly
 * to `createJSONStorage()`.
 */

import type { StateStorage } from 'zustand/middleware';

/** Adapter type discriminator */
export type StorageAdapterType = 'local' | 'supabase';

/** Storage adapter interface for editor persistence */
export interface StorageAdapter extends StateStorage {
  readonly type: StorageAdapterType;
}

/** Lazy fallback — used if getStorageAdapter() is called before setStorageAdapter() */
let fallbackAdapter: StorageAdapter | null = null;

/** Active adapter instance — defaults to localStorage via init in main.tsx */
let activeAdapter: StorageAdapter | null = null;

/** Get the active storage adapter. Falls back to LocalStorageAdapter if not yet initialized. */
export function getStorageAdapter(): StorageAdapter {
  if (activeAdapter) return activeAdapter;

  // Zustand persist may call getItem() during module-scope store creation,
  // before main.tsx has a chance to call setStorageAdapter(). Return a
  // fallback adapter so rehydration can proceed.
  if (!fallbackAdapter) {
    // Lazy import to avoid circular dependency
    fallbackAdapter = {
      type: 'local' as const,
      getItem: (name: string) => localStorage.getItem(name),
      setItem: (name: string, value: string) => localStorage.setItem(name, value),
      removeItem: (name: string) => localStorage.removeItem(name),
    };
  }
  return fallbackAdapter;
}

/** Set the active storage adapter */
export function setStorageAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}
