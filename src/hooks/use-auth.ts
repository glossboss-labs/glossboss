/**
 * useAuth — convenience hook over the auth store.
 */

import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const { session, user, loading, error } = useAuthStore(
    useShallow((s) => ({
      session: s.session,
      user: s.user,
      loading: s.loading,
      error: s.error,
    })),
  );

  return {
    session,
    user,
    loading,
    error,
    isAuthenticated: Boolean(session),
  };
}
