import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SpeakButton } from './SpeakButton';
import { saveTtsSettings } from '@/lib/tts';

describe('SpeakButton', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('disables ElevenLabs playback when quota is exhausted', () => {
    saveTtsSettings({
      provider: 'elevenlabs',
      apiKey: 'test_api_key_1234567890',
      elevenLabsUsage: {
        characterCount: 1000,
        characterLimit: 1000,
      },
    });

    render(
      <MantineProvider>
        <SpeakButton kind="translation" entryId="entry-1" text="Hallo wereld" lang="nl-NL" />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: /play translation/i })).toBeDisabled();
  });
});
