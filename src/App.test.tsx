import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from './App';
import { AppProviders } from './providers';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

describe('App problem states', () => {
  afterEach(() => {
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
});
