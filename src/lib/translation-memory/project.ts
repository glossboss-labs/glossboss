import type { POEntry, POHeader } from '@/lib/po';
import type { TranslationMemoryEntry, TranslationMemoryScope } from './types';

function sanitizeProjectSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w.-]+/g, '-');
}

export function deriveProjectName(header: POHeader | null, filename: string | null): string {
  const headerProject = header?.projectIdVersion?.trim();
  if (headerProject) return headerProject;

  if (filename?.trim()) {
    return filename.replace(/\.[^.]+$/, '');
  }

  return 'Untitled project';
}

export function createTranslationMemoryProjectKey(scope: TranslationMemoryScope): string {
  return `${sanitizeProjectSegment(scope.projectName)}::${sanitizeProjectSegment(scope.targetLanguage)}`;
}

export function createTranslationMemoryEntryFingerprint(
  entry: Pick<TranslationMemoryEntry, 'sourceText' | 'sourceTextPlural' | 'context'>,
): string {
  return [
    entry.context?.trim().toLowerCase() ?? '',
    entry.sourceText.trim().toLowerCase(),
    entry.sourceTextPlural?.trim().toLowerCase() ?? '',
  ].join('::');
}

export function createTranslationMemoryEntryFromPoEntry(
  scope: TranslationMemoryScope,
  entry: POEntry,
  now: string,
  previous?: TranslationMemoryEntry,
): TranslationMemoryEntry {
  // Only bump usageCount and updatedAt when the target text actually changed
  const targetChanged = !previous || previous.targetText !== entry.msgstr;

  return {
    id: previous?.id ?? entry.id,
    projectName: scope.projectName,
    targetLanguage: scope.targetLanguage,
    sourceLanguage: scope.sourceLanguage ?? null,
    sourceText: entry.msgid,
    sourceTextPlural: entry.msgidPlural,
    targetText: entry.msgstr,
    targetTextPlural: entry.msgstrPlural,
    context: entry.msgctxt,
    approvedAt: previous?.approvedAt ?? now,
    updatedAt: targetChanged ? now : (previous?.updatedAt ?? now),
    usageCount: targetChanged ? (previous?.usageCount ?? 0) + 1 : (previous?.usageCount ?? 1),
  };
}
