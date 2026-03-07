# Contributing

Thanks for helping improve GlossBoss.

## Setup

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Use Bun for all scripts and package management in this repository.

## Before opening a pull request

Run the full local check suite:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build
```

## Commit style

This repository uses Conventional Commits through Commitlint.

Examples:

- `feat: add glossary cache reset`
- `fix: harden feedback origin validation`
- `docs: refresh deployment guide`

## Tooling

- `pre-commit` runs `lint-staged`
- `commit-msg` runs `commitlint`
- CI runs lint, format check, typecheck, tests, and build

## Project expectations

- Prefer targeted, reviewable changes over broad refactors.
- Keep client-side environment variables under `VITE_*`.
- Do not commit secrets or local `.env` files.
- Add or update tests when behavior changes.

## Security issues

Please do not file public issues for vulnerabilities. Follow `SECURITY.md` instead.
