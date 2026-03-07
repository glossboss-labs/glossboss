/**
 * POT Merge Utility
 *
 * Merges a POT (template) file into an existing PO file,
 * equivalent to the `msgmerge` gettext tool.
 */

import type { POEntry } from './types';

/** Result of merging POT into PO */
export interface MergeResult {
  /** The merged entry list */
  entries: POEntry[];
  /** Statistics about the merge */
  stats: {
    /** Entries present in both (preserved translation) */
    kept: number;
    /** New entries from POT */
    added: number;
    /** Entries dropped (not in POT) */
    removed: number;
    /** Entries where references/comments changed */
    updatedMeta: number;
  };
}

/**
 * Build a canonical key for matching entries.
 * Uses msgctxt\x04msgid if context exists, otherwise just msgid.
 */
function entryKey(entry: POEntry): string {
  return entry.msgctxt ? `${entry.msgctxt}\x04${entry.msgid}` : entry.msgid;
}

/**
 * Check if two string arrays are equal.
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

/**
 * Merge POT entries into existing PO entries.
 *
 * - Kept entries: msgid exists in both. Preserves PO translation, updates metadata from POT.
 *   If msgid_plural changed, marks the entry fuzzy.
 * - New entries: msgid only in POT. Added with empty msgstr.
 * - Removed entries: msgid only in PO. Dropped.
 */
export function mergePotIntoPo(poEntries: POEntry[], potEntries: POEntry[]): MergeResult {
  const poMap = new Map<string, POEntry>();
  for (const entry of poEntries) {
    poMap.set(entryKey(entry), entry);
  }

  let kept = 0;
  let added = 0;
  let updatedMeta = 0;

  const mergedEntries: POEntry[] = [];
  const usedPoKeys = new Set<string>();

  for (const potEntry of potEntries) {
    const key = entryKey(potEntry);
    const poEntry = poMap.get(key);

    if (poEntry) {
      // Kept: exists in both
      usedPoKeys.add(key);
      kept++;

      // Check if metadata changed
      const refsChanged = !arraysEqual(poEntry.references, potEntry.references);
      const extractedCommentsChanged = !arraysEqual(
        poEntry.extractedComments,
        potEntry.extractedComments,
      );
      const pluralChanged = (poEntry.msgidPlural ?? '') !== (potEntry.msgidPlural ?? '');

      if (refsChanged || extractedCommentsChanged || pluralChanged) {
        updatedMeta++;
      }

      // Update flags: take POT flags but preserve fuzzy from PO
      const potFlags = potEntry.flags.filter((f) => f !== 'fuzzy');
      const hasFuzzy = poEntry.flags.includes('fuzzy');
      const flags = pluralChanged
        ? [...new Set([...potFlags, 'fuzzy' as const])]
        : hasFuzzy
          ? [...new Set([...potFlags, 'fuzzy' as const])]
          : potFlags;

      mergedEntries.push({
        ...poEntry,
        // Update metadata from POT
        references: potEntry.references,
        extractedComments: potEntry.extractedComments,
        flags,
        msgidPlural: potEntry.msgidPlural,
        // Preserve PO translation
        msgstr: poEntry.msgstr,
        msgstrPlural: poEntry.msgstrPlural,
        translatorComments: poEntry.translatorComments,
      });
    } else {
      // New: only in POT
      added++;
      mergedEntries.push({
        ...potEntry,
        msgstr: '',
        msgstrPlural: potEntry.msgidPlural ? ['', ''] : undefined,
      });
    }
  }

  const removed = poEntries.length - usedPoKeys.size;

  return {
    entries: mergedEntries,
    stats: { kept, added, removed, updatedMeta },
  };
}
