/**
 * Storage Module
 *
 * Exports for live localStorage persistence utilities.
 */

export { STORAGE_KEY } from './persistence';

export {
  saveDraft,
  loadDraft,
  deleteDraft,
  cleanupExpiredDrafts,
  formatDraftAge,
  type DraftData,
} from './drafts';
