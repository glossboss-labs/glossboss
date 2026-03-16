<p align="center">
  <picture>
    <source srcset="public/glossboss-combined-light.svg" media="(prefers-color-scheme: dark)" />
    <img src="public/glossboss-combined-dark.svg" alt="GlossBoss" height="48" />
  </picture>
  <br />
  A browser-based translation editor for gettext <code>.po</code> / <code>.pot</code> files and i18next JSON resources.
</p>

<p align="center">
  <a href="https://github.com/glossboss-labs/glossboss/actions/workflows/ci.yml"><img src="https://github.com/glossboss-labs/glossboss/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/glossboss-labs/glossboss/actions/workflows/cloudflare-pages.yml"><img src="https://github.com/glossboss-labs/glossboss/actions/workflows/cloudflare-pages.yml/badge.svg" alt="Deploy" /></a>
  <a href="https://github.com/glossboss-labs/glossboss/blob/main/LICENSE"><img src="https://img.shields.io/github/license/glossboss-labs/glossboss" alt="License" /></a>
</p>

---

## Features

- **Edit** gettext `.po` / `.pot` files and i18next JSON resources in the browser
- **Translate** entries and batches through [DeepL](https://www.deepl.com/), [Azure Translator](https://azure.microsoft.com/en-us/products/ai-services/ai-translator), or [Gemini](https://ai.google.dev/) — switch providers at any time
- **Repo sync** — open files directly from GitHub or GitLab, commit changes, and create pull / merge requests without leaving the editor
- **Translation memory** — reuse approved translations across files with exact and fuzzy matching, import / export as JSON or TMX
- **QA checks** — catch broken placeholders, mismatched HTML tags, ICU variable drift, glossary conflicts, and more before export
- **WordPress tooling** — load WordPress.org glossary data, sync it to DeepL glossaries, and inspect plugin source references through proxied SVN lookups
- **Review workflow** — assign per-entry statuses (draft, in-review, approved, needs-changes), add threaded comments with resolution tracking, lock approved translations from further edits, and view change history
- **Text-to-speech** — play strings with browser TTS or ElevenLabs BYO cloud voices
- **Auto-save** local drafts in the browser, including review state

## Getting started

Requires [Bun](https://bun.sh/) v1.3+.

```bash
bun install --frozen-lockfile
cp .env.example .env.local
bun run supabase:start
# then fill in VITE_SUPABASE_ANON_KEY from `bunx supabase status -o env`
bun run dev
```

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_TURNSTILE_SITE_KEY=your-cloudflare-turnstile-site-key
```

Environment templates:

- `.env.local` for `supabase start` local development
- `.env.staging` for the hosted staging project, using [.env.staging.example](.env.staging.example)
- `.env.production` for the hosted production project, using [.env.production.example](.env.production.example)

Real environment files stay untracked. Only the example templates are committed.

Run `bun run` to see all available scripts.

## Deployment

### Frontend — Cloudflare Pages

`.github/workflows/cloudflare-pages.yml` deploys the Vite build to the `glossboss-dev` Cloudflare Pages project: `main` updates the protected dev environment, pull requests get preview branches.

**Required GitHub repository secrets:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`

### Database migrations — staging before production

`.github/workflows/supabase-database.yml` validates migrations locally on every PR/push that touches `supabase/migrations/**`, pushes them to staging on `main`, and supports an explicit production promotion via manual dispatch after staging succeeds.

**Required GitHub repository secrets:**

| Secret                            | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`           | Supabase management API token                     |
| `SUPABASE_STAGING_PROJECT_REF`    | Hosted staging project reference                  |
| `SUPABASE_STAGING_DB_PASSWORD`    | Hosted staging Postgres password                  |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Hosted production project reference for promotion |
| `SUPABASE_PRODUCTION_DB_PASSWORD` | Hosted production Postgres password for promotion |

`SUPABASE_PROJECT_REF` is still accepted as a staging fallback for older edge-function deploy setups.

### Backend — Supabase Edge Functions

Edge functions proxy external services and keep server-managed secrets out of the browser. `.github/workflows/supabase-functions.yml` deploys to staging on `main` and can promote the same function set to production via manual dispatch.

<details>
<summary><strong>Supabase secrets reference</strong></summary>

**Required:**

| Secret                    | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `ALLOWED_ORIGINS`         | Comma-separated list of allowed CORS origins             |
| `TURNSTILE_SECRET`        | Cloudflare Turnstile server secret                       |
| `GITHUB_TOKEN`            | Fine-grained PAT for feedback issue creation             |
| `SETTINGS_ENCRYPTION_KEY` | Server-side secret for AES-256-GCM credential encryption |

**Optional (translation providers):**

| Secret                      | Purpose                   |
| --------------------------- | ------------------------- |
| `DEEPL_KEY`                 | Server-side DeepL API key |
| `AZURE_TRANSLATOR_KEY`      | Azure Translator key      |
| `AZURE_TRANSLATOR_REGION`   | Azure region              |
| `AZURE_TRANSLATOR_ENDPOINT` | Azure endpoint URL        |
| `GEMINI_API_KEY`            | Google Gemini API key     |

**Optional (billing):**

| Secret                 | Purpose                              |
| ---------------------- | ------------------------------------ |
| `POLAR_ACCESS_TOKEN`   | Polar.sh API token for checkout flow |
| `POLAR_WEBHOOK_SECRET` | Polar webhook signature verification |

**Optional (feedback):**

| Secret                   | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `FEEDBACK_GITHUB_OWNER`  | Override GitHub org/user for feedback issues |
| `FEEDBACK_GITHUB_REPO`   | Override GitHub repo for feedback issues     |
| `ROADMAP_GITHUB_OWNER`   | Override GitHub org/user for roadmap issues  |
| `ROADMAP_GITHUB_REPO`    | Override GitHub repo for roadmap issues      |
| `ALLOW_TURNSTILE_BYPASS` | Allow dev bypass tokens                      |

**GitHub repository secrets for CI deploy:**

| Secret                            | Purpose                       |
| --------------------------------- | ----------------------------- |
| `SUPABASE_ACCESS_TOKEN`           | Supabase management API token |
| `SUPABASE_STAGING_PROJECT_REF`    | Staging project reference     |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Production project reference  |

</details>

## Security and privacy

- Edge functions reject requests from origins not listed in `ALLOWED_ORIGINS`.
- Repo sync tokens default to session-only storage and are never sent to GlossBoss servers — they go directly to the GitHub / GitLab API from the browser.
- Translation provider API keys can optionally be stored in the browser. On shared machines, saved keys should be removed after use.
- When cloud settings sync is enabled with credential sync, API keys are encrypted with AES-256-GCM using a per-user key derived server-side. The encryption key never lives in the database.
- Azure Translator endpoint URLs are validated against a domain allowlist to prevent SSRF.

If you find a security issue, please follow `SECURITY.md` instead of opening a public issue. See also `/privacy/` and `NOTICE.md`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[AGPL-3.0-only](LICENSE) — maintained by Toine Rademacher and Bjorn Lammers.
