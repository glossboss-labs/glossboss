# GlossBoss

Only keep non-obvious, repo-specific failure modes here. If an agent can infer something from the repo, CI, or scripts, leave it out.

`AGENTS.md` is the source of truth. Keep `AGENT.md`, `CLAUDE.md`, `CODEX.md`, `CURSOR.md`, `GEMINI.md`, and `.github/copilot-instructions.md` symlinked to it.

- Use Bun only: `bun` / `bunx`, never npm lockfiles or `npx`.
- AGENTS.md is guidance for coding agents. CI does not read this file directly: on `pull_request`, `.github/workflows/ci.yml` runs `bunx commitlint --from ... --to ...` and fails if any commit message in the PR is not a Conventional Commit. The current workflow does **not** validate the PR title. When reporting progress or committing manually, always use Conventional Commit headers such as `docs: clarify AGENTS commitlint expectations`.
- For any non-trivial change, do not stop until you have run the CI script surface from `.github/workflows/ci.yml`: `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run build`, `bun run test:coverage`. If any step is skipped or fails, say which one and why.
- If you touch deploy paths, re-check the workflows before claiming things are safe:
  - frontend deploy: `.github/workflows/cloudflare-pages.yml`
  - edge functions: `.github/workflows/supabase-functions.yml`
- Frontend production builds require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_TURNSTILE_SITE_KEY`.
- Keep the routing contract intact: one `<BrowserRouter>` in `src/main.tsx`, route definitions in `src/App.tsx`, no `useRoutes()`, no `React.lazy()`, no dynamic route imports.

## Frontend Design Policy

- For any frontend design or UI generation work done by Codex or GPT-family models, load and follow the repo-local Uncodixfy skill at `.codex/skills/uncodixfy/SKILL.md`.
- Treat `.codex/skills/uncodixfy/Uncodixfy.md` as the source of truth for frontend aesthetics when generating HTML, CSS, React, Mantine, or other UI code.
- This rule applies only to Codex and GPT-family models. Do not extend it to Claude or other non-OpenAI models unless the user explicitly asks.
