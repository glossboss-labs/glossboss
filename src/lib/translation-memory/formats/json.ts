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

  return {
    version: 1,
    projectName: parsed.projectName,
    targetLanguage: parsed.targetLanguage,
    sourceLanguage:
      typeof parsed.sourceLanguage === 'string' || parsed.sourceLanguage === null
        ? parsed.sourceLanguage
        : null,
    exportedAt:
      typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    entries: parsed.entries as TranslationMemoryEntry[],
  };
}
