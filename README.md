# GlossBoss

GlossBoss is a browser-based translation editor for gettext `.po` / `.pot` files and i18next JSON resources. It combines local draft recovery, DeepL-powered machine translation, and WordPress glossary/source tooling in a single React app.

The project is open source under `AGPL-3.0-only`.
It is maintained by Toine Rademacher and Bjorn Lammers.

## Features

- Edit gettext `.po` and `.pot` files in the browser
- Import and export i18next JSON resources
- Translate entries and batches through DeepL
- Reuse approved translations across files with local translation memory (exact and fuzzy matching, JSON/TMX import and export)
- Catch broken placeholders, mismatched tags, and inconsistencies before export with inline QA checks
- Play strings with browser TTS or ElevenLabs BYO cloud voices
- Load WordPress.org glossary data and sync it to DeepL glossaries
- Inspect WordPress plugin source references through proxied SVN lookups
- Auto-save local drafts in the browser
- Submit product feedback through a protected backend flow

## Stack

- React 19
- TypeScript
- Vite 7
- Mantine 8
- Zustand
- Supabase Edge Functions
- Cloudflare Pages
- Bun

## Local setup

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Client-side environment variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TURNSTILE_SITE_KEY=your-cloudflare-turnstile-site-key

# Local development only
# VITE_FEEDBACK_BYPASS_TURNSTILE=true
```

## Scripts

```bash
bun run dev
bun run lint
bun run format
bun run format:check
bun run typecheck
bun run test
bun run test:coverage
bun run build
bun run preview
bun run i18n:extract
bun run i18n:add-lang <code>
bun run i18n:sync-en
```

## Translating GlossBoss

GlossBoss ships with an app UI translation system backed by gettext `.po` catalogs in
`src/lib/app-language/locales/`.

- `app.en.po` is the source catalog and required fallback language for the app UI.
- Edit an existing catalog such as `app.en.po` or `app.nl.po` to improve current translations.
- Add a new `app.<language>.po` catalog when introducing another UI language; it is discovered
  automatically.
- When you add a new `t('...')` UI string in code, run `bun run i18n:extract` to update the
  `app.pot` template and merge into all `app.*.po` catalogs automatically. CI fails if PO/POT
  files are out of date.

For the full contributor workflow, see `CONTRIBUTING.md`. The deployed app also includes a
translation guide at `/translate/`.

## Translation Memory

GlossBoss stores your approved (translated, non-fuzzy) entries in a local memory bank scoped by
project and target language. When you select a row in the editor, the inspector panel suggests
matching translations from memory — exact matches appear first, then fuzzy matches scored at 75% or
above using bigram similarity.

Manage memory in **Settings → Backup**: export as JSON (lossless backup) or TMX (for other CAT
tools like memoQ, Trados, OmegaT), import `.json`/`.tmx`/`.xml` files to merge into the current
project, or clear the current project memory.

## QA Checks

QA checks run automatically as you edit and flag issues that could break output or cause
inconsistencies:

| Rule                        | Severity | What it catches                                                 |
| --------------------------- | -------- | --------------------------------------------------------------- |
| Placeholder parity          | Error    | `%s`, `%d`, `%1$s` count differs between source and translation |
| HTML tag parity             | Error    | `<b>`, `</a>`, `<br />` tags don't match                        |
| ICU variable parity         | Error    | `{count}`, `{name}` variables don't match                       |
| Glossary conflict           | Warning  | Translation doesn't use expected glossary terms                 |
| Repeated-source consistency | Warning  | Same source string translated differently in the same file      |
| Whitespace drift            | Warning  | Leading/trailing spaces or newlines differ                      |
| Punctuation drift           | Warning  | Terminal punctuation (`.` `!` `?` `…` `:` `;`) differs          |

Issues appear as badges in the signals column, as details in the inspector panel, and as a summary
modal before export. Export is never blocked — you can always export anyway after reviewing.

## Deployment model

### Frontend

The frontend is built with Vite and deployed to Cloudflare Pages.

GitHub Actions in `.github/workflows/cloudflare-pages.yml` deploy:

- `main` pushes to production
- pull requests into `main` to preview branches

Required GitHub repository secrets for the frontend build:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`

### Backend

Supabase Edge Functions proxy external services and keep server-managed secrets out of the browser.

`VITE_SUPABASE_ANON_KEY` supports both legacy JWT anon keys and newer `sb_publishable_*` keys.

Functions:

- `deepl-translate`
- `azure-translate`
- `gemini-translate`
- `tts-elevenlabs`
- `wp-glossary`
- `wp-source`
- `feedback-issue`

Deploy them with the Supabase CLI:

```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase functions deploy deepl-translate --no-verify-jwt
bunx supabase functions deploy azure-translate --no-verify-jwt
bunx supabase functions deploy gemini-translate --no-verify-jwt
bunx supabase functions deploy tts-elevenlabs --no-verify-jwt
bunx supabase functions deploy wp-glossary --no-verify-jwt
bunx supabase functions deploy wp-source --no-verify-jwt
bunx supabase functions deploy feedback-issue --no-verify-jwt
```

GitHub Actions in `.github/workflows/supabase-functions.yml` automatically deploy the Edge
Functions on pushes to `main` when files under `supabase/functions/` change. This is the path used
for merged changes landing on `main`.

Required Supabase secrets / environment variables:

- `ALLOWED_ORIGINS`
- `TURNSTILE_SECRET`
- `GITHUB_TOKEN`

Optional Supabase secrets:

- `DEEPL_KEY`
- `AZURE_TRANSLATOR_KEY`
- `AZURE_TRANSLATOR_REGION`
- `AZURE_TRANSLATOR_ENDPOINT`
- `GEMINI_API_KEY`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `ALLOW_TURNSTILE_BYPASS`

Required GitHub repository secrets for the Supabase deployment workflow:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`

Example:

```bash
bunx supabase secrets set ALLOWED_ORIGINS=https://glossboss.example,https://preview.glossboss.example
bunx supabase secrets set TURNSTILE_SECRET=your-turnstile-secret
bunx supabase secrets set GITHUB_TOKEN=your-fine-grained-token
bunx supabase secrets set DEEPL_KEY=your-server-side-deepl-key
bunx supabase secrets set AZURE_TRANSLATOR_KEY=your-server-side-azure-key
bunx supabase secrets set AZURE_TRANSLATOR_REGION=your-azure-region
bunx supabase secrets set GEMINI_API_KEY=your-server-side-gemini-key
```

## Security notes

- Edge functions reject requests from origins not listed in `ALLOWED_ORIGINS`.
- `feedback-issue` uses Cloudflare Turnstile plus best-effort in-memory rate limiting.
- Translation provider API keys (DeepL, Azure Translator, Gemini) can be stored locally in the
  browser if the user chooses to save them. For shared or untrusted machines, saved keys should be
  removed after use.
- Azure Translator endpoint URLs are validated against a known domain allowlist to prevent SSRF.
- Gemini API keys are sent via the `x-goog-api-key` header rather than URL query parameters to
  avoid accidental exposure in server logs and referrer headers.

If you find a security issue, please follow `SECURITY.md` instead of opening a public issue.

## Privacy

The app stores drafts and some settings in browser local storage. Optional feedback submissions can create GitHub issues and may include a contact email if the user provides one.

In local Vite dev mode, the frontend automatically falls back to a bypass token (`dev-bypass`) when `VITE_TURNSTILE_SITE_KEY` is not set.

Set `VITE_FEEDBACK_BYPASS_TURNSTILE=true` in your local `.env` if you want to force bypass even when a site key is present.

See `/privacy/` and `NOTICE.md`.

## Project structure

```text
src/
  components/
  lib/
  pages/
  stores/
supabase/
  functions/
public/
```

## Open source

- Maintainers: Toine Rademacher and Bjorn Lammers
- License: `LICENSE`
- Contributing guide: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`
