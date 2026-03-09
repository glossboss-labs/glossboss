/**
 * Sync English source strings.
 *
 * When app.en.po has entries where msgstr differs from msgid, this script
 * renames the source string in all t()/msgid() calls across the codebase
 * and updates msgid in all PO files to match.
 *
 * Usage: bun scripts/sync-en-strings.ts          # apply renames
 *        bun scripts/sync-en-strings.ts --check   # dry-run, exit 1 if renames pending
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { parsePOFile } from '../src/lib/po/parser';
import { serializePOFile } from '../src/lib/po/serializer';

const rootDir = resolve(import.meta.dirname, '..');
const srcDir = resolve(rootDir, 'src');
const localesDir = resolve(srcDir, 'lib/app-language/locales');
const checkOnly = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// 1. Find renames: en.po entries where msgstr !== msgid
// ---------------------------------------------------------------------------

interface Rename {
  oldStr: string;
  newStr: string;
}

function findRenames(): Rename[] {
  const enPath = resolve(localesDir, 'app.en.po');
  const raw = readFileSync(enPath, 'utf-8');
  const poFile = parsePOFile(raw, 'app.en.po');

  const renames: Rename[] = [];
  for (const entry of poFile.entries) {
    if (entry.msgstr && entry.msgid && entry.msgstr !== entry.msgid) {
      renames.push({ oldStr: entry.msgid, newStr: entry.msgstr });
    }
  }
  return renames;
}

// ---------------------------------------------------------------------------
// 2. Rename strings in source files
// ---------------------------------------------------------------------------

function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
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

/**
 * Escape a string for use in a regex pattern.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape a string for use inside a JS single-quoted string literal.
 */
function escapeForSingleQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Escape a string for use inside a JS double-quoted string literal.
 */
function escapeForDoubleQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renameInSourceFiles(renames: Rename[]): number {
  const files = findSourceFiles(srcDir);
  let totalReplacements = 0;

  for (const filePath of files) {
    let content = readFileSync(filePath, 'utf-8');
    let changed = false;

    for (const { oldStr, newStr } of renames) {
      // Match t('old') or msgid('old') with both quote styles
      const oldSingle = escapeRegex(escapeForSingleQuote(oldStr));
      const oldDouble = escapeRegex(escapeForDoubleQuote(oldStr));
      const newSingle = escapeForSingleQuote(newStr);
      const newDouble = escapeForDoubleQuote(newStr);

      // Single-quoted: t('old') or msgid('old')
      const singlePattern = new RegExp(`(?<=(?:^|\\W)(?:t|msgid)\\(\\s*)('${oldSingle}')`, 'g');
      const singleResult = content.replace(singlePattern, `'${newSingle}'`);
      if (singleResult !== content) {
        const count = (content.match(singlePattern) || []).length;
        totalReplacements += count;
        content = singleResult;
        changed = true;
      }

      // Double-quoted: t("old") or msgid("old")
      const doublePattern = new RegExp(`(?<=(?:^|\\W)(?:t|msgid)\\(\\s*)("${oldDouble}")`, 'g');
      const doubleResult = content.replace(doublePattern, `"${newDouble}"`);
      if (doubleResult !== content) {
        const count = (content.match(doublePattern) || []).length;
        totalReplacements += count;
        content = doubleResult;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(filePath, content, 'utf-8');
    }
  }

  return totalReplacements;
}

// ---------------------------------------------------------------------------
// 3. Rename msgid in all PO files (including en.po)
// ---------------------------------------------------------------------------

function renameInPoFiles(renames: Rename[]): number {
  const renameMap = new Map(renames.map((r) => [r.oldStr, r.newStr]));
  const poFiles = readdirSync(localesDir)
    .filter((f) => /^app\.[a-z]+\.po$/.test(f))
    .sort();

  let totalRenamed = 0;

  for (const poFilename of poFiles) {
    const poPath = resolve(localesDir, poFilename);
    const raw = readFileSync(poPath, 'utf-8');
    const poFile = parsePOFile(raw, poFilename);
    const lang = poFilename.match(/^app\.([a-z]+)\.po$/)![1];
    let changed = false;

    for (const entry of poFile.entries) {
      const newMsgid = renameMap.get(entry.msgid);
      if (newMsgid) {
        entry.msgid = newMsgid;
        // For English: msgstr should always equal msgid
        if (lang === 'en') {
          entry.msgstr = newMsgid;
        }
        changed = true;
        totalRenamed++;
      }
    }

    if (changed) {
      const content = serializePOFile(poFile, { updateRevisionDate: false });
      writeFileSync(poPath, content, 'utf-8');
    }
  }

  return totalRenamed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const renames = findRenames();

if (renames.length === 0) {
  console.log('\n  No string renames found in app.en.po — everything is in sync.\n');
  process.exit(0);
}

console.log(`\n  Found ${renames.length} string rename(s) in app.en.po:\n`);
for (const { oldStr, newStr } of renames) {
  console.log(`    "${oldStr}"`);
  console.log(`    → "${newStr}"\n`);
}

if (checkOnly) {
  console.log('  Run `bun run i18n:sync-en` to apply these renames to source code and PO files.\n');
  process.exit(1);
}

// Apply renames
const sourceCount = renameInSourceFiles(renames);
console.log(`  Renamed ${sourceCount} occurrence(s) in source files`);

const poCount = renameInPoFiles(renames);
console.log(`  Renamed ${poCount} msgid(s) across PO files`);

// Re-run the extractor to update references and POT
console.log(`  Running i18n:extract to sync...\n`);
execSync('bun run i18n:extract', { cwd: rootDir, stdio: 'inherit' });

console.log(`\n  Done. Review the changes and commit.\n`);
