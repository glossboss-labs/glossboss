/**
 * DeepL Glossary Sync Service
 *
 * Syncs WordPress glossary to DeepL's native glossary system.
 * DeepL handles context-aware translation with proper grammar.
 */

import type { Glossary } from './types';
import { getDeepLClient } from '@/lib/deepl';

/** Storage key for glossary mapping */
const GLOSSARY_MAPPING_KEY = 'glossboss-deepl-glossary-mapping';

/** Mapping of WP locale to DeepL glossary ID */
interface GlossaryMapping {
  [locale: string]: {
    glossaryId: string;
    entryCount: number;
    createdAt: string;
    /** Hash of entries to detect changes */
    entriesHash: string;
  };
}

/**
 * Create a simple hash of glossary entries to detect changes
 */
function hashEntries(entries: Array<{ term: string; translation: string }>): string {
  const sorted = entries
    .map((e) => `${e.term}:${e.translation}`)
    .sort()
    .join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Load glossary mapping from localStorage
 */
function loadMapping(): GlossaryMapping {
  try {
    const stored = localStorage.getItem(GLOSSARY_MAPPING_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save glossary mapping to localStorage
 */
function saveMapping(mapping: GlossaryMapping): void {
  try {
    localStorage.setItem(GLOSSARY_MAPPING_KEY, JSON.stringify(mapping));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Map WordPress locale to DeepL language code
 */
function wpLocaleToDeepL(locale: string): string {
  const mapping: Record<string, string> = {
    nl: 'NL',
    de: 'DE',
    fr: 'FR',
    es: 'ES',
    it: 'IT',
    'pt-br': 'PT-BR',
    pt: 'PT-PT',
    ru: 'RU',
    ja: 'JA',
    'zh-cn': 'ZH',
    ko: 'KO',
    pl: 'PL',
    sv: 'SV',
    da: 'DA',
    fi: 'FI',
    nb: 'NB',
    cs: 'CS',
    tr: 'TR',
    uk: 'UK',
    el: 'EL',
    hu: 'HU',
    ro: 'RO',
    sk: 'SK',
    sl: 'SL',
    bg: 'BG',
    et: 'ET',
    lt: 'LT',
    lv: 'LV',
    id: 'ID',
  };

  return mapping[locale.toLowerCase()] || locale.toUpperCase();
}

/**
 * Sync WordPress glossary to DeepL
 * Returns the DeepL glossary ID to use for translations
 *
 * @param wpGlossary - The WordPress glossary to sync
 * @param onProgress - Optional callback for progress updates
 * @param forceResync - If true, bypasses cache and creates a new glossary even if unchanged
 */
export async function syncGlossaryToDeepL(
  wpGlossary: Glossary,
  onProgress?: (status: string) => void,
  forceResync: boolean = false,
): Promise<string | null> {
  const client = getDeepLClient();
  const mapping = loadMapping();
  const locale = wpGlossary.targetLocale.toLowerCase();

  // Filter entries that have both term and translation, and deduplicate by source term
  const seenTerms = new Set<string>();
  const validEntries = wpGlossary.entries
    .filter((e) => e.term && e.translation && e.term.trim() && e.translation.trim())
    .filter((e) => {
      const lowerTerm = e.term.toLowerCase().trim();
      if (seenTerms.has(lowerTerm)) {
        return false; // Skip duplicate
      }
      seenTerms.add(lowerTerm);
      return true;
    })
    .map((e) => ({ source: e.term.trim(), target: e.translation.trim() }));

  if (validEntries.length === 0) {
    console.log('[DeepL Sync] No valid entries to sync');
    return null;
  }

  console.log(
    `[DeepL Sync] ${validEntries.length} unique entries (${wpGlossary.entries.length - validEntries.length} duplicates removed)`,
  );

  // Check if we already have a glossary for this locale with same entries
  const entriesHash = hashEntries(
    validEntries.map((e) => ({ term: e.source, translation: e.target })),
  );
  const existing = mapping[locale];

  // Skip cache check if forceResync is true
  if (!forceResync && existing && existing.entriesHash === entriesHash) {
    // Validate cached glossary still exists in DeepL. If deleted remotely, recreate it.
    try {
      await client.getGlossary(existing.glossaryId);
      console.log('[DeepL Sync] Glossary unchanged, using existing:', existing.glossaryId);
      onProgress?.('Using cached glossary');
      return existing.glossaryId;
    } catch {
      console.log('[DeepL Sync] Cached glossary missing in DeepL, recreating...');
      delete mapping[locale];
      saveMapping(mapping);
    }
  }

  if (forceResync) {
    console.log('[DeepL Sync] Force resync requested, recreating glossary');
    onProgress?.('Force resyncing to DeepL...');
  } else {
    onProgress?.('Syncing glossary to DeepL...');
  }

  try {
    // Delete ALL existing glossaries to avoid "Too many glossaries" error
    // (DeepL free tier has a strict limit)
    onProgress?.('Cleaning up old glossaries...');
    try {
      const existingGlossaries = await client.listGlossaries();
      for (const g of existingGlossaries) {
        console.log('[DeepL Sync] Deleting glossary:', g.glossaryId, g.name);
        try {
          await client.deleteGlossary(g.glossaryId);
        } catch (e) {
          console.log('[DeepL Sync] Could not delete glossary:', g.glossaryId, e);
        }
      }
    } catch (e) {
      console.log('[DeepL Sync] Could not list glossaries:', e);
      // Still try to delete the cached one
      if (existing?.glossaryId) {
        try {
          await client.deleteGlossary(existing.glossaryId);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Create new glossary
    const targetLang = wpLocaleToDeepL(locale);
    const name = `WordPress ${locale.toUpperCase()} - ${new Date().toISOString().split('T')[0]}`;

    console.log('[DeepL Sync] Creating glossary:', { name, entries: validEntries.length });
    onProgress?.(`Creating glossary with ${validEntries.length} terms...`);

    const result = await client.createGlossary({
      name,
      sourceLang: 'EN',
      targetLang,
      entries: validEntries,
    });

    console.log('[DeepL Sync] Glossary created:', result);

    // Save mapping
    mapping[locale] = {
      glossaryId: result.glossaryId,
      entryCount: result.entryCount,
      createdAt: new Date().toISOString(),
      entriesHash,
    };
    saveMapping(mapping);

    onProgress?.(`Glossary ready (${result.entryCount} terms)`);

    return result.glossaryId;
  } catch (error) {
    console.error('[DeepL Sync] Failed to sync glossary:', error);
    onProgress?.('Failed to sync glossary');
    throw error;
  }
}

/**
 * Get the cached DeepL glossary ID for a locale (without syncing)
 */
export function getCachedGlossaryId(locale: string): string | null {
  const mapping = loadMapping();
  return mapping[locale.toLowerCase()]?.glossaryId ?? null;
}

/**
 * Clear the cached glossary for a locale
 */
export async function clearCachedGlossary(locale: string): Promise<void> {
  const client = getDeepLClient();
  const mapping = loadMapping();
  const existing = mapping[locale.toLowerCase()];

  if (existing?.glossaryId) {
    try {
      await client.deleteGlossary(existing.glossaryId);
    } catch {
      // Ignore errors
    }
  }

  delete mapping[locale.toLowerCase()];
  saveMapping(mapping);
}

/**
 * Clear all cached glossaries
 */
export async function clearAllCachedGlossaries(): Promise<void> {
  const client = getDeepLClient();
  const mapping = loadMapping();

  for (const locale of Object.keys(mapping)) {
    const entry = mapping[locale];
    if (entry?.glossaryId) {
      try {
        await client.deleteGlossary(entry.glossaryId);
      } catch {
        // Ignore errors
      }
    }
  }

  localStorage.removeItem(GLOSSARY_MAPPING_KEY);
}
