import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';
import { AppProviders } from './providers';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { APP_LANGUAGE_STORAGE_KEY } from '@/lib/app-language';

describe('App problem states', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the not found page for unknown routes', async () => {
    render(
      <MemoryRouter initialEntries={['/missing-route?via=test']}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('/missing-route?via=test')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  it('renders the global error page when a route crashes', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BrokenRoute() {
      throw new Error('Broken route');
    }

    render(
      <MemoryRouter initialEntries={['/broken']}>
        <AppProviders>
          <AppErrorBoundary resetKey="/broken">
            <BrokenRoute />
          </AppErrorBoundary>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Broken route')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('keeps the root landing page in English even when Dutch is saved in storage', async () => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, 'nl');

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole('link', { name: 'Get started free' })).not.toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: 'Gratis aan de slag' })).toHaveLength(0);
  });

  it('renders localized landing routes in their route language instead of saved storage', async () => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, 'en');

    render(
      <MemoryRouter initialEntries={['/nl']}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole('link', { name: 'Gratis aan de slag' })).not.toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: 'Get started free' })).toHaveLength(0);
  });
});
