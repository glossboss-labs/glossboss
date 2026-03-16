# GlossBoss

This file is for **coding agents only** — it is not user-facing documentation. Do not confuse it with `README.md` or `CONTRIBUTING.md`, which are the user-facing docs.

Only keep non-obvious, repo-specific failure modes here. If an agent can infer something from the repo, CI, or scripts, leave it out.

`.github/copilot-instructions.md` is the source of truth. Keep the root instruction entrypoints minimal: `AGENTS.md` should symlink here and `CLAUDE.md` should symlink to `AGENTS.md`.

- Use Bun only: `bun` / `bunx`, never npm lockfiles or `npx`.
- Add all user-facing strings with proper PO strings.
- These instructions are guidance for coding agents. CI does not read this file directly: on `pull_request`, `.github/workflows/ci.yml` runs `bunx commitlint --from ... --to ...` and fails if any commit message in the PR is not a Conventional Commit. The current workflow does **not** validate the PR title. When reporting progress or committing manually, always use Conventional Commit headers such as `docs: clarify agent instructions commitlint expectations`.
- **CI is mandatory.** For any non-trivial change, you **must** run the full CI surface before committing — no exceptions:
  1. `bun run lint`
  2. `bun run format:check` (run `bun run format` to fix)
  3. `bun run typecheck`
  4. `bun run build`
  5. `bun run test:coverage`
  6. `bun run i18n:extract` (if any `t()` or `msgid()` calls changed — see i18n section)
     If any step fails, fix it before committing. If a step is skipped, explain why. **Do not push code that breaks CI.**
- **i18n sync is a CI gate.** After any change that adds, removes, or moves `t()` / `msgid()` calls, run `bun run i18n:extract` and commit the updated PO/POT files in the same commit. CI will reject pushes where locale files are out of date. Line-number shifts from refactoring count — if you move code containing `t()` calls, the PO files need re-extraction even if no strings changed.
- If you touch deploy paths, re-check the workflows before claiming things are safe:
  - frontend deploy: `.github/workflows/cloudflare-pages.yml`
  - edge functions: `.github/workflows/supabase-functions.yml`
- Frontend production builds require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_TURNSTILE_SITE_KEY`.
- Keep the routing contract intact: one `<BrowserRouter>` in `src/main.tsx`, route definitions in `src/App.tsx`, no `useRoutes()`, no `React.lazy()`, no dynamic route imports.

## i18n (App Interface Translations)

- Translatable strings use `t('...')` from `useTranslation()`. For strings defined at module scope (data arrays, default params) that are later passed to `t()`, wrap them with `msgid('...')` from `@/lib/app-language` — it's an identity function that marks strings for extraction.
- **After any change that touches `t()` or `msgid()` calls** — including refactors that only move lines — run `bun run i18n:extract` and stage the updated PO/POT files in the same commit. CI fails if PO/POT files are out of date. This is the most common cause of CI failures; do not skip it.
- PO files live in `src/lib/app-language/locales/`. The `app.pot` template is committed and generated — do not hand-edit it.
- English PO (`app.en.po`) auto-fills `msgstr = msgid` for new entries. Other languages get empty `msgstr` that must be translated.

## Translation Providers

The app supports three translation backends — DeepL (default), Azure Translator, and Gemini. The
active provider is stored in `localStorage` via `src/lib/translation/settings.ts`.

- **Provider-specific modules** live in `src/lib/deepl/`, `src/lib/azure/`, and `src/lib/gemini/`.
  Each has `client.ts` (edge function caller) and `settings.ts` (credential storage).
- **Provider abstraction** lives in `src/lib/translation/`. `client.ts` dispatches to the active
  provider; `types.ts` defines the shared request/response contract.
- **Edge functions** (`supabase/functions/{deepl,azure,gemini}-translate/`) proxy API calls and keep
  server-managed credentials private. Shared validation helpers live in
  `supabase/functions/_shared/validation.ts`.
- **Glossary support** differs by provider: DeepL uses server-managed glossaries (CRUD API), Gemini
  uses prompt-based glossary injection with post-generation validation, Azure has no glossary
  support.
- **Project context** is Gemini-only: `src/lib/gemini/context.ts` resolves WordPress source file
  excerpts that get included in the translation prompt.

When adding a new provider, add a module under `src/lib/<provider>/`, add the
`TranslationProviderId` union member in `types.ts`, handle it in `client.ts`, add an edge function,
and update the deploy workflow.

## Frontend Design Policy

- For any frontend design or UI generation work done by Codex or GPT-family models, load and follow the repo-local Uncodixfy skill at `.codex/skills/uncodixfy/SKILL.md`.
- Treat `.codex/skills/uncodixfy/Uncodixfy.md` as the source of truth for frontend aesthetics when generating HTML, CSS, React, Mantine, or other UI code.
- This rule applies only to Codex and GPT-family models. Do not extend it to Claude or other non-OpenAI models unless the user explicitly asks.
