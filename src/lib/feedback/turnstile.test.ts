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
    const remove = vi.fn();

    window.turnstile = {
      render: vi.fn((_container, options) => {
        config = options;
        return 'widget-id';
      }),
      execute,
      remove,
    };

    const controller = await createTurnstileController(document.createElement('div'), 'site-key');
    const tokenPromise = controller.executeChallenge();

    expect(execute).toHaveBeenCalledWith('widget-id');

    config?.callback('turnstile-token');

    await expect(tokenPromise).resolves.toBe('turnstile-token');

    controller.cleanup();
    expect(remove).toHaveBeenCalledWith('widget-id');
  });
});
