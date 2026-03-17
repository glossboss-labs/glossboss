/**
 * Source File Merge
 *
 * Merges a source language file into target entries so the editor can display
 * human-readable source text alongside structural keys.
 *
 * For i18next JSON files, msgid is a flattened key (e.g. "button.save") and the
 * actual source text (e.g. "Save") lives in the source language file's value.
 * For PO files with key-based msgids, the source file's msgstr provides the
 * readable text.
 */

import type { POEntry } from './types';

/**
 * Build a lookup key for matching entries between source and target files.
 * Uses msgctxt + msgid to uniquely identify an entry (standard PO convention).
 */
function entryKey(entry: POEntry): string {
  return entry.msgctxt ? `${entry.msgctxt}\x04${entry.msgid}` : entry.msgid;
}

/**
 * Apply source file entries onto target entries.
 *
 * For each target entry, finds the matching source entry by key (msgid + msgctxt)
 * and copies the source file's msgstr as `sourceText` on the target entry.
 *
 * @returns The number of entries that were matched and enriched.
 */
export function applySourceFile(targetEntries: POEntry[], sourceEntries: POEntry[]): number {
  const sourceLookup = new Map<string, POEntry>();
  for (const entry of sourceEntries) {
    sourceLookup.set(entryKey(entry), entry);
  }

  let matched = 0;

  for (const target of targetEntries) {
    const source = sourceLookup.get(entryKey(target));
    if (!source) continue;

    // The source file's msgstr is the human-readable source text
    const sourceText = source.msgstr.trim();
    if (sourceText) {
      target.sourceText = sourceText;
      matched++;
    }

    // Handle plural source text
    if (source.msgidPlural && source.msgstrPlural && source.msgstrPlural.length > 1) {
      const pluralText = source.msgstrPlural[1]?.trim();
      if (pluralText) {
        target.sourceTextPlural = pluralText;
      }
    }
  }

  return matched;
}
