/**
 * Auth session helpers — thin wrappers around Supabase Auth.
 */

import type { Session, User, AuthError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';

function auth() {
  return getSupabaseClient('Auth').auth;
}

/* ------------------------------------------------------------------ */
/*  Session                                                            */
/* ------------------------------------------------------------------ */

export async function getSession(): Promise<Session | null> {
  const { data } = await auth().getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const { data } = await auth().getUser();
  return data.user;
}

/* ------------------------------------------------------------------ */
/*  Email / password                                                   */
/* ------------------------------------------------------------------ */

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await auth().signUp({ email, password });
  return { user: data.user, session: data.session, error };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await auth().signInWithPassword({ email, password });
  return { user: data.user, session: data.session, error };
}

/* ------------------------------------------------------------------ */
/*  OAuth                                                              */
/* ------------------------------------------------------------------ */

const RETURN_PATH_KEY = 'glossboss-oauth-return-path';
const PLAN_PARAMS_KEY = 'glossboss-plan-params';

/** Paths that should not be restored after OAuth — redirect to dashboard instead. */
const AUTH_PATHS = new Set(['/login', '/signup', '/auth/callback', '/onboarding']);

/** Save the current path so the OAuth callback can redirect back to it. */
export function saveReturnPath(): void {
  try {
    const path = window.location.pathname + window.location.search;
    if (!AUTH_PATHS.has(window.location.pathname)) {
      sessionStorage.setItem(RETURN_PATH_KEY, path);
    }
  } catch {
    // sessionStorage unavailable
  }
}

/** Consume the saved return path (reads and deletes). Falls back to '/dashboard'. */
export function consumeReturnPath(): string {
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return path ?? '/dashboard';
  } catch {
    return '/dashboard';
  }
}

/** Save plan/interval query params so the OAuth callback can pass them to onboarding. */
export function savePlanParams(plan: string | null, interval: string | null): void {
  try {
    if (plan) {
      sessionStorage.setItem(
        PLAN_PARAMS_KEY,
        JSON.stringify({ plan, interval: interval || 'month' }),
      );
    }
  } catch {
    // sessionStorage unavailable
  }
}

/** Consume saved plan params (reads and deletes). */
export function consumePlanParams(): { plan: string; interval: string } | null {
  try {
    const raw = sessionStorage.getItem(PLAN_PARAMS_KEY);
    sessionStorage.removeItem(PLAN_PARAMS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { plan: string; interval: string };
  } catch {
    return null;
  }
}

export async function signInWithGitHub(): Promise<{ error: AuthError | null }> {
  saveReturnPath();
  const { error } = await auth().signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { error };
}

/* ------------------------------------------------------------------ */
/*  Password reset                                                     */
/* ------------------------------------------------------------------ */

export async function resetPasswordForEmail(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await auth().resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback`,
  });
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  const { error } = await auth().updateUser({ password: newPassword });
  return { error };
}

/* ------------------------------------------------------------------ */
/*  Sign out                                                           */
/* ------------------------------------------------------------------ */

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await auth().signOut();
  return { error };
}
