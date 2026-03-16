import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, resetCache } from './index';

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
    resetCache();
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
    // Without a token, only the public repo is fetched (private repo is skipped)
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('fetches from both repos when a GitHub token is set and deduplicates by title', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      GITHUB_TOKEN: 'ghp_test_token',
    });

    const publicIssue = {
      number: 1,
      title: 'Shared feature',
      state: 'open',
      body: '## Goal\nPublic version.\n',
      labels: [{ name: 'roadmap', color: 'ededed' }],
      reactions: { '+1': 2 },
      updated_at: '2026-03-16T09:00:00.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      html_url: 'https://github.com/glossboss-labs/glossboss/issues/1',
    };

    const privateOnly = {
      number: 10,
      title: 'Private-only feature',
      state: 'open',
      body: '## Goal\nInternal roadmap item.\n',
      labels: [{ name: 'roadmap', color: 'ededed' }],
      reactions: { '+1': 0 },
      updated_at: '2026-03-16T09:00:00.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      html_url: 'https://github.com/glossboss-labs/glossboss-dev/issues/10',
    };

    const privateDuplicate = {
      number: 5,
      title: 'Shared feature', // same title as public — should be deduped
      state: 'open',
      body: '## Goal\nPrivate version.\n',
      labels: [{ name: 'roadmap', color: 'ededed' }],
      reactions: { '+1': 0 },
      updated_at: '2026-03-16T09:00:00.000Z',
      created_at: '2026-03-15T09:00:00.000Z',
      html_url: 'https://github.com/glossboss-labs/glossboss-dev/issues/5',
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/glossboss-dev/')) {
        return new Response(JSON.stringify([privateOnly, privateDuplicate]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([publicIssue]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await handleRequest(
      new Request('https://functions.test/roadmap', {
        method: 'GET',
        headers: { origin: 'https://glossboss.test' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.issues).toHaveLength(2); // public + private-only (duplicate removed)
    expect(body.issues[0]).toMatchObject({ number: 1, title: 'Shared feature' });
    expect(body.issues[1]).toMatchObject({
      number: 10,
      title: 'Private-only feature',
      url: '', // URL stripped for private repo issues
      labels: [], // Labels stripped for private repo issues
    });
  });
});
