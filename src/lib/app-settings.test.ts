import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyAppSettingsFile,
  createAppSettingsFile,
  createAppSettingsFilename,
  parseAppSettingsFile,
  serializeAppSettingsFile,
  settingsFileHasCredentials,
  type AppSettingsSnapshot,
} from './app-settings';
import { getDeepLSettings, isPersistEnabled, saveDeepLSettings, setPersistEnabled } from './deepl';

const baseSnapshot: AppSettingsSnapshot = {
  deepl: {
    apiKey: 'deepl-key',
    apiType: 'pro',
    formality: 'prefer_more',
    persistKey: true,
  },
  preferences: {
    glossaryLocale: 'nl',
    glossaryEnforcementEnabled: false,
    navSkipTranslated: true,
    containerWidth: '100%',
    branchChipEnabled: false,
  },
};

describe('app settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('creates a settings file without credentials by default', () => {
    const file = createAppSettingsFile(baseSnapshot, { includeApiKey: false });

    expect(file.schema).toBe('glossboss-settings');
    expect(file.version).toBe(1);
    expect(file.deepl.credentials).toBeUndefined();
    expect(file.preferences).toEqual(baseSnapshot.preferences);
  });

  it('includes credentials when requested', () => {
    const file = createAppSettingsFile(baseSnapshot, { includeApiKey: true });

    expect(file.deepl.credentials).toEqual({
      apiKey: 'deepl-key',
      persistKey: true,
    });
    expect(settingsFileHasCredentials(file)).toBe(true);
  });

  it('parses a serialized settings file', () => {
    const content = serializeAppSettingsFile(
      createAppSettingsFile(baseSnapshot, { includeApiKey: true }),
    );

    expect(parseAppSettingsFile(content)).toMatchObject({
      deepl: {
        apiType: 'pro',
        formality: 'prefer_more',
        credentials: {
          apiKey: 'deepl-key',
          persistKey: true,
        },
      },
      preferences: baseSnapshot.preferences,
    });
  });

  it('rejects unsupported settings versions', () => {
    expect(() =>
      parseAppSettingsFile(
        JSON.stringify({
          schema: 'glossboss-settings',
          version: 99,
          exportedAt: new Date().toISOString(),
          deepl: {
            apiType: 'free',
            formality: 'prefer_less',
          },
          preferences: {
            glossaryLocale: '',
            glossaryEnforcementEnabled: true,
            navSkipTranslated: true,
            containerWidth: 'xl',
          },
        }),
      ),
    ).toThrow(/Unsupported settings file version/);
  });

  it('imports credentials when allowed', () => {
    const file = createAppSettingsFile(baseSnapshot, { includeApiKey: true });

    const applied = applyAppSettingsFile(file, { includeApiKey: true });

    expect(getDeepLSettings()).toMatchObject({
      apiKey: 'deepl-key',
      apiType: 'pro',
      formality: 'prefer_more',
    });
    expect(isPersistEnabled()).toBe(true);
    expect(applied.deepl.persistKey).toBe(true);
    expect(applied.preferences.containerWidth).toBe('100%');
  });

  it('preserves the current key when imported credentials are skipped', () => {
    setPersistEnabled(true);
    saveDeepLSettings({
      apiKey: 'current-key',
      apiType: 'free',
      formality: 'prefer_less',
    });

    const file = createAppSettingsFile(baseSnapshot, { includeApiKey: true });

    const applied = applyAppSettingsFile(file, { includeApiKey: false });

    expect(getDeepLSettings()).toMatchObject({
      apiKey: 'current-key',
      apiType: 'pro',
      formality: 'prefer_more',
    });
    expect(isPersistEnabled()).toBe(true);
    expect(applied.deepl.apiKey).toBe('current-key');
  });

  it('builds a timestamped filename', () => {
    const filename = createAppSettingsFilename(new Date('2026-03-10T12:34:56.789Z'));

    expect(filename).toBe('glossboss-settings-2026-03-10T12-34-56-789Z.json');
  });
});
