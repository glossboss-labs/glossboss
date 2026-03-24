/**
 * CSV Translation File Serializer
 *
 * Converts POEntry[] to CSV format.
 * Supports generic and Weglot variants.
 */

import type { POEntry, POHeader } from '@/lib/po/types';
import type { CSVSerializeOptions } from './types';

/**
 * Escape and quote a CSV field if it contains special characters.
 *
 * Wraps the value in double quotes when it contains a comma, double-quote,
 * or newline. Internal double-quotes are escaped by doubling them.
 */
function quoteField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize a single row of fields to a CSV line
 */
function serializeRow(fields: string[]): string {
  return fields.map(quoteField).join(',');
}

/**
 * Serialize entries to Weglot CSV format
 */
function serializeWeglot(entries: POEntry[], header: POHeader): string {
  const sourceLang = header['x-weglot-source-language'] ?? '';
  const targetLang = header.language ?? '';

  const headerRow = serializeRow([
    'word_type',
    'source_language',
    'target_language',
    'source_word',
    'target_word',
    'is_translated',
  ]);

  const dataRows = entries.map((entry) => {
    const wordType = entry.msgctxt ?? 'p';
    const isTranslated = entry.msgstr.trim() ? '1' : '0';

    return serializeRow([
      wordType,
      sourceLang,
      targetLang,
      entry.msgid,
      entry.msgstr,
      isTranslated,
    ]);
  });

  return [headerRow, ...dataRows].join('\n') + '\n';
}

/**
 * Serialize entries to generic CSV format
 */
function serializeGeneric(entries: POEntry[], header: POHeader): string {
  const hasContext = entries.some((e) => e.msgctxt);

  // Recover original header names if available
  const csvHeaders = header['x-csv-headers'];
  let headerFields: string[];
  if (csvHeaders) {
    headerFields = csvHeaders.split(',');
    // Ensure correct column count
    if (hasContext && headerFields.length < 3) {
      headerFields = [...headerFields, 'context'];
    } else if (!hasContext && headerFields.length > 2) {
      headerFields = headerFields.slice(0, 2);
    }
  } else {
    headerFields = hasContext ? ['key', 'translation', 'context'] : ['key', 'translation'];
  }

  const headerRow = serializeRow(headerFields);

  const dataRows = entries.map((entry) => {
    const fields = [entry.msgid, entry.msgstr];
    if (hasContext) {
      fields.push(entry.msgctxt ?? '');
    }
    return serializeRow(fields);
  });

  return [headerRow, ...dataRows].join('\n') + '\n';
}

/**
 * Serialize PO entries to CSV format.
 *
 * @param entries - PO translation entries
 * @param header - PO header with metadata
 * @param options - Serialization options (variant selection)
 * @returns CSV string
 */
export function serializeToCSV(
  entries: POEntry[],
  header: POHeader,
  options: CSVSerializeOptions = {},
): string {
  const { variant = 'generic' } = options;

  if (variant === 'weglot') {
    return serializeWeglot(entries, header);
  }

  return serializeGeneric(entries, header);
}
