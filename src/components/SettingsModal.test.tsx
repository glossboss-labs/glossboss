import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from './SettingsModal';
import { AppProviders } from '@/providers';
import { APP_LANGUAGE_STORAGE_KEY } from '@/lib/app-language';
import { getDeepLSettings, saveDeepLSettings } from '@/lib/deepl';
import * as tts from '@/lib/tts';

function renderModal() {
  return render(
    <AppProviders>
      <SettingsModal opened onClose={vi.fn()} />
    </AppProviders>,
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

    await waitFor(() => {
      expect(screen.getByLabelText(/^api key$/i)).toHaveValue('existing-key');
    });

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
  }, 10000);

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

  it('links to the translation guide from display settings', async () => {
    const user = userEvent.setup();

    renderModal();

    await user.click(screen.getByRole('tab', { name: /display/i }));

    expect(screen.getByRole('link', { name: /read the translation guide/i })).toHaveAttribute(
      'href',
      '/translate/',
    );
  });

  it('shows ElevenLabs usage details after testing a speech key', async () => {
    const user = userEvent.setup();
    const testKey = vi.fn().mockResolvedValue({
      characterCount: 950,
      characterLimit: 1000,
      tier: 'free',
      nextResetUnix: 1736000000,
    });
    const listVoices = vi.fn().mockResolvedValue([
      { voiceId: 'voice_a', name: 'Alice' },
      { voiceId: 'voice_b', name: 'Brian' },
    ]);

    vi.spyOn(tts, 'getElevenLabsClient').mockReturnValue({
      testKey,
      getUsage: testKey,
      listVoices,
      speak: vi.fn(),
    } as unknown as ReturnType<typeof tts.getElevenLabsClient>);
    vi.spyOn(tts, 'primeElevenLabsVoices').mockResolvedValue();

    renderModal();

    await user.click(screen.getByRole('tab', { name: /speech/i }));
    await user.click(screen.getByRole('radio', { name: /elevenlabs/i }));
    await user.type(
      screen.getByPlaceholderText(/enter your elevenlabs api key/i),
      'test_api_key_1234567890',
    );
    await user.click(screen.getByRole('button', { name: /test connection/i }));

    expect(await screen.findByText(/950 \/ 1,000 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/usage is above 90%/i)).toBeInTheDocument();
    expect(listVoices).toHaveBeenCalled();
  });
});
