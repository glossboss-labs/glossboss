/**
 * WordPress Glossary CSV Parser
 *
 * Parses CSV exports from WordPress.org translation glossaries.
 * WordPress.org format: source_lang, target_lang, pos, description
 * Example headers: "en,nl,pos,description"
 *
 * Handles multi-line quoted fields correctly.
 *
 * @see https://translate.wordpress.org/locale/{lang}/default/glossary/-export/
 */

import type { GlossaryEntry } from './types';

/** Result of parsing a glossary CSV */
export interface ParseResult {
  /** Successfully parsed entries */
  entries: GlossaryEntry[];

  /** Number of rows that failed to parse */
  errorCount: number;

  /** Parse errors (first 5) */
  errors: string[];

  /** Detected source language from header */
  sourceLocale?: string;

  /** Detected target language from header */
  targetLocale?: string;
}

/**
 * Parse CSV text into rows, handling multi-line quoted fields
 *
 * @param csvText - Raw CSV text
 * @returns Array of rows, each row is an array of field values
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // Normalize line endings
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote - add single quote and skip next
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
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        // End of row
        currentRow.push(currentField.trim());
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
  currentRow.push(currentField.trim());
  if (currentRow.some((f) => f.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parse WordPress glossary CSV text into structured entries
 *
 * WordPress.org CSV format has dynamic headers based on locale:
 * - Column 0: source language term (header is source locale, e.g., "en")
 * - Column 1: target language translation (header is target locale, e.g., "nl")
 * - Column 2: part of speech (header is "pos")
 * - Column 3: description/comment (header is "description")
 *
 * @param csvText - Raw CSV text from WordPress.org export
 * @returns Parse result with entries and error info
 */
export function parseGlossaryCSV(csvText: string): ParseResult {
  const entries: GlossaryEntry[] = [];
  const errors: string[] = [];
  let errorCount = 0;

  // Parse CSV into rows
  const rows = parseCSV(csvText);

  if (rows.length === 0) {
    return { entries: [], errorCount: 0, errors: ['Empty CSV file'] };
  }

  // First row is headers
  const headers = rows[0]!.map((h) => h.toLowerCase().trim());

  if (headers.length < 2) {
    return {
      entries: [],
      errorCount: 0,
      errors: ['Invalid CSV: need at least 2 columns'],
    };
  }

  // WordPress.org format: first column is source locale, second is target locale
  // Headers are like: "en,nl,pos,description"
  const termIndex = 0;
  const translationIndex = 1;
  let posIndex = headers.indexOf('pos');
  let descIndex = headers.indexOf('description');

  // If no 'pos' column found by name, assume position 2
  if (posIndex === -1 && headers.length > 2) {
    posIndex = 2;
  }

  // If no 'description' column found by name, assume position 3
  if (descIndex === -1 && headers.length > 3) {
    descIndex = 3;
  }

  // Extract locale info from headers
  const sourceLocale = headers[0];
  const targetLocale = headers[1];

  // Parse data rows (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;

    try {
      const term = row[termIndex] || '';
      const translation = row[translationIndex] || '';
      const partOfSpeech = posIndex >= 0 && posIndex < row.length ? row[posIndex] || '' : '';
      const comment = descIndex >= 0 && descIndex < row.length ? row[descIndex] || '' : '';

      // Skip empty terms
      if (!term.trim()) {
        continue;
      }

      entries.push({
        term: term.trim(),
        translation: translation.trim(),
        partOfSpeech: partOfSpeech.trim() || undefined,
        comment: comment.trim() || undefined,
      });
    } catch (err) {
      errorCount++;
      if (errors.length < 5) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
      }
    }
  }

  return { entries, errorCount, errors, sourceLocale, targetLocale };
}

/**
 * Validate that text looks like a WordPress glossary CSV
 *
 * @param text - Text to validate
 * @returns True if it appears to be a valid glossary CSV
 */
export function isValidGlossaryCSV(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Parse just the first row
  const rows = parseCSV(text);
  if (rows.length === 0) {
    return false;
  }

  const headers = rows[0]!;

  // WordPress.org CSVs have at least 2 columns (source, target)
  if (headers.length < 2) {
    return false;
  }

  // Check if it looks like a WordPress glossary (has 'pos' or 'description' columns)
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const hasPos = lowerHeaders.includes('pos');
  const hasDescription = lowerHeaders.includes('description');

  return hasPos || hasDescription || headers.length >= 2;
}
