# GlossBoss

Only keep non-obvious, repo-specific failure modes here. If an agent can infer something from the repo, CI, or scripts, leave it out.

`AGENTS.md` is the source of truth. Keep `AGENT.md`, `CLAUDE.md`, `CODEX.md`, `CURSOR.md`, `GEMINI.md`, and `.github/copilot-instructions.md` symlinked to it.

- Use Bun only: `bun` / `bunx`, never npm lockfiles or `npx`.
- For any non-trivial change, do not stop until you have run the local equivalent of `.github/workflows/ci.yml`: `bun install --frozen-lockfile`, `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run build`, `bun run test:coverage`. If any step is skipped or fails, say which one and why.
- If you touch deploy paths, re-check the workflows before claiming things are safe:
  - frontend deploy: `.github/workflows/cloudflare-pages.yml`
  - edge functions: `.github/workflows/supabase-functions.yml`
- Frontend production builds require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_TURNSTILE_SITE_KEY`.
- Keep the routing contract intact: one `<BrowserRouter>` in `src/main.tsx`, route definitions in `src/App.tsx`, no `useRoutes()`, no `React.lazy()`, no dynamic route imports.
