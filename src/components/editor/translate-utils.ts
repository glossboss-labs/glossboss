import type { POEntry } from '@/lib/po';

export function shouldAutoTranslateEntry(entry: POEntry): boolean {
  if (entry.flags.includes('fuzzy')) return true;

  if (entry.msgidPlural) {
    const plurals = entry.msgstrPlural ?? [];
    return plurals.length < 2 || plurals.some((p) => !p.trim());
  }

  return !entry.msgstr.trim();
}
