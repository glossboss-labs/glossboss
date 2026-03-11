import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAzureTranslateRequest, parseAzureTranslatePayload } from './index';

function installDenoEnv(entries: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: { get: vi.fn((key: string) => entries[key]) },
    serve: vi.fn(),
  });
}

function makeRequest(
  body: Record<string, unknown> | null,
  overrides: { method?: string; origin?: string; contentType?: string } = {},
) {
  const method = overrides.method ?? 'POST';
  const init: RequestInit = {
    method,
    headers: {
      origin: overrides.origin ?? 'https://glossboss.test',
      'content-type': overrides.contentType ?? 'application/json',
    },
  };
  if (body !== null) {
    init.body = JSON.stringify(body);
  }
  return new Request('https://functions.test/azure-translate', init);
}

// ─── Pure unit tests ────────────────────────────────────────────────────────

describe('parseAzureTranslatePayload', () => {
  it('accepts valid minimal input', () => {
    expect(
      parseAzureTranslatePayload({
        text: ['Hello'],
        targetLang: 'de',
      }),
    ).toMatchObject({
      text: ['Hello'],
      targetLang: 'de',
    });
  });

  it('accepts a single string as text and wraps it in an array', () => {
    const result = parseAzureTranslatePayload({ text: 'Hello', targetLang: 'de' });
    expect(result?.text).toEqual(['Hello']);
  });

  it('accepts optional sourceLang, userApiKey, userRegion, and endpoint', () => {
    const result = parseAzureTranslatePayload({
      text: ['Hello'],
      targetLang: 'de',
      sourceLang: 'en',
      userApiKey: 'test-key',
      userRegion: 'westeurope',
      endpoint: 'https://custom.cognitive.microsofttranslator.com',
    });
    expect(result).toMatchObject({
      sourceLang: 'en',
      userApiKey: 'test-key',
      userRegion: 'westeurope',
      endpoint: 'https://custom.cognitive.microsofttranslator.com',
    });
  });

  it('returns null for invalid target languages', () => {
    expect(parseAzureTranslatePayload({ text: ['Hello'], targetLang: '123' })).toBeNull();
    expect(parseAzureTranslatePayload({ text: ['Hello'], targetLang: '' })).toBeNull();
  });

  it('returns null for an empty texts array', () => {
    expect(parseAzureTranslatePayload({ text: [], targetLang: 'de' })).toBeNull();
  });

  it('returns null when more than 50 texts are provided', () => {
    const texts = Array.from({ length: 51 }, (_, i) => `text${i}`);
    expect(parseAzureTranslatePayload({ text: texts, targetLang: 'de' })).toBeNull();
  });

  it('accepts exactly 50 texts', () => {
    const texts = Array.from({ length: 50 }, (_, i) => `text${i}`);
    expect(parseAzureTranslatePayload({ text: texts, targetLang: 'de' })).not.toBeNull();
  });

  it('omits invalid sourceLang silently', () => {
    const result = parseAzureTranslatePayload({
      text: ['Hi'],
      targetLang: 'de',
      sourceLang: 'bad!',
    });
    expect(result?.sourceLang).toBeUndefined();
  });

  it('trims text to MAX_TEXT_LENGTH (5000) characters', () => {
    const long = 'a'.repeat(6000);
    const result = parseAzureTranslatePayload({ text: [long], targetLang: 'de' });
    expect(result?.text[0].length).toBe(5000);
  });

  it('trims region and endpoint to max lengths', () => {
    const result = parseAzureTranslatePayload({
      text: ['Hi'],
      targetLang: 'de',
      userRegion: 'r'.repeat(100),
      endpoint: 'e'.repeat(200),
    });
    expect(result?.userRegion?.length).toBe(64);
    expect(result?.endpoint?.length).toBe(160);
  });

  it('rejects arrays containing non-string text entries', () => {
    expect(
      parseAzureTranslatePayload({
        text: ['Hello', 42, null, 'World'],
        targetLang: 'de',
      }),
    ).toBeNull();
  });

  it('accepts language codes with region suffix', () => {
    expect(parseAzureTranslatePayload({ text: ['Hi'], targetLang: 'pt-br' })).not.toBeNull();
    expect(parseAzureTranslatePayload({ text: ['Hi'], targetLang: 'zh-cn' })).not.toBeNull();
  });
});

// ─── Handler integration tests ──────────────────────────────────────────────

describe('handleAzureTranslateRequest', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
  });

  it('returns 204 for OPTIONS preflight requests', async () => {
    const response = await handleAzureTranslateRequest(makeRequest(null, { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
  });

  it('rejects non-POST methods with 405', async () => {
    const response = await handleAzureTranslateRequest(makeRequest(null, { method: 'GET' }));
    expect(response.status).toBe(405);
  });

  it('rejects non-JSON content type with 415', async () => {
    const response = await handleAzureTranslateRequest(
      makeRequest({ text: ['Hi'], targetLang: 'de' }, { contentType: 'text/plain' }),
    );
    expect(response.status).toBe(415);
  });

  it('rejects disallowed origins with 403', async () => {
    const response = await handleAzureTranslateRequest(
      makeRequest({ text: ['Hi'], targetLang: 'de' }, { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
  });

  it('rejects missing credentials', async () => {
    const response = await handleAzureTranslateRequest(
      makeRequest({
        text: ['Hello'],
        targetLang: 'de',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MISSING_API_KEY',
    });
  });

  it('rejects invalid payload', async () => {
    const response = await handleAzureTranslateRequest(
      makeRequest({
        text: [],
        targetLang: 'de',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PAYLOAD',
    });
  });

  it('rejects non-Azure endpoint URLs', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      AZURE_TRANSLATOR_KEY: 'test-key',
      AZURE_TRANSLATOR_REGION: 'westeurope',
    });

    const response = await handleAzureTranslateRequest(
      makeRequest({
        text: ['Hello'],
        targetLang: 'de',
        endpoint: 'https://evil.example.com',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PAYLOAD',
      message: expect.stringContaining('Azure Translator domain'),
    });
  });

  it('rejects HTTP (non-HTTPS) Azure endpoints', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      AZURE_TRANSLATOR_KEY: 'test-key',
      AZURE_TRANSLATOR_REGION: 'westeurope',
    });

    const response = await handleAzureTranslateRequest(
      makeRequest({
        text: ['Hello'],
        targetLang: 'de',
        endpoint: 'http://api.cognitive.microsofttranslator.com',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('accepts known Azure endpoint domains', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      AZURE_TRANSLATOR_KEY: 'test-key',
      AZURE_TRANSLATOR_REGION: 'westeurope',
    });

    // This will try to fetch and fail, but it should pass the endpoint validation
    const response = await handleAzureTranslateRequest(
      makeRequest({
        text: ['Hello'],
        targetLang: 'de',
        endpoint: 'https://api.cognitive.microsofttranslator.com',
      }),
    );

    // Should not be 400 with INVALID_PAYLOAD about endpoint
    const body = await response.json();
    expect(body.code).not.toBe('INVALID_PAYLOAD');
  });

  it('uses user-provided API key over env variable', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      AZURE_TRANSLATOR_KEY: 'env-key',
      AZURE_TRANSLATOR_REGION: 'westeurope',
    });

    // Both env and user key exist — should not reject with MISSING_API_KEY
    const response = await handleAzureTranslateRequest(
      makeRequest({
        text: ['Hello'],
        targetLang: 'de',
        userApiKey: 'user-key',
        userRegion: 'eastus',
      }),
    );

    expect(response.status).not.toBe(400);
  });

  it('includes CORS headers on all responses', async () => {
    const response = await handleAzureTranslateRequest(
      makeRequest({ text: ['Hi'], targetLang: 'de' }),
    );
    expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});
