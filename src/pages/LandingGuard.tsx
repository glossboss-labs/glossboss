/**
 * LandingGuard — renders the landing page for unauthenticated visitors,
 * redirects authenticated users to /dashboard.
 *
 * Accepts an optional `lang` prop for language-specific routes (e.g. /nl).
 * When a language is specified, the landing page is wrapped in a scoped
 * TranslationProvider so all content renders in that language — making the
 * page crawlable by bots at its own URL.
 */

import { Navigate } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '@/hooks/use-auth';
import { TranslationProvider, type AppLanguage } from '@/lib/app-language';
import Landing from './Landing';

export default function LandingGuard({ lang }: { lang?: AppLanguage }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // If a specific language is requested, wrap in a scoped provider
  if (lang) {
    return (
      <TranslationProvider initialLanguage={lang}>
        <Landing lang={lang} />
      </TranslationProvider>
    );
  }

  return <Landing />;
}
