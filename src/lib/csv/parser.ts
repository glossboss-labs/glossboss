/**
 * CSV Translation File Parser
 *
 * Parses CSV translation files into POEntry[] for the editor.
 * Supports generic two/three-column CSV and Weglot 6-column CSV.
 * Auto-detects the variant from header columns.
 */

import type { POEntry, POFile, POHeader } from '@/lib/po/types';
import type { CSVVariant } from './types';
import { hashString } from '@/lib/utils/hash';

/**
 * Generate a stable ID for an entry based on its key
 */
function generateEntryId(key: string, index: number): string {
  return `${index}-${hashString(key)}`;
}

/**
 * Parse raw CSV text into rows, handling quoted fields and multi-line content.
 *
 * Character-by-character state machine that handles:
 * - Quoted fields (double-quote for escaping)
 * - Multi-line content inside quotes
 * - Comma delimiter
 * - BOM stripping
 * - Line ending normalization
 */
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // Strip BOM
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote — add single quote and skip next
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Any character inside quotes (including newlines)
        currentField += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n') {
        // End of row
        currentRow.push(currentField);
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Don't forget the last field and row
  currentRow.push(currentField);
  if (currentRow.some((f) => f.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Detect the CSV variant from header column names.
 *
 * Weglot is detected when headers include both `word_type` AND `source_word`.
 * Everything else is treated as generic CSV.
 */
export function detectCSVVariant(headers: string[]): CSVVariant {
  const lower = headers.map((h) => h.trim().toLowerCase());
  if (lower.includes('word_type') && lower.includes('source_word')) {
    return 'weglot';
  }
  return 'generic';
}

/**
 * Detect if content looks like a CSV translation file.
 *
 * Returns true when the first line has at least 2 comma-separated columns.
 */
export function isCSVTranslationContent(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  // Strip BOM
  let text = content;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Grab the first line
  const firstNewline = text.indexOf('\n');
  const firstLine = (firstNewline === -1 ? text : text.slice(0, firstNewline)).trim();

  if (firstLine.length === 0) {
    return false;
  }

  // Quick parse: count top-level commas (outside quotes)
  let commas = 0;
  let inQ = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      commas++;
    }
  }

  // Need at least one comma → 2 columns
  return commas >= 1;
}

/**
 * Parse a Weglot CSV into POFile
 */
function parseWeglot(rows: string[][], headers: string[], filename: string): POFile {
  const colIndex = (name: string): number =>
    headers.findIndex((h) => h.trim().toLowerCase() === name);

  const iWordType = colIndex('word_type');
  const iSourceLang = colIndex('source_language');
  const iTargetLang = colIndex('target_language');
  const iSourceWord = colIndex('source_word');
  const iTargetWord = colIndex('target_word');
  const iIsTranslated = colIndex('is_translated');

  const entries: POEntry[] = [];
  let sourceLang = '';
  let targetLang = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;

    const sourceWord = iSourceWord >= 0 ? (row[iSourceWord] ?? '') : '';

    // Skip rows with empty source word
    if (!sourceWord.trim()) {
      continue;
    }

    // Capture languages from first data row
    if (i === 1) {
      sourceLang = iSourceLang >= 0 ? (row[iSourceLang] ?? '') : '';
      targetLang = iTargetLang >= 0 ? (row[iTargetLang] ?? '') : '';
    }

    const wordType = iWordType >= 0 ? (row[iWordType] ?? '') : '';
    const targetWord = iTargetWord >= 0 ? (row[iTargetWord] ?? '') : '';
    const isTranslated = iIsTranslated >= 0 ? (row[iIsTranslated] ?? '') : '1';

    const msgid = sourceWord;
    const msgstr = isTranslated.trim() === '0' ? '' : targetWord;
    const msgctxt = wordType || undefined;

    const key = `${msgctxt ?? ''}:${msgid}`;

    const entry: POEntry = {
      id: generateEntryId(key, entries.length),
      msgid,
      msgstr,
      msgctxt,
      translatorComments: [],
      extractedComments: wordType ? [wordType] : [],
      references: [],
      flags: [],
    };

    entries.push(entry);
  }

  const header: POHeader = {
    language: targetLang,
    contentType: 'text/csv; charset=UTF-8',
    'x-weglot-source-language': sourceLang,
  };

  return {
    filename,
    header,
    entries,
    charset: 'UTF-8',
  };
}

/**
 * Parse a generic CSV into POFile
 */
function parseGeneric(rows: string[][], headers: string[], filename: string): POFile {
  const entries: POEntry[] = [];
  const hasContext = headers.length >= 3;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;

    const msgid = row[0] ?? '';

    // Skip rows with empty first column
    if (!msgid.trim()) {
      continue;
    }

    const msgstr = row[1] ?? '';
    const msgctxt = hasContext ? row[2] || undefined : undefined;

    const key = `${msgctxt ?? ''}:${msgid}`;

    const entry: POEntry = {
      id: generateEntryId(key, entries.length),
      msgid,
      msgstr,
      msgctxt,
      translatorComments: [],
      extractedComments: [],
      references: [],
      flags: [],
    };

    entries.push(entry);
  }

  const header: POHeader = {
    contentType: 'text/csv; charset=UTF-8',
    'x-csv-headers': headers.join(','),
  };

  return {
    filename,
    header,
    entries,
    charset: 'UTF-8',
  };
}

/**
 * Parse a CSV translation file into a POFile structure.
 *
 * Auto-detects Weglot vs generic variant from the header row.
 * Weglot is detected when headers include `word_type` AND `source_word`.
 */
export function parseCSVTranslationFile(content: string, filename: string): POFile {
  const rows = parseCSVRows(content);

  if (rows.length === 0) {
    return {
      filename,
      header: { contentType: 'text/csv; charset=UTF-8' },
      entries: [],
      charset: 'UTF-8',
    };
  }

  const headers = rows[0]!;
  const variant = detectCSVVariant(headers);

  if (variant === 'weglot') {
    return parseWeglot(rows, headers, filename);
  }

  return parseGeneric(rows, headers, filename);
}
