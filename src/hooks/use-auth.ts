/**
 * useAuth — convenience hook over the auth store.
 */

import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  return {
    session,
    user,
    loading,
    error,
    isAuthenticated: Boolean(session),
  };
}
