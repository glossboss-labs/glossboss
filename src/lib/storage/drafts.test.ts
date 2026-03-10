import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveDraft,
  loadDraft,
  hasDraft,
  deleteDraft,
  getAllDrafts,
  deleteAllDrafts,
  cleanupExpiredDrafts,
  formatDraftAge,
} from './drafts';
import type { POEntry, POHeader } from '@/lib/po/types';

// Silence debug output during tests
vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
  debugInfo: vi.fn(),
}));

function makeDraft(overrides: Partial<{ filename: string; entries: POEntry[] }> = {}) {
  const entries: POEntry[] = [
    {
      msgid: 'hello',
      msgstr: ['hallo'],
      comments: {},
    } as POEntry,
  ];
  return {
    filename: overrides.filename ?? 'test.po',
    header: null as POHeader | null,
    entries: overrides.entries ?? entries,
    dirtyEntryIds: ['hello'],
    machineTranslatedIds: [],
  };
}

describe('drafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveDraft', () => {
    it('saves a draft and returns true', () => {
      const result = saveDraft(makeDraft());
      expect(result).toBe(true);
    });

    it('returns false when no filename is provided', () => {
      const result = saveDraft(makeDraft({ filename: '' }));
      expect(result).toBe(false);
    });

    it('normalises the filename (case + trim)', () => {
      saveDraft(makeDraft({ filename: '  Test.PO  ' }));
      expect(hasDraft('test.po')).toBe(true);
    });
  });

  describe('loadDraft', () => {
    it('returns null when no draft is saved', () => {
      expect(loadDraft('missing.po')).toBeNull();
    });

    it('loads a previously saved draft', () => {
      saveDraft(makeDraft({ filename: 'a.po' }));
      const loaded = loadDraft('a.po');
      expect(loaded).not.toBeNull();
      expect(loaded!.filename).toBe('a.po');
      expect(loaded!.version).toBe(1);
      expect(loaded!.savedAt).toBeGreaterThan(0);
    });

    it('returns null for an expired draft', () => {
      saveDraft(makeDraft({ filename: 'old.po' }));
      // Manually backdate the saved draft
      const key = `po-editor-draft:old.po`;
      const raw = JSON.parse(localStorage.getItem(key)!);
      raw.savedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      localStorage.setItem(key, JSON.stringify(raw));

      expect(loadDraft('old.po')).toBeNull();
    });

    it('returns null for empty filename', () => {
      expect(loadDraft('')).toBeNull();
    });
  });

  describe('hasDraft', () => {
    it('returns false when nothing is saved', () => {
      expect(hasDraft('nope.po')).toBe(false);
    });

    it('returns true after saving', () => {
      saveDraft(makeDraft({ filename: 'exists.po' }));
      expect(hasDraft('exists.po')).toBe(true);
    });
  });

  describe('deleteDraft', () => {
    it('removes a saved draft', () => {
      saveDraft(makeDraft({ filename: 'del.po' }));
      expect(hasDraft('del.po')).toBe(true);
      expect(deleteDraft('del.po')).toBe(true);
      expect(hasDraft('del.po')).toBe(false);
    });

    it('returns false for empty filename', () => {
      expect(deleteDraft('')).toBe(false);
    });
  });

  describe('getAllDrafts', () => {
    it('returns an empty list initially', () => {
      expect(getAllDrafts()).toEqual([]);
    });

    it('returns metadata for saved drafts sorted by newest first', () => {
      saveDraft(makeDraft({ filename: 'a.po' }));
      // Manually update the index timestamp of b.po so it's clearly newer
      saveDraft(makeDraft({ filename: 'b.po' }));
      const indexRaw = JSON.parse(localStorage.getItem('po-editor-draft-index')!);
      const bEntry = indexRaw.drafts.find((d: { filename: string }) => d.filename === 'b.po');
      bEntry.savedAt = Date.now() + 1000;
      localStorage.setItem('po-editor-draft-index', JSON.stringify(indexRaw));

      const all = getAllDrafts();
      expect(all).toHaveLength(2);
      // b.po has a newer savedAt so should be first
      expect(all[0].filename).toBe('b.po');
    });
  });

  describe('deleteAllDrafts', () => {
    it('removes all drafts', () => {
      saveDraft(makeDraft({ filename: 'x.po' }));
      saveDraft(makeDraft({ filename: 'y.po' }));
      deleteAllDrafts();
      expect(getAllDrafts()).toEqual([]);
      expect(hasDraft('x.po')).toBe(false);
    });
  });

  describe('cleanupExpiredDrafts', () => {
    it('removes expired drafts and returns count', () => {
      saveDraft(makeDraft({ filename: 'fresh.po' }));
      saveDraft(makeDraft({ filename: 'stale.po' }));

      // Backdate index entry for stale.po
      const indexRaw = JSON.parse(localStorage.getItem('po-editor-draft-index')!);
      const staleEntry = indexRaw.drafts.find(
        (d: { filename: string }) => d.filename === 'stale.po',
      );
      staleEntry.savedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem('po-editor-draft-index', JSON.stringify(indexRaw));

      const cleaned = cleanupExpiredDrafts();
      expect(cleaned).toBe(1);
      expect(getAllDrafts()).toHaveLength(1);
      expect(getAllDrafts()[0].filename).toBe('fresh.po');
    });

    it('returns 0 when nothing is expired', () => {
      saveDraft(makeDraft({ filename: 'ok.po' }));
      expect(cleanupExpiredDrafts()).toBe(0);
    });
  });

  describe('formatDraftAge', () => {
    // Create a mock t() that interpolates {{count}} like the real i18n runtime
    const t = (key: string, opts?: Record<string, unknown>) =>
      opts ? key.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : key;

    it('returns "just now" for very recent timestamps', () => {
      expect(formatDraftAge(Date.now(), t)).toBe('just now');
    });

    it('returns minutes ago', () => {
      expect(formatDraftAge(Date.now() - 5 * 60 * 1000, t)).toBe('5 minutes ago');
    });

    it('returns singular minute', () => {
      expect(formatDraftAge(Date.now() - 1 * 60 * 1000, t)).toBe('1 minute ago');
    });

    it('returns hours ago', () => {
      expect(formatDraftAge(Date.now() - 3 * 60 * 60 * 1000, t)).toBe('3 hours ago');
    });

    it('returns singular hour', () => {
      expect(formatDraftAge(Date.now() - 1 * 60 * 60 * 1000, t)).toBe('1 hour ago');
    });

    it('returns days ago', () => {
      expect(formatDraftAge(Date.now() - 2 * 24 * 60 * 60 * 1000, t)).toBe('2 days ago');
    });

    it('returns singular day', () => {
      expect(formatDraftAge(Date.now() - 1 * 24 * 60 * 60 * 1000, t)).toBe('1 day ago');
    });
  });
});
