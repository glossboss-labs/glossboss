/**
 * LandingGuard — renders the landing page for all visitors.
 * Authenticated users see a "Dashboard" link instead of sign-in CTAs.
 *
 * Accepts an optional `lang` prop for language-specific routes (e.g. /nl).
 * The landing page always renders inside a scoped TranslationProvider so the
 * URL, not persisted app preferences, determines the visible landing language.
 * This keeps / as English and preserves crawlable localized pages for bots.
 */

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

  const landingLanguage: AppLanguage = lang ?? 'en';

  return (
    <TranslationProvider initialLanguage={landingLanguage}>
      <Landing lang={landingLanguage} isAuthenticated={isAuthenticated} />
    </TranslationProvider>
  );
}
