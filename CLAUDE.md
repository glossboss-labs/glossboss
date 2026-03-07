# GlossBoss

Translation editor built with React 19, TypeScript, Vite 7, Mantine 8, Zustand, Supabase Edge Functions, and Bun.

## Commands

```bash
bun run dev
bun run lint
bun run format
bun run format:check
bun run typecheck
bun run test
bun run test:coverage
bun run build
```

## Repo rules

- Use Bun for package management and scripts.
- Keep routing in `src/main.tsx` + `src/App.tsx`.
- Import app code through the `@/` alias.
- Client env vars must use `import.meta.env.VITE_*`.
- Do not add dynamic imports or an extra router.

## Testing

- Vitest with jsdom + Testing Library
- Tests are colocated as `*.test.ts` / `*.test.tsx`
- Setup lives in `src/test/setup.ts`
- jsdom is the active browser-like test environment for DOM-facing tests

## Deployment notes

- Frontend deploys to Cloudflare Pages
- Edge functions deploy through Supabase
- Server-side secrets such as `ALLOWED_ORIGINS`, `TURNSTILE_SECRET`, `GITHUB_TOKEN`, and optional `DEEPL_KEY` live in Supabase, not the client `.env`

## Open source

- License: `AGPL-3.0-only`
- Public contribution guide: `CONTRIBUTING.md`
- Public security policy: `SECURITY.md`
