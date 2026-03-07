/**
 * Glossary-Aware Translation
 *
 * Protects glossary terms during translation by:
 * 1. Replacing glossary terms with placeholders before DeepL
 * 2. Restoring glossary translations after DeepL (with correct capitalization)
 *
 * This ensures glossary terms are ALWAYS translated correctly.
 */

import type { Glossary, GlossaryEntry } from './types';

/** Placeholder format that DeepL won't translate */
const PLACEHOLDER_PREFIX = '⟦GLOSS';
const PLACEHOLDER_SUFFIX = '⟧';

/** Stored info about a placeholder */
interface PlaceholderInfo {
  entry: GlossaryEntry;
  /** Original capitalization: 'lower' | 'upper' | 'title' | 'mixed' */
  capitalization: 'lower' | 'upper' | 'title' | 'mixed';
}

/** Result of preparing text for translation */
export interface PreparedText {
  /** Text with placeholders */
  text: string;
  /** Map of placeholder ID to glossary entry + capitalization */
  placeholders: Map<number, PlaceholderInfo>;
  /** Whether any terms were replaced */
  hasGlossaryTerms: boolean;
}

/** Result of restoring glossary terms */
export interface RestoredText {
  /** Final text with glossary translations */
  text: string;
  /** Terms that were applied */
  appliedTerms: GlossaryEntry[];
}

/**
 * Detect the capitalization pattern of a string
 */
function detectCapitalization(text: string): 'lower' | 'upper' | 'title' | 'mixed' {
  if (!text || text.length === 0) return 'lower';

  const isAllLower = text === text.toLowerCase();
  const isAllUpper = text === text.toUpperCase();
  const isTitle =
    text[0] === text[0].toUpperCase() && text.slice(1) === text.slice(1).toLowerCase();

  if (isAllLower) return 'lower';
  if (isAllUpper) return 'upper';
  if (isTitle) return 'title';
  return 'mixed';
}

/**
 * Apply capitalization pattern to a string
 */
function applyCapitalization(text: string, pattern: 'lower' | 'upper' | 'title' | 'mixed'): string {
  if (!text) return text;

  switch (pattern) {
    case 'lower':
      return text.toLowerCase();
    case 'upper':
      return text.toUpperCase();
    case 'title':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case 'mixed':
    default:
      // For mixed, just use title case as sensible default
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
}

/**
 * Find a term in text with word boundaries (case-insensitive)
 */
function findTermWithBoundaries(
  text: string,
  term: string,
): { index: number; matchedText: string } | null {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();

  let searchStart = 0;
  while (searchStart < text.length) {
    const index = lowerText.indexOf(lowerTerm, searchStart);
    if (index === -1) return null;

    // Check word boundaries
    const before = index > 0 ? text[index - 1] : ' ';
    const after = index + term.length < text.length ? text[index + term.length] : ' ';

    const boundaryChars = /[\s,.!?;:()[\]{}"'<>\-/\n\r\t]/;
    const isWordStart = index === 0 || boundaryChars.test(before);
    const isWordEnd = index + term.length === text.length || boundaryChars.test(after);

    if (isWordStart && isWordEnd) {
      return {
        index,
        matchedText: text.substring(index, index + term.length),
      };
    }

    searchStart = index + 1;
  }

  return null;
}

/**
 * Prepare text for translation by replacing glossary terms with placeholders
 */
export function prepareForTranslation(sourceText: string, glossary: Glossary | null): PreparedText {
  if (!glossary || !glossary.entries.length || !sourceText.trim()) {
    return {
      text: sourceText,
      placeholders: new Map(),
      hasGlossaryTerms: false,
    };
  }

  let result = sourceText;
  const placeholders = new Map<number, PlaceholderInfo>();
  let placeholderId = 0;

  // Sort by term length (longest first) to handle overlapping terms
  const sortedEntries = [...glossary.entries]
    .filter((e) => e.term && e.term.length >= 2 && e.translation)
    .sort((a, b) => b.term.length - a.term.length);

  for (const entry of sortedEntries) {
    let match = findTermWithBoundaries(result, entry.term);

    while (match) {
      const placeholder = `${PLACEHOLDER_PREFIX}${placeholderId}${PLACEHOLDER_SUFFIX}`;

      // Detect capitalization of the matched text
      const capitalization = detectCapitalization(match.matchedText);

      placeholders.set(placeholderId, { entry, capitalization });

      // Replace this occurrence
      result =
        result.substring(0, match.index) +
        placeholder +
        result.substring(match.index + entry.term.length);

      placeholderId++;

      // Look for more occurrences
      match = findTermWithBoundaries(result, entry.term);
    }
  }

  return {
    text: result,
    placeholders,
    hasGlossaryTerms: placeholders.size > 0,
  };
}

/**
 * Restore glossary translations in the translated text
 */
export function restoreGlossaryTerms(
  translatedText: string,
  placeholders: Map<number, PlaceholderInfo>,
): RestoredText {
  if (placeholders.size === 0) {
    return { text: translatedText, appliedTerms: [] };
  }

  let result = translatedText;
  const appliedTerms: GlossaryEntry[] = [];

  // Replace each placeholder with the glossary translation
  placeholders.forEach((info, id) => {
    const placeholder = `${PLACEHOLDER_PREFIX}${id}${PLACEHOLDER_SUFFIX}`;

    // Apply the original capitalization to the translation
    const translationWithCase = applyCapitalization(info.entry.translation, info.capitalization);

    if (result.includes(placeholder)) {
      result = result.replace(placeholder, translationWithCase);
      appliedTerms.push(info.entry);
    } else {
      // Sometimes DeepL might modify spacing around placeholders
      // Try variations
      const variations = [
        placeholder,
        placeholder.replace('⟦', '[ ').replace('⟧', ' ]'),
        placeholder.replace('⟦', '[').replace('⟧', ']'),
        `GLOSS${id}`,
        `Gloss${id}`,
        `gloss${id}`,
      ];

      for (const variant of variations) {
        if (result.includes(variant)) {
          result = result.replace(variant, translationWithCase);
          appliedTerms.push(info.entry);
          break;
        }
      }
    }
  });

  return { text: result, appliedTerms };
}

/**
 * Translate text with glossary support
 *
 * Use this wrapper instead of calling DeepL directly:
 *
 * ```ts
 * const { preparedText, placeholders } = prepareForTranslation(source, glossary);
 * const translated = await deepl.translateText(preparedText, targetLang);
 * const { text: final } = restoreGlossaryTerms(translated, placeholders);
 * ```
 */
export function createGlossaryAwareTranslator(
  translateFn: (text: string) => Promise<string>,
  glossary: Glossary | null,
) {
  return async (sourceText: string): Promise<string> => {
    // Step 1: Replace glossary terms with placeholders
    const {
      text: preparedText,
      placeholders,
      hasGlossaryTerms,
    } = prepareForTranslation(sourceText, glossary);

    if (!hasGlossaryTerms) {
      // No glossary terms, translate normally
      return translateFn(sourceText);
    }

    console.log('[Glossary] Prepared text:', preparedText);
    console.log(
      '[Glossary] Placeholders:',
      [...placeholders.entries()].map(
        ([id, info]) =>
          `${id}: "${info.entry.term}" → "${info.entry.translation}" (${info.capitalization})`,
      ),
    );

    // Step 2: Translate with placeholders
    const translated = await translateFn(preparedText);

    console.log('[Glossary] DeepL result:', translated);

    // Step 3: Replace placeholders with glossary translations
    const { text: finalText, appliedTerms } = restoreGlossaryTerms(translated, placeholders);

    console.log('[Glossary] Final text:', finalText);
    console.log(
      '[Glossary] Applied terms:',
      appliedTerms.map((e) => `${e.term} → ${e.translation}`),
    );

    return finalText;
  };
}
