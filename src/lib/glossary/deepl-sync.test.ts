import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedGlossaryId } from '@/lib/glossary/deepl-sync';

// Mock the deepl client
vi.mock('@/lib/deepl', () => ({
  getDeepLClient: vi.fn(() => ({
    getGlossary: vi.fn(),
    listGlossaries: vi.fn().mockResolvedValue([]),
    deleteGlossary: vi.fn(),
    createGlossary: vi.fn().mockResolvedValue({ glossaryId: 'gl-123', entryCount: 5 }),
  })),
}));

// Silence debug output
vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
  debugWarn: vi.fn(),
  debugInfo: vi.fn(),
}));

const MAPPING_KEY = 'glossboss-deepl-glossary-mapping';

describe('deepl-sync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getCachedGlossaryId', () => {
    it('returns null when no mapping exists', () => {
      expect(getCachedGlossaryId('nl')).toBeNull();
    });

    it('returns the cached glossary ID', () => {
      localStorage.setItem(
        MAPPING_KEY,
        JSON.stringify({
          nl: {
            glossaryId: 'gl-abc',
            entryCount: 10,
            createdAt: '2026-01-01',
            entriesHash: 'abc123',
          },
        }),
      );
      expect(getCachedGlossaryId('nl')).toBe('gl-abc');
    });

    it('is case-insensitive for locale', () => {
      localStorage.setItem(
        MAPPING_KEY,
        JSON.stringify({
          nl: {
            glossaryId: 'gl-abc',
            entryCount: 10,
            createdAt: '2026-01-01',
            entriesHash: 'abc123',
          },
        }),
      );
      expect(getCachedGlossaryId('NL')).toBe('gl-abc');
    });

    it('returns null for unknown locale', () => {
      localStorage.setItem(
        MAPPING_KEY,
        JSON.stringify({
          nl: {
            glossaryId: 'gl-abc',
            entryCount: 10,
            createdAt: '2026-01-01',
            entriesHash: 'abc123',
          },
        }),
      );
      expect(getCachedGlossaryId('de')).toBeNull();
    });

    it('returns null when mapping is corrupt JSON', () => {
      localStorage.setItem(MAPPING_KEY, 'not-json');
      expect(getCachedGlossaryId('nl')).toBeNull();
    });
  });
});
