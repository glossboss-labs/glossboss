/**
 * Glossary Analyzer
 *
 * Analyzes translations to verify glossary term usage.
 * Checks if expected translations appear in the target text.
 */

import type { Glossary } from './types';
import { findGlossaryMatches } from './matcher';

/** Result of analyzing a single term */
export interface TermAnalysisResult {
  /** Original term from source text */
  term: string;

  /** Expected translation from glossary */
  expectedTranslation: string;

  /** Whether the expected translation was found in target */
  found: boolean;

  /** Start position of term in source text */
  sourcePosition: number;

  /** Glossary comment/note if available */
  comment?: string;

  /** Part of speech if available */
  partOfSpeech?: string;
}

/** Complete analysis result for an entry */
export interface GlossaryAnalysisResult {
  /** Entry ID this analysis belongs to */
  entryId: string;

  /** All terms found in source text */
  terms: TermAnalysisResult[];

  /** Number of terms that match glossary expectations */
  matchedCount: number;

  /** Number of terms that need review */
  needsReviewCount: number;

  /** When this analysis was performed */
  analyzedAt: string;
}

/**
 * Check if a translation contains the expected glossary term as a STANDALONE word.
 * This is strict matching - the term must appear with proper word boundaries.
 * Compound words like "Standaardsjabloon" do NOT match "sjabloon".
 *
 * Examples:
 * - "Dit is een sjabloon" contains "sjabloon" ✓
 * - "Standaardsjabloon" does NOT contain "sjabloon" as standalone ✗
 * - "sjabloon-bestand" contains "sjabloon" ✓ (hyphen is boundary)
 */
function translationContainsTerm(translation: string, expectedTerm: string): boolean {
  if (!translation || !expectedTerm) return false;

  const normalizedTranslation = translation.toLowerCase();
  const normalizedTerm = expectedTerm.toLowerCase().trim();

  // Skip empty or very short terms
  if (normalizedTerm.length < 2) return false;

  // Escape regex special chars in the term
  const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Strict word boundary pattern:
  // - Must be at start OR preceded by whitespace/punctuation (NOT another letter)
  // - Must be at end OR followed by whitespace/punctuation (NOT another letter)
  // This prevents matching inside compound words like "Standaardsjabloon"
  const wordBoundaryPattern = new RegExp(
    `(?:^|[\\s,.!?;:()\\[\\]{}"'<>\\-/])${escapedTerm}(?:[\\s,.!?;:()\\[\\]{}"'<>\\-/]|$)`,
    'i',
  );

  // Also check for exact match (the term IS the entire translation)
  if (normalizedTranslation === normalizedTerm) {
    return true;
  }

  return wordBoundaryPattern.test(normalizedTranslation);
}

/**
 * Analyze a translation against glossary expectations
 *
 * @param sourceText - Original source text
 * @param translation - Current translation
 * @param glossary - Glossary to check against
 * @param entryId - ID of the entry being analyzed
 * @returns Analysis result with term status
 */
export function analyzeTranslation(
  sourceText: string,
  translation: string,
  glossary: Glossary,
  entryId: string,
): GlossaryAnalysisResult {
  // Find all glossary terms in the source text
  const sourceMatches = findGlossaryMatches(sourceText, glossary);

  if (sourceMatches.length === 0) {
    return {
      entryId,
      terms: [],
      matchedCount: 0,
      needsReviewCount: 0,
      analyzedAt: new Date().toISOString(),
    };
  }

  // Analyze each matched term
  const terms: TermAnalysisResult[] = sourceMatches.map((match) => {
    // Find the full entry for additional info
    const entry = glossary.entries.find((e) => e.term.toLowerCase() === match.term.toLowerCase());

    // Check if expected translation appears in the target as standalone word
    const found = translationContainsTerm(translation, match.translation);

    return {
      term: match.term,
      expectedTranslation: match.translation,
      found,
      sourcePosition: match.startIndex,
      comment: entry?.comment,
      partOfSpeech: entry?.partOfSpeech,
    };
  });

  const matchedCount = terms.filter((t) => t.found).length;
  const needsReviewCount = terms.filter((t) => !t.found).length;

  return {
    entryId,
    terms,
    matchedCount,
    needsReviewCount,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Batch analyze multiple entries
 *
 * @param entries - Array of entries with source/translation
 * @param glossary - Glossary to check against
 * @returns Map of entryId to analysis result
 */
export function batchAnalyzeTranslations(
  entries: Array<{ id: string; msgid: string; msgstr: string }>,
  glossary: Glossary,
): Map<string, GlossaryAnalysisResult> {
  const results = new Map<string, GlossaryAnalysisResult>();

  for (const entry of entries) {
    const result = analyzeTranslation(entry.msgid, entry.msgstr, glossary, entry.id);
    // Only store if there are terms to check
    if (result.terms.length > 0) {
      results.set(entry.id, result);
    }
  }

  return results;
}

/**
 * Check if an entry has any glossary terms that need review
 */
export function entryNeedsGlossaryReview(result: GlossaryAnalysisResult | undefined): boolean {
  return result ? result.needsReviewCount > 0 : false;
}

/**
 * Check if all glossary terms are correctly translated
 */
export function entryGlossaryComplete(result: GlossaryAnalysisResult | undefined): boolean {
  if (!result || result.terms.length === 0) return true;
  return result.needsReviewCount === 0;
}
