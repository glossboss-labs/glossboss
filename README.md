# GlossBoss

PO file editor with DeepL integration and WordPress glossary support. Built with React, Mantine, and Supabase Edge Functions.

## Features

- Upload and edit `.po` / `.pot` translation files
- Bulk translation via DeepL API (free or pro)
- WordPress glossary import with DeepL glossary sync
- Glossary enforcement and analysis on translations
- Tri-state filters (untranslated, translated, fuzzy, modified, MT, manual)
- Auto-save drafts to localStorage
- Encoding detection (UTF-8, Latin-1, etc.)
- Download edited files as UTF-8

## Tech Stack

- **Frontend:** React 18, TypeScript, Mantine UI, Zustand, Tailwind CSS v4
- **Backend:** Supabase Edge Functions (Deno)
- **Build:** Vite + SWC

## Setup

```bash
bun install
cp .env.example .env  # Add your Supabase URL and anon key
bun run dev
```

## Cloudflare Git Deployment

This repository deploys automatically to Cloudflare Pages via GitHub Actions on:

- Push to `main` (production deployment)
- Pull requests into `main` (preview deployment)

Add these GitHub repository secrets to enable deployment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (with Pages edit permissions for the `glossboss` project)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`

## Environment Variables

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_TURNSTILE_SITE_KEY=your-cloudflare-turnstile-site-key
```

`VITE_SUPABASE_ANON_KEY` supports both legacy JWT anon keys and newer `sb_publishable_*` keys.

## Edge Functions

Four Supabase Edge Functions proxy external APIs to avoid CORS and keep keys secure:

- **`deepl-translate`** — Proxies DeepL API requests (translate, glossary CRUD, usage stats). Accepts a user-provided API key or falls back to a `DEEPL_KEY` secret.
- **`wp-glossary`** — Fetches WordPress.org glossary CSV exports.
- **`wp-source`** — Fetches plugin source files and listings from WordPress SVN.
- **`feedback-issue`** — Validates Turnstile, rate limits incoming requests, and creates GitHub issues in a private repository.

### Deploy Edge Functions

```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase functions deploy deepl-translate --no-verify-jwt
bunx supabase functions deploy wp-glossary --no-verify-jwt
bunx supabase functions deploy wp-source --no-verify-jwt
bunx supabase functions deploy feedback-issue --no-verify-jwt
```

### Feedback Pipeline Setup

The feedback modal submits to `feedback-issue`, which creates issues in GitHub without exposing your repository.

Required Supabase secrets:

```bash
bunx supabase secrets set GITHUB_TOKEN=ghp_xxx
bunx supabase secrets set TURNSTILE_SECRET=your-turnstile-secret
```

Optional overrides:

```bash
bunx supabase secrets set GITHUB_OWNER=toineenzo
bunx supabase secrets set GITHUB_REPO=glossboss
```

Local-only Turnstile bypass for development:

```bash
bunx supabase secrets set ALLOW_TURNSTILE_BYPASS=true
```

In local Vite dev mode, the frontend automatically falls back to a bypass token (`dev-bypass`) when `VITE_TURNSTILE_SITE_KEY` is not set.

Set `VITE_FEEDBACK_BYPASS_TURNSTILE=true` in your local `.env` if you want to force bypass even when a site key is present.

GitHub token requirements:

- Use a fine-grained personal access token scoped to the target repository.
- Grant **Issues: Read and write** permissions.

## Project Structure

```
src/
  components/
    editor/        # EditorTable, FilterToolbar, TranslateToolbar, etc.
    ui/            # Reusable UI components
    SettingsModal  # DeepL settings, glossary management
  lib/
    deepl/         # DeepL API client and settings
    glossary/      # Glossary parsing, analysis, enforcement, DeepL sync
    po/            # PO file parser and serializer
    storage/       # Draft persistence
  pages/           # Route pages
  stores/          # Zustand editor store
supabase/
  functions/       # Edge functions (deepl-translate, wp-glossary)
```
