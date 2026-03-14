import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createSupabaseJsClientMock, invokeMock } = vi.hoisted(() => ({
  createSupabaseJsClientMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', async () => {
  const actual =
    await vi.importActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');

  return {
    ...actual,
    createClient: createSupabaseJsClientMock,
  };
});

import {
  createClient,
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
  invokeSupabaseFunction,
  isCloudBackendConfigured,
  resetSupabaseClient,
} from './client';

const testEnv = import.meta.env as Record<string, string | undefined>;
const originalSupabaseUrl = testEnv.VITE_SUPABASE_URL;
const originalSupabaseAnonKey = testEnv.VITE_SUPABASE_ANON_KEY;

describe('supabase client helpers', () => {
  beforeEach(() => {
    testEnv.VITE_SUPABASE_URL = 'https://example.supabase.co/';
    testEnv.VITE_SUPABASE_ANON_KEY = ' publishable-test-key ';
    resetSupabaseClient();
    invokeMock.mockReset();
    createSupabaseJsClientMock.mockReset();
    createSupabaseJsClientMock.mockImplementation(() => ({
      functions: {
        invoke: invokeMock,
      },
    }));
  });

  afterEach(() => {
    testEnv.VITE_SUPABASE_URL = originalSupabaseUrl;
    testEnv.VITE_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    resetSupabaseClient();
    vi.clearAllMocks();
  });

  it('normalizes the Supabase URL and anon key', () => {
    expect(getSupabaseUrl()).toBe('https://example.supabase.co');
    expect(getSupabaseAnonKey()).toBe('publishable-test-key');
  });

  it('requires both Supabase URL and anon key for cloud features', () => {
    testEnv.VITE_SUPABASE_ANON_KEY = '   ';

    expect(isCloudBackendConfigured()).toBe(false);
    expect(() => createClient('Feedback')).toThrow('Feedback is unavailable in this deployment.');
  });

  it('reuses the singleton client until the environment changes', () => {
    const firstClient = getSupabaseClient('Translation');
    const secondClient = getSupabaseClient('Translation');

    expect(firstClient).toBe(secondClient);
    expect(createSupabaseJsClientMock).toHaveBeenCalledTimes(1);

    testEnv.VITE_SUPABASE_URL = 'https://another-project.supabase.co';
    const thirdClient = getSupabaseClient('Translation');

    expect(thirdClient).not.toBe(firstClient);
    expect(createSupabaseJsClientMock).toHaveBeenCalledTimes(2);
  });

  it('invokes edge functions through the shared Supabase client', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(
      invokeSupabaseFunction<{ ok: boolean }>('feedback-issue', {
        featureLabel: 'Feedback',
        body: { title: 'Example' },
      }),
    ).resolves.toEqual({ data: { ok: true }, error: null });

    expect(invokeMock).toHaveBeenCalledWith('feedback-issue', {
      body: { title: 'Example' },
    });
  });
});
