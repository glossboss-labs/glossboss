import {
  buildIssueBody,
  buildIssueTitle,
  getLabelsForType,
  type BugFeedbackDetails,
  type FeatureFeedbackDetails,
  type FeedbackContext,
  type FeedbackType,
} from '../_shared/feedback-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_PER_IP = 6;
const RATE_LIMIT_GLOBAL = 150;

const ipRequestLog = new Map<string, number[]>();
const globalRequestLog: number[] = [];

interface FeedbackRequest {
  type: FeedbackType;
  title: string;
  details: BugFeedbackDetails | FeatureFeedbackDetails;
  contactEmail?: string;
  allowFollowUp?: boolean;
  context: FeedbackContext;
  turnstileToken: string;
  website: string;
}

interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number = 200,
  extra: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extra,
      'Content-Type': 'application/json',
    },
  });
}

function nowMs(): number {
  return Date.now();
}

function trimAndLimit(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

function pruneOldRequests(timestamp: number): void {
  const threshold = timestamp - RATE_LIMIT_WINDOW_MS;

  for (const [ip, entries] of ipRequestLog.entries()) {
    const filtered = entries.filter((entry) => entry >= threshold);
    if (filtered.length === 0) {
      ipRequestLog.delete(ip);
      continue;
    }
    ipRequestLog.set(ip, filtered);
  }

  while (globalRequestLog.length > 0 && globalRequestLog[0] < threshold) {
    globalRequestLog.shift();
  }
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const timestamp = nowMs();
  pruneOldRequests(timestamp);

  const ipEntries = ipRequestLog.get(ip) ?? [];
  if (ipEntries.length >= RATE_LIMIT_PER_IP) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (timestamp - ipEntries[0]);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  if (globalRequestLog.length >= RATE_LIMIT_GLOBAL) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (timestamp - globalRequestLog[0]);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  ipEntries.push(timestamp);
  ipRequestLog.set(ip, ipEntries);
  globalRequestLog.push(timestamp);

  return { allowed: true };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseFeedbackType(value: unknown): FeedbackType | null {
  if (value === 'bug' || value === 'feature') {
    return value;
  }
  return null;
}

function parseContext(value: unknown): FeedbackContext | null {
  if (!isObject(value)) return null;

  const appVersion = value.appVersion;
  const pageUrl = value.pageUrl;
  const filename = value.filename;
  const userAgent = value.userAgent;
  const submittedAt = value.submittedAt;

  if (!isNonEmptyString(appVersion)) return null;
  if (!isNonEmptyString(pageUrl)) return null;
  if (!isNonEmptyString(userAgent)) return null;
  if (!isNonEmptyString(submittedAt)) return null;

  return {
    appVersion: trimAndLimit(appVersion, 100),
    pageUrl: trimAndLimit(pageUrl, 2000),
    filename: typeof filename === 'string' ? trimAndLimit(filename, 200) : undefined,
    userAgent: trimAndLimit(userAgent, 500),
    submittedAt: trimAndLimit(submittedAt, 100),
  };
}

function parseBugDetails(value: unknown): BugFeedbackDetails | null {
  if (!isObject(value)) return null;

  const whatHappened = value.whatHappened;
  const stepsToReproduce = value.stepsToReproduce;
  const expectedBehavior = value.expectedBehavior;

  if (!isNonEmptyString(whatHappened)) return null;
  if (!isNonEmptyString(stepsToReproduce)) return null;
  if (!isNonEmptyString(expectedBehavior)) return null;

  return {
    whatHappened: trimAndLimit(whatHappened, 8000),
    stepsToReproduce: trimAndLimit(stepsToReproduce, 8000),
    expectedBehavior: trimAndLimit(expectedBehavior, 8000),
  };
}

function parseFeatureDetails(value: unknown): FeatureFeedbackDetails | null {
  if (!isObject(value)) return null;

  const problem = value.problem;
  const proposedSolution = value.proposedSolution;
  const useCase = value.useCase;

  if (!isNonEmptyString(problem)) return null;
  if (!isNonEmptyString(proposedSolution)) return null;
  if (!isNonEmptyString(useCase)) return null;

  return {
    problem: trimAndLimit(problem, 8000),
    proposedSolution: trimAndLimit(proposedSolution, 8000),
    useCase: trimAndLimit(useCase, 8000),
  };
}

function parseRequestBody(value: unknown): { ok: true; data: FeedbackRequest } | ErrorResponse {
  if (!isObject(value)) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body must be a JSON object.' };
  }

  const type = parseFeedbackType(value.type);
  if (!type) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "type" must be either "bug" or "feature".',
    };
  }

  if (!isNonEmptyString(value.title)) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "title" is required.',
    };
  }

  const title = trimAndLimit(value.title, 160);
  if (title.length < 3) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "title" must be at least 3 characters.',
    };
  }

  const context = parseContext(value.context);
  if (!context) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "context" is missing required values.',
    };
  }

  if (!isNonEmptyString(value.turnstileToken)) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "turnstileToken" is required.',
    };
  }

  const website = typeof value.website === 'string' ? value.website : '';

  const details =
    type === 'bug' ? parseBugDetails(value.details) : parseFeatureDetails(value.details);
  if (!details) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "details" is missing required content for this feedback type.',
    };
  }

  let contactEmail: string | undefined;
  if (typeof value.contactEmail === 'string' && value.contactEmail.trim()) {
    const email = trimAndLimit(value.contactEmail, 320);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Field "contactEmail" must be a valid email address.',
      };
    }
    contactEmail = email;
  }

  return {
    ok: true,
    data: {
      type,
      title,
      details,
      contactEmail,
      allowFollowUp: value.allowFollowUp === true,
      context,
      turnstileToken: trimAndLimit(value.turnstileToken, 4096),
      website: trimAndLimit(website, 2048),
    },
  };
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) {
    throw new Error('TURNSTILE_SECRET is not configured.');
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip && ip !== 'unknown') {
    body.set('remoteip', ip);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json().catch(() => ({}))) as { success?: boolean };
  return result.success === true;
}

function hasLabelValidationError(payload: unknown): boolean {
  if (!isObject(payload)) return false;

  const message = typeof payload.message === 'string' ? payload.message.toLowerCase() : '';
  if (message.includes('label') && message.includes('does not exist')) {
    return true;
  }

  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  for (const error of errors) {
    if (!isObject(error)) continue;
    const field = typeof error.field === 'string' ? error.field : '';
    if (field === 'labels') {
      return true;
    }
  }

  return false;
}

async function createGitHubIssue(
  payload: FeedbackRequest,
): Promise<{ issueNumber: number; issueUrl: string }> {
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured.');
  }

  const owner = Deno.env.get('GITHUB_OWNER') || 'toineenzo';
  const repo = Deno.env.get('GITHUB_REPO') || 'glossboss';

  const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const requestHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'GlossBoss-Feedback-Function',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const requestBody = {
    title: buildIssueTitle(payload),
    body: buildIssueBody(payload),
    labels: getLabelsForType(payload.type),
  };

  let response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  });

  let result = await response.json().catch(() => ({}));

  if (!response.ok && response.status === 422 && hasLabelValidationError(result)) {
    response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        title: requestBody.title,
        body: requestBody.body,
      }),
    });
    result = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    const message =
      isObject(result) && typeof result.message === 'string'
        ? result.message
        : `GitHub issue creation failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  if (
    !isObject(result) ||
    typeof result.number !== 'number' ||
    typeof result.html_url !== 'string'
  ) {
    throw new Error('GitHub returned an unexpected issue response.');
  }

  return {
    issueNumber: result.number,
    issueUrl: result.html_url,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed.' },
      405,
    );
  }

  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return jsonResponse(
        {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many feedback submissions. Please try again later.',
        },
        429,
        { 'Retry-After': String(rateCheck.retryAfter ?? 60) },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseRequestBody(body);

    if (!parsed.ok) {
      return jsonResponse(parsed, 400);
    }

    if (parsed.data.website) {
      return jsonResponse({ ok: false, code: 'BOT_DETECTED', message: 'Invalid request.' }, 400);
    }

    const bypassEnabled = Deno.env.get('ALLOW_TURNSTILE_BYPASS') === 'true';
    const isBypassToken = parsed.data.turnstileToken === 'dev-bypass';

    if (!(bypassEnabled && isBypassToken)) {
      const verified = await verifyTurnstile(parsed.data.turnstileToken, ip);
      if (!verified) {
        return jsonResponse(
          {
            ok: false,
            code: 'TURNSTILE_FAILED',
            message: 'Verification failed. Please try again.',
          },
          400,
        );
      }
    }

    const issue = await createGitHubIssue(parsed.data);

    return jsonResponse({
      ok: true,
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown feedback function error';

    if (message.includes('TURNSTILE_SECRET') || message.includes('GITHUB_TOKEN')) {
      return jsonResponse(
        {
          ok: false,
          code: 'SERVER_MISCONFIGURED',
          message: 'Feedback backend is not configured correctly.',
        },
        500,
      );
    }

    return jsonResponse(
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message,
      },
      500,
    );
  }
});
