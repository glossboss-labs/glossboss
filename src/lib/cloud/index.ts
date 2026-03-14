/**
 * Cloud Storage Module
 *
 * Provides the storage adapter abstraction for editor persistence.
 * The default adapter is LocalStorageAdapter; Phase 2 wires in
 * SupabaseStorageAdapter for authenticated users.
 */

export { getStorageAdapter, setStorageAdapter } from './adapter';
export type { StorageAdapter, StorageAdapterType } from './adapter';
export { LocalStorageAdapter } from './local-adapter';
export { SupabaseStorageAdapter } from './supabase-adapter';
