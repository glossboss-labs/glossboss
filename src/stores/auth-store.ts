/**
 * Auth Store
 *
 * Zustand store for authentication state.
 * Listens to Supabase auth state changes and keeps session/user in sync.
 */

import { create } from 'zustand';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import {
  getSupabaseAuthStorageKey,
  getSupabaseClient,
  isCloudBackendConfigured,
} from '@/lib/supabase/client';
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
import { trackEvent } from '@/lib/analytics';

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
  signUpWithEmail: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function isPersistedSession(value: unknown): value is Session {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { access_token?: unknown }).access_token === 'string' &&
    typeof (value as { refresh_token?: unknown }).refresh_token === 'string' &&
    typeof (value as { expires_at?: unknown }).expires_at === 'number'
  );
}

export function readPersistedAuthSession(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined,
  storageKey = getSupabaseAuthStorageKey(),
): Pick<AuthState, 'session' | 'user'> {
  if (!storage || !storageKey) {
    return { session: null, user: null };
  }

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return { session: null, user: null };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedSession(parsed)) {
      return { session: null, user: null };
    }

    const session = parsed as Session;
    return { session, user: session.user ?? null };
  } catch {
    return { session: null, user: null };
  }
}

const hydratedAuthState = readPersistedAuthSession();

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  session: hydratedAuthState.session,
  user: hydratedAuthState.user,
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

      if (event === 'SIGNED_OUT') {
        clearGitHubOAuthToken();
        clearEncryptionKeyCache();
        trackEvent('logout');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  signUpWithEmail: async (email, password, captchaToken) => {
    set({ error: null });
    const { error } = await signUpWithEmail(email, password, captchaToken);
    if (error) set({ error });
  },

  signInWithEmail: async (email, password, captchaToken) => {
    set({ error: null });
    const { error } = await signInWithEmail(email, password, captchaToken);
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
