/**
 * Cloud Storage Module
 *
 * Provides the storage adapter abstraction for editor persistence.
 * The default adapter is LocalStorageAdapter; Phase 2 wires in
 * SupabaseStorageAdapter for authenticated users.
 *
 * Note: SupabaseStorageAdapter is intentionally NOT re-exported here.
 * It imports the Supabase client at module scope, so eagerly loading it
 * from this barrel would pull in the real @supabase/supabase-js before
 * test mocks are installed.  Import it directly from
 * '@/lib/cloud/supabase-adapter' where needed.
 */

export { getStorageAdapter, setStorageAdapter } from './adapter';
export type { StorageAdapter, StorageAdapterType } from './adapter';
export { LocalStorageAdapter } from './local-adapter';
