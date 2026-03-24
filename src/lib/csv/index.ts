/**
 * CSV Translation File Library
 *
 * Utilities for parsing and serializing CSV translation files,
 * including Weglot-specific CSV format.
 */

// Types
export type { CSVVariant, CSVSerializeOptions } from './types';

// Parser
export { parseCSVTranslationFile, isCSVTranslationContent, detectCSVVariant } from './parser';

// Serializer
export { serializeToCSV } from './serializer';
