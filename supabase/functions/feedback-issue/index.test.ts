import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleFeedbackIssueRequest, parseRequestBody } from './index';

function installDenoEnv(entries: Record<string, string | undefined>) {
  vi.stubGlobal('Deno', {
    env: {
      get: vi.fn((key: string) => entries[key]),
    },
    serve: vi.fn(),
  });
}

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'bug',
    title: 'Broken import flow',
    details: {
      whatHappened: 'Importing a PO file shows an empty table.',
      stepsToReproduce: 'Upload a file and wait for parsing to complete.',
      expectedBehavior: 'Entries should appear in the editor.',
    },
    allowFollowUp: true,
    context: {
      appVersion: '1.2.0',
      pageUrl: 'https://glossboss.test/',
      filename: 'messages.po',
      userAgent: 'Vitest',
      submittedAt: '2026-03-07T12:00:00.000Z',
    },
    turnstileToken: 'token',
    website: '',
    ...overrides,
  };
}

describe('feedback issue handler', () => {
  beforeEach(() => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects disallowed origins before processing feedback', async () => {
    const request = new Request('https://functions.test/feedback-issue', {
      method: 'POST',
      headers: {
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildPayload()),
    });

    const response = await handleFeedbackIssueRequest(request);
    expect(response.status).toBe(403);
  });

  it('returns misconfiguration when origin allowlist is empty', async () => {
    installDenoEnv({ ALLOWED_ORIGINS: '' });

    const request = new Request('https://functions.test/feedback-issue', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildPayload()),
    });

    const response = await handleFeedbackIssueRequest(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, code: 'SERVER_MISCONFIGURED' });
  });

  it('rejects non-JSON requests', async () => {
    const request = new Request('https://functions.test/feedback-issue', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'text/plain',
      },
      body: 'hello',
    });

    const response = await handleFeedbackIssueRequest(request);
    expect(response.status).toBe(415);
  });

  it('returns INVALID_PAYLOAD for malformed JSON body', async () => {
    const request = new Request('https://functions.test/feedback-issue', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'application/json',
      },
      body: '{not valid json',
    });

    const response = await handleFeedbackIssueRequest(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Request body is not valid JSON.',
    });
  });

  it('requires a page URL that matches allowed origins', () => {
    const payload = buildPayload();
    const result = parseRequestBody({
      ...payload,
      context: {
        ...payload.context,
        pageUrl: 'https://example.com/',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'INVALID_PAYLOAD',
    });
  });

  it('verifies Turnstile tokens without forwarding remoteip', async () => {
    installDenoEnv({
      ALLOWED_ORIGINS: 'https://glossboss.test',
      TURNSTILE_SECRET: ' secret-value ',
      KANEO_API_URL: 'https://kaneo.example/api',
      KANEO_API_KEY: 'kaneo-token',
      KANEO_CF_ACCESS_CLIENT_ID: 'cf-client-id',
      KANEO_CF_ACCESS_CLIENT_SECRET: 'cf-client-secret',
      KANEO_WORKSPACE_ID: 'workspace-123',
      KANEO_FEEDBACK_PROJECT_ID: 'project-123',
      KANEO_FEEDBACK_PROJECT_SLUG: 'INBOX',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'task-1', number: 42 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://functions.test/feedback-issue', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify(buildPayload()),
    });

    const response = await handleFeedbackIssueRequest(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, referenceId: 'INBOX-42' });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://kaneo.example/api/task/project-123');

    const turnstileInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(String(turnstileInit.body));
    expect(params.get('secret')).toBe('secret-value');
    expect(params.get('response')).toBe('token');
    expect(params.has('remoteip')).toBe(false);

    const taskInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(taskInit.headers).toMatchObject({
      Authorization: 'Bearer kaneo-token',
      'CF-Access-Client-Id': 'cf-client-id',
      'CF-Access-Client-Secret': 'cf-client-secret',
    });
    expect(JSON.parse(String(taskInit.body))).toMatchObject({
      title: 'Broken import flow',
      priority: 'no-priority',
      status: 'inbox',
    });
  });
});
