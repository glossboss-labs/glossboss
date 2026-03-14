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

/** Active adapter instance — defaults to localStorage via init in index.ts */
let activeAdapter: StorageAdapter | null = null;

/** Get the active storage adapter. Throws if called before initialization. */
export function getStorageAdapter(): StorageAdapter {
  if (!activeAdapter) {
    throw new Error('StorageAdapter not initialized — call setStorageAdapter() first');
  }
  return activeAdapter;
}

/** Set the active storage adapter */
export function setStorageAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}
