import { useEffect } from 'react';
import { Button } from '@mantine/core';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from '@/lib/app-language';
import { ProblemPage } from '@/components/ui/ProblemPage';
import { useAuthStore } from '@/stores/auth-store';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t('Page not found - GlossBoss');
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  const requestedPath = `${location.pathname}${location.search}${location.hash}` || '/';
  const primaryHref = user ? '/dashboard' : '/';
  const primaryLabel = user ? t('Go to dashboard') : t('Go home');

  const handleGoBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(primaryHref);
  };

  return (
    <ProblemPage
      code="404"
      title={t('Page not found')}
      message={t(
        "We couldn't find the page you requested. It may have moved, the link may be out of date, or the URL may be mistyped.",
      )}
      details={[{ label: t('Requested path'), value: requestedPath }]}
      actions={
        <>
          <Button component={Link} to={primaryHref}>
            {primaryLabel}
          </Button>
          <Button variant="default" onClick={handleGoBack}>
            {t('Go back')}
          </Button>
        </>
      }
    />
  );
}
