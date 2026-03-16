import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from './index';

function installDenoEnv(entries: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: {
      get: vi.fn((key: string) => entries[key]),
    },
    serve: vi.fn(),
  });
}

describe('roadmap handler', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads roadmap issues from the public repo without a GitHub token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            number: 42,
            title: 'Ship public roadmap',
            state: 'open',
            body: '## Goal\nMake the roadmap visible to everyone.\n\n- [x] Add page',
            labels: [{ name: 'roadmap', color: 'ededed' }],
            reactions: { '+1': 3 },
            updated_at: '2026-03-16T09:00:00.000Z',
            created_at: '2026-03-15T09:00:00.000Z',
            html_url: 'https://github.com/glossboss-labs/glossboss/issues/42',
          },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleRequest(
      new Request('https://functions.test/roadmap', {
        method: 'GET',
        headers: { origin: 'https://glossboss.test' },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/glossboss-labs/glossboss/issues?labels=roadmap&state=all&per_page=100&page=1',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );

    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      issues: [
        {
          number: 42,
          url: 'https://github.com/glossboss-labs/glossboss/issues/42',
        },
      ],
    });
  });
});
