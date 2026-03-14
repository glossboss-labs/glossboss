/**
 * Supabase Storage Adapter (Stub)
 *
 * Placeholder that delegates to LocalStorageAdapter.
 * Phase 2 replaces this with real cloud persistence via Supabase.
 */

import type { StorageAdapter } from './adapter';
import { LocalStorageAdapter } from './local-adapter';

const local = new LocalStorageAdapter();

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly type = 'supabase' as const;

  getItem(name: string): string | null {
    return local.getItem(name);
  }

  setItem(name: string, value: string): void {
    local.setItem(name, value);
  }

  removeItem(name: string): void {
    local.removeItem(name);
  }
}
