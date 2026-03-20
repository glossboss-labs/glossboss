import { describe, expect, it } from 'vitest';
import { readPersistedAuthSession } from './auth-store';

describe('readPersistedAuthSession', () => {
  it('hydrates a persisted Supabase session synchronously', () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 1_900_000_000,
          user: { id: 'user-1', email: 'hello@example.com' },
        }),
    };

    const result = readPersistedAuthSession(storage, 'sb-test-auth-token');

    expect(result.session?.access_token).toBe('access-token');
    expect(result.user?.id).toBe('user-1');
  });

  it('falls back cleanly when no persisted session is available', () => {
    const result = readPersistedAuthSession({ getItem: () => null }, 'sb-test-auth-token');

    expect(result).toEqual({ session: null, user: null });
  });
});
