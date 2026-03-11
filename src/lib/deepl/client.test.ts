import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeepLClient } from './client';
import { clearDeepLSettings, saveDeepLSettings } from './settings';

const testEnv = import.meta.env as Record<string, string | undefined>;
const originalSupabaseUrl = testEnv.VITE_SUPABASE_URL;
const originalSupabaseAnonKey = testEnv.VITE_SUPABASE_ANON_KEY;

function createStorageMock(): Storage {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map<string, string>();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

describe('createDeepLClient', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorageMock(),
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: createStorageMock(),
      configurable: true,
    });
    localStorage.clear();
    sessionStorage.clear();
    clearDeepLSettings();
    testEnv.VITE_SUPABASE_URL = 'https://example.supabase.co';
    testEnv.VITE_SUPABASE_ANON_KEY = 'publishable-test-key';
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          translations: [{ text: 'Hallo', detectedSourceLanguage: 'EN' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ) as typeof fetch;
  });

  afterEach(() => {
    clearDeepLSettings();
    testEnv.VITE_SUPABASE_URL = originalSupabaseUrl;
    testEnv.VITE_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    vi.restoreAllMocks();
  });

  it('applies the saved formality when the request omits it', async () => {
    saveDeepLSettings({ formality: 'prefer_more' });
    const client = createDeepLClient();

    await client.translate({
      text: 'Hello world',
      targetLang: 'NL',
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body).toMatchObject({
      action: 'translate',
      text: ['Hello world'],
      targetLang: 'NL',
      tagHandling: 'xml',
      formality: 'prefer_more',
    });
  });

  it('preserves an explicit request formality over the saved preference', async () => {
    saveDeepLSettings({ formality: 'prefer_more' });
    const client = createDeepLClient();

    await client.translate({
      text: 'Hello world',
      targetLang: 'NL',
      formality: 'less',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));

    expect(body.formality).toBe('less');
  });
});
