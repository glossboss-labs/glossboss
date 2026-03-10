import {
  getDeepLSettings,
  isPersistEnabled,
  saveDeepLSettings,
  setPersistEnabled,
  type DeepLApiType,
  type DeepLFormality,
} from '@/lib/deepl';
import { CONTAINER_WIDTH_OPTIONS, type ContainerWidth } from '@/lib/container-width';

const APP_SETTINGS_SCHEMA = 'glossboss-settings';
const APP_SETTINGS_VERSION = 1;
const VALID_API_TYPES: DeepLApiType[] = ['free', 'pro'];
const VALID_FORMALITY_VALUES: DeepLFormality[] = ['prefer_less', 'prefer_more'];
const VALID_CONTAINER_WIDTHS = CONTAINER_WIDTH_OPTIONS.map((option) => option.value);

interface AppSettingsPreferences {
  glossaryLocale: string;
  glossaryEnforcementEnabled: boolean;
  navSkipTranslated: boolean;
  containerWidth: ContainerWidth;
  branchChipEnabled?: boolean;
  speechEnabled?: boolean;
  translateEnabled?: boolean;
}

interface AppSettingsDeepLCredentials {
  apiKey: string;
  persistKey: boolean;
}

interface AppSettingsDeepL {
  apiType: DeepLApiType;
  formality: DeepLFormality;
  credentials?: AppSettingsDeepLCredentials;
}

export interface AppSettingsSnapshot {
  deepl: AppSettingsDeepL & AppSettingsDeepLCredentials;
  preferences: AppSettingsPreferences;
}

export interface AppSettingsFile {
  schema: typeof APP_SETTINGS_SCHEMA;
  version: typeof APP_SETTINGS_VERSION;
  exportedAt: string;
  deepl: AppSettingsDeepL;
  preferences: AppSettingsPreferences;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApiType(value: unknown): value is DeepLApiType {
  return typeof value === 'string' && VALID_API_TYPES.includes(value as DeepLApiType);
}

function isFormality(value: unknown): value is DeepLFormality {
  return typeof value === 'string' && VALID_FORMALITY_VALUES.includes(value as DeepLFormality);
}

function isContainerWidth(value: unknown): value is ContainerWidth {
  return typeof value === 'string' && VALID_CONTAINER_WIDTHS.includes(value as ContainerWidth);
}

function parsePreferences(value: unknown): AppSettingsPreferences {
  if (!isRecord(value)) {
    throw new Error('Settings file is missing preferences.');
  }

  const { glossaryLocale, glossaryEnforcementEnabled, navSkipTranslated, containerWidth } = value;

  if (typeof glossaryLocale !== 'string') {
    throw new Error('Settings file has an invalid glossary locale.');
  }

  if (typeof glossaryEnforcementEnabled !== 'boolean') {
    throw new Error('Settings file has an invalid glossary enforcement setting.');
  }

  if (typeof navSkipTranslated !== 'boolean') {
    throw new Error('Settings file has an invalid navigation preference.');
  }

  if (!isContainerWidth(containerWidth)) {
    throw new Error('Settings file has an invalid container width.');
  }

  if (
    'branchChipEnabled' in value &&
    value.branchChipEnabled !== undefined &&
    typeof value.branchChipEnabled !== 'boolean'
  ) {
    throw new Error('Settings file has an invalid development preference.');
  }

  return {
    glossaryLocale,
    glossaryEnforcementEnabled,
    navSkipTranslated,
    containerWidth,
    branchChipEnabled:
      typeof value.branchChipEnabled === 'boolean' ? value.branchChipEnabled : undefined,
    speechEnabled: typeof value.speechEnabled === 'boolean' ? value.speechEnabled : undefined,
    translateEnabled:
      typeof value.translateEnabled === 'boolean' ? value.translateEnabled : undefined,
  };
}

function parseDeepL(value: unknown): AppSettingsDeepL {
  if (!isRecord(value)) {
    throw new Error('Settings file is missing DeepL settings.');
  }

  if (!isApiType(value.apiType)) {
    throw new Error('Settings file has an invalid DeepL API type.');
  }

  if (!isFormality(value.formality)) {
    throw new Error('Settings file has an invalid DeepL formality preference.');
  }

  if (!('credentials' in value) || value.credentials === undefined) {
    return {
      apiType: value.apiType,
      formality: value.formality,
    };
  }

  if (!isRecord(value.credentials)) {
    throw new Error('Settings file has invalid DeepL credentials.');
  }

  if (typeof value.credentials.apiKey !== 'string') {
    throw new Error('Settings file has an invalid DeepL API key.');
  }

  if (typeof value.credentials.persistKey !== 'boolean') {
    throw new Error('Settings file has an invalid DeepL persistence setting.');
  }

  return {
    apiType: value.apiType,
    formality: value.formality,
    credentials: {
      apiKey: value.credentials.apiKey,
      persistKey: value.credentials.persistKey,
    },
  };
}

export function createAppSettingsFile(
  snapshot: AppSettingsSnapshot,
  options: { includeApiKey: boolean },
): AppSettingsFile {
  const file: AppSettingsFile = {
    schema: APP_SETTINGS_SCHEMA,
    version: APP_SETTINGS_VERSION,
    exportedAt: new Date().toISOString(),
    deepl: {
      apiType: snapshot.deepl.apiType,
      formality: snapshot.deepl.formality,
    },
    preferences: snapshot.preferences,
  };

  if (options.includeApiKey && snapshot.deepl.apiKey.trim()) {
    file.deepl.credentials = {
      apiKey: snapshot.deepl.apiKey,
      persistKey: snapshot.deepl.persistKey,
    };
  }

  return file;
}

export function serializeAppSettingsFile(file: AppSettingsFile): string {
  return JSON.stringify(file, null, 2);
}

export function parseAppSettingsFile(content: string): AppSettingsFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Settings file is not valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Settings file has an invalid shape.');
  }

  if (parsed.schema !== APP_SETTINGS_SCHEMA) {
    throw new Error('This file is not a GlossBoss settings export.');
  }

  if (parsed.version !== APP_SETTINGS_VERSION) {
    throw new Error(`Unsupported settings file version: ${String(parsed.version)}.`);
  }

  if (typeof parsed.exportedAt !== 'string') {
    throw new Error('Settings file is missing an export timestamp.');
  }

  return {
    schema: APP_SETTINGS_SCHEMA,
    version: APP_SETTINGS_VERSION,
    exportedAt: parsed.exportedAt,
    deepl: parseDeepL(parsed.deepl),
    preferences: parsePreferences(parsed.preferences),
  };
}

export function settingsFileHasCredentials(file: AppSettingsFile): boolean {
  return Boolean(file.deepl.credentials?.apiKey.trim());
}

export function applyAppSettingsFile(
  file: AppSettingsFile,
  options: { includeApiKey: boolean },
): AppSettingsSnapshot {
  const currentDeepL = getDeepLSettings();
  const shouldImportCredentials = options.includeApiKey && settingsFileHasCredentials(file);

  if (shouldImportCredentials && file.deepl.credentials) {
    setPersistEnabled(file.deepl.credentials.persistKey);
    saveDeepLSettings({
      apiKey: file.deepl.credentials.apiKey,
      apiType: file.deepl.apiType,
      formality: file.deepl.formality,
    });
  } else {
    saveDeepLSettings({
      apiKey: currentDeepL.apiKey,
      apiType: file.deepl.apiType,
      formality: file.deepl.formality,
    });
  }

  const appliedDeepL = getDeepLSettings();

  return {
    deepl: {
      apiKey: appliedDeepL.apiKey,
      apiType: appliedDeepL.apiType,
      formality: appliedDeepL.formality,
      persistKey: isPersistEnabled(),
    },
    preferences: file.preferences,
  };
}

export function createAppSettingsFilename(date = new Date()): string {
  return `glossboss-settings-${date.toISOString().replace(/[:.]/g, '-')}.json`;
}
