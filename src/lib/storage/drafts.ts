/**
 * Per-File Draft Persistence
 * 
 * Handles auto-saving and recovery of translation drafts on a per-file basis.
 * Drafts are keyed by filename to prevent cross-file data leakage.
 */

import type { POEntry, POHeader } from '@/lib/po/types';

/** Storage key prefix for drafts */
const DRAFT_KEY_PREFIX = 'po-editor-draft:';

/** Storage key for draft metadata index */
const DRAFT_INDEX_KEY = 'po-editor-draft-index';

/** Maximum age for drafts before auto-cleanup (7 days) */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Persisted draft data structure */
export interface DraftData {
  /** Original filename this draft is for */
  filename: string;
  
  /** File header metadata */
  header: POHeader | null;
  
  /** All translation entries */
  entries: POEntry[];
  
  /** IDs of entries that were modified from original */
  dirtyEntryIds: string[];
  
  /** IDs of entries that were machine translated */
  machineTranslatedIds: string[];
  
  /** When the draft was last saved */
  savedAt: number;
  
  /** Draft version for future migrations */
  version: number;
}

/** Draft metadata for the index */
interface DraftIndexEntry {
  filename: string;
  savedAt: number;
  entryCount: number;
  modifiedCount: number;
}

/** Draft index structure */
interface DraftIndex {
  drafts: DraftIndexEntry[];
}

/**
 * Generate a storage key for a specific file's draft
 */
function getDraftKey(filename: string): string {
  // Normalize filename to handle path differences
  const normalizedName = filename.toLowerCase().trim();
  return `${DRAFT_KEY_PREFIX}${normalizedName}`;
}

/**
 * Check if localStorage is available
 */
function isStorageAvailable(): boolean {
  try {
    const test = '__draft_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the draft index
 */
function loadDraftIndex(): DraftIndex {
  try {
    const data = localStorage.getItem(DRAFT_INDEX_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('[Drafts] Failed to load draft index:', error);
  }
  return { drafts: [] };
}

/**
 * Save the draft index
 */
function saveDraftIndex(index: DraftIndex): void {
  try {
    localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.warn('[Drafts] Failed to save draft index:', error);
  }
}

/**
 * Update the draft index when saving/deleting a draft
 */
function updateDraftIndex(draft: DraftData | null, filename: string): void {
  const index = loadDraftIndex();
  
  // Remove existing entry for this file
  index.drafts = index.drafts.filter(d => 
    d.filename.toLowerCase() !== filename.toLowerCase()
  );
  
  // Add new entry if draft exists
  if (draft) {
    index.drafts.push({
      filename: draft.filename,
      savedAt: draft.savedAt,
      entryCount: draft.entries.length,
      modifiedCount: draft.dirtyEntryIds.length,
    });
  }
  
  saveDraftIndex(index);
}

/**
 * Save a draft for a specific file
 */
export function saveDraft(data: Omit<DraftData, 'savedAt' | 'version'>): boolean {
  if (!isStorageAvailable()) {
    console.warn('[Drafts] localStorage not available');
    return false;
  }
  
  if (!data.filename) {
    console.warn('[Drafts] Cannot save draft without filename');
    return false;
  }
  
  const draft: DraftData = {
    ...data,
    savedAt: Date.now(),
    version: 1,
  };
  
  try {
    const key = getDraftKey(data.filename);
    localStorage.setItem(key, JSON.stringify(draft));
    updateDraftIndex(draft, data.filename);
    console.log(`[Drafts] Saved draft for: ${data.filename}`);
    return true;
  } catch (error) {
    console.error('[Drafts] Failed to save draft:', error);
    return false;
  }
}

/**
 * Load a draft for a specific file
 */
export function loadDraft(filename: string): DraftData | null {
  if (!isStorageAvailable() || !filename) {
    return null;
  }
  
  try {
    const key = getDraftKey(filename);
    const data = localStorage.getItem(key);
    
    if (!data) {
      return null;
    }
    
    const draft: DraftData = JSON.parse(data);
    
    // Check if draft is too old
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      console.log(`[Drafts] Draft for ${filename} is expired, removing`);
      deleteDraft(filename);
      return null;
    }
    
    console.log(`[Drafts] Loaded draft for: ${filename}`);
    return draft;
  } catch (error) {
    console.error('[Drafts] Failed to load draft:', error);
    return null;
  }
}

/**
 * Check if a draft exists for a specific file
 */
export function hasDraft(filename: string): boolean {
  if (!isStorageAvailable() || !filename) {
    return false;
  }
  
  const key = getDraftKey(filename);
  return localStorage.getItem(key) !== null;
}

/**
 * Delete a draft for a specific file
 */
export function deleteDraft(filename: string): boolean {
  if (!isStorageAvailable() || !filename) {
    return false;
  }
  
  try {
    const key = getDraftKey(filename);
    localStorage.removeItem(key);
    updateDraftIndex(null, filename);
    console.log(`[Drafts] Deleted draft for: ${filename}`);
    return true;
  } catch (error) {
    console.error('[Drafts] Failed to delete draft:', error);
    return false;
  }
}

/**
 * Get all saved drafts metadata
 */
export function getAllDrafts(): DraftIndexEntry[] {
  const index = loadDraftIndex();
  return index.drafts.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Delete all drafts
 */
export function deleteAllDrafts(): void {
  if (!isStorageAvailable()) {
    return;
  }
  
  const index = loadDraftIndex();
  
  for (const draft of index.drafts) {
    const key = getDraftKey(draft.filename);
    localStorage.removeItem(key);
  }
  
  localStorage.removeItem(DRAFT_INDEX_KEY);
  console.log('[Drafts] Deleted all drafts');
}

/**
 * Clean up expired drafts
 */
export function cleanupExpiredDrafts(): number {
  if (!isStorageAvailable()) {
    return 0;
  }
  
  const index = loadDraftIndex();
  const now = Date.now();
  let cleanedCount = 0;
  
  const validDrafts = index.drafts.filter(draft => {
    if (now - draft.savedAt > DRAFT_MAX_AGE_MS) {
      const key = getDraftKey(draft.filename);
      localStorage.removeItem(key);
      cleanedCount++;
      return false;
    }
    return true;
  });
  
  if (cleanedCount > 0) {
    saveDraftIndex({ drafts: validDrafts });
    console.log(`[Drafts] Cleaned up ${cleanedCount} expired drafts`);
  }
  
  return cleanedCount;
}

/**
 * Format a relative time string for draft age
 */
export function formatDraftAge(savedAt: number): string {
  const diff = Date.now() - savedAt;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
