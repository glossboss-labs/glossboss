import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTtsElevenLabsRequest, parseAction } from './index';

function installDenoEnv(entries: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: {
      get: vi.fn((key: string) => entries[key]),
    },
    serve: vi.fn(),
  });
}

function makeRequest(
  body: Record<string, unknown> | null,
  overrides: { origin?: string; contentType?: string } = {},
) {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      origin: overrides.origin ?? 'https://glossboss.test',
      'content-type': overrides.contentType ?? 'application/json',
    },
  };

  if (body !== null) {
    init.body = JSON.stringify(body);
  }

  return new Request('https://functions.test/tts-elevenlabs', init);
}

describe('tts-elevenlabs handler', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['usage', 'listVoices', 'speak'])('accepts valid action %s', (action) => {
    expect(parseAction(action)).toBe(action);
  });

  it('rejects disallowed origins', async () => {
    const response = await handleTtsElevenLabsRequest(
      makeRequest(
        { action: 'usage', apiKey: 'not-a-real-elevenlabs-key' },
        { origin: 'https://example.com' },
      ),
    );

    expect(response.status).toBe(403);
  });

  it('rejects missing api keys', async () => {
    const response = await handleTtsElevenLabsRequest(makeRequest({ action: 'usage' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: 'MISSING_API_KEY',
    });
  });

  it('returns normalized usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            character_count: 2500,
            character_limit: 10000,
            tier: 'free',
            status: 'active',
            next_character_count_reset_unix: 1736000000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await handleTtsElevenLabsRequest(
      makeRequest({ action: 'usage', apiKey: 'not-a-real-elevenlabs-key' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      characterCount: 2500,
      characterLimit: 10000,
      tier: 'free',
      status: 'active',
      nextResetUnix: 1736000000,
    });
  });

  it('rejects oversized or empty speech requests', async () => {
    const emptyResponse = await handleTtsElevenLabsRequest(
      makeRequest({
        action: 'speak',
        apiKey: 'not-a-real-elevenlabs-key',
        voiceId: 'voice_1234',
        text: '',
      }),
    );
    expect(emptyResponse.status).toBe(400);

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleTtsElevenLabsRequest(
      makeRequest({
        action: 'speak',
        apiKey: 'not-a-real-elevenlabs-key',
        voiceId: 'voice_1234',
        text: 'a'.repeat(800),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/text-to-speech/voice_1234'),
      expect.any(Object),
    );
    const [, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(String(init?.body));
    expect(payload.text).toBe('a'.repeat(500));
  });

  it('does not leak api keys in upstream errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('bad key not-a-real-elevenlabs-key', {
          status: 401,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    const response = await handleTtsElevenLabsRequest(
      makeRequest({ action: 'usage', apiKey: 'not-a-real-elevenlabs-key' }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.message).not.toContain('not-a-real-elevenlabs-key');
  });
});
