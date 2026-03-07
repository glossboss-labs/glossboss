/**
 * WordPress Glossary Types
 *
 * Types for WordPress translation glossary entries.
 * Glossaries help ensure consistent translation of technical terms.
 */

/** A single glossary entry */
export interface GlossaryEntry {
  /** Original term (source language) */
  term: string;

  /** Translated term (target language) */
  translation: string;

  /** Part of speech (noun, verb, etc.) */
  partOfSpeech?: string;

  /** Additional context or notes */
  comment?: string;

  /** Last updated timestamp */
  lastUpdated?: string;
}

/** Complete glossary for a language */
export interface Glossary {
  /** Source language code */
  sourceLocale: string;

  /** Target language code */
  targetLocale: string;

  /** Project/domain (e.g., 'wordpress', 'woocommerce') */
  project?: string;

  /** All glossary entries */
  entries: GlossaryEntry[];

  /** When the glossary was fetched */
  fetchedAt: string;
}

/** Request to fetch a glossary */
export interface FetchGlossaryRequest {
  /** Target locale (e.g., 'nl', 'de', 'fr') */
  locale: string;

  /** Project slug (default: 'wp') */
  project?: string;
}

/** Response from glossary fetch */
export interface FetchGlossaryResponse {
  /** The fetched glossary */
  glossary: Glossary;

  /** Whether this was from cache */
  cached: boolean;
}

/** Match result when applying glossary to text */
export interface GlossaryMatch {
  /** The matched term */
  term: string;

  /** The suggested translation */
  translation: string;

  /** Start position in source text */
  startIndex: number;

  /** End position in source text */
  endIndex: number;

  /** Confidence score (0-1) */
  confidence: number;
}

/** Options for glossary matching */
export interface MatchOptions {
  /** Case-sensitive matching (default: false) */
  caseSensitive?: boolean;

  /** Match whole words only (default: true) */
  wholeWord?: boolean;

  /** Minimum term length to match (default: 2) */
  minLength?: number;
}

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
