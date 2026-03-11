# Contributing

Thanks for helping improve GlossBoss.

## Setup

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Use Bun for all scripts and package management in this repository.

## Before opening a pull request

Run the full local check suite:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run test:coverage
```

## Commit style

This repository uses Conventional Commits through Commitlint.

Examples:

- `feat: add glossary cache reset`
- `fix: harden feedback origin validation`
- `docs: refresh deployment guide`

## Tooling

- `pre-commit` runs `lint-staged`
- `commit-msg` runs `commitlint`
- CI runs lint, format check, typecheck, tests, and build

## Project expectations

- Prefer targeted, reviewable changes over broad refactors.
- Keep client-side environment variables under `VITE_*`.
- Do not commit secrets or local `.env` files.
- Add or update tests when behavior changes.
- If you touch translation memory or QA, read the Translation Memory and QA Checks sections in `README.md` first. TM logic lives in `src/lib/translation-memory/`, QA logic in `src/lib/qa/`. To add a new QA rule, update `types.ts` (rule identifier and label) and `analyzer.ts` (check implementation).

## Translating the app

GlossBoss uses gettext `.po` files for its own interface text.

### Existing app languages

The bundled UI catalogs currently live in:

- `src/lib/app-language/locales/app.en.po`
- `src/lib/app-language/locales/app.nl.po`

`app.en.po` is the source catalog and required fallback language. Each `msgid` is the source string
used in the React app, and each `msgstr` contains the localized text for that language.

### Updating an existing translation

1. Edit the relevant `.po` file under `src/lib/app-language/locales/`.
2. Keep placeholders such as `{count}` or `{format}` intact in the translated `msgstr`.
3. Run the local checks before opening a pull request:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test:coverage
bun run build
```

4. In local dev, open Settings → Display and switch the interface language to verify the updated
   strings in the UI.

### Renaming an English source string

To change the wording of an existing English string, edit `msgstr` in `app.en.po` (leave `msgid` as
the old text) and run:

```bash
bun run i18n:sync-en
```

This renames the string in all `t()`/`msgid()` source calls, updates `msgid` in every PO file, and
re-runs the extractor. CI fails if pending renames are not applied.

### Adding a new UI string

1. Use `t('Your new string')` in React components (inside hooks) or `msgid('Your new string')` for
   strings defined at module scope (data arrays, default parameters) that are later passed to `t()`.
2. Run `bun run i18n:extract` — this generates `app.pot` and merges into all `app.*.po` files
   automatically. English entries get `msgstr = msgid`; other languages get empty `msgstr`.
3. Commit the updated PO/POT files alongside your code changes.
4. CI will fail if you forget to run the extractor.

Important:

- Run `bun run i18n:extract` after changing user-facing strings.
- Also run it after moving code around existing `t()` / `msgid()` calls if the touched files are in
  the app catalog. The extractor updates source reference comments in `app.pot` and `app.*.po`,
  and CI checks those files with `git diff --exit-code`.

### Adding a new app language

```bash
bun run i18n:add-lang de
```

This creates `app.de.po`, populates it from the POT template, updates the i18n-issues workflow, and
prints a local edit link. Then:

1. Translate the empty `msgstr` values in the new file.
2. Verify the new language through Settings → Display → Language.
3. Commit the new file alongside your changes.

The live site also exposes a public translation guide at `/translate/` so contributors can find the
same workflow from inside the app.

## Security issues

Please do not file public issues for vulnerabilities. Follow `SECURITY.md` instead.
