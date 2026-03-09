import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTurnstileController } from './turnstile';

describe('createTurnstileController', () => {
  afterEach(() => {
    delete window.turnstile;
    delete window.__turnstileScriptPromise;
    document.head.innerHTML = '';
  });

  it('renders the widget in execute mode with a supported size', async () => {
    const render = vi.fn(() => 'widget-id');

    window.turnstile = {
      render,
      execute: vi.fn(),
      reset: vi.fn(),
      remove: vi.fn(),
    };

    const container = document.createElement('div');

    await createTurnstileController(container, 'site-key');

    expect(render).toHaveBeenCalledWith(
      container,
      expect.objectContaining({
        sitekey: 'site-key',
        size: 'normal',
        appearance: 'execute',
        execution: 'execute',
        retry: 'never',
      }),
    );
  });

  it('executes the widget and resolves the returned token', async () => {
    let config:
      | {
          callback: (token: string) => void;
          'error-callback': () => void;
          'expired-callback': () => void;
        }
      | undefined;

    const execute = vi.fn();
    const reset = vi.fn();
    const remove = vi.fn();

    window.turnstile = {
      render: vi.fn((_container, options) => {
        config = options;
        return 'widget-id';
      }),
      execute,
      reset,
      remove,
    };

    const controller = await createTurnstileController(document.createElement('div'), 'site-key');
    const tokenPromise = controller.executeChallenge();

    expect(execute).toHaveBeenCalledWith('widget-id');
    expect(reset).not.toHaveBeenCalled();

    config?.callback('turnstile-token');

    await expect(tokenPromise).resolves.toBe('turnstile-token');

    controller.cleanup();
    expect(remove).toHaveBeenCalledWith('widget-id');
  });

  it('allows retrying after an execution error without resetting before execute', async () => {
    let config:
      | {
          callback: (token: string) => void;
          'error-callback': () => void;
          'expired-callback': () => void;
        }
      | undefined;

    const execute = vi.fn();
    const reset = vi.fn();

    window.turnstile = {
      render: vi.fn((_container, options) => {
        config = options;
        return 'widget-id';
      }),
      execute,
      reset,
      remove: vi.fn(),
    };

    const controller = await createTurnstileController(document.createElement('div'), 'site-key');
    const firstAttempt = controller.executeChallenge();

    config?.['error-callback']();

    await expect(firstAttempt).rejects.toThrow('Verification failed. Please try again.');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);

    const secondAttempt = controller.executeChallenge();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(1);

    config?.callback('turnstile-token');

    await expect(secondAttempt).resolves.toBe('turnstile-token');
  });

  it('resets the widget when Turnstile reports an execution error', async () => {
    let config:
      | {
          callback: (token: string) => void;
          'error-callback': () => void;
          'expired-callback': () => void;
        }
      | undefined;

    const reset = vi.fn();

    window.turnstile = {
      render: vi.fn((_container, options) => {
        config = options;
        return 'widget-id';
      }),
      execute: vi.fn(),
      reset,
      remove: vi.fn(),
    };

    const controller = await createTurnstileController(document.createElement('div'), 'site-key');
    const tokenPromise = controller.executeChallenge();

    config?.['error-callback']();

    await expect(tokenPromise).rejects.toThrow('Verification failed. Please try again.');
    expect(reset).toHaveBeenCalledWith('widget-id');
  });

  it('surfaces the unauthorized hostname error for code 110200', async () => {
    let config:
      | {
          callback: (token: string) => void;
          'error-callback': (errorCode?: string | number) => boolean;
          'expired-callback': () => void;
        }
      | undefined;

    window.turnstile = {
      render: vi.fn((_container, options) => {
        config = options;
        return 'widget-id';
      }),
      execute: vi.fn(),
      reset: vi.fn(),
      remove: vi.fn(),
    };

    const controller = await createTurnstileController(document.createElement('div'), 'site-key');
    const tokenPromise = controller.executeChallenge();

    expect(config?.['error-callback']('110200')).toBe(true);

    await expect(tokenPromise).rejects.toThrow(
      `Feedback verification is not authorized for this hostname (${window.location.hostname}). Update the Turnstile widget hostname allowlist or use the correct site key.`,
    );
  });

  it('resets the widget when Turnstile reports an expired challenge', async () => {
    let config:
      | {
          callback: (token: string) => void;
          'error-callback': (errorCode?: string | number) => boolean;
          'expired-callback': () => void;
        }
      | undefined;

    const reset = vi.fn();

    window.turnstile = {
      render: vi.fn((_container, options) => {
        config = options;
        return 'widget-id';
      }),
      execute: vi.fn(),
      reset,
      remove: vi.fn(),
    };

    const controller = await createTurnstileController(document.createElement('div'), 'site-key');
    const tokenPromise = controller.executeChallenge();

    config?.['expired-callback']();

    await expect(tokenPromise).rejects.toThrow('Verification expired. Please submit again.');
    expect(reset).toHaveBeenCalledWith('widget-id');
  });
});
