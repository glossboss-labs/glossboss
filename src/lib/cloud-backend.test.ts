import { afterEach, describe, expect, it } from 'vitest';
import {
  getSupabaseAnonKey,
  getSupabaseFunctionBaseUrl,
  isCloudBackendConfigured,
} from './cloud-backend';

const testEnv = import.meta.env as Record<string, string | undefined>;
const originalSupabaseUrl = testEnv.VITE_SUPABASE_URL;
const originalSupabaseAnonKey = testEnv.VITE_SUPABASE_ANON_KEY;

describe('cloud backend helpers', () => {
  afterEach(() => {
    testEnv.VITE_SUPABASE_URL = originalSupabaseUrl;
    testEnv.VITE_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
  });

  it('reports configured when a Supabase URL is present', () => {
    testEnv.VITE_SUPABASE_URL = 'https://example.supabase.co';

    expect(isCloudBackendConfigured()).toBe(true);
  });

  it('reports missing when the Supabase URL is blank', () => {
    testEnv.VITE_SUPABASE_URL = '   ';

    expect(isCloudBackendConfigured()).toBe(false);
  });

  it('builds a normalized function base URL', () => {
    testEnv.VITE_SUPABASE_URL = ' https://example.supabase.co/ ';

    expect(getSupabaseFunctionBaseUrl('Translation')).toBe(
      'https://example.supabase.co/functions/v1',
    );
  });

  it('throws a user-facing message when the backend is unavailable', () => {
    testEnv.VITE_SUPABASE_URL = '';

    expect(() => getSupabaseFunctionBaseUrl('Feedback')).toThrow(
      'Feedback is unavailable in this deployment.',
    );
  });

  it('returns an undefined anon key when blank', () => {
    testEnv.VITE_SUPABASE_ANON_KEY = '   ';

    expect(getSupabaseAnonKey()).toBeUndefined();
  });

  it('returns the trimmed anon key when configured', () => {
    testEnv.VITE_SUPABASE_ANON_KEY = ' test-key ';

    expect(getSupabaseAnonKey()).toBe('test-key');
  });
});
