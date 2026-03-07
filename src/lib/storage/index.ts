/**
 * Storage Module
 * 
 * Exports for localStorage persistence utilities.
 */

export {
  STORAGE_KEY,
  STORAGE_VERSION,
  isStorageAvailable,
  getStorageUsage,
  getStorageLimit,
  isStorageNearLimit,
  clearEditorStorage,
  exportStorageState,
  importStorageState,
} from './persistence';

export {
  saveDraft,
  loadDraft,
  hasDraft,
  deleteDraft,
  getAllDrafts,
  deleteAllDrafts,
  cleanupExpiredDrafts,
  formatDraftAge,
  type DraftData,
} from './drafts';
