import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  entriesToTSV,
  handleDeepLTranslateRequest,
  parseAction,
  parseApiType,
  parseCreateGlossaryPayload,
  parseGlossaryEntries,
  parseGlossaryId,
  parseTranslatePayload,
} from './index';

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
  return new Request('https://functions.test/deepl-translate', init);
}

// ─── Pure unit tests ────────────────────────────────────────────────────────

describe('parseAction', () => {
  it.each([
    'translate',
    'usage',
    'createGlossary',
    'listGlossaries',
    'deleteGlossary',
    'getGlossary',
  ])('accepts valid action "%s"', (action) => {
    expect(parseAction(action)).toBe(action);
  });

  it('returns null for unknown action strings', () => {
    expect(parseAction('unknown')).toBeNull();
    expect(parseAction('Translate')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(parseAction(null)).toBeNull();
    expect(parseAction(undefined)).toBeNull();
    expect(parseAction(42)).toBeNull();
    expect(parseAction({})).toBeNull();
  });
});

describe('parseApiType', () => {
  it.each([undefined, null, ''])('defaults to "free" for %s', (value) => {
    expect(parseApiType(value)).toBe('free');
  });

  it('accepts "free"', () => {
    expect(parseApiType('free')).toBe('free');
  });

  it('accepts "pro"', () => {
    expect(parseApiType('pro')).toBe('pro');
  });

  it('returns null for unsupported string values', () => {
    expect(parseApiType('enterprise')).toBeNull();
    expect(parseApiType('FREE')).toBeNull();
  });

  it('returns null for non-string non-nullish values', () => {
    expect(parseApiType(1)).toBeNull();
    expect(parseApiType({})).toBeNull();
  });
});

describe('parseTranslatePayload', () => {
  it('returns a valid payload for minimal input', () => {
    const result = parseTranslatePayload({ text: ['Hello'], targetLang: 'DE' });
    expect(result).toMatchObject({ text: ['Hello'], targetLang: 'DE' });
    expect(result?.sourceLang).toBeUndefined();
    expect(result?.glossaryId).toBeUndefined();
  });

  it('accepts a single string as text and wraps it in an array', () => {
    const result = parseTranslatePayload({ text: 'Hello', targetLang: 'EN' });
    expect(result?.text).toEqual(['Hello']);
  });

  it('accepts optional sourceLang, formality, and glossaryId', () => {
    const result = parseTranslatePayload({
      text: ['Hello'],
      targetLang: 'DE',
      sourceLang: 'EN',
      formality: 'formal',
      glossaryId: 'abc-123',
    });
    expect(result).toMatchObject({ sourceLang: 'EN', formality: 'formal', glossaryId: 'abc-123' });
  });

  it('returns null when targetLang is missing', () => {
    expect(parseTranslatePayload({ text: ['Hello'] })).toBeNull();
  });

  it('returns null when targetLang is an invalid language code', () => {
    expect(parseTranslatePayload({ text: ['Hello'], targetLang: 'invalid' })).toBeNull();
    expect(parseTranslatePayload({ text: ['Hello'], targetLang: '12' })).toBeNull();
  });

  it('returns null for an empty texts array', () => {
    expect(parseTranslatePayload({ text: [], targetLang: 'DE' })).toBeNull();
  });

  it('returns null when more than 50 texts are provided', () => {
    const texts = Array.from({ length: 51 }, (_, i) => `text${i}`);
    expect(parseTranslatePayload({ text: texts, targetLang: 'DE' })).toBeNull();
  });

  it('omits invalid sourceLang silently', () => {
    const result = parseTranslatePayload({ text: ['Hi'], targetLang: 'DE', sourceLang: 'bad!' });
    expect(result?.sourceLang).toBeUndefined();
  });

  it('omits invalid glossaryId silently', () => {
    const result = parseTranslatePayload({
      text: ['Hi'],
      targetLang: 'DE',
      glossaryId: 'invalid id!',
    });
    expect(result?.glossaryId).toBeUndefined();
  });

  it('trims text to MAX_TEXT_LENGTH (5000) characters', () => {
    const long = 'a'.repeat(6000);
    const result = parseTranslatePayload({ text: [long], targetLang: 'DE' });
    expect(result?.text[0].length).toBe(5000);
  });
});

describe('parseGlossaryEntries', () => {
  it('returns valid entries', () => {
    const result = parseGlossaryEntries([{ source: 'hello', target: 'hallo' }]);
    expect(result).toEqual([{ source: 'hello', target: 'hallo' }]);
  });

  it('returns null for an empty array', () => {
    expect(parseGlossaryEntries([])).toBeNull();
  });

  it('returns null for non-array values', () => {
    expect(parseGlossaryEntries('not an array')).toBeNull();
    expect(parseGlossaryEntries(null)).toBeNull();
  });

  it('filters out entries missing source or target', () => {
    const result = parseGlossaryEntries([
      { source: 'hello', target: 'hallo' },
      { source: '', target: 'hallo' },
      { source: 'world', target: '' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('returns null when all entries are invalid', () => {
    expect(parseGlossaryEntries([{ source: '', target: '' }])).toBeNull();
  });
});

describe('parseCreateGlossaryPayload', () => {
  const validEntries = [{ source: 'hello', target: 'hallo' }];

  it('returns a valid payload', () => {
    const result = parseCreateGlossaryPayload({
      name: 'My Glossary',
      sourceLang: 'EN',
      targetLang: 'DE',
      entries: validEntries,
    });
    expect(result).toMatchObject({ name: 'My Glossary', sourceLang: 'EN', targetLang: 'DE' });
    expect(result?.entries).toHaveLength(1);
  });

  it('returns null when name is missing', () => {
    expect(
      parseCreateGlossaryPayload({ sourceLang: 'EN', targetLang: 'DE', entries: validEntries }),
    ).toBeNull();
  });

  it('returns null when sourceLang is invalid', () => {
    expect(
      parseCreateGlossaryPayload({
        name: 'G',
        sourceLang: 'bad',
        targetLang: 'DE',
        entries: validEntries,
      }),
    ).toBeNull();
  });

  it('returns null when targetLang is invalid', () => {
    expect(
      parseCreateGlossaryPayload({
        name: 'G',
        sourceLang: 'EN',
        targetLang: 'bad',
        entries: validEntries,
      }),
    ).toBeNull();
  });

  it('returns null when entries array is empty', () => {
    expect(
      parseCreateGlossaryPayload({ name: 'G', sourceLang: 'EN', targetLang: 'DE', entries: [] }),
    ).toBeNull();
  });

  it('returns null when entries is not an array', () => {
    expect(
      parseCreateGlossaryPayload({
        name: 'G',
        sourceLang: 'EN',
        targetLang: 'DE',
        entries: 'bad',
      }),
    ).toBeNull();
  });

  it('truncates name to MAX_GLOSSARY_NAME_LENGTH (120) characters', () => {
    const longName = 'n'.repeat(200);
    const result = parseCreateGlossaryPayload({
      name: longName,
      sourceLang: 'EN',
      targetLang: 'DE',
      entries: validEntries,
    });
    expect(result?.name.length).toBe(120);
  });
});

describe('parseGlossaryId', () => {
  it('returns a valid glossaryId', () => {
    expect(parseGlossaryId('abc-123')).toBe('abc-123');
    expect(parseGlossaryId('ABC-DEF-0123456789')).toBe('ABC-DEF-0123456789');
  });

  it('returns null for non-string values', () => {
    expect(parseGlossaryId(null)).toBeNull();
    expect(parseGlossaryId(42)).toBeNull();
    expect(parseGlossaryId(undefined)).toBeNull();
  });

  it('returns null for strings with invalid characters', () => {
    expect(parseGlossaryId('abc!@#')).toBeNull();
    expect(parseGlossaryId('abc 123')).toBeNull();
    expect(parseGlossaryId('abc/def')).toBeNull();
  });

  it('returns null for strings exceeding max length (128)', () => {
    expect(parseGlossaryId('a'.repeat(129))).toBeNull();
  });

  it('accepts a string at exactly max length (128)', () => {
    expect(parseGlossaryId('a'.repeat(128))).toBe('a'.repeat(128));
  });
});

describe('entriesToTSV', () => {
  it('converts valid entries to TSV format', () => {
    const result = entriesToTSV([
      { source: 'hello', target: 'hallo' },
      { source: 'world', target: 'welt' },
    ]);
    expect(result).toBe('hello\thallo\nworld\twelt');
  });

  it('filters entries containing tab characters', () => {
    const result = entriesToTSV([
      { source: 'hel\tlo', target: 'hallo' },
      { source: 'valid', target: 'valid' },
    ]);
    expect(result).toBe('valid\tvalid');
  });

  it('filters entries containing newline characters', () => {
    const result = entriesToTSV([
      { source: 'hel\nlo', target: 'hallo' },
      { source: 'ok', target: 'ok' },
    ]);
    expect(result).toBe('ok\tok');
  });

  it('filters entries containing carriage return characters', () => {
    const result = entriesToTSV([
      { source: 'hel\rlo', target: 'hallo' },
      { source: 'ok', target: 'ok' },
    ]);
    expect(result).toBe('ok\tok');
  });

  it('filters entries with empty source or target', () => {
    const result = entriesToTSV([
      { source: '', target: 'hallo' },
      { source: 'hello', target: '' },
      { source: 'valid', target: 'valid' },
    ]);
    expect(result).toBe('valid\tvalid');
  });

  it('returns an empty string when all entries are filtered out', () => {
    expect(entriesToTSV([{ source: '', target: '' }])).toBe('');
  });
});

// ─── Handler-level tests ─────────────────────────────────────────────────────

describe('handleDeepLTranslateRequest', () => {
  beforeEach(() => {
    installDenoEnv({ ALLOWED_ORIGINS: 'https://glossboss.test' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('responds to OPTIONS requests with CORS headers', async () => {
    const req = new Request('https://functions.test/deepl-translate', {
      method: 'OPTIONS',
      headers: { origin: 'https://glossboss.test' },
    });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://glossboss.test');
  });

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://functions.test/deepl-translate', {
      method: 'GET',
      headers: { origin: 'https://glossboss.test' },
    });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  });

  it('returns 403 for disallowed origins', async () => {
    const req = makeRequest({}, { origin: 'https://evil.com' });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'FORBIDDEN_ORIGIN' });
  });

  it('returns 415 for non-JSON content type', async () => {
    const req = new Request('https://functions.test/deepl-translate', {
      method: 'POST',
      headers: { origin: 'https://glossboss.test', 'content-type': 'text/plain' },
      body: 'hello',
    });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(415);
  });

  it('returns 400 INVALID_PAYLOAD for a non-object body', async () => {
    const arrReq = new Request('https://functions.test/deepl-translate', {
      method: 'POST',
      headers: { origin: 'https://glossboss.test', 'content-type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    });
    const res = await handleDeepLTranslateRequest(arrReq);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
  });

  it('returns 400 INVALID_ACTION for an unsupported action', async () => {
    const req = makeRequest({ action: 'unsupportedAction' });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
  });

  it('returns 400 INVALID_PAYLOAD for an invalid apiType', async () => {
    const req = makeRequest({ action: 'translate', apiType: 'enterprise' });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
  });

  it('returns 400 INVALID_PAYLOAD for a malformed userApiKey', async () => {
    const req = makeRequest({ action: 'translate', userApiKey: 'bad key!' });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
  });

  it('returns 400 MISSING_API_KEY when no API key is available', async () => {
    // ALLOWED_ORIGINS set but no DEEPL_KEY
    const req = makeRequest({ action: 'translate', text: ['Hello'], targetLang: 'DE' });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: 'MISSING_API_KEY' });
  });

  it('uses a provided userApiKey instead of the server DEEPL_KEY', async () => {
    installDenoEnv({ ALLOWED_ORIGINS: 'https://glossboss.test' }); // no DEEPL_KEY
    const mockData = { translations: [{ detected_source_language: 'EN', text: 'Hallo' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 })),
    );

    const req = makeRequest({
      action: 'translate',
      text: ['Hello'],
      targetLang: 'DE',
      userApiKey: 'user-supplied-api-key-123',
    });
    const res = await handleDeepLTranslateRequest(req);
    expect(res.status).toBe(200);
  });

  describe('translate action', () => {
    beforeEach(() => {
      installDenoEnv({
        ALLOWED_ORIGINS: 'https://glossboss.test',
        DEEPL_KEY: 'server-key-123456789',
      });
    });

    it('returns 400 INVALID_PAYLOAD for missing text/targetLang', async () => {
      const req = makeRequest({ action: 'translate' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
    });

    it('proxies a successful translate response', async () => {
      const mockData = { translations: [{ detected_source_language: 'EN', text: 'Hallo' }] };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 })),
      );

      const req = makeRequest({ action: 'translate', text: ['Hello'], targetLang: 'DE' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ translations: [{ text: 'Hallo' }] });
    });

    it('proxies a DeepL upstream error with UPSTREAM_ERROR code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('Quota exceeded', { status: 456 })),
      );

      const req = makeRequest({ action: 'translate', text: ['Hello'], targetLang: 'DE' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(456);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, code: 'UPSTREAM_ERROR' });
    });

    it('returns 500 INTERNAL_ERROR on request timeout', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));

      const req = makeRequest({ action: 'translate', text: ['Hello'], targetLang: 'DE' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'DeepL request timed out.',
      });
    });
  });

  describe('usage action', () => {
    beforeEach(() => {
      installDenoEnv({
        ALLOWED_ORIGINS: 'https://glossboss.test',
        DEEPL_KEY: 'server-key-123456789',
      });
    });

    it('maps snake_case fields to camelCase', async () => {
      const mockData = { character_count: 100, character_limit: 500000 };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 })),
      );

      const req = makeRequest({ action: 'usage' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ characterCount: 100, characterLimit: 500000 });
    });
  });

  describe('createGlossary action', () => {
    beforeEach(() => {
      installDenoEnv({
        ALLOWED_ORIGINS: 'https://glossboss.test',
        DEEPL_KEY: 'server-key-123456789',
      });
    });

    it('returns 400 INVALID_PAYLOAD for missing required fields', async () => {
      const req = makeRequest({ action: 'createGlossary' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
    });

    it('returns 400 INVALID_PAYLOAD when all entries contain control characters', async () => {
      const req = makeRequest({
        action: 'createGlossary',
        name: 'Test',
        sourceLang: 'EN',
        targetLang: 'DE',
        entries: [{ source: 'hel\tlo', target: 'hallo' }],
      });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
    });

    it('proxies a successful createGlossary response with mapped fields', async () => {
      const mockData = {
        glossary_id: 'g-abc-123',
        name: 'Test Glossary',
        source_lang: 'EN',
        target_lang: 'DE',
        entry_count: 1,
        creation_time: '2024-01-01T00:00:00Z',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockData), { status: 201 })),
      );

      const req = makeRequest({
        action: 'createGlossary',
        name: 'Test Glossary',
        sourceLang: 'EN',
        targetLang: 'DE',
        entries: [{ source: 'hello', target: 'hallo' }],
      });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        glossaryId: 'g-abc-123',
        name: 'Test Glossary',
        sourceLang: 'EN',
        targetLang: 'DE',
      });
    });
  });

  describe('listGlossaries action', () => {
    beforeEach(() => {
      installDenoEnv({
        ALLOWED_ORIGINS: 'https://glossboss.test',
        DEEPL_KEY: 'server-key-123456789',
      });
    });

    it('returns mapped glossaries with camelCase fields', async () => {
      const mockData = {
        glossaries: [
          {
            glossary_id: 'abc-123',
            name: 'My Glossary',
            source_lang: 'EN',
            target_lang: 'DE',
            entry_count: 5,
            creation_time: '2024-01-01T00:00:00Z',
          },
        ],
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 })),
      );

      const req = makeRequest({ action: 'listGlossaries' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        glossaries: [
          { glossaryId: 'abc-123', name: 'My Glossary', sourceLang: 'EN', targetLang: 'DE' },
        ],
      });
    });
  });

  describe('deleteGlossary action', () => {
    beforeEach(() => {
      installDenoEnv({
        ALLOWED_ORIGINS: 'https://glossboss.test',
        DEEPL_KEY: 'server-key-123456789',
      });
    });

    it('returns 400 INVALID_PAYLOAD for an invalid glossaryId', async () => {
      const req = makeRequest({ action: 'deleteGlossary', glossaryId: 'invalid id!' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
    });

    it('returns success for a valid glossaryId', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

      const req = makeRequest({ action: 'deleteGlossary', glossaryId: 'abc-123' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ success: true });
    });

    it('returns success even when DeepL returns 404 (already deleted)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));

      const req = makeRequest({ action: 'deleteGlossary', glossaryId: 'abc-123' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ success: true });
    });
  });

  describe('getGlossary action', () => {
    beforeEach(() => {
      installDenoEnv({
        ALLOWED_ORIGINS: 'https://glossboss.test',
        DEEPL_KEY: 'server-key-123456789',
      });
    });

    it('returns 400 INVALID_PAYLOAD when glossaryId is missing', async () => {
      const req = makeRequest({ action: 'getGlossary' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
    });

    it('proxies a successful getGlossary response with mapped fields', async () => {
      const mockData = {
        glossary_id: 'abc-123',
        name: 'Test',
        source_lang: 'EN',
        target_lang: 'DE',
        entry_count: 3,
        creation_time: '2024-01-01T00:00:00Z',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 })),
      );

      const req = makeRequest({ action: 'getGlossary', glossaryId: 'abc-123' });
      const res = await handleDeepLTranslateRequest(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ glossaryId: 'abc-123', name: 'Test', sourceLang: 'EN' });
    });
  });
});
