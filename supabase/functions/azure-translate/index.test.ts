import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAzureTranslateRequest, parseAzureTranslatePayload } from './index';

function installDenoEnv(entries: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: { get: vi.fn((key: string) => entries[key]) },
    serve: vi.fn(),
  });
}

function makeRequest(body: Record<string, unknown> | null) {
  return new Request('https://functions.test/azure-translate', {
    method: 'POST',
    headers: {
      origin: 'https://glossboss.test',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
}

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

  it('returns null for invalid target languages', () => {
    expect(parseAzureTranslatePayload({ text: ['Hello'], targetLang: '123' })).toBeNull();
  });
});

describe('handleAzureTranslateRequest', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
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
});
