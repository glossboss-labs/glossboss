/**
 * Glossary Enforcer
 *
 * Applies glossary terms to translations by finding source terms
 * and replacing their translations with glossary-approved versions.
 */

import type { Glossary, GlossaryEntry } from './types';
import { checkWordBoundaries } from './text-utils';

/** Result of applying glossary to a translation */
export interface EnforcementResult {
  /** The modified translation */
  text: string;
  /** Whether any changes were made */
  modified: boolean;
  /** Terms that were replaced */
  replacements: Array<{
    original: string;
    replacement: string;
    term: string;
  }>;
}

/**
 * Find a term in text with word boundaries
 */
function findTermInText(
  text: string,
  term: string,
): { found: boolean; index: number; matchedText: string } {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();

  // Try exact match first
  let index = lowerText.indexOf(lowerTerm);

  while (index !== -1) {
    if (checkWordBoundaries(lowerText, index, index + lowerTerm.length)) {
      return {
        found: true,
        index,
        matchedText: text.substring(index, index + term.length),
      };
    }

    // Keep searching
    index = lowerText.indexOf(lowerTerm, index + 1);
  }

  return { found: false, index: -1, matchedText: '' };
}

/**
 * Apply glossary terms to a translation
 *
 * This function:
 * 1. Finds glossary source terms in the original text
 * 2. Looks for DeepL's translation of those terms in the result
 * 3. Replaces them with the glossary-approved translation
 *
 * @param sourceText - Original English text
 * @param translation - DeepL's translation
 * @param glossary - Glossary to apply
 * @returns Modified translation with glossary terms applied
 */
export function applyGlossaryToTranslation(
  sourceText: string,
  translation: string,
  glossary: Glossary,
): EnforcementResult {
  if (!sourceText || !translation || !glossary?.entries?.length) {
    return { text: translation, modified: false, replacements: [] };
  }

  let result = translation;
  const replacements: EnforcementResult['replacements'] = [];

  // Sort entries by term length (longest first) to handle overlapping terms
  const sortedEntries = [...glossary.entries]
    .filter((e) => e.term && e.translation)
    .sort((a, b) => b.term.length - a.term.length);

  for (const entry of sortedEntries) {
    // Check if this term exists in the source text
    const sourceMatch = findTermInText(sourceText, entry.term);

    if (!sourceMatch.found) {
      continue; // Term not in source, skip
    }

    // Check if the glossary translation is already correct in the result
    const targetMatch = findTermInText(result, entry.translation);

    if (targetMatch.found) {
      continue; // Already correct, skip
    }

    // The glossary term is in source but its translation isn't in result
    // Try to find what DeepL translated it to and replace
    // This is a heuristic: look for common alternative translations

    // For now, we'll just append a note or do a simple replacement
    // A more sophisticated approach would use NLP to identify the translated term

    // Simple approach: if the term appears as part of a compound word, extract and fix it
    const lowerResult = result.toLowerCase();
    const lowerExpected = entry.translation.toLowerCase();

    // Check if it's embedded in a compound word (e.g., "Standaardsjabloon" contains "sjabloon")
    const compoundIndex = lowerResult.indexOf(lowerExpected);

    if (compoundIndex !== -1) {
      // Found as part of compound - extract the compound word and split it
      // Find the full word containing this
      let wordStart = compoundIndex;
      let wordEnd = compoundIndex + lowerExpected.length;

      // Expand to find full word
      while (wordStart > 0 && /[a-zA-Z\u00C0-\u017F]/.test(lowerResult[wordStart - 1]!)) {
        wordStart--;
      }
      while (wordEnd < lowerResult.length && /[a-zA-Z\u00C0-\u017F]/.test(lowerResult[wordEnd]!)) {
        wordEnd++;
      }

      const compoundWord = result.substring(wordStart, wordEnd);

      // Check if this is actually a compound (longer than just the term)
      if (
        compoundWord.toLowerCase() !== lowerExpected &&
        compoundWord.length > entry.translation.length
      ) {
        // It's a compound word - split it
        // e.g., "Standaardsjabloon" → "Standaard sjabloon"
        const prefix = result.substring(wordStart, compoundIndex);
        // Preserve original casing of the term from the compound
        const originalTerm = result.substring(
          compoundIndex,
          compoundIndex + entry.translation.length,
        );
        const suffix = result.substring(compoundIndex + entry.translation.length, wordEnd);

        // Reconstruct with space
        let replacement: string;
        if (prefix && !suffix) {
          // Prefix compound: "Standaardsjabloon" → "Standaard sjabloon"
          replacement = prefix + ' ' + originalTerm;
        } else if (!prefix && suffix) {
          // Suffix compound: "sjabloonbestand" → "sjabloon bestand"
          replacement = originalTerm + ' ' + suffix;
        } else {
          // Both or neither - just use the term
          replacement = originalTerm;
        }

        result = result.substring(0, wordStart) + replacement + result.substring(wordEnd);

        replacements.push({
          original: compoundWord,
          replacement: replacement,
          term: entry.term,
        });
      }
    }
  }

  return {
    text: result,
    modified: replacements.length > 0,
    replacements,
  };
}

/**
 * Get glossary terms that apply to a source text
 */
export function getApplicableTerms(sourceText: string, glossary: Glossary): GlossaryEntry[] {
  if (!sourceText || !glossary?.entries?.length) {
    return [];
  }

  const applicable: GlossaryEntry[] = [];

  for (const entry of glossary.entries) {
    if (findTermInText(sourceText, entry.term).found) {
      applicable.push(entry);
    }
  }

  // Sort by position in text
  return applicable.sort((a, b) => {
    const posA = sourceText.toLowerCase().indexOf(a.term.toLowerCase());
    const posB = sourceText.toLowerCase().indexOf(b.term.toLowerCase());
    return posA - posB;
  });
}
