import {
  buildIssueBody,
  type BugFeedbackDetails,
  type FeatureFeedbackDetails,
  type FeedbackContext,
  type FeedbackType,
} from '../_shared/feedback-template.ts';
import {
  fetchWithTimeout,
  forbiddenOrigin,
  isAbortError,
  isAllowedOrigin,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  parseJsonBody,
  requireJsonRequest,
  sanitizeUpstreamError,
  validateRequestOrigin,
} from '../_shared/http.ts';

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_PER_IP = 6;
const RATE_LIMIT_GLOBAL = 150;
const TURNSTILE_FETCH_TIMEOUT_MS = 8000;
const KANEO_FETCH_TIMEOUT_MS = 12000;

const TITLE_MAX_LENGTH = 160;
const TEXT_MAX_LENGTH = 8000;
const TURNSTILE_TOKEN_MAX_LENGTH = 4096;
const EMAIL_MAX_LENGTH = 320;
const WEBSITE_MAX_LENGTH = 2048;
const PAGE_URL_MAX_LENGTH = 2000;
const USER_AGENT_MAX_LENGTH = 500;
const APP_VERSION_MAX_LENGTH = 100;
const FILENAME_MAX_LENGTH = 200;
const SUBMITTED_AT_MAX_LENGTH = 100;
const DEFAULT_KANEO_FEEDBACK_PROJECT_SLUG = 'INBOX';

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

  const filteredGlobalEntries = globalRequestLog.filter((entry) => entry >= threshold);
  globalRequestLog.length = 0;
  globalRequestLog.push(...filteredGlobalEntries);
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
  return value === 'bug' || value === 'feature' ? value : null;
}

function isAllowedPageUrl(pageUrl: string): boolean {
  try {
    const url = new URL(pageUrl);
    return isAllowedOrigin(url.origin);
  } catch {
    return false;
  }
}

function parseContext(value: unknown): FeedbackContext | null {
  if (!isObject(value)) return null;

  const appVersion = value.appVersion;
  const pageUrl = value.pageUrl;
  const filename = value.filename;
  const userAgent = value.userAgent;
  const submittedAt = value.submittedAt;

  if (!isNonEmptyString(appVersion)) return null;
  if (!isNonEmptyString(pageUrl) || !isAllowedPageUrl(pageUrl)) return null;
  if (!isNonEmptyString(userAgent)) return null;
  if (!isNonEmptyString(submittedAt)) return null;

  return {
    appVersion: trimAndLimit(appVersion, APP_VERSION_MAX_LENGTH),
    pageUrl: trimAndLimit(pageUrl, PAGE_URL_MAX_LENGTH),
    filename:
      typeof filename === 'string' ? trimAndLimit(filename, FILENAME_MAX_LENGTH) : undefined,
    userAgent: trimAndLimit(userAgent, USER_AGENT_MAX_LENGTH),
    submittedAt: trimAndLimit(submittedAt, SUBMITTED_AT_MAX_LENGTH),
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
    whatHappened: trimAndLimit(whatHappened, TEXT_MAX_LENGTH),
    stepsToReproduce: trimAndLimit(stepsToReproduce, TEXT_MAX_LENGTH),
    expectedBehavior: trimAndLimit(expectedBehavior, TEXT_MAX_LENGTH),
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
    problem: trimAndLimit(problem, TEXT_MAX_LENGTH),
    proposedSolution: trimAndLimit(proposedSolution, TEXT_MAX_LENGTH),
    useCase: trimAndLimit(useCase, TEXT_MAX_LENGTH),
  };
}

export function parseRequestBody(
  value: unknown,
): { ok: true; data: FeedbackRequest } | ErrorResponse {
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
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Field "title" is required.' };
  }

  const title = trimAndLimit(value.title, TITLE_MAX_LENGTH);
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
      message: 'Field "context" is missing required values or has an invalid page URL.',
    };
  }

  if (!isNonEmptyString(value.turnstileToken)) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Field "turnstileToken" is required.',
    };
  }

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
    const email = trimAndLimit(value.contactEmail, EMAIL_MAX_LENGTH);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
      turnstileToken: trimAndLimit(value.turnstileToken, TURNSTILE_TOKEN_MAX_LENGTH),
      website:
        typeof value.website === 'string' ? trimAndLimit(value.website, WEBSITE_MAX_LENGTH) : '',
    },
  };
}

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET')?.trim();
  if (!secret) {
    throw new Error('TURNSTILE_SECRET is not configured.');
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);

  try {
    const response = await fetchWithTimeout(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      TURNSTILE_FETCH_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    if (!response.ok) return false;
    const result = (await response.json().catch(() => ({}))) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    if (isAbortError(error)) return false;
    throw error;
  }
}

interface KaneoTaskResponse {
  id: string;
  number: number | null;
}

interface KaneoLabelSpec {
  name: string;
  color: string;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getKaneoBaseUrl(): string {
  return requireEnv('KANEO_API_URL').replace(/\/+$/, '');
}

function buildKaneoHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${requireEnv('KANEO_API_KEY')}`,
    'CF-Access-Client-Id': requireEnv('KANEO_CF_ACCESS_CLIENT_ID'),
    'CF-Access-Client-Secret': requireEnv('KANEO_CF_ACCESS_CLIENT_SECRET'),
    'Content-Type': 'application/json',
    'User-Agent': 'GlossBoss-Feedback-Function',
  };
}

function getKaneoFeedbackLabels(type: FeedbackType): KaneoLabelSpec[] {
  if (type === 'bug') {
    return [
      { name: 'bug', color: 'teal' },
      { name: 'customer', color: 'red' },
      { name: 'source:in-app', color: 'gray' },
    ];
  }

  return [
    { name: 'feature', color: 'purple' },
    { name: 'customer', color: 'red' },
    { name: 'source:in-app', color: 'gray' },
  ];
}

async function createKaneoTask(payload: FeedbackRequest): Promise<{ referenceId?: string }> {
  const baseUrl = getKaneoBaseUrl();
  const workspaceId = requireEnv('KANEO_WORKSPACE_ID');
  const projectId = requireEnv('KANEO_FEEDBACK_PROJECT_ID');
  const projectSlug =
    Deno.env.get('KANEO_FEEDBACK_PROJECT_SLUG')?.trim() || DEFAULT_KANEO_FEEDBACK_PROJECT_SLUG;

  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/task/${projectId}`, KANEO_FETCH_TIMEOUT_MS, {
      method: 'POST',
      headers: buildKaneoHeaders(),
      body: JSON.stringify({
        title: payload.title.trim(),
        description: buildIssueBody(payload),
        priority: 'no-priority',
        status: 'inbox',
      }),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('Kaneo API request timed out.', { cause: error });
    }
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      isObject(result) && typeof result.message === 'string'
        ? sanitizeUpstreamError(result.message, 'Kaneo task creation failed.')
        : `Kaneo task creation failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!isObject(result) || typeof result.id !== 'string') {
    throw new Error('Kaneo returned an unexpected task response.');
  }

  const task = result as unknown as KaneoTaskResponse;

  for (const label of getKaneoFeedbackLabels(payload.type)) {
    try {
      const labelResponse = await fetchWithTimeout(`${baseUrl}/label`, KANEO_FETCH_TIMEOUT_MS, {
        method: 'POST',
        headers: buildKaneoHeaders(),
        body: JSON.stringify({
          name: label.name,
          color: label.color,
          workspaceId,
          taskId: task.id,
        }),
      });

      if (!labelResponse.ok) {
        const labelError = await labelResponse.json().catch(() => ({}));
        const labelMessage =
          isObject(labelError) && typeof labelError.message === 'string'
            ? labelError.message
            : `HTTP ${labelResponse.status}`;
        console.error(`Failed to create Kaneo label ${label.name}: ${labelMessage}`);
      }
    } catch (error) {
      console.error(`Failed to create Kaneo label ${label.name}:`, error);
    }
  }

  const referenceId =
    typeof task.number === 'number' && Number.isFinite(task.number)
      ? `${projectSlug}-${task.number}`
      : undefined;

  return { referenceId };
}

export async function handleFeedbackIssueRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(req);
  }

  const originValidation = validateRequestOrigin(req);
  if (originValidation.allowedOrigins.length === 0) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Feedback backend is not configured correctly.',
      },
      { status: 500 },
    );
  }
  if (!originValidation.allowed) {
    return forbiddenOrigin(req);
  }

  const jsonError = requireJsonRequest(req);
  if (jsonError) {
    return jsonError;
  }

  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many feedback submissions. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter ?? 60),
          },
        },
      );
    }

    const body = await parseJsonBody(req);
    const parsed = parseRequestBody(body);
    if (!parsed.ok) {
      return jsonResponse(req, parsed, { status: 400 });
    }

    if (parsed.data.website) {
      return jsonResponse(
        req,
        { ok: false, code: 'BOT_DETECTED', message: 'Invalid request.' },
        { status: 400 },
      );
    }

    const bypassEnabled = Deno.env.get('ALLOW_TURNSTILE_BYPASS') === 'true';
    const isBypassToken = parsed.data.turnstileToken === 'dev-bypass';
    if (!(bypassEnabled && isBypassToken)) {
      const verified = await verifyTurnstile(parsed.data.turnstileToken);
      if (!verified) {
        return jsonResponse(
          req,
          {
            ok: false,
            code: 'TURNSTILE_FAILED',
            message: 'Verification failed. Please try again.',
          },
          { status: 400 },
        );
      }
    }

    const task = await createKaneoTask(parsed.data);
    return jsonResponse(req, {
      ok: true,
      referenceId: task.referenceId,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.' },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown feedback function error';

    if (
      message.includes('TURNSTILE_SECRET') ||
      message.includes('KANEO_API_URL') ||
      message.includes('KANEO_API_KEY') ||
      message.includes('KANEO_CF_ACCESS_CLIENT_ID') ||
      message.includes('KANEO_CF_ACCESS_CLIENT_SECRET') ||
      message.includes('KANEO_WORKSPACE_ID') ||
      message.includes('KANEO_FEEDBACK_PROJECT_ID')
    ) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'SERVER_MISCONFIGURED',
          message: 'Feedback backend is not configured correctly.',
        },
        { status: 500 },
      );
    }

    return jsonResponse(
      req,
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: sanitizeUpstreamError(message, 'Feedback request failed.'),
      },
      { status: 500 },
    );
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleFeedbackIssueRequest);
}
