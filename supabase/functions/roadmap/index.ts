/**
 * Roadmap edge function — fetches roadmap-labeled issues from the public
 * GitHub repo and returns sanitized, cached data for the public roadmap page.
 */

import {
  fetchWithTimeout,
  forbiddenOrigin,
  isAbortError,
  jsonResponse,
  optionsResponse,
  sanitizeUpstreamError,
  validateRequestOrigin,
} from '../_shared/http.ts';

const GITHUB_FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_GITHUB_OWNER = 'glossboss-labs';
const DEFAULT_GITHUB_REPO = 'glossboss';
const PRIVATE_GITHUB_REPO = 'glossboss-dev';

interface CachedResult {
  data: RoadmapIssue[];
  timestamp: number;
}

interface RoadmapIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  goal: string;
  tasksTotal: number;
  tasksDone: number;
  labels: Array<{ name: string; color: string }>;
  reactions: number;
  updatedAt: string;
  createdAt: string;
  url: string;
}

let cache: CachedResult | null = null;

function parseGoal(body: string | null): string {
  if (!body) return '';
  const goalMatch = body.match(/## Goal\s*\n([\s\S]*?)(?=\n## |\n---|\n$)/);
  if (!goalMatch) return '';
  return goalMatch[1].trim().slice(0, 300);
}

function countTasks(body: string | null): { total: number; done: number } {
  if (!body) return { total: 0, done: 0 };
  const allTasks = body.match(/- \[[ x]\]/g) ?? [];
  const doneTasks = body.match(/- \[x\]/g) ?? [];
  return { total: allTasks.length, done: doneTasks.length };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toRoadmapIssue(raw: unknown): RoadmapIssue | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.number !== 'number') return null;
  if (typeof raw.title !== 'string') return null;
  if (raw.state !== 'open' && raw.state !== 'closed') return null;

  const body = typeof raw.body === 'string' ? raw.body : null;
  const tasks = countTasks(body);

  const labels = Array.isArray(raw.labels)
    ? (raw.labels as unknown[])
        .filter(isRecord)
        .filter((l) => typeof l.name === 'string' && typeof l.color === 'string')
        .map((l) => ({ name: l.name as string, color: l.color as string }))
    : [];

  const reactions = isRecord(raw.reactions) ? Number(raw.reactions['+1']) || 0 : 0;

  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    goal: parseGoal(body),
    tasksTotal: tasks.total,
    tasksDone: tasks.done,
    labels,
    reactions,
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : '',
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : '',
    url: typeof raw.html_url === 'string' ? raw.html_url : '',
  };
}

async function fetchRepoIssues(
  owner: string,
  repo: string,
  token: string | undefined,
): Promise<RoadmapIssue[]> {
  const issues: RoadmapIssue[] = [];
  let page = 1;

  while (page <= 5) {
    const url =
      `https://api.github.com/repos/${owner}/${repo}/issues` +
      `?labels=roadmap&state=all&per_page=100&page=${page}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, GITHUB_FETCH_TIMEOUT_MS, {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': 'GlossBoss-Roadmap-Function',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (error) {
      if (isAbortError(error)) throw new Error('GitHub API request timed out.', { cause: error });
      throw error;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const msg =
        typeof body.message === 'string'
          ? sanitizeUpstreamError(body.message, 'GitHub API request failed.')
          : `GitHub API returned HTTP ${response.status}`;
      throw new Error(msg);
    }

    const items = (await response.json()) as unknown[];
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      const issue = toRoadmapIssue(item);
      if (issue) issues.push(issue);
    }

    if (items.length < 100) break;
    page++;
  }

  return issues;
}

async function fetchRoadmapIssues(): Promise<RoadmapIssue[]> {
  const token = Deno.env.get('GITHUB_TOKEN')?.trim();
  const owner = Deno.env.get('ROADMAP_GITHUB_OWNER')?.trim() || DEFAULT_GITHUB_OWNER;
  const repo = Deno.env.get('ROADMAP_GITHUB_REPO')?.trim() || DEFAULT_GITHUB_REPO;

  // Fetch from both public and private repos in parallel
  const [publicIssues, privateIssues] = await Promise.all([
    fetchRepoIssues(owner, repo, token),
    token
      ? fetchRepoIssues(owner, PRIVATE_GITHUB_REPO, token).catch(() => [] as RoadmapIssue[])
      : Promise.resolve([] as RoadmapIssue[]),
  ]);

  // Deduplicate by title (public repo takes priority)
  const publicTitles = new Set(publicIssues.map((i) => i.title.toLowerCase()));
  const uniquePrivate = privateIssues
    .filter((i) => !publicTitles.has(i.title.toLowerCase()))
    .map((i) => ({ ...i, url: '', labels: [] })); // Strip URLs and labels — private repo is not publicly accessible

  return [...publicIssues, ...uniquePrivate];
}

async function getCachedOrFetch(): Promise<RoadmapIssue[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const data = await fetchRoadmapIssues();
  cache = { data, timestamp: Date.now() };
  return data;
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse(
      req,
      { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Only GET and POST are allowed.' },
      { status: 405 },
    );
  }

  const originValidation = validateRequestOrigin(req);
  if (originValidation.allowedOrigins.length === 0) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Roadmap backend is not configured correctly.',
      },
      { status: 500 },
    );
  }
  if (!originValidation.allowed) {
    return forbiddenOrigin(req);
  }

  try {
    const issues = await getCachedOrFetch();
    return jsonResponse(
      req,
      { ok: true, issues },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown roadmap function error';

    if (
      message.includes('GITHUB_TOKEN') ||
      message.includes('GITHUB_OWNER') ||
      message.includes('GITHUB_REPO')
    ) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'SERVER_MISCONFIGURED',
          message: 'Roadmap backend is not configured correctly.',
        },
        { status: 500 },
      );
    }

    return jsonResponse(
      req,
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: sanitizeUpstreamError(message, 'Roadmap request failed.'),
      },
      { status: 500 },
    );
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleRequest);
}

function resetCache() {
  cache = null;
}

export { handleRequest, toRoadmapIssue, parseGoal, countTasks, resetCache };
