/**
 * PO File Library
 * 
 * Utilities for parsing and serializing GNU gettext .po files.
 */

// Types
export type {
  POFile,
  POEntry,
  POHeader,
  POEntryFlag,
  ParseOptions,
  SerializeOptions,
  ParseResult,
  ParseIssue,
  ParseIssueSeverity,
  ParseErrorCode,
  ValidationResult,
} from './types';

// Parser
export { 
  parsePOFile, 
  parsePOFileWithDiagnostics,
  validatePOFile,
  isPOFileContent,
} from './parser';

// Serializer
export { serializePOFile, exportEntriesToJSON, calculatePOFileSize } from './serializer';

// Encoding
export {
  detectAndDecode,
  decodeWithEncoding,
  normalizeEncoding,
  isEncodingSupported,
  getSupportedEncodings,
  encodeToBytes,
  type SupportedEncoding,
  type EncodingDetectionResult,
} from './encoding';
