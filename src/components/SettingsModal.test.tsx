import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from './SettingsModal';
import { AppProviders } from '@/providers';
import { APP_LANGUAGE_STORAGE_KEY } from '@/lib/app-language';
import { getDeepLSettings, saveDeepLSettings } from '@/lib/deepl';

function renderModal() {
  return render(
    <AppProviders>
      <SettingsModal opened onClose={vi.fn()} />
    </AppProviders>,
  );
}

describe('SettingsModal', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('resets formality to informal after clearing saved DeepL settings', async () => {
    const user = userEvent.setup();
    saveDeepLSettings({
      apiKey: 'existing-key',
      apiType: 'free',
      formality: 'prefer_more',
    });

    renderModal();

    await user.click(screen.getByRole('button', { name: /remove saved key/i }));

    const apiKeyInput = screen.getByLabelText(/^api key$/i);
    await user.type(apiKeyInput, 'new-key');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(getDeepLSettings()).toMatchObject({
        apiKey: 'new-key',
        apiType: 'free',
        formality: 'prefer_less',
      });
    });
  });

  it('persists the selected app language from display settings', async () => {
    const user = userEvent.setup();

    renderModal();

    await user.click(screen.getByRole('tab', { name: /display/i }));

    const languageInput = screen.getByRole('textbox', { name: /interface language/i });
    await user.click(languageInput);
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)).toBe('nl');
      expect(screen.getByRole('heading', { name: 'Instellingen' })).toBeInTheDocument();
    });
  });
});
