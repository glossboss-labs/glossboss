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
npm install
cp .env.example .env  # Add your Supabase URL and anon key
npm run dev
```

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Edge Functions

Two Supabase Edge Functions proxy external APIs to avoid CORS and keep keys secure:

- **`deepl-translate`** — Proxies DeepL API requests (translate, glossary CRUD, usage stats). Accepts a user-provided API key or falls back to a `DEEPL_KEY` secret.
- **`wp-glossary`** — Fetches WordPress.org glossary CSV exports.

### Deploy Edge Functions

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy deepl-translate --no-verify-jwt
npx supabase functions deploy wp-glossary --no-verify-jwt
```

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
