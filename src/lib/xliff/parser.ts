/**
 * XLIFF 1.2 Parser
 *
 * Parses XLIFF 1.2 translation files into POEntry[] for the editor.
 * Uses regex-based XML parsing (no external libraries).
 */

import type { POEntry, POFile, POHeader } from '@/lib/po/types';
import { hashString } from '@/lib/utils/hash';

/** Per-entry metadata extracted from Weglot XLIFF attributes */
export interface XLIFFEntryMeta {
  /** Weglot quality: "Manual" (human-reviewed) or "Automatic" (MT) */
  quality?: string;
  /** Content type: "Text", "Meta (SEO)", etc. */
  contentType?: string;
  /** Human-readable name / context */
  resname?: string;
  /** Page URL this string appears on */
  url?: string;
  /** Timestamp when the string was first seen */
  createdAt?: string;
}

/** Extended parse result with per-entry metadata */
export interface XLIFFParseResult {
  file: POFile;
  /** Per-entry metadata indexed by entry ID */
  entryMeta: Map<string, XLIFFEntryMeta>;
}

/**
 * Escape special XML characters
 */
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Decode XML entities back to characters.
 * Handles named entities (&amp; &lt; &gt; &quot; &apos;) and
 * numeric/hex character references (&#xEB; &#233; etc.).
 */
function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replaceAll('&amp;', '&');
}

/**
 * Strip CDATA wrappers from text
 */
function stripCDATA(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/**
 * Extract text content from an XML element, handling CDATA and entities
 */
function extractElementText(xml: string, tagName: string): string | null {
  // Match opening tag (with optional attributes), content, and closing tag
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (match) {
    const raw = match[1]!;
    return decodeXml(stripCDATA(raw));
  }

  // Check for self-closing tag
  const selfClosing = new RegExp(`<${tagName}\\s*/>`);
  if (selfClosing.test(xml)) {
    return '';
  }

  return null;
}

/**
 * Extract an attribute value from an XML element string
 */
function extractAttribute(xml: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1]! : null;
}

/**
 * Check if a note looks like a Weglot word_type (single word, no spaces)
 */
function isWordType(note: string): boolean {
  return /^\S+$/.test(note.trim()) && note.trim().length > 0;
}

/**
 * Generate a stable ID for an entry based on its XLIFF id and source text
 */
function generateEntryId(xliffId: string, sourceText: string, index: number): string {
  return `${index}-${hashString(xliffId + ':' + sourceText)}`;
}

/**
 * Detect if content looks like XLIFF
 */
export function isXLIFFContent(content: string): boolean {
  const snippet = content.slice(0, 500);
  return /<xliff\b/i.test(snippet);
}

/**
 * Parse an XLIFF 1.2 string into a POFile structure with optional metadata.
 */
export function parseXLIFF(content: string, filename: string): XLIFFParseResult {
  // Strip BOM
  let xml = content.replace(/^\uFEFF/, '');

  // Check for empty/malformed content
  if (!xml.trim()) {
    throw new Error('Empty XLIFF file.');
  }

  // Reject XLIFF 2.0
  if (/version="2\.0"/.test(xml)) {
    throw new Error('XLIFF 2.0 is not supported. Please export as XLIFF 1.2.');
  }

  // Validate it contains XLIFF
  if (!/<xliff\b/i.test(xml)) {
    throw new Error('Invalid XLIFF file: missing <xliff> root element.');
  }

  // Extract all <file> elements
  const fileMatches = xml.match(/<file\b[\s\S]*?<\/file>/g) ?? [];
  if (fileMatches.length === 0) {
    throw new Error('Invalid XLIFF file: no <file> elements found.');
  }

  // Read source-language and target-language from the first <file>
  const firstFile = fileMatches[0]!;
  const firstFileOpenTag = firstFile.match(/<file\b[^>]*>/)?.[0] ?? '';
  const sourceLanguage = extractAttribute(firstFileOpenTag, 'source-language') ?? 'en';
  const targetLanguage = extractAttribute(firstFileOpenTag, 'target-language') ?? '';

  // Collect all trans-units from all files
  const entries: POEntry[] = [];
  const entryMeta = new Map<string, XLIFFEntryMeta>();
  let globalIndex = 0;

  for (const fileBlock of fileMatches) {
    const tuMatches = fileBlock.match(/<trans-unit\b[\s\S]*?<\/trans-unit>/g) ?? [];

    for (const tu of tuMatches) {
      // Extract trans-unit attributes
      const tuOpenTag = tu.match(/<trans-unit\b[^>]*>/)?.[0] ?? '';
      const xliffId = extractAttribute(tuOpenTag, 'id') ?? String(globalIndex + 1);
      const approved = extractAttribute(tuOpenTag, 'approved');
      const quality = extractAttribute(tuOpenTag, 'quality');
      const resname = extractAttribute(tuOpenTag, 'resname');
      const tuType = extractAttribute(tuOpenTag, 'type');
      const createdAt = extractAttribute(tuOpenTag, 'created_at');
      const url = extractAttribute(tuOpenTag, 'url');

      // Extract source text
      const sourceText = extractElementText(tu, 'source') ?? '';

      // Extract target text — missing or self-closing means empty
      const targetText = extractElementText(tu, 'target') ?? '';

      // Extract target state attribute
      const targetTag = tu.match(/<target\b[^>]*>/)?.[0] ?? '';
      const state = extractAttribute(targetTag, 'state');

      // Extract note (optional)
      const note = extractElementText(tu, 'note');

      // Build flags
      const flags: POEntry['flags'] = [];
      if (state === 'needs-translation' && approved !== 'yes') {
        flags.push('fuzzy');
      }

      // Build extracted comments and msgctxt
      const extractedComments: string[] = [];
      let msgctxt: string | undefined;

      // Weglot: use type as extracted comment (e.g. "Text", "Meta (SEO)")
      if (tuType && tuType !== 'plaintext') {
        extractedComments.push(tuType);
      }

      if (note !== null && note.trim().length > 0) {
        extractedComments.push(note.trim());
        if (isWordType(note.trim())) {
          msgctxt = note.trim();
        }
      }

      // Weglot: use resname as translator comment (human-readable context)
      const translatorComments: string[] = [];
      if (resname) {
        translatorComments.push(resname);
      }

      const entryId = generateEntryId(xliffId, sourceText, globalIndex);

      const entry: POEntry = {
        id: entryId,
        msgid: sourceText,
        msgstr: targetText,
        msgctxt,
        translatorComments,
        extractedComments,
        references: [`xliff:id=${xliffId}`],
        flags,
      };

      entries.push(entry);

      // Store Weglot-specific metadata
      if (quality || tuType || resname || url || createdAt) {
        entryMeta.set(entryId, {
          quality: quality ?? undefined,
          contentType: tuType && tuType !== 'plaintext' ? tuType : undefined,
          resname: resname ?? undefined,
          url: url ?? undefined,
          createdAt: createdAt ?? undefined,
        });
      }

      globalIndex++;
    }
  }

  const header: POHeader = {
    language: targetLanguage || undefined,
    contentType: 'application/xliff+xml; charset=UTF-8',
    'x-xliff-source-language': sourceLanguage,
  };

  return {
    file: {
      filename,
      header,
      entries,
      charset: 'UTF-8',
    },
    entryMeta,
  };
}

export { escapeXml, decodeXml };
