import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/providers';
import Index from '@/pages/Index';
import { useEditorStore } from '@/stores/editor-store';
import { useSourceStore } from '@/stores/source-store';

const originalFetch = globalThis.fetch;
const navigatorLanguageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'language');
const navigatorLanguagesDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'languages');

const WORDPRESS_EXAMPLE_PO = `
msgid ""
msgstr ""
"Project-Id-Version: Hello Dolly 1.7.2\\n"
"Report-Msgid-Bugs-To: https://wordpress.org/support/plugin/hello-dolly/\\n"
"POT-Creation-Date: 2025-01-01 00:00+0000\\n"
"PO-Revision-Date: 2025-01-01 00:00+0000\\n"
"Last-Translator: GlossBoss Example\\n"
"Language-Team: German\\n"
"Language: de_DE\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"X-Domain: hello-dolly\\n"

#: hello.php:18
msgid "Hello Dolly"
msgstr "Hallo Dolly"

#: hello.php:47
msgid "This is not just a plugin, it symbolizes the hope and enthusiasm of an entire generation summed up in two words sung most famously by Louis Armstrong."
msgstr "Dies ist nicht nur ein Plugin, sondern ein Symbol für die Hoffnung und den Enthusiasmus einer ganzen Generation."

#: hello.php:84
msgid "Donate"
msgstr "Spenden"
`.trim();

function setNavigatorLocale(language: string, languages = [language]) {
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
    useEditorStore.getState().clearEditor();
    useSourceStore.getState().clearSource();
    setNavigatorLocale('en-US');
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    if (navigatorLanguageDescriptor) {
      Object.defineProperty(window.navigator, 'language', navigatorLanguageDescriptor);
    }
    if (navigatorLanguagesDescriptor) {
      Object.defineProperty(window.navigator, 'languages', navigatorLanguagesDescriptor);
    }
    globalThis.fetch = originalFetch;
  });

  it('renders a feedback button and opens feedback modal', async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    const feedbackButton = screen.getByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();

    await user.click(feedbackButton);

    expect(await screen.findByText('Share Feedback')).toBeInTheDocument();
  });

  it('loads the example PO from the empty state, uses the device locale, and hides the action afterward', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(WORDPRESS_EXAMPLE_PO, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }),
    );
    globalThis.fetch = fetchMock;
    setNavigatorLocale('de-DE');

    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    expect(screen.getByRole('button', { name: /load example po/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load example po/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().filename).toBe('hello-dolly-nl_NL.po');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/projects/wp-plugins/hello-dolly/stable/de/default/export-translations/',
      ),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(useEditorStore.getState().entries).toHaveLength(3);
    expect(useSourceStore.getState().autoDetectedSlug).toBe('hello-dolly');
    expect(useSourceStore.getState().pluginVersion).toBe('1.7.2');
    expect(screen.getByText('Auto-detected: hello-dolly')).toBeInTheDocument();
    expect(screen.getByText('Detected: DE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load example po/i })).not.toBeInTheDocument();
  });

  it('falls back to the bundled example when WordPress is unavailable', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    await user.click(screen.getByRole('button', { name: /load example po/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().filename).toBe('hello-dolly-nl_NL.po');
    });

    expect(useEditorStore.getState().entries).toHaveLength(3);
    expect(useSourceStore.getState().autoDetectedSlug).toBe('hello-dolly');
    expect(screen.getByText('Detected: NL')).toBeInTheDocument();
  });

  it('renders footer links for source, license, and privacy', () => {
    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://github.com/lammersbjorn/glossboss',
    );
    expect(screen.getByRole('link', { name: 'License' })).toHaveAttribute('href', '/license/');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
  });

  it('shows the development branch chip by default and hides it when disabled in storage', () => {
    const { unmount } = render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    expect(screen.getByText('test-branch')).toBeInTheDocument();

    unmount();

    localStorage.setItem('glossboss-dev-branch-chip-enabled', 'false');

    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    expect(screen.queryByText('test-branch')).not.toBeInTheDocument();
  });

  it('hides the development branch chip when the cursor gets close and restores it on leave', async () => {
    render(
      <AppProviders>
        <Index />
      </AppProviders>,
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
