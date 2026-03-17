/**
 * Repository OAuth Edge Function
 *
 * Handles OAuth flows for GitHub and GitLab repository access.
 * Uses a popup-based flow:
 *   1. Frontend opens popup → this function redirects to provider authorize URL
 *   2. Provider redirects back with code → this function exchanges for access token
 *   3. Serves HTML that postMessages the token to the opener window and closes
 *
 * Required secrets (set via Supabase dashboard):
 *   GITHUB_REPO_CLIENT_ID, GITHUB_REPO_CLIENT_SECRET
 *   GITLAB_REPO_CLIENT_ID, GITLAB_REPO_CLIENT_SECRET
 */

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITLAB_AUTHORIZE_URL = 'https://gitlab.com/oauth/authorize';
const GITLAB_TOKEN_URL = 'https://gitlab.com/oauth/token';

type Provider = 'github' | 'gitlab';

function isValidProvider(v: string | null): v is Provider {
  return v === 'github' || v === 'gitlab';
}

function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

/* ── State encoding (base64url JSON) ─────────────────────── */

interface StatePayload {
  provider: Provider;
  origin: string;
}

function encodeState(payload: StatePayload): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(state: string): StatePayload | null {
  try {
    const padded = state.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const payload = JSON.parse(json);
    if (!isValidProvider(payload.provider) || !isValidOrigin(payload.origin)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ── Credentials ─────────────────────────────────────────── */

function getCredentials(provider: Provider): { clientId: string; clientSecret: string } | null {
  const prefix = provider === 'github' ? 'GITHUB' : 'GITLAB';
  const clientId = Deno.env.get(`${prefix}_REPO_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${prefix}_REPO_CLIENT_SECRET`);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getRedirectUri(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  return `${supabaseUrl}/functions/v1/repo-oauth`;
}

/* ── Response helpers ────────────────────────────────────── */

function errorPage(message: string, origin: string): Response {
  const params = new URLSearchParams({
    'repo-oauth-error': message,
  });
  return Response.redirect(`${origin}/#${params}`, 302);
}

function successPage(provider: string, token: string, origin: string): Response {
  const params = new URLSearchParams({
    'repo-oauth-provider': provider,
    'repo-oauth-token': token,
  });
  return Response.redirect(`${origin}/#${params}`, 302);
}

/* ── Authorize (step 1) ─────────────────────────────────── */

function handleAuthorize(url: URL): Response {
  const provider = url.searchParams.get('provider');
  const origin = url.searchParams.get('origin');

  if (!isValidProvider(provider)) {
    return new Response('Invalid provider', { status: 400 });
  }
  if (!isValidOrigin(origin)) {
    return new Response('Invalid origin', { status: 400 });
  }

  const creds = getCredentials(provider);
  if (!creds) {
    return errorPage(
      `OAuth is not configured for ${provider}. Use a personal access token instead.`,
      origin!,
    );
  }

  const state = encodeState({ provider, origin: origin! });
  const redirectUri = getRedirectUri();

  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'repo',
      state,
    });
    return Response.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`, 302);
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'api',
    state,
  });
  return Response.redirect(`${GITLAB_AUTHORIZE_URL}?${params}`, 302);
}

/* ── Callback (step 2) ──────────────────────────────────── */

async function handleCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    const desc = url.searchParams.get('error_description') || error;
    const state = stateParam ? decodeState(stateParam) : null;
    return errorPage(desc, state?.origin ?? '*');
  }

  if (!code || !stateParam) {
    return new Response('Missing code or state', { status: 400 });
  }

  const state = decodeState(stateParam);
  if (!state) {
    return new Response('Invalid state', { status: 400 });
  }

  const creds = getCredentials(state.provider);
  if (!creds) {
    return errorPage('OAuth credentials not configured', state.origin);
  }

  const redirectUri = getRedirectUri();

  try {
    let accessToken: string;

    if (state.provider === 'github') {
      const resp = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const data = await resp.json();
      if (data.error) {
        return errorPage(data.error_description || data.error, state.origin);
      }
      accessToken = data.access_token;
    } else {
      const resp = await fetch(GITLAB_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      const data = await resp.json();
      if (data.error) {
        return errorPage(data.error_description || data.error, state.origin);
      }
      accessToken = data.access_token;
    }

    if (!accessToken) {
      return errorPage('Failed to obtain access token', state.origin);
    }

    return successPage(state.provider, accessToken, state.origin);
  } catch (err) {
    return errorPage(`Token exchange failed: ${(err as Error).message}`, state.origin);
  }
}

/* ── Entry point ─────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);

  // Callback from OAuth provider (has code or error)
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    return handleCallback(url);
  }

  // Start new OAuth flow
  return handleAuthorize(url);
});
