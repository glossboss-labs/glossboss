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

export async function signInWithGitHub(): Promise<{ error: AuthError | null }> {
  const { error } = await auth().signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  return { error };
}

/* ------------------------------------------------------------------ */
/*  Sign out                                                           */
/* ------------------------------------------------------------------ */

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await auth().signOut();
  return { error };
}
