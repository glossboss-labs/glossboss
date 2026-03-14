/**
 * Local Storage Adapter
 *
 * Wraps the browser's localStorage API as a StorageAdapter.
 * This is the default adapter for the free/local-first workflow.
 */

import type { StorageAdapter } from './adapter';

export class LocalStorageAdapter implements StorageAdapter {
  readonly type = 'local' as const;

  getItem(name: string): string | null {
    return localStorage.getItem(name);
  }

  setItem(name: string, value: string): void {
    localStorage.setItem(name, value);
  }

  removeItem(name: string): void {
    localStorage.removeItem(name);
  }
}
