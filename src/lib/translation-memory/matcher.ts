import type {
  TranslationMemoryEntry,
  TranslationMemorySuggestion,
  TranslationMemoryScope,
} from './types';
import { createTranslationMemoryEntryFingerprint } from './project';

const DEFAULT_FUZZY_THRESHOLD = 0.75;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s%{}<>/._-]+/gu, '');
}

function sameShape(
  sourceTextPlural: string | undefined,
  candidatePlural: string | undefined,
): boolean {
  return Boolean(sourceTextPlural) === Boolean(candidatePlural);
}

function createBigrams(value: string): string[] {
  if (value.length < 2) return [value];

  const bigrams: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    bigrams.push(value.slice(index, index + 2));
  }
  return bigrams;
}

function diceCoefficient(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftBigrams = createBigrams(left);
  const rightBigrams = createBigrams(right);
  const rightCounts = new Map<string, number>();

  for (const gram of rightBigrams) {
    rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  }

  let matches = 0;
  for (const gram of leftBigrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count > 0) {
      matches += 1;
      rightCounts.set(gram, count - 1);
    }
  }

  return (2 * matches) / (leftBigrams.length + rightBigrams.length);
}

export function findTranslationMemorySuggestions(
  entries: TranslationMemoryEntry[],
  candidate: Pick<TranslationMemoryEntry, 'sourceText' | 'sourceTextPlural' | 'context'>,
  limit = 3,
  fuzzyThreshold = DEFAULT_FUZZY_THRESHOLD,
): TranslationMemorySuggestion[] {
  const exactFingerprint = createTranslationMemoryEntryFingerprint(candidate);
  const normalizedSource = normalizeText(candidate.sourceText);

  const suggestions = entries
    .filter(
      (entry) =>
        sameShape(candidate.sourceTextPlural, entry.sourceTextPlural) &&
        (candidate.context ?? '') === (entry.context ?? ''),
    )
    .map<TranslationMemorySuggestion | null>((entry) => {
      const fingerprint = createTranslationMemoryEntryFingerprint(entry);
      if (fingerprint === exactFingerprint) {
        return {
          entry,
          score: 1,
          matchType: 'exact',
        };
      }

      const score = diceCoefficient(normalizedSource, normalizeText(entry.sourceText));
      if (score < fuzzyThreshold) return null;

      return {
        entry,
        score,
        matchType: 'fuzzy',
      };
    })
    .filter((suggestion): suggestion is TranslationMemorySuggestion => suggestion !== null)
    .sort((left, right) => {
      if (left.matchType !== right.matchType) {
        return left.matchType === 'exact' ? -1 : 1;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.entry.updatedAt.localeCompare(left.entry.updatedAt);
    });

  return suggestions.slice(0, limit);
}

export function createTranslationMemoryScope(
  projectName: string,
  targetLanguage: string,
  sourceLanguage?: string | null,
): TranslationMemoryScope {
  return {
    projectName,
    targetLanguage,
    sourceLanguage: sourceLanguage ?? null,
  };
}
