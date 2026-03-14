/**
 * Auth Store
 *
 * Zustand store for authentication state.
 * Listens to Supabase auth state changes and keeps session/user in sync.
 */

import { create } from 'zustand';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { isCloudBackendConfigured, getSupabaseClient } from '@/lib/supabase/client';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGitHub,
  signOut as sessionSignOut,
} from '@/lib/auth/session';
import { setGitHubOAuthToken, clearGitHubOAuthToken } from '@/lib/github/token';

export interface AuthState {
  /** Current session (null if signed out). */
  session: Session | null;
  /** Current user (null if signed out). */
  user: User | null;
  /** True while the initial session check is in progress. */
  loading: boolean;
  /** Last auth error (cleared on next attempt). */
  error: AuthError | null;
}

export interface AuthActions {
  /** Initialize the auth listener. Call once at app startup. Returns cleanup. */
  initialize: () => () => void;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  session: null,
  user: null,
  loading: true,
  error: null,

  initialize: () => {
    if (!isCloudBackendConfigured()) {
      set({ loading: false });
      return () => {};
    }

    const client = getSupabaseClient('Auth');

    // Get initial session
    client.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false });
      if (data.session?.provider_token && data.session.user?.app_metadata?.provider === 'github') {
        setGitHubOAuthToken(data.session.provider_token);
      }
    });

    // Listen to auth state changes.
    // Capture the GitHub OAuth provider_token when signing in — Supabase only
    // provides it on the initial SIGNED_IN event, not on session refresh.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null, loading: false });

      if (session?.provider_token && session.user?.app_metadata?.provider === 'github') {
        setGitHubOAuthToken(session.provider_token);
      }

      if (event === 'SIGNED_OUT') {
        clearGitHubOAuthToken();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  signUpWithEmail: async (email, password) => {
    set({ error: null });
    const { error } = await signUpWithEmail(email, password);
    if (error) set({ error });
  },

  signInWithEmail: async (email, password) => {
    set({ error: null });
    const { error } = await signInWithEmail(email, password);
    if (error) set({ error });
  },

  signInWithGitHub: async () => {
    set({ error: null });
    const { error } = await signInWithGitHub();
    if (error) set({ error });
  },

  signOut: async () => {
    set({ error: null });
    const { error } = await sessionSignOut();
    if (error) set({ error });
  },

  clearError: () => set({ error: null }),
}));
