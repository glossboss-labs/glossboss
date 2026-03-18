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
import { getAzureSettings, isAzurePersistEnabled } from './azure';
import { getDeepLSettings, isPersistEnabled, saveDeepLSettings, setPersistEnabled } from './deepl';
import { getGeminiSettings, isGeminiPersistEnabled } from './gemini';
import { getActiveTranslationProvider } from './translation';

const baseSnapshot: AppSettingsSnapshot = {
  translationProvider: 'google',
  deepl: {
    apiKey: 'deepl-key',
    apiType: 'pro',
    formality: 'prefer_more',
    persistKey: true,
  },
  azure: {
    apiKey: 'azure-key',
    region: 'westeurope',
    endpoint: 'https://api.cognitive.microsofttranslator.com',
    persistKey: true,
  },
  gemini: {
    apiKey: 'gemini-key',
    modelId: 'gemini-2.5-flash-lite',
    useProjectContext: true,
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
    expect(file.version).toBe(2);
    expect(file.deepl.credentials).toBeUndefined();
    expect(file.azure.credentials).toBeUndefined();
    expect(file.gemini.credentials).toBeUndefined();
    expect(file.preferences).toEqual(baseSnapshot.preferences);
  });

  it('includes credentials when requested', () => {
    const file = createAppSettingsFile(baseSnapshot, { includeApiKey: true });

    expect(file.deepl.credentials).toEqual({
      apiKey: 'deepl-key',
      persistKey: true,
    });
    expect(file.azure.credentials).toEqual({
      apiKey: 'azure-key',
      persistKey: true,
    });
    expect(file.gemini.credentials).toEqual({
      apiKey: 'gemini-key',
      persistKey: true,
    });
    expect(settingsFileHasCredentials(file)).toBe(true);
  });

  it('parses a serialized settings file', () => {
    const content = serializeAppSettingsFile(
      createAppSettingsFile(baseSnapshot, { includeApiKey: true }),
    );

    expect(parseAppSettingsFile(content)).toMatchObject({
      translationProvider: 'google',
      deepl: {
        apiType: 'pro',
        formality: 'prefer_more',
        credentials: {
          apiKey: 'deepl-key',
          persistKey: true,
        },
      },
      azure: {
        region: 'westeurope',
        endpoint: 'https://api.cognitive.microsofttranslator.com',
        credentials: {
          apiKey: 'azure-key',
          persistKey: true,
        },
      },
      gemini: {
        modelId: 'gemini-2.5-flash-lite',
        useProjectContext: true,
        credentials: {
          apiKey: 'gemini-key',
          persistKey: true,
        },
      },
      preferences: baseSnapshot.preferences,
    });
  });

  it('imports v1 settings files with default Azure and Gemini settings', () => {
    const v1File = JSON.stringify({
      schema: 'glossboss-settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      deepl: {
        apiType: 'free',
        formality: 'prefer_less',
        credentials: { apiKey: 'old-deepl-key', persistKey: false },
      },
      preferences: {
        glossaryLocale: 'de',
        glossaryEnforcementEnabled: true,
        navSkipTranslated: false,
        containerWidth: 'xl',
      },
    });

    const parsed = parseAppSettingsFile(v1File);

    expect(parsed.version).toBe(2);
    expect(parsed.translationProvider).toBe('deepl');
    expect(parsed.deepl.apiType).toBe('free');
    expect(parsed.deepl.credentials?.apiKey).toBe('old-deepl-key');
    expect(parsed.azure).toEqual({
      region: '',
      endpoint: 'https://api.cognitive.microsofttranslator.com',
    });
    expect(parsed.gemini).toEqual({
      modelId: 'gemini-flash-lite-latest',
      useProjectContext: false,
    });
  });

  it('rejects unsupported settings versions', () => {
    expect(() =>
      parseAppSettingsFile(
        JSON.stringify({
          schema: 'glossboss-settings',
          version: 99,
          exportedAt: new Date().toISOString(),
          translationProvider: 'deepl',
          deepl: {
            apiType: 'free',
            formality: 'prefer_less',
          },
          azure: {
            region: 'westeurope',
            endpoint: 'https://api.cognitive.microsofttranslator.com',
          },
          gemini: {
            modelId: 'gemini-2.5-flash-lite',
            useProjectContext: false,
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

  it('rejects files with the wrong schema', () => {
    expect(() =>
      parseAppSettingsFile(
        JSON.stringify({
          schema: 'not-glossboss-settings',
          version: 2,
          exportedAt: new Date().toISOString(),
          translationProvider: 'deepl',
          deepl: {
            apiType: 'free',
            formality: 'prefer_less',
          },
          azure: {
            region: 'westeurope',
            endpoint: 'https://api.cognitive.microsofttranslator.com',
          },
          gemini: {
            modelId: 'gemini-2.5-flash-lite',
            useProjectContext: false,
          },
          preferences: {
            glossaryLocale: '',
            glossaryEnforcementEnabled: true,
            navSkipTranslated: true,
            containerWidth: 'xl',
          },
        }),
      ),
    ).toThrow('This file is not a GlossBoss settings export.');
  });

  it('imports credentials when allowed', () => {
    const file = createAppSettingsFile(baseSnapshot, { includeApiKey: true });

    const applied = applyAppSettingsFile(file, { includeApiKey: true });

    expect(getDeepLSettings()).toMatchObject({
      apiKey: 'deepl-key',
      apiType: 'pro',
      formality: 'prefer_more',
    });
    expect(getAzureSettings()).toMatchObject({
      apiKey: 'azure-key',
      region: 'westeurope',
    });
    expect(getGeminiSettings()).toMatchObject({
      apiKey: 'gemini-key',
      modelId: 'gemini-2.5-flash-lite',
      useProjectContext: true,
    });
    expect(isPersistEnabled()).toBe(true);
    expect(isAzurePersistEnabled()).toBe(true);
    expect(isGeminiPersistEnabled()).toBe(true);
    expect(getActiveTranslationProvider()).toBe('google');
    expect(applied.deepl.persistKey).toBe(true);
    expect(applied.azure.persistKey).toBe(true);
    expect(applied.gemini.persistKey).toBe(true);
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
