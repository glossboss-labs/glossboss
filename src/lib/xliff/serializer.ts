/**
 * XLIFF 1.2 Serializer
 *
 * Converts POEntry[] to XLIFF 1.2 format.
 */

import type { POEntry, POHeader } from '@/lib/po/types';
import type { XLIFFSerializeOptions } from './types';
import { escapeXml } from './parser';

/**
 * Extract the XLIFF trans-unit id from a reference string.
 * References stored as "xliff:id=<value>" during parsing.
 */
function extractXliffId(references: string[]): string | null {
  for (const ref of references) {
    const match = ref.match(/^xliff:id=(.+)$/);
    if (match) {
      return match[1]!;
    }
  }
  return null;
}

/**
 * Serialize PO entries to XLIFF 1.2 format
 *
 * @param entries - PO translation entries
 * @param header - PO header with language metadata
 * @param options - Serialization options
 * @returns XLIFF 1.2 XML string
 */
export function serializeToXLIFF(
  entries: POEntry[],
  header: POHeader,
  options: XLIFFSerializeOptions = {},
): string {
  const { indent = 2 } = options;
  const pad = (level: number) => ' '.repeat(indent * level);

  // Determine languages
  const sourceLanguage = header['x-xliff-source-language'] ?? header.language ?? 'en';
  const targetLanguage = header.language ?? 'und';

  // Build trans-units
  const transUnits: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    // Skip empty msgid (header entry)
    if (!entry.msgid && !entry.msgctxt) continue;

    // Determine trans-unit id
    const xliffId = extractXliffId(entry.references) ?? String(i + 1);

    // Determine target state
    const state = entry.msgstr.trim() ? 'translated' : 'needs-translation';

    // Build note from extractedComments or msgctxt
    const noteText = entry.extractedComments[0] ?? entry.msgctxt;

    // Build the trans-unit XML
    const lines: string[] = [];
    lines.push(`${pad(3)}<trans-unit id="${escapeXml(xliffId)}">`);
    lines.push(`${pad(4)}<source>${escapeXml(entry.msgid)}</source>`);
    lines.push(`${pad(4)}<target state="${state}">${escapeXml(entry.msgstr)}</target>`);
    if (noteText) {
      lines.push(`${pad(4)}<note>${escapeXml(noteText)}</note>`);
    }
    lines.push(`${pad(3)}</trans-unit>`);

    transUnits.push(lines.join('\n'));
  }

  // Assemble the full document
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(`<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">`);
  parts.push(
    `${pad(1)}<file source-language="${escapeXml(sourceLanguage)}" target-language="${escapeXml(targetLanguage)}" datatype="plaintext" original="glossboss">`,
  );
  parts.push(`${pad(2)}<body>`);
  parts.push(transUnits.join('\n'));
  parts.push(`${pad(2)}</body>`);
  parts.push(`${pad(1)}</file>`);
  parts.push('</xliff>\n');

  return parts.join('\n');
}
