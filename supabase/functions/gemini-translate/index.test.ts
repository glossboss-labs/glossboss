import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGeminiTranslateRequest, parseGeminiPayload } from './index';

function installDenoEnv(entries: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: { get: vi.fn((key: string) => entries[key]) },
    serve: vi.fn(),
  });
}

function makeRequest(body: Record<string, unknown> | null) {
  return new Request('https://functions.test/gemini-translate', {
    method: 'POST',
    headers: {
      origin: 'https://glossboss.test',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
}

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

  it('caps glossary and context arrays', () => {
    const payload = parseGeminiPayload({
      text: ['Hello'],
      targetLang: 'DE',
      glossaryEntries: Array.from({ length: 40 }, (_, index) => ({
        term: `Term ${index}`,
        translation: `Vertaling ${index}`,
      })),
      contextExcerpts: Array.from({ length: 10 }, (_, index) => ({
        path: `file-${index}.php`,
        line: index + 1,
        content: 'x'.repeat(1200),
      })),
    });

    expect(payload?.glossaryEntries.length).toBeLessThanOrEqual(32);
    expect(payload?.contextExcerpts.length).toBeLessThanOrEqual(3);
  });
});

describe('handleGeminiTranslateRequest', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
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
});
