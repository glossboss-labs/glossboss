import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGeminiTranslateRequest, parseGeminiPayload } from './index';

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
  return new Request('https://functions.test/gemini-translate', init);
}

// ─── Pure unit tests ────────────────────────────────────────────────────────

describe('parseGeminiPayload', () => {
  it('accepts valid minimal input', () => {
    expect(
      parseGeminiPayload({
        text: ['Hello'],
        targetLang: 'DE',
      }),
    ).toMatchObject({
      text: ['Hello'],
      targetLang: 'DE',
    });
  });

  it('accepts a single string as text and wraps it in an array', () => {
    const result = parseGeminiPayload({ text: 'Hello', targetLang: 'DE' });
    expect(result?.text).toEqual(['Hello']);
  });

  it('normalizes target language to uppercase', () => {
    const result = parseGeminiPayload({ text: ['Hi'], targetLang: 'de' });
    expect(result?.targetLang).toBe('DE');
  });

  it('normalizes source language to uppercase', () => {
    const result = parseGeminiPayload({ text: ['Hi'], targetLang: 'DE', sourceLang: 'en' });
    expect(result?.sourceLang).toBe('EN');
  });

  it('accepts optional userApiKey and modelId', () => {
    const result = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      userApiKey: 'test-key',
      modelId: 'gemini-2.5-pro',
    });
    expect(result).toMatchObject({
      userApiKey: 'test-key',
      modelId: 'gemini-2.5-pro',
    });
  });

  it('accepts optional projectSlug', () => {
    const result = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      projectSlug: 'my-plugin',
    });
    expect(result?.projectSlug).toBe('my-plugin');
  });

  it('returns null for invalid target languages', () => {
    expect(parseGeminiPayload({ text: ['Hello'], targetLang: '123' })).toBeNull();
    expect(parseGeminiPayload({ text: ['Hello'], targetLang: '' })).toBeNull();
  });

  it('returns null for an empty texts array', () => {
    expect(parseGeminiPayload({ text: [], targetLang: 'DE' })).toBeNull();
  });

  it('returns null when more than 25 texts are provided', () => {
    const texts = Array.from({ length: 26 }, (_, i) => `text${i}`);
    expect(parseGeminiPayload({ text: texts, targetLang: 'DE' })).toBeNull();
  });

  it('accepts exactly 25 texts', () => {
    const texts = Array.from({ length: 25 }, (_, i) => `text${i}`);
    expect(parseGeminiPayload({ text: texts, targetLang: 'DE' })).not.toBeNull();
  });

  it('omits invalid sourceLang silently', () => {
    const result = parseGeminiPayload({ text: ['Hi'], targetLang: 'DE', sourceLang: 'bad!' });
    expect(result?.sourceLang).toBeUndefined();
  });

  it('trims text to MAX_TEXT_LENGTH (5000) characters', () => {
    const long = 'a'.repeat(6000);
    const result = parseGeminiPayload({ text: [long], targetLang: 'DE' });
    expect(result?.text[0].length).toBe(5000);
  });

  it('truncates modelId to 80 characters', () => {
    const result = parseGeminiPayload({
      text: ['Hi'],
      targetLang: 'DE',
      modelId: 'm'.repeat(100),
    });
    expect(result?.modelId?.length).toBe(80);
  });

  it('truncates projectSlug to 100 characters', () => {
    const result = parseGeminiPayload({
      text: ['Hi'],
      targetLang: 'DE',
      projectSlug: 's'.repeat(150),
    });
    expect(result?.projectSlug?.length).toBe(100);
  });

  it('filters out non-string text entries', () => {
    const result = parseGeminiPayload({
      text: ['Hello', 42, null, 'World'],
      targetLang: 'DE',
    });
    expect(result?.text).toEqual(['Hello', 'World']);
  });

  it('accepts language codes with region suffix', () => {
    expect(parseGeminiPayload({ text: ['Hi'], targetLang: 'PT-BR' })).not.toBeNull();
    expect(parseGeminiPayload({ text: ['Hi'], targetLang: 'ZH-CN' })).not.toBeNull();
  });

  it('caps glossary entries at 32', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: Array.from({ length: 40 }, (_, index) => ({
        term: `Term ${index}`,
        translation: `Vertaling ${index}`,
      })),
    });
    expect(payload?.glossaryEntries.length).toBeLessThanOrEqual(32);
  });

  it('caps context excerpts at 3', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      contextExcerpts: Array.from({ length: 10 }, (_, index) => ({
        path: `file-${index}.php`,
        line: index + 1,
        content: 'x'.repeat(100),
      })),
    });
    expect(payload?.contextExcerpts.length).toBeLessThanOrEqual(3);
  });

  it('enforces total context character limit (9000)', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      contextExcerpts: Array.from({ length: 3 }, (_, index) => ({
        path: `file-${index}.php`,
        line: 1,
        content: 'x'.repeat(3001),
      })),
    });
    // With 3001 chars each, only ~2 should fit within 9000
    expect(payload?.contextExcerpts.length).toBeLessThanOrEqual(3);
    const totalChars = payload?.contextExcerpts.reduce((sum, e) => sum + e.content.length, 0) ?? 0;
    expect(totalChars).toBeLessThanOrEqual(9000);
  });

  it('truncates glossary entry terms and translations to 120 chars', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: [{ term: 'a'.repeat(200), translation: 'b'.repeat(200) }],
    });
    expect(payload?.glossaryEntries[0].term.length).toBe(120);
    expect(payload?.glossaryEntries[0].translation.length).toBe(120);
  });

  it('includes optional glossary entry comment', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: [{ term: 'Dashboard', translation: 'Übersicht', comment: 'admin context' }],
    });
    expect(payload?.glossaryEntries[0].comment).toBe('admin context');
  });

  it('truncates glossary comments to 240 chars', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: [{ term: 'A', translation: 'B', comment: 'c'.repeat(300) }],
    });
    expect(payload?.glossaryEntries[0].comment?.length).toBe(240);
  });

  it('filters out glossary entries missing term or translation', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: [
        { term: 'valid', translation: 'geldig' },
        { term: '', translation: 'empty term' },
        { term: 'empty translation', translation: '' },
      ],
    });
    expect(payload?.glossaryEntries).toHaveLength(1);
    expect(payload?.glossaryEntries[0].term).toBe('valid');
  });

  it('filters out context excerpts missing path or content', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      contextExcerpts: [
        { path: 'file.php', line: 1, content: 'code' },
        { path: '', line: 1, content: 'no path' },
        { path: 'file2.php', line: 1, content: '' },
      ],
    });
    expect(payload?.contextExcerpts).toHaveLength(1);
  });

  it('returns empty arrays for non-array glossaryEntries and contextExcerpts', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: 'not an array',
      contextExcerpts: 42,
    });
    expect(payload?.glossaryEntries).toEqual([]);
    expect(payload?.contextExcerpts).toEqual([]);
  });
});

// ─── Handler integration tests ──────────────────────────────────────────────

describe('handleGeminiTranslateRequest', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
  });

  it('returns 204 for OPTIONS preflight requests', async () => {
    const response = await handleGeminiTranslateRequest(makeRequest(null, { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
  });

  it('rejects non-POST methods with 405', async () => {
    const response = await handleGeminiTranslateRequest(makeRequest(null, { method: 'GET' }));
    expect(response.status).toBe(405);
  });

  it('rejects non-JSON content type with 415', async () => {
    const response = await handleGeminiTranslateRequest(
      makeRequest({ text: ['Hi'], targetLang: 'DE' }, { contentType: 'text/plain' }),
    );
    expect(response.status).toBe(415);
  });

  it('rejects disallowed origins with 403', async () => {
    const response = await handleGeminiTranslateRequest(
      makeRequest({ text: ['Hi'], targetLang: 'DE' }, { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
  });

  it('rejects missing credentials', async () => {
    const response = await handleGeminiTranslateRequest(
      makeRequest({
        text: ['Hello'],
        targetLang: 'DE',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MISSING_API_KEY',
    });
  });

  it('rejects invalid payload', async () => {
    const response = await handleGeminiTranslateRequest(
      makeRequest({
        text: [],
        targetLang: 'DE',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PAYLOAD',
    });
  });

  it('rejects non-object body', async () => {
    const req = new Request('https://functions.test/gemini-translate', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify([1, 2, 3]),
    });
    const response = await handleGeminiTranslateRequest(req);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PAYLOAD',
      message: expect.stringContaining('JSON object'),
    });
  });

  it('includes CORS headers on all responses', async () => {
    const response = await handleGeminiTranslateRequest(
      makeRequest({ text: ['Hi'], targetLang: 'DE' }),
    );
    expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('uses env API key when user key is not provided', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      GEMINI_API_KEY: 'env-key',
    });

    // Will fail at the network level but should not fail at credential validation
    const response = await handleGeminiTranslateRequest(
      makeRequest({ text: ['Hello'], targetLang: 'DE' }),
    );
    expect(response.status).not.toBe(400);
  });
});
