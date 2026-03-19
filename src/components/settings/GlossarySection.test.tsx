import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/providers';
import { GlossarySection } from './GlossarySection';

vi.mock('@/lib/glossary/wp-fetcher', () => ({
  fetchWPGlossary: vi.fn(() => new Promise(() => {})),
  clearWPGlossaryCache: vi.fn(),
}));

describe('GlossarySection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows uploaded csv glossaries when used standalone', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <AppProviders>
        <GlossarySection initialLocale="nl" />
      </AppProviders>,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const csvFile = new File(['en,nl,pos,description\nHello,Hoi,noun,Greeting'], 'glossary.csv', {
      type: 'text/csv',
    });

    await user.upload(fileInput!, csvFile);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
      expect(screen.getByText('(nl)')).toBeInTheDocument();
    });
  });
});
