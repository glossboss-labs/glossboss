import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite-plus';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string };
const appVersion = packageJson.version ?? '0.0.0';

function getGitBranch() {
  if (process.env.CF_PAGES_BRANCH) return process.env.CF_PAGES_BRANCH;
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: import.meta.dirname,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

const gitBranch = getGitBranch();

/**
 * Serve static sub-directory pages (e.g. /translate/)
 * before Vite's SPA fallback rewrites them to the root index.html.
 */
function staticPages(): Plugin {
  return {
    name: 'static-pages',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (/^\/(translate)(\/)?$/.test(pathname)) {
          const dir = pathname.replace(/\/$/, '');
          const filePath = path.resolve(import.meta.dirname, `public${dir}/index.html`);
          if (existsSync(filePath)) {
            req.url = `${dir}/index.html`;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    warmup: {
      clientFiles: ['./src/main.tsx'],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router', '@supabase/supabase-js', 'lucide-react'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router'],
  },
  plugins: [staticPages(), tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
  },
  build: {
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-router')
          )
            return 'vendor';
          if (
            id.includes('node_modules/@mantine/core') ||
            id.includes('node_modules/@mantine/hooks')
          )
            return 'ui';
          if (id.includes('node_modules/motion')) return 'motion';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/lucide-react')) return 'icons';
        },
      },
    },
  },

  // Vitest configuration
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test/**'],
    },
    exclude: ['e2e/**', 'node_modules/**'],
  },

  // Oxlint configuration
  lint: {
    ignorePatterns: ['dist/**', 'coverage/**'],
  },

  // Oxfmt configuration
  fmt: {
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
    tabWidth: 2,
  },

  // Staged files (replaces lint-staged)
  staged: {
    '*.{ts,tsx}': 'vp check --fix',
    '*.{json,md,css,yml}': 'vp fmt --write',
  },
});
