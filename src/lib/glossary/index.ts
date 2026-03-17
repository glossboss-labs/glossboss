/**
 * WordPress Glossary Integration
 *
 * Fetch and apply WordPress translation glossaries.
 */

export * from './types';
export { findGlossaryMatches, applyGlossaryToTranslation, getGlossarySuggestions } from './matcher';

// WordPress.org CSV-based glossary fetching
export { parseGlossaryCSV, isValidGlossaryCSV } from './csv-parser';
export type { ParseResult } from './csv-parser';
export {
  fetchWPGlossary,
  clearWPGlossaryCache,
  getCachedWPGlossaryLocales,
  hasGlossaryCache,
  buildGlossaryURL,
  type FetchResult,
} from './wp-fetcher';

// Glossary analysis
export {
  analyzeTranslation,
  batchAnalyzeTranslations,
  entryNeedsGlossaryReview,
  entryGlossaryComplete,
} from './analyzer';
export type { TermAnalysisResult, GlossaryAnalysisResult } from './analyzer';

// Unified glossary loader (for cloud projects)
export { loadGlossaryForLanguage } from './loader';

// Source-specific fetchers
export { fetchGlossaryFromUrl } from './url-fetcher';
export { fetchGlossaryFromRepo } from './repo-fetcher';

// DeepL glossary sync
export {
  syncGlossaryToDeepL,
  getCachedGlossaryId,
  clearCachedGlossary,
  clearAllCachedGlossaries,
} from './deepl-sync';
