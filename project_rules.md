# Project Rules — Read Before Writing Any Code

## Routing
- `<BrowserRouter>` is in `main.tsx`. NEVER add another router anywhere.
- Define routes in `App.tsx` using `<Routes>` + `<Route>`. NEVER use `useRoutes()`.
- Import from `react-router`. The package `react-router-dom` does NOT exist.

## Imports
- Path alias: always use `@/` for src imports (e.g., `import X from '@/pages/X'`).
- STATIC IMPORTS ONLY. NEVER use `React.lazy()` or dynamic `import()`.
- Before importing a package, verify it's listed in `package.json`.

## CSS / Tailwind v4
- Theme is defined in `src/theme.css` using `@theme { }`. There is no `tailwind.config.js`.
- To add theme values, add CSS variables inside the existing `@theme { }` block.
- Do NOT nest `@media`, `@layer`, `@import`, or other at-rules inside `@theme { }`.
- Do NOT use `rgba()`, `rgb()`, `hsl()`, or `hsla()` inside `@theme { }` — use hex colors instead (e.g., `rgba(0,0,0,0.5)` → `#00000080`).
- Do NOT add `@import 'tailwindcss'` in `theme.css` — it is already imported in `index.css`.
- Keep all `{` and `}` braces balanced when editing CSS — every opening brace needs a closing brace.
- Prefer `flex flex-col gap-*` over `space-y-*` and `flex flex-row gap-*` over `space-x-*`.

## React Components
- ALL hooks (`useState`, `useEffect`, `useRef`, etc.) must be at the TOP of the component, BEFORE any conditional returns.
- Render components as JSX: `<Component />`. NEVER call as functions: `Component()`.
- Initialize array state with empty array: `useState<T[]>([])`, not `useState<T[]>()`.
- Guard array operations: `(items ?? []).map(...)`.

## Context Providers
- Add providers in `src/providers.tsx`, which wraps `<BrowserRouter>` in `main.tsx`.
- Any component using `useX()` must be a CHILD of `<XProvider>` in the tree.
- NEVER place a provider inside a route — it must wrap the router.

## Exports
- Page components: `export default function PageName()` (default export).
- Utilities, hooks, constants: named exports (`export const`, `export function`).
- Types and interfaces: named exports (`export type`, `export interface`).
- Before importing `{ X }`, verify the target file uses a named export. If it's `export default`, import without braces.

## Data Fetching (Supabase)
- The Supabase client (`@/integrations/supabase/client`) can be `null`. Always check: `if (!supabase) return;`
- Always handle loading and error states before rendering data.
- Use `data ?? []` when assigning fetched arrays to state.

## Environment Variables
- Client-side: `import.meta.env.VITE_*`. NEVER use `process.env` in browser code.
- All env vars must have the `VITE_` prefix to be exposed to the client.

## Sandbox Limitations
- `navigator.clipboard` is BLOCKED. Do NOT use `navigator.clipboard.writeText()` or `navigator.clipboard.readText()`. Instead, use a textarea-based fallback:
  ```tsx
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  ```
- Dynamic imports / code splitting are not supported. Use static imports only.
- Do NOT modify `vite.config.ts` — it contains sandbox-specific plugins.

## File Naming
- Pages: `src/pages/PageName.tsx` — component name should match filename.
- Components: `src/components/ComponentName.tsx`.
- Hooks: `src/hooks/use-hook-name.ts`.
