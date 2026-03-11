import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'bun run build && bun run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      VITE_TURNSTILE_SITE_KEY: process.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
    },
  },
});
