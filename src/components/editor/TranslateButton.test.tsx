import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router';
import * as deepl from '@/lib/deepl';
import { TranslateButton } from './TranslateButton';

function renderWithMantine(display: 'icon' | 'button' = 'icon') {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <TranslateButton text="Hello" targetLang="DE" display={display} onTranslated={vi.fn()} />
      </MantineProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TranslateButton', () => {
  it('opens a recovery popover for the inline translate action when no DeepL API key is configured', async () => {
    const user = userEvent.setup();
    const getDeepLClientSpy = vi.spyOn(deepl, 'getDeepLClient');

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('icon');

    const button = screen.getByRole('button', {
      name: /add your deepl api key in settings to enable translation/i,
    });
    await user.click(button);

    expect(await screen.findByText(/deepl needs setup/i)).toBeInTheDocument();
    expect(await screen.findByText(/set up deepl/i)).toBeInTheDocument();
    expect(getDeepLClientSpy).not.toHaveBeenCalled();
  });

  it('shows an inline recovery path for the icon action when credentials are missing', async () => {
    const user = userEvent.setup();

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('icon');

    const button = screen.getByRole('button', {
      name: /add your deepl api key in settings to enable translation/i,
    });
    await user.click(button);

    expect(
      await screen.findByText(/this editor is using your personal default provider/i),
    ).toBeInTheDocument();
  });

  it('opens a recovery popover for the sidebar translate action when no DeepL API key is configured', async () => {
    const user = userEvent.setup();
    const getDeepLClientSpy = vi.spyOn(deepl, 'getDeepLClient');

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('button');

    const button = screen.getByRole('button', { name: /translate with deepl/i });
    await user.click(button);

    expect(await screen.findByText(/deepl needs setup/i)).toBeInTheDocument();
    expect(getDeepLClientSpy).not.toHaveBeenCalled();
  });

  it('shows an inline recovery path for the sidebar action when credentials are missing', async () => {
    const user = userEvent.setup();

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('button');

    const button = screen.getByRole('button', { name: /translate with deepl/i });
    await user.click(button);

    expect(await screen.findByText(/set up deepl/i)).toBeInTheDocument();
  });
});
