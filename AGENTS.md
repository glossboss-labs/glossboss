# GlossBoss Agent Guide

This file is for non-obvious, repo-specific agent guidance only.

If a rule is already obvious from code, tests, scripts, or CI, do not duplicate it here.
If an agent keeps making the same mistake, prefer fixing the repo or tooling first. Only add a rule here when the better fix is not practical.

`AGENTS.md` is the single source of truth. Keep these as symlinks to it:

- `AGENT.md`
- `CLAUDE.md`
- `CODEX.md`
- `CURSOR.md`
- `GEMINI.md`
- `.github/copilot-instructions.md`

## Finish Criteria

- Do not stop at "the edit is done". For any non-trivial code, config, or workflow change, reproduce CI locally before handoff.
- CI parity in this repo means running the same script surface used by `.github/workflows/ci.yml`:
  1. `bun run lint`
  2. `bun run format:check`
  3. `bun run typecheck`
  4. `bun run build`
  5. `bun run test:coverage`
- If you cannot run one of those commands, say exactly which command was skipped and why.
- If a check fails, either fix it or hand off with the failure called out explicitly.
- Prefer repo scripts over ad-hoc equivalents. CI runs the package scripts, so local verification should too.
- If dependencies change, use `bun install --frozen-lockfile` and keep `bun.lock` changes intentional.

## Repo-Specific Constraints

- Use Bun only. Use `bun` and `bunx`. Do not add npm lockfiles or npm-only config.
- Frontend production builds require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_TURNSTILE_SITE_KEY`. Cloudflare Pages deploys fail without them.
- Server secrets such as `ALLOWED_ORIGINS`, `TURNSTILE_SECRET`, `GITHUB_TOKEN`, and optional `DEEPL_KEY` belong in Supabase function secrets, not the frontend env.
- Changes under `supabase/functions/**` affect the Supabase deployment workflow. Re-check `.github/workflows/supabase-functions.yml` before concluding deploy-related work is safe.
- The routing contract is easy to break: keep the single `<BrowserRouter>` in `src/main.tsx`, keep route definitions in `src/App.tsx`, and do not add `useRoutes()`, `React.lazy()`, or dynamic route imports.
- DOM-facing tests rely on the shims in `src/test/setup.ts`. Update tests with behavior changes instead of treating test fixes as optional cleanup.

## Where To Look First

- `README.md` for setup, env, and deployment context
- `.github/workflows/ci.yml` for the required verification bar
- `.github/workflows/cloudflare-pages.yml` for frontend deploy requirements
- `.github/workflows/supabase-functions.yml` for edge-function deploy scope
- `src/main.tsx` and `src/App.tsx` for routing constraints
- `src/test/setup.ts` for test-environment assumptions

## When To Edit This File

- Add rules only after an agent repeatedly fails in the same way.
- Prefer short directives about failure modes, verification, and non-inferable constraints.
- Keep this file short. Stale instructions are worse than missing instructions.
