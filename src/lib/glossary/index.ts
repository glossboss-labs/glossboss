/**
 * WordPress Glossary Integration — public API
 *
 * Only re-exports consumed by other modules via `@/lib/glossary`.
 * Internal utilities (csv-parser, wp-fetcher, matcher, loader, etc.)
 * should be imported directly from their submodule when needed.
 */

// Glossary analysis
export { analyzeTranslation, batchAnalyzeTranslations } from './analyzer';
export type { GlossaryAnalysisResult } from './analyzer';

// DeepL glossary sync
export { syncGlossaryToDeepL } from './deepl-sync';
