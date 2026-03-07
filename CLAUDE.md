# Glossboss

PO file translation editor built with React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Mantine v8.
State management: Zustand. Package manager: Bun. Database: Supabase.

## Commands

```bash
bun run dev          # Start dev server (port 5173)
bun run build        # Typecheck + build for production
bun run lint         # ESLint
bun run format       # Prettier — write
bun run format:check # Prettier — check only
bun run typecheck    # tsc --noEmit
bun run test         # Vitest (single run)
bun run test:watch   # Vitest (watch mode)
bun run test:coverage # Vitest with coverage
```

## Code Style

Enforced by Prettier (`.prettierrc.json`) and ESLint (`eslint.config.js`).

- Semicolons, single quotes, trailing commas, 100 char line width, 2-space indent.
- ESLint uses `eslint-config-prettier` to avoid conflicts.

## Commit Convention

Enforced by commitlint (conventional commits):

```
type(scope?): description   # max 100 chars
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Git Hooks (Husky)

- **pre-commit**: lint-staged runs ESLint + Prettier on staged files.
- **commit-msg**: commitlint validates commit message format.

## CI (GitHub Actions)

On push/PR to `main`: install → lint → format:check → typecheck → build → test.

## Architecture Rules

### Routing

- `<BrowserRouter>` is in `main.tsx`. Never add another router.
- Define routes in `App.tsx` using `<Routes>` + `<Route>`. Never use `useRoutes()`.
- Import from `react-router` (not `react-router-dom`).

### Imports

- Always use `@/` path alias for src imports.
- Static imports only. Never use `React.lazy()` or dynamic `import()`.
- Verify packages exist in `package.json` before importing.

### CSS / Tailwind v4

- Theme defined in `src/theme.css` using `@theme { }`. No `tailwind.config.js`.
- Use hex colors inside `@theme { }`, not `rgba()`/`hsl()`.
- `@import 'tailwindcss'` is in `index.css` only.
- Prefer `flex flex-col gap-*` over `space-y-*`.

### React Components

- All hooks at the top of the component, before any conditional returns.
- Render as JSX `<Component />`, never call as `Component()`.
- Initialize array state: `useState<T[]>([])`.
- Guard arrays: `(items ?? []).map(...)`.

### Context Providers

- Add providers in `src/providers.tsx`, which wraps `<BrowserRouter>` in `main.tsx`.
- Never place a provider inside a route.

### Exports

- Pages: default export. Utilities/hooks/types: named exports.
- Verify export style before importing.

### Data Fetching (Supabase)

- Supabase client can be `null`. Always check: `if (!supabase) return;`.
- Handle loading and error states. Use `data ?? []` for arrays.

### Environment Variables

- Client-side: `import.meta.env.VITE_*`. Never use `process.env`.

### File Naming

- Pages: `src/pages/PageName.tsx`. Components: `src/components/ComponentName.tsx`. Hooks: `src/hooks/use-hook-name.ts`.

## Testing

- Test framework: Vitest with jsdom + @testing-library/react.
- Test files: colocated as `*.test.ts(x)` next to the source file.
- Globals enabled (`describe`, `it`, `expect` available without import from vitest).
- Setup file: `src/test/setup.ts` (loads jest-dom matchers).
