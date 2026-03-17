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
  resetPasswordForEmail,
  updatePassword,
} from '@/lib/auth/session';
import { clearGitHubOAuthToken } from '@/lib/github/token';
import { clearEncryptionKeyCache } from '@/lib/settings/crypto';
import { identifyUser, resetAnalytics, trackEvent } from '@/lib/analytics';

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
  resetPasswordForEmail: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
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
    });

    // Listen to auth state changes.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user ?? null, loading: false });

      if (session?.user) {
        identifyUser(session.user.id, { email: session.user.email });
      }

      if (event === 'SIGNED_OUT') {
        clearGitHubOAuthToken();
        clearEncryptionKeyCache();
        trackEvent('logout');
        resetAnalytics();
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

  resetPasswordForEmail: async (email) => {
    set({ error: null });
    const { error } = await resetPasswordForEmail(email);
    if (error) {
      set({ error });
      return false;
    }
    return true;
  },

  updatePassword: async (newPassword) => {
    set({ error: null });
    const { error } = await updatePassword(newPassword);
    if (error) {
      set({ error });
      return false;
    }
    return true;
  },

  signOut: async () => {
    set({ error: null });
    const { error } = await sessionSignOut();
    if (error) set({ error });
  },

  clearError: () => set({ error: null }),
}));
