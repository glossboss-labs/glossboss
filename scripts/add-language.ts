/**
 * Add a new UI language to GlossBoss.
 *
 * Creates the PO catalog, populates it via i18n:extract, updates the
 * i18n-issues workflow config, and prints an edit link.
 *
 * Usage: bun scripts/add-language.ts <lang> [--assignee <user>...]
 *        bun scripts/add-language.ts de
 *        bun scripts/add-language.ts fr --assignee octocat
 *        bun scripts/add-language.ts ja --assignee user1 --assignee user2
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

interface LangEntry {
  name: string;
  assignees: string;
}

function updateIssuesWorkflow(lang: string, name: string, assignees: string[]) {
  if (!existsSync(issuesWorkflow)) return;

  const content = readFileSync(issuesWorkflow, 'utf-8');
  const match = content.match(/LANG_CONFIG='(\{[^']*\})'/);
  if (!match) return;

  try {
    const config: Record<string, LangEntry> = JSON.parse(match[1]);

    if (config[lang]) {
      // Language exists — merge new assignees
      const existing = config[lang].assignees
        ? config[lang].assignees.split(',').map((s) => s.trim())
        : [];
      const merged = [...new Set([...existing, ...assignees])].filter(Boolean);
      config[lang].assignees = merged.join(',');
    } else {
      config[lang] = { name, assignees: assignees.join(',') };
    }

    const sorted = Object.keys(config).sort();
    const obj: Record<string, LangEntry> = {};
    for (const k of sorted) obj[k] = config[k];

    const updated = content.replace(
      /LANG_CONFIG='(\{[^']*\})'/,
      `LANG_CONFIG='${JSON.stringify(obj)}'`,
    );
    writeFileSync(issuesWorkflow, updated, 'utf-8');
    console.log(`  Updated i18n-issues.yml language config`);
  } catch {
    console.warn(`  Warning: could not update i18n-issues.yml language config`);
  }
}

// ---------------------------------------------------------------------------
// Parse arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let langArg: string | undefined;
const assignees: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--assignee' && i + 1 < args.length) {
    assignees.push(args[++i]);
  } else if (!langArg && !args[i].startsWith('-')) {
    langArg = args[i];
  }
}

const lang = langArg?.toLowerCase().replace(/_/g, '-').split('-')[0];

if (!lang) {
  die(
    'Usage: bun scripts/add-language.ts <lang> [--assignee <user>...]\n         Example: bun scripts/add-language.ts de --assignee octocat',
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
  // File already exists — still allow updating assignees
  if (assignees.length > 0) {
    updateIssuesWorkflow(lang, name, assignees);
    console.log(`\n  ${poFilename} already exists — updated assignees: ${assignees.join(', ')}\n`);
    process.exit(0);
  }
  die(
    `${poFilename} already exists — nothing to do\n         To add assignees: bun run i18n:add-lang ${lang} --assignee <user>`,
  );
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

// Update the i18n-issues workflow config
updateIssuesWorkflow(lang, name, assignees);

// Print summary
const relPath = `src/lib/app-language/locales/${poFilename}`;
console.log(`\n  Language: ${name} (${lang})`);
console.log(`  File:     ${relPath}`);
console.log(`  Edit:     ${poPath}`);
if (assignees.length > 0) {
  console.log(`  Assignees: ${assignees.join(', ')}`);
}
console.log(``);
console.log(`  Next steps:`);
console.log(`    1. Translate the empty msgstr values in ${poFilename}`);
console.log(`    2. Verify in Settings > Display > Language`);
console.log(`    3. Commit the new file alongside your changes`);
console.log(``);
