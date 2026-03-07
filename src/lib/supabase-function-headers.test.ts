import { describe, expect, it } from 'vitest';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';

describe('buildSupabaseFunctionHeaders', () => {
  it('returns base headers when key is missing', () => {
    expect(buildSupabaseFunctionHeaders(undefined)).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('uses apikey only for publishable keys', () => {
    const publishableKey = 'local-publishable-key';

    expect(buildSupabaseFunctionHeaders(publishableKey)).toEqual({
      'Content-Type': 'application/json',
      apikey: publishableKey,
    });
  });

  it('adds bearer authorization for JWT-like keys', () => {
    const jwtLike = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';

    expect(buildSupabaseFunctionHeaders(jwtLike)).toEqual({
      'Content-Type': 'application/json',
      apikey: jwtLike,
      Authorization: `Bearer ${jwtLike}`,
    });
  });
});
