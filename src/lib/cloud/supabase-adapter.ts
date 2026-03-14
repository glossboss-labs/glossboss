/**
 * Supabase Storage Adapter
 *
 * Cloud persistence for authenticated project editing.
 * Uses localStorage as a write-through cache for instant UI response,
 * with debounced background sync to Supabase.
 *
 * Data flow:
 * - getItem: fetches project + entries from Supabase, caches in localStorage
 * - setItem: writes to localStorage immediately, schedules debounced cloud sync
 * - removeItem: clears localStorage only (does not delete the project)
 */

import type { POEntry, POHeader } from '@/lib/po/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { ReviewEntryState } from '@/lib/review';
import {
  getProject,
  getProjectEntries,
  updateProject,
  syncProjectEntries,
  dbEntryToPOEntry,
  dbEntryToMTMeta,
  dbEntryToReviewState,
  dbProjectToHeader,
  editorStateToProjectUpdate,
} from '@/lib/projects';
import type { StorageAdapter } from './adapter';

/** Debounce interval for cloud sync (ms) */
const SYNC_DEBOUNCE_MS = 1500;

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly type = 'supabase' as const;

  private projectId: string;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncing = false;
  private pendingValue: string | null = null;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Load project state from Supabase.
   * Returns a JSON string matching Zustand's persist format.
   */
  async getItem(name: string): Promise<string | null> {
    const [project, entries] = await Promise.all([
      getProject(this.projectId),
      getProjectEntries(this.projectId),
    ]);

    if (!project) return null;

    // Transform DB rows to editor state shape
    const poEntries: POEntry[] = entries.map((row, i) => dbEntryToPOEntry(row, i));

    const machineTranslationMeta: [string, MachineTranslationMeta][] = [];
    const reviewEntryPairs: [string, ReviewEntryState][] = [];
    const machineTranslatedIds: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const clientId = poEntries[i].id;

      const mtMeta = dbEntryToMTMeta(row);
      if (mtMeta) {
        machineTranslationMeta.push([clientId, mtMeta]);
        machineTranslatedIds.push(clientId);
      }

      const reviewState = dbEntryToReviewState(row);
      if (reviewState.status !== 'draft' || reviewState.comments.length > 0) {
        reviewEntryPairs.push([clientId, reviewState]);
      }
    }

    const header: POHeader | null = dbProjectToHeader(project);

    // Build state matching Zustand's partialize output
    const state = {
      projectName: project.name,
      filename: project.source_filename,
      sourceFormat: project.source_format,
      header,
      entries: poEntries,
      dirtyEntryIds: [] as string[],
      machineTranslatedIds,
      manualEditIds: [] as string[],
      visibleColumns: ['status', 'approve', 'source', 'translation', 'signals'],
      columnOrder: ['status', 'approve', 'source', 'translation', 'signals'],
      sortField: 'default',
      sortDirection: 'asc',
      machineTranslationMeta,
      reviewEntries: reviewEntryPairs,
      reviewerName: '',
      lockApprovedEntries: false,
      lastSavedAt: Date.now(),
      hasUnsavedChanges: false,
    };

    const serialized = JSON.stringify({ state, version: 0 });

    // Cache in localStorage for offline access
    try {
      localStorage.setItem(name, serialized);
    } catch {
      // localStorage may be full or unavailable — non-fatal
    }

    return serialized;
  }

  /**
   * Persist state to localStorage immediately and schedule cloud sync.
   */
  setItem(name: string, value: string): void {
    // Immediate localStorage write for fast UI
    try {
      localStorage.setItem(name, value);
    } catch {
      // non-fatal
    }

    // Schedule debounced sync
    this.pendingValue = value;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      void this.syncToCloud();
    }, SYNC_DEBOUNCE_MS);
  }

  removeItem(name: string): void {
    localStorage.removeItem(name);

    // Cancel any pending sync
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** Force an immediate sync (e.g., before navigation). */
  async flush(): Promise<void> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.pendingValue) {
      await this.syncToCloud();
    }
  }

  // ── Private ──────────────────────────────────────────────

  private async syncToCloud(): Promise<void> {
    if (this.isSyncing || !this.pendingValue) return;
    this.isSyncing = true;

    const value = this.pendingValue;
    this.pendingValue = null;

    try {
      const parsed = JSON.parse(value) as {
        state: {
          projectName: string;
          filename: string | null;
          sourceFormat: string;
          header: POHeader | null;
          entries: POEntry[];
          machineTranslationMeta: [string, MachineTranslationMeta][];
          reviewEntries: [string, ReviewEntryState][];
        };
      };
      const { state } = parsed;

      // Sync project metadata
      const projectUpdate = editorStateToProjectUpdate(state);
      await updateProject(this.projectId, projectUpdate);

      // Sync entries
      const mtMetaMap = new Map(state.machineTranslationMeta ?? []);
      const reviewMap = new Map(state.reviewEntries ?? []);
      await syncProjectEntries(this.projectId, state.entries, mtMetaMap, reviewMap);
    } catch (err) {
      // Re-queue the value so the next setItem or flush retries
      if (!this.pendingValue) this.pendingValue = value;
      console.error('[SupabaseStorageAdapter] sync failed:', err);
    } finally {
      this.isSyncing = false;
    }

    // If a new value arrived while we were syncing, sync again
    if (this.pendingValue) {
      void this.syncToCloud();
    }
  }
}
