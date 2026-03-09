/**
 * Add a new UI language to GlossBoss.
 *
 * Creates the PO catalog, populates it via i18n:extract, updates the
 * i18n-issues workflow language map, and prints an edit link.
 *
 * Usage: bun scripts/add-language.ts <lang>
 *        bun scripts/add-language.ts de
 *        bun scripts/add-language.ts fr
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = resolve(import.meta.dirname, '..');
const localesDir = resolve(rootDir, 'src/lib/app-language/locales');
const issuesWorkflow = resolve(rootDir, '.github/workflows/i18n-issues.yml');

function die(msg: string): never {
  console.error(`\n  Error: ${msg}\n`);
  process.exit(1);
}

function getLanguageName(code: string): string | null {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    const name = dn.of(code);
    // Intl returns the input back when it doesn't recognise it
    if (!name || name === code) return null;
    return name;
  } catch {
    return null;
  }
}

function updateIssuesWorkflow(lang: string, name: string) {
  if (!existsSync(issuesWorkflow)) return;

  const content = readFileSync(issuesWorkflow, 'utf-8');
  const match = content.match(/LANG_NAMES='(\{[^']*\})'/);
  if (!match) return;

  try {
    const map: Record<string, string> = JSON.parse(match[1]);
    if (map[lang]) return; // already present
    map[lang] = name;

    const sorted = Object.keys(map).sort();
    const obj: Record<string, string> = {};
    for (const k of sorted) obj[k] = map[k];

    const updated = content.replace(
      /LANG_NAMES='(\{[^']*\})'/,
      `LANG_NAMES='${JSON.stringify(obj)}'`,
    );
    writeFileSync(issuesWorkflow, updated, 'utf-8');
    console.log(`  Updated i18n-issues.yml language map`);
  } catch {
    // Non-critical — don't block the rest
    console.warn(`  Warning: could not update i18n-issues.yml language map`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const lang = process.argv[2]?.toLowerCase().replace(/_/g, '-').split('-')[0];

if (!lang) {
  die(
    'Usage: bun scripts/add-language.ts <lang>\n         Example: bun scripts/add-language.ts de',
  );
}

if (!/^[a-z]{2,3}$/.test(lang)) {
  die(`"${lang}" does not look like a valid language code (expected 2-3 letter ISO 639 code)`);
}

const name = getLanguageName(lang);
if (!name) {
  die(`"${lang}" is not a recognised language code`);
}

const poFilename = `app.${lang}.po`;
const poPath = resolve(localesDir, poFilename);

if (existsSync(poPath)) {
  die(`${poFilename} already exists — nothing to do`);
}

// Build the new PO file from the POT template (so the parser sees entries)
const potPath = resolve(localesDir, 'app.pot');
if (!existsSync(potPath)) {
  console.log(`  No app.pot found — running i18n:extract first...\n`);
  execSync('bun run i18n:extract', { cwd: rootDir, stdio: 'inherit' });
}

const potContent = readFileSync(potPath, 'utf-8');

// Replace the POT header with a language-specific PO header
const poContent = potContent.replace(
  /^msgid ""\nmsgstr ""\n((?:"[^\n]*\n)*""\n)/m,
  [
    `msgid ""`,
    `msgstr ""`,
    `"Project-Id-Version: GlossBoss UI\\n"`,
    `"Language: ${lang}\\n"`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `""`,
    ``,
  ].join('\n'),
);

writeFileSync(poPath, poContent, 'utf-8');
console.log(
  `\n  Created ${poFilename} with ${(poContent.match(/^msgid "[^"]/gm) || []).length} entries`,
);

// Re-run the extractor so it merges properly and keeps everything in sync
console.log(`  Running i18n:extract to sync...\n`);
execSync('bun run i18n:extract', { cwd: rootDir, stdio: 'inherit' });

// Update the i18n-issues workflow language map
updateIssuesWorkflow(lang, name);

// Print summary and edit links
const relPath = `src/lib/app-language/locales/${poFilename}`;
console.log(`\n  Language: ${name} (${lang})`);
console.log(`  File:     ${relPath}`);
console.log(`  Edit locally:  ${poPath}`);
console.log(`  Edit in GlossBoss: http://localhost:5173/?url=file://${encodeURIComponent(poPath)}`);
console.log(``);
console.log(`  Next steps:`);
console.log(`    1. Translate the empty msgstr values in ${poFilename}`);
console.log(`    2. Verify in Settings > Display > Language`);
console.log(`    3. Commit the new file alongside your changes`);
console.log(``);
