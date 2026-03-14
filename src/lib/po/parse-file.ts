/**
 * File Parsing Utilities
 *
 * Shared parsing pipeline for PO/POT/JSON files from any source
 * (file upload, repository, URL). Extracted from the editor controller
 * for reuse in project creation and other import flows.
 */

import type { POFile, ParseIssue } from './types';
import { parsePOFileWithDiagnostics } from './parser';
import { detectAndDecode, type SupportedEncoding } from './encoding';
import { parseI18nextJSON, isI18nextContent } from '@/lib/i18next';
import type { FileFormat } from '@/stores/editor-store';

export interface EncodingInfo {
  encoding: SupportedEncoding;
  confidence: string;
  method: string;
}

export interface ParsedFileResult {
  file: POFile;
  format: FileFormat;
  encoding?: EncodingInfo;
  warnings: ParseIssue[];
}

export type ParseFileOutcome =
  | { ok: true; result: ParsedFileResult }
  | { ok: false; errors: ParseIssue[] };

const VALID_EXTENSIONS = new Set(['po', 'pot', 'json']);

/** Get the lowercase file extension from a filename. */
export function getFileExtension(filename: string): string | undefined {
  return filename.toLowerCase().split('.').pop();
}

/** Check if a file extension is supported for import. */
export function isSupportedExtension(ext: string | undefined): boolean {
  return ext !== undefined && VALID_EXTENSIONS.has(ext);
}

/**
 * Parse a File object (from file picker or drag-drop).
 * Handles binary encoding detection for PO/POT and JSON validation.
 */
export async function parseUploadedFile(file: File): Promise<ParseFileOutcome> {
  const ext = getFileExtension(file.name);

  if (!isSupportedExtension(ext)) {
    return {
      ok: false,
      errors: [
        {
          severity: 'error',
          code: 'INVALID_SYNTAX',
          message: `Invalid file type: .${ext ?? ''}. Please upload a .po, .pot, or .json file.`,
        },
      ],
    };
  }

  try {
    if (ext === 'json') {
      const text = await file.text();
      return parseJsonContent(text, file.name);
    }

    // PO/POT: detect encoding from raw binary
    const buffer = await file.arrayBuffer();
    const decoded = detectAndDecode(buffer);

    return parsePoContent(decoded.content, file.name, {
      encoding: decoded.encoding,
      confidence: decoded.confidence,
      method: decoded.method,
    });
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          severity: 'error',
          code: 'INVALID_SYNTAX',
          message: error instanceof Error ? error.message : 'Failed to parse file',
        },
      ],
    };
  }
}

/**
 * Parse string content (from repository, URL fetch, or WordPress export).
 * Auto-detects format from filename extension or content sniffing.
 */
export function parseFileContent(content: string, filename: string): ParseFileOutcome {
  const ext = getFileExtension(filename);

  if (ext === 'json' || isI18nextContent(content)) {
    return parseJsonContent(content, filename);
  }

  return parsePoContent(content, filename);
}

// ── Internal helpers ──────────────────────────────────────────

function parseJsonContent(text: string, filename: string): ParseFileOutcome {
  if (!isI18nextContent(text)) {
    return {
      ok: false,
      errors: [
        {
          severity: 'error',
          code: 'INVALID_SYNTAX',
          message: 'Invalid JSON file. Expected an i18next JSON resource object.',
        },
      ],
    };
  }

  const file = parseI18nextJSON(text, filename);
  return { ok: true, result: { file, format: 'i18next', warnings: [] } };
}

function parsePoContent(
  content: string,
  filename: string,
  encoding?: EncodingInfo,
): ParseFileOutcome {
  const result = parsePOFileWithDiagnostics(content, filename);
  const warnings = [...result.warnings];

  if (encoding && (encoding.confidence === 'low' || encoding.confidence === 'medium')) {
    warnings.unshift({
      severity: 'warning',
      code: 'ENCODING_ERROR',
      message: `Encoding detected as ${encoding.encoding.toUpperCase()} with ${encoding.confidence} confidence. If characters appear incorrect, the file may use a different encoding.`,
    });
  }

  if (!result.success || !result.file) {
    return { ok: false, errors: result.errors };
  }

  return { ok: true, result: { file: result.file, format: 'po', encoding, warnings } };
}
