/**
 * XLIFF 1.2 Library
 *
 * Utilities for parsing and serializing XLIFF 1.2 translation files.
 */

// Types
export type { XLIFFSerializeOptions } from './types';

// Parser
export { parseXLIFF, isXLIFFContent } from './parser';
export type { XLIFFEntryMeta, XLIFFParseResult } from './parser';

// Serializer
export { serializeToXLIFF } from './serializer';
