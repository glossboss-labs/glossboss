# GlossBoss

Agent instructions — not user-facing docs. See `README.md` and `CONTRIBUTING.md` for those.

Only non-obvious, repo-specific constraints belong here. If you can infer it from the code, CI, or scripts, leave it out.

`AGENTS.md` symlinks here; `CLAUDE.md` symlinks to `AGENTS.md`.

## Commands

```
bun run lint
bun run format:check          # fix with: bun run format
bun run typecheck
bun run build
bun run test:coverage
bun run i18n:extract           # after any t() or msgid() changes
```

Run all six before committing any non-trivial change. If any step fails, fix it before committing. If a step is skipped, explain why. **Do not push code that breaks CI.**

## Boundaries

**Always:**

- Use `bun` / `bunx` — never `npm`, `npx`, or npm lockfiles.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.). CI validates all PR commits via commitlint. The PR title is **not** validated.
- Wrap user-facing strings with `t()` (inside hooks) or `msgid()` (module scope). Run `bun run i18n:extract` and commit PO/POT diffs in the same commit.
- `React.lazy()` for route-level code splitting in `src/App.tsx` — all `lazy()` calls at module scope (React 19 requirement). First-paint routes (Landing, Login, Signup) stay eagerly imported.
- One `<BrowserRouter>` in `src/main.tsx`, `<Routes>` + `<Route>` in `src/App.tsx`.
- Import from `react-router` — not `react-router-dom` (the package does not exist in this repo).

**Never:**

- `useRoutes()` or dynamic route imports (except `React.lazy()` at module scope in `App.tsx`).
- Hand-edit `app.pot` — it is generated.
- Commit `.env` files or secrets.

**Check first:**

- If you touch deploy paths, re-read the workflows before claiming things are safe:
  - Frontend: `.github/workflows/cloudflare-pages.yml`
  - Edge functions: `.github/workflows/supabase-functions.yml`
  - Database migrations: `.github/workflows/supabase-database.yml`

## i18n

The most common CI failure. Run `bun run i18n:extract` whenever you touch files containing `t()` or `msgid()` calls — even if you only moved lines.

- `t('...')` from `useTranslation()` for strings inside React components.
- `msgid('...')` from `@/lib/app-language` for strings at module scope (identity function that marks for extraction).
- PO files live in `src/lib/app-language/locales/`. English auto-fills `msgstr = msgid`; other languages get empty `msgstr`.
- Line-number shifts count — refactoring code that contains `t()` calls requires re-extraction even if no strings changed.

## Architecture traps

- Frontend production builds require env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`.
- Translation providers (DeepL, Azure, Gemini) dispatch through `src/lib/translation/client.ts`. Each has a module under `src/lib/<provider>/` and an edge function under `supabase/functions/<provider>-translate/`. Adding a provider: add the module, extend the `TranslationProviderId` union in `types.ts`, handle in `client.ts`, add edge function, update deploy workflow.
- Glossary support differs: DeepL = server-managed CRUD, Gemini = prompt-injected with validation, Azure = none.
- Edge functions proxy external services — secrets stay server-side. Shared validation lives in `supabase/functions/_shared/validation.ts`.

## Frontend design (Codex / GPT-family only)

For Codex or GPT-family models: load `.codex/skills/uncodixfy/SKILL.md` before generating UI code. Does not apply to Claude or other non-OpenAI models unless the user explicitly asks.
