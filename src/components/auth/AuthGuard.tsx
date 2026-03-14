/**
 * AuthGuard — wraps routes that require authentication.
 * Redirects unauthenticated users to /login.
 */

import { Navigate, useLocation } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '@/hooks/use-auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
