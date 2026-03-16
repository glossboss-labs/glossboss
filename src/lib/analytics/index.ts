/**
 * Analytics public API — wraps PostHog with safe no-op fallbacks.
 * All calls are no-ops when PostHog is not initialized (local dev).
 */

import { initPostHog, isPostHogEnabled, withPostHog } from './posthog';

export { initPostHog };

export function trackPageView(path: string): void {
  runWithAnalytics((posthog) => {
    posthog.capture('$pageview', { $current_url: path });
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  runWithAnalytics((posthog) => {
    posthog.capture(event, properties);
  });
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  runWithAnalytics((posthog) => {
    posthog.identify(userId, traits);
  });
}

export function resetAnalytics(): void {
  runWithAnalytics((posthog) => {
    posthog.reset();
  });
}

function runWithAnalytics(action: Parameters<typeof withPostHog>[0]): void {
  if (!isPostHogEnabled()) {
    return;
  }

  withPostHog(action);
}
