import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite-plus';

const SITE_URL = 'https://glossboss.ink';

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
 * Discover app language codes from PO files at build time.
 * Mirrors the runtime discovery in src/lib/app-language/discovery.ts.
 */
function discoverLanguages(): string[] {
  const localesDir = path.resolve(import.meta.dirname, 'src/lib/app-language/locales');
  return readdirSync(localesDir)
    .filter((f) => /^app\.[a-z]+\.po$/.test(f))
    .map((f) => f.match(/^app\.([a-z]+)\.po$/)?.[1])
    .filter((lang): lang is string => lang != null)
    .sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : a.localeCompare(b)));
}

/** Map a language code to an OG-style locale (e.g. "nl" → "nl_NL"). */
function toOgLocale(lang: string): string {
  try {
    const locale = new Intl.Locale(lang);
    const region = locale.maximize().region ?? lang.toUpperCase();
    return `${lang}_${region}`;
  } catch {
    return `${lang}_${lang.toUpperCase()}`;
  }
}

/**
 * Inject hreflang and og:locale tags into the built HTML.
 * Auto-discovers languages from PO files so adding a locale = adding a .po file.
 */
function seoMeta(): Plugin {
  return {
    name: 'seo-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const languages = discoverLanguages();
        const tags: string[] = [];

        // hreflang tags
        tags.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`);
        for (const lang of languages) {
          const href = lang === 'en' ? `${SITE_URL}/` : `${SITE_URL}/${lang}`;
          tags.push(`<link rel="alternate" hreflang="${lang}" href="${href}" />`);
        }

        // og:locale tags
        const defaultLang = languages.includes('en') ? 'en' : languages[0];
        tags.push(`<meta property="og:locale" content="${toOgLocale(defaultLang)}" />`);
        for (const lang of languages) {
          if (lang !== defaultLang) {
            tags.push(`<meta property="og:locale:alternate" content="${toOgLocale(lang)}" />`);
          }
        }

        return html
          .replace(
            '<!-- hreflang tags injected at build time by seoMeta() Vite plugin -->',
            tags.filter((t) => t.includes('hreflang')).join('\n    '),
          )
          .replace(
            '<!-- og:locale tags injected at build time by seoMeta() Vite plugin -->',
            tags.filter((t) => t.includes('og:locale')).join('\n    '),
          );
      },
    },
  };
}

/**
 * Generate sitemap.xml at build time from discovered languages and known public routes.
 * Adding a PO file automatically adds the language route to the sitemap.
 */
function sitemapGenerator(): Plugin {
  const publicRoutes = [
    { path: '/', changefreq: 'weekly', priority: '1.0', multilingual: true },
    { path: '/explore', changefreq: 'daily', priority: '0.8', multilingual: false },
    { path: '/editor', changefreq: 'weekly', priority: '0.7', multilingual: false },
    { path: '/roadmap', changefreq: 'weekly', priority: '0.6', multilingual: false },
    { path: '/signup', changefreq: 'monthly', priority: '0.5', multilingual: false },
    { path: '/login', changefreq: 'monthly', priority: '0.4', multilingual: false },
    { path: '/privacy', changefreq: 'monthly', priority: '0.3', multilingual: false },
    { path: '/terms', changefreq: 'monthly', priority: '0.3', multilingual: false },
    { path: '/translate', changefreq: 'monthly', priority: '0.3', multilingual: false },
    { path: '/license', changefreq: 'yearly', priority: '0.2', multilingual: false },
  ];

  return {
    name: 'sitemap-generator',
    apply: 'build',
    generateBundle() {
      const languages = discoverLanguages();
      const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ];

      for (const route of publicRoutes) {
        if (route.multilingual) {
          // Emit a <url> for each language variant with hreflang cross-references
          const variants = languages.map((lang) => ({
            lang,
            href: lang === 'en' ? `${SITE_URL}/` : `${SITE_URL}/${lang}`,
          }));

          for (const variant of variants) {
            lines.push('  <url>');
            lines.push(`    <loc>${variant.href}</loc>`);
            lines.push(`    <changefreq>${route.changefreq}</changefreq>`);
            lines.push(
              `    <priority>${variant.lang === 'en' ? route.priority : '0.9'}</priority>`,
            );
            lines.push(
              `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`,
            );
            for (const v of variants) {
              lines.push(
                `    <xhtml:link rel="alternate" hreflang="${v.lang}" href="${v.href}" />`,
              );
            }
            lines.push('  </url>');
          }
        } else {
          lines.push('  <url>');
          lines.push(`    <loc>${SITE_URL}${route.path}</loc>`);
          lines.push(`    <changefreq>${route.changefreq}</changefreq>`);
          lines.push(`    <priority>${route.priority}</priority>`);
          lines.push('  </url>');
        }
      }

      lines.push('</urlset>');
      lines.push('');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: lines.join('\n'),
      });
    },
  };
}

/**
 * Inject a <link rel="preload"> for the Geist latin font into the built HTML.
 * Breaks the critical chain: Navigation → CSS → font → render.
 */
function fontPreload(): Plugin {
  let fontFileName = '';

  return {
    name: 'font-preload',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (/geist-latin-wght-normal-.*\.woff2$/.test(name)) {
          fontFileName = name;
          break;
        }
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!fontFileName) return html;
        const tag = `<link rel="preload" href="/${fontFileName}" as="font" type="font/woff2" crossorigin>`;
        return html.replace('</head>', `  ${tag}\n  </head>`);
      },
    },
  };
}

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
  plugins: [staticPages(), fontPreload(), seoMeta(), sitemapGenerator(), tailwindcss(), react()],
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
