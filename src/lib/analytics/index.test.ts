import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMocks = vi.hoisted(() => {
  const posthogClient = {
    capture: vi.fn(),
  };

  return {
    initPostHog: vi.fn().mockResolvedValue(undefined),
    isPostHogEnabled: vi.fn(() => true),
    posthogClient,
    withPostHog: vi.fn((action: (client: typeof posthogClient) => void) => {
      action(posthogClient);
    }),
  };
});

vi.mock('./posthog', () => ({
  initPostHog: analyticsMocks.initPostHog,
  isPostHogEnabled: analyticsMocks.isPostHogEnabled,
  withPostHog: analyticsMocks.withPostHog,
}));

vi.unmock('@/lib/analytics');

describe('analytics wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    analyticsMocks.isPostHogEnabled.mockReturnValue(true);
  });

  it('captures pageviews through the deferred PostHog helper', async () => {
    const analytics = await import('./index');

    analytics.trackPageView('/dashboard');

    expect(analyticsMocks.withPostHog).toHaveBeenCalledOnce();
    expect(analyticsMocks.posthogClient.capture).toHaveBeenCalledWith('$pageview', {
      $current_url: '/dashboard',
    });
  });

  it('captures custom events through the deferred PostHog helper', async () => {
    const analytics = await import('./index');

    analytics.trackEvent('signup_started', { plan: 'free' });

    expect(analyticsMocks.withPostHog).toHaveBeenCalledOnce();
    expect(analyticsMocks.posthogClient.capture).toHaveBeenCalledWith('signup_started', {
      plan: 'free',
    });
  });

  it('does not export identifyUser or resetAnalytics', async () => {
    const analytics = await import('./index');

    expect(analytics).not.toHaveProperty('identifyUser');
    expect(analytics).not.toHaveProperty('resetAnalytics');
  });

  it('re-exports the initializer', async () => {
    const analytics = await import('./index');

    await analytics.initPostHog();

    expect(analyticsMocks.initPostHog).toHaveBeenCalledOnce();
  });

  it('skips analytics work completely when PostHog is disabled', async () => {
    analyticsMocks.isPostHogEnabled.mockReturnValue(false);
    const analytics = await import('./index');

    analytics.trackEvent('signup_started');
    analytics.trackPageView('/dashboard');

    expect(analyticsMocks.withPostHog).not.toHaveBeenCalled();
    expect(analyticsMocks.posthogClient.capture).not.toHaveBeenCalled();
  });
});
