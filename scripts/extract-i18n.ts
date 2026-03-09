/**
 * i18n String Extractor
 *
 * Scans src/ for t('...') calls, generates app.pot, and merges into all PO files.
 *
 * Usage: bun scripts/extract-i18n.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep, basename } from 'node:path';
import { parsePOFile } from '../src/lib/po/parser';
import { serializePOFile } from '../src/lib/po/serializer';
import { mergePotIntoPo } from '../src/lib/po/merge';
import type { POEntry, POFile } from '../src/lib/po/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedMessage {
  msgid: string;
  references: string[];
}

export interface ExtractionWarning {
  file: string;
  line: number;
  message: string;
}

// ---------------------------------------------------------------------------
// A. Scan — extract t('...') calls from source
// ---------------------------------------------------------------------------

/**
 * Compute a line-number lookup: given a character offset, return the 1-based line number.
 */
function buildLineMap(source: string): (offset: number) => number {
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1);
  }
  return (offset: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * Parse a quoted string starting at position `pos` (the opening quote character).
 * Returns the parsed string and the position after the closing quote, or null if invalid.
 */
function parseQuotedString(source: string, pos: number): { value: string; end: number } | null {
  const quote = source[pos];
  let str = '';
  let escaped = false;
  let i = pos + 1;

  while (i < source.length) {
    const c = source[i];
    if (escaped) {
      if (c === quote) str += quote;
      else if (c === '\\') str += '\\';
      else if (c === 'n') str += '\n';
      else if (c === 't') str += '\t';
      else if (c === 'r') str += '\r';
      else if (c === '0') str += '\0';
      else if (c === 'u') {
        if (i + 1 < source.length && source[i + 1] === '{') {
          // \u{XXXX} form
          const closeBrace = source.indexOf('}', i + 2);
          if (closeBrace !== -1) {
            const hex = source.slice(i + 2, closeBrace);
            const cp = parseInt(hex, 16);
            str += isNaN(cp) ? '\\u{' + hex + '}' : String.fromCodePoint(cp);
            i = closeBrace;
          } else {
            str += '\\u';
          }
        } else if (i + 4 < source.length) {
          // \uXXXX form
          const hex = source.slice(i + 1, i + 5);
          const cp = parseInt(hex, 16);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            str += String.fromCharCode(cp);
            i += 4;
          } else {
            str += '\\u';
          }
        } else {
          str += '\\u';
        }
      } else if (c === 'x') {
        if (i + 2 < source.length) {
          const hex = source.slice(i + 1, i + 3);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            str += String.fromCharCode(parseInt(hex, 16));
            i += 2;
          } else {
            str += '\\x';
          }
        } else {
          str += '\\x';
        }
      } else if (c === '\n') {
        // Escaped line continuation — skip
      } else if (c === '\r') {
        // Escaped line continuation — skip \r and optional \n
        if (i + 1 < source.length && source[i + 1] === '\n') i++;
      } else {
        str += '\\' + c;
      }
      escaped = false;
    } else if (c === '\\') {
      escaped = true;
    } else if (c === quote) {
      return { value: str, end: i + 1 };
    } else {
      str += c;
    }
    i++;
  }

  return null;
}

/**
 * Extract translatable messages from a single source file.
 * Exported for testing.
 *
 * Works on the full source text to handle multi-line t() calls like:
 *   {t(
 *     'Long string on next line',
 *   )}
 */
export function extractMessagesFromSource(
  source: string,
  filename: string,
): { messages: Map<string, string[]>; warnings: ExtractionWarning[] } {
  const messages = new Map<string, string[]>();
  const warnings: ExtractionWarning[] = [];
  const lineOf = buildLineMap(source);

  // Match both t() and msgid() calls
  const callPattern = /(?<!\w)(?:t|msgid)\(/g;

  let match: RegExpExecArray | null;

  while ((match = callPattern.exec(source)) !== null) {
    const callLine = lineOf(match.index);
    let argStart = match.index + match[0].length;

    // Skip whitespace (including newlines) after the opening paren
    while (argStart < source.length && /\s/.test(source[argStart])) {
      argStart++;
    }

    if (argStart >= source.length) continue;

    const ch = source[argStart];

    // Extract the callee name for diagnostics
    const callee = match[0].slice(0, -1); // strip trailing '('

    // Template literal — warn and skip
    if (ch === '`') {
      warnings.push({
        file: filename,
        line: callLine,
        message: `Template literal in ${callee}() — cannot extract statically`,
      });
      continue;
    }

    // Not a string literal — dynamic call
    if (ch !== "'" && ch !== '"') {
      if (/[a-zA-Z_$]/.test(ch)) {
        warnings.push({
          file: filename,
          line: callLine,
          message: `Dynamic ${callee}() call — cannot extract statically`,
        });
      }
      continue;
    }

    // Parse the quoted string
    const result = parseQuotedString(source, argStart);
    if (result && result.value.length > 0) {
      const ref = `${filename}:${callLine}`;
      const existing = messages.get(result.value);
      if (existing) {
        existing.push(ref);
      } else {
        messages.set(result.value, [ref]);
      }
      // Advance regex past the parsed string to avoid re-matching inside it
      callPattern.lastIndex = result.end;
    }
  }

  return { messages, warnings };
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, test fixtures, etc.
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// B. Generate POT
// ---------------------------------------------------------------------------

function buildPotEntries(allMessages: Map<string, string[]>): POEntry[] {
  const sortedKeys = Array.from(allMessages.keys()).sort();

  return sortedKeys.map((msgid, idx) => ({
    id: String(idx),
    translatorComments: [],
    extractedComments: [],
    references: allMessages.get(msgid)!,
    flags: [],
    msgid,
    msgstr: '',
  }));
}

function buildPotFile(entries: POEntry[]): POFile {
  return {
    filename: 'app.pot',
    header: {
      projectIdVersion: 'GlossBoss UI',
      contentType: 'text/plain; charset=UTF-8',
      contentTransferEncoding: '8bit',
    },
    entries,
    charset: 'UTF-8',
  };
}

// ---------------------------------------------------------------------------
// C. Merge into PO files
// ---------------------------------------------------------------------------

interface LangMergeStats {
  lang: string;
  kept: number;
  added: number;
  removed: number;
  untranslated: number;
}

function mergeIntoPo(poPath: string, potEntries: POEntry[], lang: string): LangMergeStats {
  const raw = readFileSync(poPath, 'utf-8');
  const filename = basename(poPath);
  const poFile = parsePOFile(raw, filename);

  const result = mergePotIntoPo(poFile.entries, potEntries);

  // Special case for English: set msgstr = msgid for new entries
  if (lang === 'en') {
    for (const entry of result.entries) {
      if (entry.msgstr === '') {
        entry.msgstr = entry.msgid;
      }
    }
  }

  const merged: POFile = {
    ...poFile,
    entries: result.entries,
  };

  const content = serializePOFile(merged, {
    updateRevisionDate: false,
  });
  writeFileSync(poPath, content, 'utf-8');

  const untranslated = result.entries.filter(
    (e) => e.msgstr === '' || e.flags.includes('fuzzy'),
  ).length;

  return {
    lang,
    kept: result.stats.kept,
    added: result.stats.added,
    removed: result.stats.removed,
    untranslated,
  };
}

// ---------------------------------------------------------------------------
// D. Main
// ---------------------------------------------------------------------------

function main() {
  const rootDir = resolve(import.meta.dirname, '..');
  const srcDir = resolve(rootDir, 'src');
  const localesDir = resolve(srcDir, 'lib/app-language/locales');

  // A. Scan
  const files = findSourceFiles(srcDir);
  const allMessages = new Map<string, string[]>();
  const allWarnings: ExtractionWarning[] = [];

  for (const filePath of files) {
    const relPath = relative(rootDir, filePath).split(sep).join('/');
    const source = readFileSync(filePath, 'utf-8');
    const { messages, warnings } = extractMessagesFromSource(source, relPath);

    for (const [msgid, refs] of messages) {
      const existing = allMessages.get(msgid);
      if (existing) {
        existing.push(...refs);
      } else {
        allMessages.set(msgid, [...refs]);
      }
    }

    allWarnings.push(...warnings);
  }

  // Print warnings
  for (const w of allWarnings) {
    console.warn(`⚠ ${w.file}:${w.line} — ${w.message}`);
  }

  // B. Generate POT
  const potEntries = buildPotEntries(allMessages);
  const potFile = buildPotFile(potEntries);
  const potContent = serializePOFile(potFile, {
    updateRevisionDate: false,
  });
  const potPath = resolve(localesDir, 'app.pot');
  writeFileSync(potPath, potContent, 'utf-8');

  console.log(`\nExtracted ${potEntries.length} messages into app.pot`);

  // C. Merge into PO files
  const poFiles = readdirSync(localesDir)
    .filter((f) => /^app\.[a-z]+\.po$/.test(f))
    .sort();

  const stats: LangMergeStats[] = [];

  for (const poFilename of poFiles) {
    const lang = poFilename.match(/^app\.([a-z]+)\.po$/)![1];
    const poPath = resolve(localesDir, poFilename);
    const langStats = mergeIntoPo(poPath, potEntries, lang);
    stats.push(langStats);
  }

  // D. Report
  console.log('');
  for (const s of stats) {
    const parts = [`${s.lang}: ${s.kept} kept`];
    if (s.added > 0) parts.push(`${s.added} new`);
    if (s.removed > 0) parts.push(`${s.removed} removed`);
    if (s.untranslated > 0) parts.push(`${s.untranslated} untranslated`);
    console.log(`  ${parts.join(', ')}`);
  }
  console.log('');
}

// Run only when executed directly, not when imported by tests
const isDirectRun = typeof Bun !== 'undefined' && Bun.main === import.meta.path;
if (isDirectRun) {
  main();
}
