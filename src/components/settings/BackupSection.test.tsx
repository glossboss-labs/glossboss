import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as appSettings from '@/lib/app-settings';
import {
  CONTAINER_WIDTH_KEY,
  DEV_BRANCH_CHIP_KEY,
  SPEECH_ENABLED_KEY,
  TRANSLATE_ENABLED_KEY,
} from '@/lib/constants/storage-keys';
import { AppProviders } from '@/providers';
import { BackupSection } from './BackupSection';

describe('BackupSection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('exports stored standalone preferences instead of fallback defaults', async () => {
    const user = userEvent.setup();
    const createAppSettingsFileSpy = vi.spyOn(appSettings, 'createAppSettingsFile');

    localStorage.setItem(CONTAINER_WIDTH_KEY, 'md');
    localStorage.setItem(DEV_BRANCH_CHIP_KEY, 'false');
    localStorage.setItem(SPEECH_ENABLED_KEY, 'false');
    localStorage.setItem(TRANSLATE_ENABLED_KEY, 'false');

    render(
      <AppProviders>
        <BackupSection />
      </AppProviders>,
    );

    await user.click(screen.getByRole('button', { name: /export settings/i }));

    expect(createAppSettingsFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          containerWidth: 'md',
          speechEnabled: false,
          translateEnabled: false,
        }),
      }),
      { includeApiKey: false },
    );
  });
});
