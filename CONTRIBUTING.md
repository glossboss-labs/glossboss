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
bun run test
bun run build
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

### Adding a new UI string

1. Add the string in code with `t('Your new string')`.
2. Add the same `msgid` to `src/lib/app-language/locales/app.en.po`.
3. Add the same `msgid` to the other `app.*.po` files. The `msgstr` can stay empty until the
   translation is ready; GlossBoss will fall back to the English `msgid`.
4. Run the test suite or at least the app-language tests. CI now checks that every discovered app
   catalog has the same keys as `app.en.po`.

### Adding a new app language

1. Add a new catalog file such as `src/lib/app-language/locales/app.de.po`.
2. Set the PO header `Language: de` (or use the matching `app.de.po` filename).
3. Add the same `msgid` entries that exist in `app.en.po`.
4. Verify the new language through the Settings → Display language selector.

This PO-first workflow is a reasonable fit for GlossBoss today because the app already parses PO
files elsewhere and the UI catalog count is still small. If the interface grows a lot, the next
step would be extracting a `.pot` template automatically, but we do not need that extra complexity
yet.

The live site also exposes a public translation guide at `/translate/` so contributors can find the
same workflow from inside the app.

## Security issues

Please do not file public issues for vulnerabilities. Follow `SECURITY.md` instead.
