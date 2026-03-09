import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import * as deepl from '@/lib/deepl';
import { TranslateButton } from './TranslateButton';

function renderWithMantine(display: 'icon' | 'button' = 'icon') {
  return render(
    <MantineProvider>
      <TranslateButton text="Hello" targetLang="DE" display={display} onTranslated={vi.fn()} />
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TranslateButton', () => {
  it('disables the inline translate action when no DeepL API key is configured', async () => {
    const user = userEvent.setup();
    const getDeepLClientSpy = vi.spyOn(deepl, 'getDeepLClient');

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('icon');

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    await user.click(button);

    expect(getDeepLClientSpy).not.toHaveBeenCalled();
  });

  it('shows a settings tooltip when the inline action is disabled by missing DeepL credentials', async () => {
    const user = userEvent.setup();

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('icon');

    const button = screen.getByRole('button');
    await user.hover(button.parentElement as HTMLElement);

    expect(
      await screen.findByText(/add your deepl api key in settings to enable translation/i),
    ).toBeInTheDocument();
  });

  it('disables the sidebar translate action when no DeepL API key is configured', async () => {
    const user = userEvent.setup();
    const getDeepLClientSpy = vi.spyOn(deepl, 'getDeepLClient');

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('button');

    const button = screen.getByRole('button', { name: /translate with deepl/i });
    expect(button).toBeDisabled();

    await user.click(button);

    expect(getDeepLClientSpy).not.toHaveBeenCalled();
  });

  it('shows a settings tooltip when the sidebar action is disabled by missing DeepL credentials', async () => {
    const user = userEvent.setup();

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(false);

    renderWithMantine('button');

    const button = screen.getByRole('button', { name: /translate with deepl/i });
    await user.hover(button.parentElement as HTMLElement);

    expect(
      await screen.findByText(/add your deepl api key in settings to enable translation/i),
    ).toBeInTheDocument();
  });
});
