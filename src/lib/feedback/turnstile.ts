type TurnstileWidgetConfig = {
  sitekey: string;
  size: 'compact' | 'flexible' | 'normal';
  appearance: 'execute';
  execution: 'execute';
  retry: 'auto' | 'never';
  callback: (token: string) => void;
  'error-callback': (errorCode?: string | number) => boolean;
  'expired-callback': () => void;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: TurnstileWidgetConfig) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

export interface TurnstileController {
  executeChallenge: () => Promise<string>;
  cleanup: () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileScriptPromise?: Promise<void>;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const CHALLENGE_TIMEOUT_MS = 20000;

function describeTurnstileError(errorCode?: string | number): string {
  const normalizedCode = String(errorCode ?? '').trim();

  if (normalizedCode.startsWith('110200')) {
    return `Feedback verification is not authorized for this hostname (${window.location.hostname}). Update the Turnstile widget hostname allowlist or use the correct site key.`;
  }

  if (
    normalizedCode.startsWith('110100') ||
    normalizedCode.startsWith('110110') ||
    normalizedCode.startsWith('400020') ||
    normalizedCode.startsWith('400070')
  ) {
    return 'Feedback verification is misconfigured. Check the configured Turnstile site key.';
  }

  return 'Verification failed. Please try again.';
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (window.__turnstileScriptPromise) {
    return window.__turnstileScriptPromise;
  }

  window.__turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Turnstile script.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile script.'));
    document.head.appendChild(script);
  });

  return window.__turnstileScriptPromise;
}

export async function createTurnstileController(
  container: HTMLElement,
  siteKey: string,
): Promise<TurnstileController> {
  await loadTurnstileScript();

  if (!window.turnstile) {
    throw new Error('Turnstile script loaded but API is unavailable.');
  }

  let pending:
    | {
        resolve: (token: string) => void;
        reject: (reason?: unknown) => void;
        timeoutId: number;
      }
    | undefined;

  const rejectPending = (message: string) => {
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pending.reject(new Error(message));
    pending = undefined;
  };

  const widgetId = window.turnstile.render(container, {
    sitekey: siteKey,
    size: 'normal',
    appearance: 'execute',
    execution: 'execute',
    retry: 'never',
    callback: (token: string) => {
      if (!pending) return;
      window.clearTimeout(pending.timeoutId);
      pending.resolve(token);
      pending = undefined;
    },
    'error-callback': (errorCode?: string | number) => {
      window.turnstile?.reset(widgetId);
      rejectPending(describeTurnstileError(errorCode));
      return true;
    },
    'expired-callback': () => {
      window.turnstile?.reset(widgetId);
      rejectPending('Verification expired. Please submit again.');
    },
  });

  return {
    executeChallenge: () => {
      if (!window.turnstile) {
        throw new Error('Verification service unavailable.');
      }

      if (pending) {
        throw new Error('Verification already in progress.');
      }

      return new Promise<string>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          rejectPending('Verification timed out. Please try again.');
        }, CHALLENGE_TIMEOUT_MS);

        pending = { resolve, reject, timeoutId };
        window.turnstile?.reset(widgetId);
        window.turnstile?.execute(widgetId);
      });
    },
    cleanup: () => {
      rejectPending('Verification cancelled.');
      window.turnstile?.remove(widgetId);
    },
  };
}
