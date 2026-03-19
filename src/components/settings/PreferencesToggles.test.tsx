import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '@/providers';
import { SPEECH_ENABLED_KEY, TRANSLATE_ENABLED_KEY } from '@/lib/constants/storage-keys';
import { SpeechSection } from './SpeechSection';
import { TranslationSection } from './TranslationSection';

function renderWithProviders(node: ReactNode) {
  return render(
    <MemoryRouter>
      <AppProviders>{node}</AppProviders>
    </MemoryRouter>,
  );
}

describe('Settings preference toggles', () => {
  it('persists the speech toggle when the section is used standalone', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SpeechSection />);

    const speechToggle = screen.getByRole('switch', { name: /enable speech playback/i });
    expect(speechToggle).toBeChecked();

    await user.click(speechToggle);

    expect(speechToggle).not.toBeChecked();
    expect(localStorage.getItem(SPEECH_ENABLED_KEY)).toBe('false');
  });

  it('persists the translation toggle when the section is used standalone', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TranslationSection />);

    const translationToggle = screen.getByRole('switch', {
      name: /enable machine translation/i,
    });
    expect(translationToggle).toBeChecked();

    await user.click(translationToggle);

    expect(translationToggle).not.toBeChecked();
    expect(localStorage.getItem(TRANSLATE_ENABLED_KEY)).toBe('false');
  });
});
