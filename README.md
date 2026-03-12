<p align="center">
  <strong>GlossBoss</strong><br />
  A browser-based translation editor for gettext <code>.po</code> / <code>.pot</code> files and i18next JSON resources.
</p>

<p align="center">
  <a href="https://github.com/lammersbjorn/glossboss/actions/workflows/ci.yml"><img src="https://github.com/lammersbjorn/glossboss/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/lammersbjorn/glossboss/actions/workflows/cloudflare-pages.yml"><img src="https://github.com/lammersbjorn/glossboss/actions/workflows/cloudflare-pages.yml/badge.svg" alt="Deploy" /></a>
  <a href="https://github.com/lammersbjorn/glossboss/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lammersbjorn/glossboss" alt="License" /></a>
</p>

---

## Features

- **Edit** gettext `.po` / `.pot` files and i18next JSON resources in the browser
- **Translate** entries and batches through [DeepL](https://www.deepl.com/), [Azure Translator](https://azure.microsoft.com/en-us/products/ai-services/ai-translator), or [Gemini](https://ai.google.dev/) — switch providers at any time
- **Repo sync** — open files directly from GitHub or GitLab, commit changes, and create pull / merge requests without leaving the editor
- **Translation memory** — reuse approved translations across files with exact and fuzzy matching (75 %+ bigram similarity), import / export as JSON or TMX
- **QA checks** — catch broken placeholders, mismatched HTML tags, ICU variable drift, glossary conflicts, and more before export
- **WordPress tooling** — load WordPress.org glossary data, sync it to DeepL glossaries, and inspect plugin source references through proxied SVN lookups
- **Text-to-speech** — play strings with browser TTS or ElevenLabs BYO cloud voices
- **Auto-save** local drafts in the browser
- **Feedback** — submit product feedback through a Turnstile-protected backend flow

## Tech stack

| Layer     | Technology                                                                     |
| --------- | ------------------------------------------------------------------------------ |
| Framework | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build     | [Vite 7](https://vite.dev/) + [Bun](https://bun.sh/)                           |
| UI        | [Mantine 8](https://mantine.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| State     | [Zustand](https://zustand.docs.pmnd.rs/)                                       |
| Backend   | [Supabase Edge Functions](https://supabase.com/docs/guides/functions)          |
| Hosting   | [Cloudflare Pages](https://pages.cloudflare.com/)                              |
| Testing   | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)          |

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) v1.3+
- A Supabase project (for edge function proxying)
- A Cloudflare Turnstile site key (for feedback protection)

### Setup

```bash
bun install --frozen-lockfile
cp .env.example .env          # then fill in the values below
bun run dev
```

#### Environment variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TURNSTILE_SITE_KEY=your-cloudflare-turnstile-site-key

# Local development only — falls back to bypass automatically when omitted
# VITE_FEEDBACK_BYPASS_TURNSTILE=true
```

## Scripts

| Command                      | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `bun run dev`                | Start Vite dev server                            |
| `bun run build`              | Type-check and production build                  |
| `bun run preview`            | Preview production build locally                 |
| `bun run lint`               | ESLint                                           |
| `bun run format`             | Prettier (write)                                 |
| `bun run format:check`       | Prettier (check only)                            |
| `bun run typecheck`          | TypeScript `--noEmit`                            |
| `bun run test`               | Vitest (single run)                              |
| `bun run test:watch`         | Vitest (watch mode)                              |
| `bun run test:coverage`      | Vitest with coverage                             |
| `bun run test:e2e`           | Playwright end-to-end tests                      |
| `bun run i18n:extract`       | Regenerate `app.pot` and merge into `app.*.po`   |
| `bun run i18n:add-lang <cc>` | Scaffold a new app language catalog              |
| `bun run i18n:sync-en`       | Rename an English source string across all files |

## Architecture

```text
src/
  components/          UI components (editor, settings, repo-sync, feedback)
  lib/
    app-language/      i18n system — PO catalogs, extraction, language switching
    deepl/             DeepL provider — client, settings, glossary CRUD
    azure/             Azure Translator provider — client, settings
    gemini/            Gemini provider — client, settings, project context
    translation/       Provider abstraction — dispatcher, shared types
    translation-memory/  TM store — exact + fuzzy matching, JSON/TMX import/export
    qa/                QA engine — analyzer, rule definitions
    repo-sync/         Repo sync types and provider dispatcher
    github/            GitHub REST API client and token storage
    gitlab/            GitLab REST API client and token storage
  pages/               Route-level page components
  stores/              Zustand stores (editor, settings, repo-sync, TM)
supabase/
  functions/
    deepl-translate/   DeepL proxy
    azure-translate/   Azure Translator proxy
    gemini-translate/  Gemini proxy
    tts-elevenlabs/    ElevenLabs TTS proxy
    wp-glossary/       WordPress.org glossary proxy
    wp-source/         WordPress SVN source proxy
    feedback-issue/    Feedback → GitHub Issues
    _shared/           Validation helpers shared across functions
public/                Static assets
```

### Translation providers

The app supports three translation backends — **DeepL** (default), **Azure Translator**, and **Gemini**. The active provider is stored in `localStorage` and can be switched at any time in Settings.

Each provider has a client-side module (`src/lib/<provider>/`) with `client.ts` (edge function caller) and `settings.ts` (credential storage), plus a matching Supabase Edge Function that proxies API calls and keeps server-managed secrets private.

Glossary support varies by provider: DeepL uses server-managed glossaries (CRUD API), Gemini uses prompt-based glossary injection with post-generation validation, and Azure has no glossary support.

### Repo sync

Repo sync lets users open locale files directly from **GitHub** or **GitLab** repositories and push translations back — with optional branch creation and pull / merge request support.

- **Provider abstraction** — `src/lib/repo-sync/` defines the shared `RepoClient` interface and a `createRepoClient()` factory that dispatches to the GitHub or GitLab implementation.
- **Provider clients** — `src/lib/github/` and `src/lib/gitlab/` call their respective REST APIs directly from the browser (no edge function needed — both support CORS with PAT auth).
- **Token storage** — follows the same session/localStorage pattern as translation providers; tokens default to session-only and can optionally be persisted.
- **State** — `src/stores/repo-sync-store.ts` is a Zustand store persisted to `localStorage`, tracking the active connection, sync settings (commit prefix, branch template, PR defaults), and operation status. Sensitive content (file baselines) is stripped before persistence.
- **UI** — `src/components/repo-sync/` contains a tabbed modal (Connect → Browse → Push), a recursive file tree browser with locale-file highlighting, and a commit panel supporting conventional commits, branch creation, and PR / MR creation.

### Translation memory

Approved (translated, non-fuzzy) entries are stored locally per project and target language. The inspector panel shows matching translations — exact matches first, then fuzzy matches scored at 75 %+ using bigram similarity. Memory can be exported as JSON or TMX and imported from `.json` / `.tmx` / `.xml` files.

### QA checks

QA checks run automatically as you edit:

| Rule                        | Severity | What it catches                                                 |
| --------------------------- | -------- | --------------------------------------------------------------- |
| Placeholder parity          | Error    | `%s`, `%d`, `%1$s` count differs between source and translation |
| HTML tag parity             | Error    | `<b>`, `</a>`, `<br />` tags don't match                        |
| ICU variable parity         | Error    | `{count}`, `{name}` variables don't match                       |
| Glossary conflict           | Warning  | Translation doesn't use expected glossary terms                 |
| Repeated-source consistency | Warning  | Same source string translated differently in the same file      |
| Whitespace drift            | Warning  | Leading/trailing spaces or newlines differ                      |
| Punctuation drift           | Warning  | Terminal punctuation (`.` `!` `?` `…` `:` `;`) differs          |

Issues appear as badges in the signals column, as details in the inspector panel, and as a summary modal before export. Export is never blocked.

## Deployment

### Frontend — Cloudflare Pages

GitHub Actions in `.github/workflows/cloudflare-pages.yml` deploy the Vite build:

- `main` → production
- Pull requests into `main` → preview branches

**Required GitHub repository secrets:**

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`

### Backend — Supabase Edge Functions

Edge functions proxy external services and keep server-managed secrets out of the browser. GitHub Actions in `.github/workflows/supabase-functions.yml` automatically deploy when files under `supabase/functions/` change on `main`.

**Functions:** `deepl-translate`, `azure-translate`, `gemini-translate`, `tts-elevenlabs`, `wp-glossary`, `wp-source`, `feedback-issue`

**Manual deploy:**

```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase functions deploy deepl-translate --no-verify-jwt
# repeat for each function
```

<details>
<summary><strong>Supabase secrets reference</strong></summary>

**Required:**

| Secret             | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `ALLOWED_ORIGINS`  | Comma-separated list of allowed CORS origins |
| `TURNSTILE_SECRET` | Cloudflare Turnstile server secret           |
| `GITHUB_TOKEN`     | Fine-grained PAT for feedback issue creation |

**Optional (enable translation providers):**

| Secret                      | Purpose                   |
| --------------------------- | ------------------------- |
| `DEEPL_KEY`                 | Server-side DeepL API key |
| `AZURE_TRANSLATOR_KEY`      | Azure Translator key      |
| `AZURE_TRANSLATOR_REGION`   | Azure region              |
| `AZURE_TRANSLATOR_ENDPOINT` | Azure endpoint URL        |
| `GEMINI_API_KEY`            | Google Gemini API key     |

**Optional (feedback):**

| Secret                   | Purpose                           |
| ------------------------ | --------------------------------- |
| `GITHUB_OWNER`           | Target GitHub org/user for issues |
| `GITHUB_REPO`            | Target GitHub repo for issues     |
| `ALLOW_TURNSTILE_BYPASS` | Allow dev bypass tokens           |

**GitHub repository secrets for CI deploy:**

| Secret                  | Purpose                       |
| ----------------------- | ----------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Supabase management API token |
| `SUPABASE_PROJECT_REF`  | Supabase project reference    |

</details>

## Translating GlossBoss

GlossBoss uses gettext `.po` files for its own interface text. Catalogs live in `src/lib/app-language/locales/`.

- `app.en.po` is the source catalog and required fallback.
- Run `bun run i18n:extract` after adding or changing `t()` / `msgid()` calls — CI fails if PO/POT files are out of date.
- Run `bun run i18n:add-lang <code>` to scaffold a new language.
- Run `bun run i18n:sync-en` to rename an English source string across all files.

See `CONTRIBUTING.md` for the full contributor workflow. The deployed app also includes a translation guide at `/translate/`.

## Security and privacy

- Edge functions reject requests from origins not listed in `ALLOWED_ORIGINS`.
- `feedback-issue` uses Cloudflare Turnstile plus best-effort in-memory rate limiting.
- Translation provider API keys can optionally be stored in the browser. On shared machines, saved keys should be removed after use.
- Repo sync tokens default to session-only storage and are never sent to GlossBoss servers — they go directly to the GitHub / GitLab API from the browser.
- Azure Translator endpoint URLs are validated against a domain allowlist to prevent SSRF.
- Gemini API keys are sent via the `x-goog-api-key` header rather than URL query parameters.
- Drafts and settings are stored in browser local storage. Optional feedback submissions can create GitHub issues and may include a contact email.

If you find a security issue, please follow `SECURITY.md` instead of opening a public issue.

See also `/privacy/` and `NOTICE.md`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, commit conventions, i18n workflow, and project expectations.

## License

[AGPL-3.0-only](LICENSE) — maintained by Toine Rademacher and Bjorn Lammers.
