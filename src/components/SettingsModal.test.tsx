import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { SettingsModal } from './SettingsModal';
import { getDeepLSettings, saveDeepLSettings } from '@/lib/deepl';
import * as tts from '@/lib/tts';

function renderModal() {
  return render(
    <MantineProvider>
      <SettingsModal opened onClose={vi.fn()} />
    </MantineProvider>,
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
