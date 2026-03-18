/**
 * PostHog initialization — EU Cloud (Frankfurt), cookie-less mode.
 * Requests are routed through a first-party reverse proxy at /ingest to
 * avoid ad-blocker interference. The proxy is a Cloudflare Pages Function
 * that forwards to eu.i.posthog.com.
 * No-ops silently when VITE_POSTHOG_KEY is not set (local dev).
 */

let posthogModule: typeof import('posthog-js') | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initPostHog(): Promise<void> {
  const key = getPostHogKey();
  if (!key || initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      posthogModule = await import('posthog-js');
      posthogModule.default.init(key, {
        api_host: '/ingest',
        ui_host: 'https://eu.posthog.com',
        persistence: 'memory',
        autocapture: true,
        capture_pageview: false,
        respect_dnt: true,
        disable_session_recording: true,
        enable_heatmaps: true,
        capture_exceptions: true,
      });
      initialized = true;
    } catch {
      // posthog-js unavailable — silently no-op
    } finally {
      if (!initialized) {
        initPromise = null;
      }
    }
  })();

  return initPromise;
}

export function getPostHog() {
  return initialized && posthogModule ? posthogModule.default : null;
}

export function isPostHogEnabled(): boolean {
  return Boolean(getPostHogKey());
}

export function withPostHog(
  action: (client: NonNullable<ReturnType<typeof getPostHog>>) => void,
): void {
  if (!isPostHogEnabled()) {
    return;
  }

  const posthog = getPostHog();
  if (posthog) {
    action(posthog);
    return;
  }

  void initPostHog().then(() => {
    const readyPostHog = getPostHog();
    if (readyPostHog) {
      action(readyPostHog);
    }
  });
}

function getPostHogKey(): string | undefined {
  const viteKey = import.meta.env.VITE_POSTHOG_KEY;
  if (viteKey) {
    return viteKey;
  }

  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return nodeEnv?.VITE_POSTHOG_KEY;
}
