import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { Button } from '@mantine/core';
import { Link, useLocation } from 'react-router';
import { useTranslation } from '@/lib/app-language';
import { useAuthStore } from '@/stores/auth-store';
import { ProblemPage } from '@/components/ui/ProblemPage';

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <AppErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

function AppErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t('Something went wrong - GlossBoss');
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  const currentPath = `${location.pathname}${location.search}${location.hash}` || '/';
  const primaryHref = user ? '/dashboard' : '/';
  const primaryLabel = user ? t('Go to dashboard') : t('Go home');

  return (
    <ProblemPage
      code={t('Unexpected error')}
      title={t('Something went wrong')}
      message={t(
        'The app ran into an unexpected error while loading this page. Reload and try again.',
      )}
      details={[
        { label: t('Current path'), value: currentPath },
        ...(error.message ? [{ label: t('Error details'), value: error.message }] : []),
      ]}
      actions={
        <>
          <Button
            onClick={() => {
              onReset();
              window.location.reload();
            }}
          >
            {t('Reload page')}
          </Button>
          <Button component={Link} to={primaryHref} variant="default" onClick={onReset}>
            {primaryLabel}
          </Button>
        </>
      }
    />
  );
}
