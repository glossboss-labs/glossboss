# AGENTS.md

## Package Manager Policy

- Always use `bun` for dependency management and scripts.
- Use `bunx` instead of `npx`.
- Do not add or use npm-specific files (for example `package-lock.json`, `.npmrc`, or `npm-shrinkwrap.json`).

## Frontend Design Policy

- For any frontend design or UI generation work done by Codex or GPT-family models, load and follow the repo-local Uncodixfy skill at `.codex/skills/uncodixfy/SKILL.md`.
- Treat `.codex/skills/uncodixfy/Uncodixfy.md` as the source of truth for frontend aesthetics when generating HTML, CSS, React, Mantine, or other UI code.
- This rule applies only to Codex and GPT-family models. Do not extend it to Claude or other non-OpenAI models unless the user explicitly asks.
