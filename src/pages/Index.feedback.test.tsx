import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '@/providers';
import { clearExamplePoCacheForTests } from '@/lib/example-po';
import Index from '@/pages/Index';
import { useEditorStore } from '@/stores/editor-store';
import { useSourceStore } from '@/stores/source-store';

const navigatorLanguageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'language');
const navigatorLanguagesDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'languages');

function mockNavigatorLanguages(language: string, languages = [language]) {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  });
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  });
}

describe('Index feedback and empty state actions', () => {
  beforeEach(() => {
    localStorage.clear();
    clearExamplePoCacheForTests();
    useEditorStore.getState().clearEditor();
    useSourceStore.getState().clearSource();
    mockNavigatorLanguages('en-US');
  });

  afterEach(() => {
    if (navigatorLanguageDescriptor) {
      Object.defineProperty(window.navigator, 'language', navigatorLanguageDescriptor);
    }
    if (navigatorLanguagesDescriptor) {
      Object.defineProperty(window.navigator, 'languages', navigatorLanguagesDescriptor);
    }
    clearExamplePoCacheForTests();
  });

  it('renders a feedback button and opens feedback modal', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    const feedbackButton = screen.getByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();

    await user.click(feedbackButton);

    expect(await screen.findByText('Share Feedback')).toBeInTheDocument();
  });

  it('loads the bundled example PO from the empty state and hides the action afterward', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /load example po/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load example po/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().filename).toBe('hello-dolly-nl_NL.po');
    });

    expect(useEditorStore.getState().entries).toHaveLength(3);
    expect(useSourceStore.getState().autoDetectedSlug).toBe('hello-dolly');
    expect(useSourceStore.getState().projectVersion).toBe('1.7.2');
    expect(await screen.findByText('Auto-detected: Plugin / hello-dolly')).toBeInTheDocument();
    expect(await screen.findByText('Detected: NL')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load example po/i })).not.toBeInTheDocument();
  }, 10000);

  it('loads the bundled example without depending on WordPress availability', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /load example po/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().filename).toBe('hello-dolly-nl_NL.po');
    });

    expect(useEditorStore.getState().entries).toHaveLength(3);
    expect(useSourceStore.getState().autoDetectedSlug).toBe('hello-dolly');
    expect(await screen.findByText('Detected: NL')).toBeInTheDocument();
  });

  it('renders footer links for source, license, translate, and privacy in settings menu', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    // Open the settings menu
    const settingsButton = screen.getByRole('button', { name: 'Settings and actions' });
    await user.click(settingsButton);

    // Menu items with component="a" render as links inside the portal
    await waitFor(() => {
      expect(screen.getByText('Source')).toBeInTheDocument();
    });
    const sourceLink = screen.getByText('Source').closest('a');
    expect(sourceLink).toHaveAttribute('href', 'https://github.com/glossboss-labs/glossboss');
    const licenseLink = screen.getByText('License').closest('a');
    expect(licenseLink).toHaveAttribute('href', '/license/');
    const translateLink = screen.getByText('Translate').closest('a');
    expect(translateLink).toHaveAttribute('href', '/translate/');
    const privacyLink = screen.getByText('Privacy').closest('a');
    expect(privacyLink).toHaveAttribute('href', '/privacy/');
  });

  it('shows the development branch chip by default and hides it when disabled in storage', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.getByText('test-branch')).toBeInTheDocument();

    unmount();

    localStorage.setItem('glossboss-dev-branch-chip-enabled', 'false');

    render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.queryByText('test-branch')).not.toBeInTheDocument();
  });

  it('hides the development branch chip when the cursor gets close and restores it on leave', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <Index />
        </AppProviders>
      </MemoryRouter>,
    );

    const branchLabel = screen.getByText('test-branch');
    const chip = branchLabel.closest('div[style*="position: fixed"]');

    expect(chip).toBeTruthy();
    expect(chip).toHaveStyle({ pointerEvents: 'auto' });

    fireEvent.mouseMove(window, {
      clientX: window.innerWidth - 16,
      clientY: window.innerHeight - 16,
    });

    await waitFor(() => {
      expect(chip).toHaveStyle({ pointerEvents: 'none' });
    });

    fireEvent.mouseLeave(window);

    await waitFor(() => {
      expect(chip).toHaveStyle({ pointerEvents: 'auto' });
    });
  });
});
