/**
 * CSV Translation File Types
 *
 * Types for parsing and serializing CSV translation files,
 * including Weglot-specific CSV format.
 */

/** CSV sub-variant */
export type CSVVariant = 'generic' | 'weglot';

/** Options for CSV serialization */
export interface CSVSerializeOptions {
  /** CSV variant to produce (default: 'generic') */
  variant?: CSVVariant;
}
