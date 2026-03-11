import type {
  TranslationMemoryEntry,
  TranslationMemoryJsonFile,
  TranslationMemoryScope,
} from '../types';

export function serializeTranslationMemoryToJson(
  scope: TranslationMemoryScope,
  entries: TranslationMemoryEntry[],
): string {
  const payload: TranslationMemoryJsonFile = {
    version: 1,
    projectName: scope.projectName,
    targetLanguage: scope.targetLanguage,
    sourceLanguage: scope.sourceLanguage ?? null,
    exportedAt: new Date().toISOString(),
    entries,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseTranslationMemoryJson(content: string): TranslationMemoryJsonFile {
  const parsed = JSON.parse(content) as Partial<TranslationMemoryJsonFile>;

  if (
    parsed.version !== 1 ||
    typeof parsed.projectName !== 'string' ||
    typeof parsed.targetLanguage !== 'string' ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error('Invalid translation memory JSON file.');
  }

  const now = new Date().toISOString();

  const validEntries = (parsed.entries as Partial<TranslationMemoryEntry>[])
    .filter(
      (entry): entry is TranslationMemoryEntry =>
        typeof entry?.id === 'string' &&
        typeof entry.sourceText === 'string' &&
        entry.sourceText.trim() !== '' &&
        typeof entry.targetText === 'string' &&
        entry.targetText.trim() !== '',
    )
    .map((entry) => ({
      ...entry,
      projectName: typeof entry.projectName === 'string' ? entry.projectName : parsed.projectName!,
      targetLanguage:
        typeof entry.targetLanguage === 'string' ? entry.targetLanguage : parsed.targetLanguage!,
      approvedAt: typeof entry.approvedAt === 'string' ? entry.approvedAt : now,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
      usageCount: typeof entry.usageCount === 'number' ? entry.usageCount : 1,
    }));

  return {
    version: 1,
    projectName: parsed.projectName,
    targetLanguage: parsed.targetLanguage,
    sourceLanguage:
      typeof parsed.sourceLanguage === 'string' || parsed.sourceLanguage === null
        ? parsed.sourceLanguage
        : null,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : now,
    entries: validEntries,
  };
}
