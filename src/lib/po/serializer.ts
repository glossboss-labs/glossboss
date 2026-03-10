/**
 * PO File Serializer
 *
 * Converts structured PO data back to .po file format.
 * Produces valid gettext-compatible output.
 *
 * Round-trip fidelity notes:
 * - Headers: Fully preserved, revision date optionally updated
 * - Comments: Preserved (translator, extracted, references)
 * - Flags: Preserved (fuzzy, format flags)
 * - Context: Preserved (msgctxt)
 * - Plural forms: Preserved (msgid_plural, msgstr[n])
 * - Line wrapping: Re-wrapped at 80 chars (original wrapping not preserved)
 * - Obsolete entries (#~): Not preserved (skipped during parse)
 */

import type { POFile, POEntry, POHeader, SerializeOptions } from './types';

/**
 * Format a date as PO-Revision-Date format: "YYYY-MM-DD HH:MM+ZZZZ"
 */
function formatPODate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  // Get timezone offset in +HHMM format
  const tzOffset = date.getTimezoneOffset();
  const tzSign = tzOffset <= 0 ? '+' : '-';
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMins = pad(Math.abs(tzOffset) % 60);

  return `${year}-${month}-${day} ${hours}:${minutes}${tzSign}${tzHours}${tzMins}`;
}

/**
 * Escape a string for PO file format
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

/**
 * Wrap a long string into multiple quoted lines
 */
function wrapString(str: string, width: number): string[] {
  const escaped = escapeString(str);

  // Short strings: single line
  if (width === 0 || escaped.length <= width - 4) {
    return [`"${escaped}"`];
  }

  // Multiline: start with empty string marker, then content lines
  const lines: string[] = ['""'];

  // Split by newlines first to preserve intentional line breaks
  const parts = escaped.split('\\n');

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const suffix = i < parts.length - 1 ? '\\n' : '';

    // If this part is short enough, add it as one line
    if (part.length + suffix.length <= width - 4) {
      lines.push(`"${part}${suffix}"`);
    } else {
      // Need to wrap this part into multiple lines
      let remaining = part;
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, width - 4);
        remaining = remaining.slice(width - 4);
        const isLast = remaining.length === 0;
        lines.push(`"${chunk}${isLast ? suffix : ''}"`);
      }
    }
  }

  return lines;
}

/**
 * Serialize header to PO format
 */
function serializeHeader(header: POHeader, options: SerializeOptions): string {
  const { updateRevisionDate = true, lastTranslator } = options;

  // Create a copy to modify
  const headerCopy = { ...header };

  // Update revision date if requested
  if (updateRevisionDate) {
    headerCopy.poRevisionDate = formatPODate(new Date());
  }

  // Update last translator if provided
  if (lastTranslator !== undefined && lastTranslator !== null) {
    headerCopy.lastTranslator = lastTranslator;
  }

  const lines: string[] = [];

  // Standard header field order for consistency
  const fieldOrder: Array<[string, string]> = [
    ['projectIdVersion', 'Project-Id-Version'],
    ['reportMsgidBugsTo', 'Report-Msgid-Bugs-To'],
    ['potCreationDate', 'POT-Creation-Date'],
    ['poRevisionDate', 'PO-Revision-Date'],
    ['lastTranslator', 'Last-Translator'],
    ['languageTeam', 'Language-Team'],
    ['language', 'Language'],
    ['mimeVersion', 'MIME-Version'],
    ['contentType', 'Content-Type'],
    ['contentTransferEncoding', 'Content-Transfer-Encoding'],
    ['pluralForms', 'Plural-Forms'],
    ['xGenerator', 'X-Generator'],
  ];

  const usedKeys = new Set<string>();

  // Output standard fields in order
  for (const [key, headerKey] of fieldOrder) {
    const value = headerCopy[key];
    if (value) {
      lines.push(`${headerKey}: ${value}\n`);
      usedKeys.add(key);
    }
  }

  // Output any custom fields not in the standard list
  for (const [key, value] of Object.entries(headerCopy)) {
    if (value && !usedKeys.has(key)) {
      // Convert camelCase to Header-Case for custom fields
      const headerKey = key.replace(/([A-Z])/g, '-$1').replace(/^-/, '');
      const formattedKey = headerKey.charAt(0).toUpperCase() + headerKey.slice(1);
      lines.push(`${formattedKey}: ${value}\n`);
    }
  }

  return lines.join('');
}

/**
 * Serialize a single PO entry
 */
function serializeEntry(entry: POEntry, options: SerializeOptions): string {
  const { wrapWidth = 80 } = options;
  const lines: string[] = [];

  // Translator comments (# comment)
  for (const comment of entry.translatorComments) {
    lines.push(`# ${comment}`);
  }

  // Extracted comments (#. comment)
  for (const comment of entry.extractedComments) {
    lines.push(`#. ${comment}`);
  }

  // References (#: file:line)
  for (const ref of entry.references) {
    lines.push(`#: ${ref}`);
  }

  // Flags (#, fuzzy, c-format)
  if (entry.flags.length > 0) {
    lines.push(`#, ${entry.flags.join(', ')}`);
  }

  // Previous msgctxt for fuzzy entries (#| msgctxt "...")
  if (entry.previousMsgctxt) {
    lines.push(`#| msgctxt "${escapeString(entry.previousMsgctxt)}"`);
  }

  // Previous msgid for fuzzy entries (#| msgid "...")
  if (entry.previousMsgid) {
    lines.push(`#| msgid "${escapeString(entry.previousMsgid)}"`);
  }

  // msgctxt (message context)
  if (entry.msgctxt) {
    const wrapped = wrapString(entry.msgctxt, wrapWidth);
    lines.push(`msgctxt ${wrapped[0]}`);
    for (let i = 1; i < wrapped.length; i++) {
      lines.push(wrapped[i]);
    }
  }

  // msgid (source string)
  const msgidWrapped = wrapString(entry.msgid, wrapWidth);
  lines.push(`msgid ${msgidWrapped[0]}`);
  for (let i = 1; i < msgidWrapped.length; i++) {
    lines.push(msgidWrapped[i]);
  }

  // msgid_plural (plural source string)
  if (entry.msgidPlural) {
    const wrapped = wrapString(entry.msgidPlural, wrapWidth);
    lines.push(`msgid_plural ${wrapped[0]}`);
    for (let i = 1; i < wrapped.length; i++) {
      lines.push(wrapped[i]);
    }
  }

  // msgstr or msgstr[n] (translations)
  if (entry.msgidPlural && entry.msgstrPlural && entry.msgstrPlural.length > 0) {
    // Plural forms
    for (let i = 0; i < entry.msgstrPlural.length; i++) {
      const wrapped = wrapString(entry.msgstrPlural[i] ?? '', wrapWidth);
      lines.push(`msgstr[${i}] ${wrapped[0]}`);
      for (let j = 1; j < wrapped.length; j++) {
        lines.push(wrapped[j]);
      }
    }
  } else if (entry.msgidPlural) {
    // Has plural but no translations yet - output empty msgstr[0] and msgstr[1]
    lines.push('msgstr[0] ""');
    lines.push('msgstr[1] ""');
  } else {
    // Singular form
    const msgstrWrapped = wrapString(entry.msgstr ?? '', wrapWidth);
    lines.push(`msgstr ${msgstrWrapped[0]}`);
    for (let i = 1; i < msgstrWrapped.length; i++) {
      lines.push(msgstrWrapped[i]);
    }
  }

  return lines.join('\n');
}

/**
 * Serialize a POFile structure back to .po file format
 *
 * @param poFile - Parsed PO file structure
 * @param options - Serialization options
 * @returns .po file content string (valid gettext format)
 *
 * @example
 * ```ts
 * const content = serializePOFile(poFile, {
 *   updateRevisionDate: true,
 *   wrapWidth: 80,
 * });
 * ```
 */
export function serializePOFile(poFile: POFile, options: SerializeOptions = {}): string {
  const { lineEnding = '\n' } = options;
  const blocks: string[] = [];

  // Header entry (msgid "" with header content as msgstr)
  const headerContent = serializeHeader(poFile.header, options);
  if (headerContent) {
    const headerEntry: POEntry = {
      id: 'header',
      translatorComments: [],
      extractedComments: [],
      references: [],
      flags: [],
      msgid: '',
      msgstr: headerContent,
    };
    blocks.push(serializeEntry(headerEntry, options));
  }

  // All translation entries
  for (const entry of poFile.entries) {
    // Skip header entry if it somehow got into entries array
    if (entry.msgid === '' && !entry.msgctxt) continue;
    blocks.push(serializeEntry(entry, options));
  }

  // Join with double newlines (standard PO format)
  let content = blocks.join('\n\n');

  // Normalize line endings if needed
  if (lineEnding === '\r\n') {
    content = content.replace(/\n/g, '\r\n');
  }

  // Ensure file ends with a newline
  return content + lineEnding;
}

/**
 * Calculate the size of serialized PO content
 */
export function calculatePOFileSize(poFile: POFile, options: SerializeOptions = {}): number {
  const content = serializePOFile(poFile, options);
  return new Blob([content]).size;
}

/**
 * Export entries to JSON format (for backup/debugging)
 */
export function exportEntriesToJSON(entries: POEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
