import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { SettingsModal } from './SettingsModal';
import { getDeepLSettings, saveDeepLSettings } from '@/lib/deepl';

function renderModal() {
  return render(
    <MantineProvider>
      <SettingsModal opened onClose={vi.fn()} />
    </MantineProvider>,
  );
}

describe('SettingsModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it('prompts before exporting a settings file that includes an api key', async () => {
    const user = userEvent.setup();
    saveDeepLSettings({
      apiKey: 'existing-key',
      apiType: 'free',
      formality: 'prefer_less',
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText(/^api key$/i)).toHaveValue('existing-key');
    });

    await user.click(screen.getByRole('tab', { name: /backup/i }));
    await user.click(screen.getByRole('button', { name: /export settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /include api key/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /export without key/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^include key$/i })).toBeInTheDocument();
  });
});
