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
  generateEntryId,
} from './parser';

// Serializer
export {
  serializePOFile,
  exportEntriesToJSON,
  calculatePOFileSize,
  formatPODate,
} from './serializer';

// Merge
export { mergePotIntoPo, type MergeResult } from './merge';

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

// File parsing (shared pipeline for upload, repo, URL)
export {
  parseUploadedFile,
  parseFileContent,
  parseAndApplySourceFile,
  getFileExtension,
  isSupportedExtension,
  type ParsedFileResult,
  type ParseFileOutcome,
  type EncodingInfo,
  type SourceFileResult,
} from './parse-file';

// Source file
export { applySourceFile } from './source-file';

// Key detection
export { hasKeyBasedMsgids } from './key-detection';
