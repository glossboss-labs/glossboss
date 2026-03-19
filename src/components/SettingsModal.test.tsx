import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SettingsModal } from './SettingsModal';
import { AppProviders } from '@/providers';
import { APP_LANGUAGE_STORAGE_KEY } from '@/lib/app-language';
import { getDeepLSettings, saveDeepLSettings } from '@/lib/deepl';
import * as tts from '@/lib/tts';

const SLOW_UI_TEST_TIMEOUT = 30_000;

function renderModal() {
  return render(
    <MemoryRouter>
      <AppProviders>
        <SettingsModal opened onClose={vi.fn()} />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe('SettingsModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it(
    'resets formality to informal after clearing saved DeepL settings',
    async () => {
      const user = userEvent.setup();
      saveDeepLSettings({
        apiKey: 'existing-key',
        apiType: 'free',
        formality: 'prefer_more',
      });

      renderModal();

      // Expand the DeepL provider card to reveal the API key input
      const allButtons = screen.getAllByRole('button');
      const deeplButton = allButtons.find((btn) => btn.textContent?.includes('DeepL'));
      expect(deeplButton).toBeTruthy();
      await user.click(deeplButton!);

      const apiKeyField = await screen.findByPlaceholderText(/enter your deepl api key/i);
      await waitFor(() => {
        expect(apiKeyField).toHaveValue('existing-key');
      });

      // Find the Remove button within the DeepL card
      const deeplCard = apiKeyField.closest('[data-tour="settings-provider"]')!;
      const removeButton = Array.from(deeplCard.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Remove',
      )!;
      await user.click(removeButton);

      const newApiKeyField = await screen.findByPlaceholderText(/enter your deepl api key/i);
      await user.type(newApiKeyField, 'new-key');

      const saveButton = Array.from(
        newApiKeyField.closest('[data-tour="settings-provider"]')!.querySelectorAll('button'),
      ).find((btn) => btn.textContent === 'Save')!;
      await user.click(saveButton);

      await waitFor(() => {
        expect(getDeepLSettings()).toMatchObject({
          apiKey: 'new-key',
          apiType: 'free',
          formality: 'prefer_less',
        });
      });
    },
    SLOW_UI_TEST_TIMEOUT,
  );

  it(
    'prompts before exporting a settings file that includes an api key',
    async () => {
      const user = userEvent.setup();
      saveDeepLSettings({
        apiKey: 'existing-key',
        apiType: 'free',
        formality: 'prefer_less',
      });

      renderModal();

      await user.click(screen.getByRole('tab', { name: /backup/i }));
      await user.click(screen.getByRole('button', { name: /export settings/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('dialog', { name: /include saved credentials/i }),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByRole('button', { name: /export without credentials/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^include credentials$/i })).toBeInTheDocument();
    },
    SLOW_UI_TEST_TIMEOUT,
  );

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

  it(
    'shows ElevenLabs usage details after testing a speech key',
    async () => {
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
        'not-a-real-elevenlabs-key',
      );
      await user.click(screen.getByRole('button', { name: /test connection/i }));

      expect(await screen.findByText(/950 \/ 1,000 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/usage is above 90%/i)).toBeInTheDocument();
      expect(listVoices).toHaveBeenCalled();
    },
    SLOW_UI_TEST_TIMEOUT,
  );
});
