/**
 * ⚠️ VITE CONFIG — DO NOT MODIFY unless you know what you're doing.
 * This config includes custom plugins for the sandbox environment.
 * Modifying it can break the dev server, HMR, and Tailwind.
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { existsSync, constants as fsConstants } from 'fs';
import { access, readFile } from 'fs/promises';
import path from 'path';
import pino from 'pino';
import { createLogger, defineConfig, PluginOption, type HotPayload, type Plugin, type Update, type ViteDevServer } from 'vite';

// Check if we're in the monorepo (local dev) vs standalone (sandbox)
const localDevToolsPath = path.resolve(__dirname, '../../libs/sandbox-dev-scripts-injector/src');
const isLocalDev = existsSync(localDevToolsPath);

const defaultLogger = createLogger();

// Create Pino logger that writes to both console and file
const logDestination = pino.multistream([{ stream: process.stdout }, { stream: pino.destination('/tmp/dev.log') }]);
const logger = pino(
  {
    level: 'info',
    timestamp: () => `,"timestamp":${Date.now()}`,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  logDestination,
);

// Capture errors only
console.error = (...args: unknown[]) => {
  const message = args
    .map((arg) => {
      if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
  logger.error({ message });
};

// Vite plugin to inject sandbox dev tools in dev mode only
function injectDevToolsPlugin(): Plugin {
  return {
    name: 'inject-dev-tools',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module' },
              children: `import '@elementor/sandbox-dev-scripts-injector';`,
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
    apply: 'serve', // Only in dev mode
  };
}

// Vite plugin to inject Tailwind CDN in dev mode
function tailwindDevPlugin(): PluginOption {
  const themeCssPath = path.resolve(__dirname, './src/theme.css');
  let themeCssCache: string | null = null;

  async function readThemeCss(): Promise<string> {
    if (themeCssCache !== null) {
      return themeCssCache;
    }
    try {
      await access(themeCssPath, fsConstants.F_OK);
      themeCssCache = await readFile(themeCssPath, 'utf-8');
      logger.info({ event: 'tailwind-theme-read', path: themeCssPath });
    } catch {
      themeCssCache = '';
      logger.warn({ event: 'tailwind-theme-missing', path: themeCssPath });
    }
    return themeCssCache;
  }

  return [
    {
      name: 'tailwind-cdn',
      configureServer(server: ViteDevServer) {
        server.watcher.add(themeCssPath);
        const invalidate = (filePath: string) => {
          if (path.resolve(filePath) !== themeCssPath) {
            return;
          }
          themeCssCache = null;
          server.ws.send({ type: 'full-reload', path: '*' });
          logger.info({ event: 'tailwind-theme-invalidated', path: themeCssPath });
        };
        server.watcher.on('change', invalidate);
        server.watcher.on('add', invalidate);
        server.watcher.on('unlink', invalidate);
      },
      transformIndexHtml: {
        order: 'pre',
        async handler(html) {
          return {
            html,
            tags: [
              {
                tag: 'script',
                attrs: {
                  src: 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.18/dist/index.global.min.js',
                  integrity:
                    'sha384-WrpyCFNrMmN/IC7KmMNiXxIouXEFpoDIuJ2P+ys++uYEzegAW2MSl+X6Unsahaij',
                  crossorigin: 'anonymous',
                },
                injectTo: 'head-prepend',
              },
              {
                tag: 'style',
                attrs: { type: 'text/tailwindcss' },
                children: await readThemeCss(),
                injectTo: 'head-prepend',
              },
            ],
          };
        },
      },
      apply: 'serve', // Only in dev mode.
    },
  ];
}

// Vite plugin to log build lifecycle events
function structuredLoggerPlugin() {
  return {
    name: 'structured-logger',
    configureServer(server: ViteDevServer) {
      const originalSend = server.ws.send.bind(server.ws);
      server.ws.send = (payload: HotPayload) => {
        if (payload.type === 'update') {
          payload.updates.forEach((u: Update) => logger.info({ event: 'hmr-update', path: u.path }));
        } else if (payload.type === 'full-reload') {
          logger.info({ event: 'page-reload', path: payload.path });
        }
        return originalSend(payload);
      };
    },
    buildEnd(error?: Error) {
      if (error) {
        logger.error({ event: 'build-error', message: error.message, stack: error.stack });
      } else {
        logger.info({ event: 'build-success' });
      }
    },
  };
}

function viteCustomErrorOverlay(): Plugin {
  return {
    name: 'custom-error-overlay',
    apply: (config) => config.mode === 'development',
    transform(code, id, opts = {}) {
      if (opts?.ssr) {
        return;
      }
      if (!id.includes('vite/dist/client/client.mjs')) {
        return;
      }
      const errorOverlayHTML =
        'class ErrorOverlay extends HTMLElement {close() {this.parentNode?.removeChild(this);}}';
      return code.replace('class ErrorOverlay', `${errorOverlayHTML} \n class OldErrorOverlay`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    customLogger: {
      ...defaultLogger,
      info(msg: string) {
        logger.info({ message: msg });
      },
    },
    server: {
      host: '0.0.0.0', // Bind to all interfaces (required for sandbox proxy access)
      port: 5173,
      strictPort: true, // Fail instead of silently switching ports
      warmup: {
        clientFiles: ['./src/main.tsx'], // Pre-transform entry on startup
      },
      watch: {
        ignored: ['**/.sc/**', '**/vite-ignore/**'],
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router', '@supabase/supabase-js', 'lucide-react'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Local dev: resolve to workspace library
        // Sandbox: uses node_modules (npm package)
        ...(isLocalDev && {
          '@elementor/sandbox-dev-scripts-injector': localDevToolsPath,
        }),
      },
      dedupe: ['react', 'react-dom', 'react-router'],
    },
    plugins: [injectDevToolsPlugin(), tailwindcss(), tailwindDevPlugin(), structuredLoggerPlugin(), react(), viteCustomErrorOverlay()],
    build: { assetsInlineLimit: 100000 },
  };
});
