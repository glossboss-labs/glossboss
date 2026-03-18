/**
 * Analytics public API — wraps PostHog with safe no-op fallbacks.
 * All calls are no-ops when PostHog is not initialized (local dev).
 *
 * Privacy: No personal data (user ID, email) is ever sent to PostHog.
 * All events are fully anonymous — cookie-less, in-memory persistence only.
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

function runWithAnalytics(action: Parameters<typeof withPostHog>[0]): void {
  if (!isPostHogEnabled()) {
    return;
  }

  withPostHog(action);
}
