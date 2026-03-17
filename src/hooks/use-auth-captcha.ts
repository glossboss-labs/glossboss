/**
 * Hook for Turnstile captcha on auth pages (Login/Signup).
 *
 * Returns a ref for the container div and a function to get the captcha token.
 * In dev mode without a site key, bypasses captcha entirely.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createTurnstileController, type TurnstileController } from '@/lib/feedback/turnstile';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';
const IS_DEV = import.meta.env.DEV;

export function useAuthCaptcha() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<TurnstileController | null>(null);
  const [ready, setReady] = useState(!SITE_KEY);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    let cancelled = false;

    createTurnstileController(containerRef.current, SITE_KEY)
      .then((ctrl) => {
        if (cancelled) {
          ctrl.cleanup();
          return;
        }
        controllerRef.current = ctrl;
        setReady(true);
      })
      .catch(() => {
        // If Turnstile fails to load in dev, allow bypass
        if (IS_DEV) setReady(true);
      });

    return () => {
      cancelled = true;
      controllerRef.current?.cleanup();
      controllerRef.current = null;
    };
  }, []);

  const getCaptchaToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    if (!controllerRef.current) {
      if (IS_DEV) return undefined;
      throw new Error('Captcha not ready.');
    }
    return controllerRef.current.executeChallenge();
  }, []);

  return { containerRef, getCaptchaToken, ready, captchaEnabled: !!SITE_KEY };
}
