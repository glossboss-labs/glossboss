import {
  getAzureSettings,
  isAzurePersistEnabled,
  saveAzureSettings,
  setAzurePersistEnabled,
} from '@/lib/azure';
import {
  getDeepLSettings,
  isPersistEnabled,
  saveDeepLSettings,
  setPersistEnabled,
  type DeepLApiType,
  type DeepLFormality,
} from '@/lib/deepl';
import {
  getGeminiSettings,
  isGeminiPersistEnabled,
  saveGeminiSettings,
  setGeminiPersistEnabled,
} from '@/lib/gemini';
import {
  getTranslationProviderSettings,
  saveActiveTranslationProvider,
  type TranslationProviderId,
} from '@/lib/translation';
import { CONTAINER_WIDTH_OPTIONS, type ContainerWidth } from '@/lib/container-width';

const APP_SETTINGS_SCHEMA = 'glossboss-settings';
const APP_SETTINGS_VERSION = 2;
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

interface AppSettingsAzureCredentials {
  apiKey: string;
  persistKey: boolean;
}

interface AppSettingsAzure {
  region: string;
  endpoint: string;
  credentials?: AppSettingsAzureCredentials;
}

interface AppSettingsGeminiCredentials {
  apiKey: string;
  persistKey: boolean;
}

interface AppSettingsGemini {
  modelId: string;
  useProjectContext: boolean;
  credentials?: AppSettingsGeminiCredentials;
}

export interface AppSettingsSnapshot {
  translationProvider: TranslationProviderId;
  deepl: AppSettingsDeepL & AppSettingsDeepLCredentials;
  azure: AppSettingsAzure & AppSettingsAzureCredentials;
  gemini: AppSettingsGemini & AppSettingsGeminiCredentials;
  preferences: AppSettingsPreferences;
}

export interface AppSettingsFile {
  schema: typeof APP_SETTINGS_SCHEMA;
  version: typeof APP_SETTINGS_VERSION;
  exportedAt: string;
  translationProvider: TranslationProviderId;
  deepl: AppSettingsDeepL;
  azure: AppSettingsAzure;
  gemini: AppSettingsGemini;
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

function isProvider(value: unknown): value is TranslationProviderId {
  return value === 'deepl' || value === 'azure' || value === 'gemini';
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

function parseAzure(value: unknown): AppSettingsAzure {
  if (!isRecord(value)) {
    throw new Error('Settings file is missing Azure settings.');
  }

  if (typeof value.region !== 'string') {
    throw new Error('Settings file has an invalid Azure region.');
  }

  if (typeof value.endpoint !== 'string') {
    throw new Error('Settings file has an invalid Azure endpoint.');
  }

  if (!('credentials' in value) || value.credentials === undefined) {
    return {
      region: value.region,
      endpoint: value.endpoint,
    };
  }

  if (!isRecord(value.credentials)) {
    throw new Error('Settings file has invalid Azure credentials.');
  }

  if (typeof value.credentials.apiKey !== 'string') {
    throw new Error('Settings file has an invalid Azure API key.');
  }

  if (typeof value.credentials.persistKey !== 'boolean') {
    throw new Error('Settings file has an invalid Azure persistence setting.');
  }

  return {
    region: value.region,
    endpoint: value.endpoint,
    credentials: {
      apiKey: value.credentials.apiKey,
      persistKey: value.credentials.persistKey,
    },
  };
}

function parseGemini(value: unknown): AppSettingsGemini {
  if (!isRecord(value)) {
    throw new Error('Settings file is missing Gemini settings.');
  }

  if (typeof value.modelId !== 'string') {
    throw new Error('Settings file has an invalid Gemini model.');
  }

  if (typeof value.useProjectContext !== 'boolean') {
    throw new Error('Settings file has an invalid Gemini context setting.');
  }

  if (!('credentials' in value) || value.credentials === undefined) {
    return {
      modelId: value.modelId,
      useProjectContext: value.useProjectContext,
    };
  }

  if (!isRecord(value.credentials)) {
    throw new Error('Settings file has invalid Gemini credentials.');
  }

  if (typeof value.credentials.apiKey !== 'string') {
    throw new Error('Settings file has an invalid Gemini API key.');
  }

  if (typeof value.credentials.persistKey !== 'boolean') {
    throw new Error('Settings file has an invalid Gemini persistence setting.');
  }

  return {
    modelId: value.modelId,
    useProjectContext: value.useProjectContext,
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
    translationProvider: snapshot.translationProvider,
    deepl: {
      apiType: snapshot.deepl.apiType,
      formality: snapshot.deepl.formality,
    },
    azure: {
      region: snapshot.azure.region,
      endpoint: snapshot.azure.endpoint,
    },
    gemini: {
      modelId: snapshot.gemini.modelId,
      useProjectContext: snapshot.gemini.useProjectContext,
    },
    preferences: snapshot.preferences,
  };

  if (options.includeApiKey && snapshot.deepl.apiKey.trim()) {
    file.deepl.credentials = {
      apiKey: snapshot.deepl.apiKey,
      persistKey: snapshot.deepl.persistKey,
    };
  }

  if (options.includeApiKey && snapshot.azure.apiKey.trim()) {
    file.azure.credentials = {
      apiKey: snapshot.azure.apiKey,
      persistKey: snapshot.azure.persistKey,
    };
  }

  if (options.includeApiKey && snapshot.gemini.apiKey.trim()) {
    file.gemini.credentials = {
      apiKey: snapshot.gemini.apiKey,
      persistKey: snapshot.gemini.persistKey,
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
    translationProvider: isProvider(parsed.translationProvider)
      ? parsed.translationProvider
      : 'deepl',
    deepl: parseDeepL(parsed.deepl),
    azure: parseAzure(parsed.azure),
    gemini: parseGemini(parsed.gemini),
    preferences: parsePreferences(parsed.preferences),
  };
}

export function settingsFileHasCredentials(file: AppSettingsFile): boolean {
  return Boolean(
    file.deepl.credentials?.apiKey.trim() ||
    file.azure.credentials?.apiKey.trim() ||
    file.gemini.credentials?.apiKey.trim(),
  );
}

export function applyAppSettingsFile(
  file: AppSettingsFile,
  options: { includeApiKey: boolean },
): AppSettingsSnapshot {
  const currentDeepL = getDeepLSettings();
  const currentAzure = getAzureSettings();
  const currentGemini = getGeminiSettings();
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

  if (shouldImportCredentials && file.azure.credentials) {
    setAzurePersistEnabled(file.azure.credentials.persistKey);
    saveAzureSettings({
      apiKey: file.azure.credentials.apiKey,
      region: file.azure.region,
      endpoint: file.azure.endpoint,
    });
  } else {
    saveAzureSettings({
      apiKey: currentAzure.apiKey,
      region: file.azure.region,
      endpoint: file.azure.endpoint,
    });
  }

  if (shouldImportCredentials && file.gemini.credentials) {
    setGeminiPersistEnabled(file.gemini.credentials.persistKey);
    saveGeminiSettings({
      apiKey: file.gemini.credentials.apiKey,
      modelId: file.gemini.modelId,
      useProjectContext: file.gemini.useProjectContext,
    });
  } else {
    saveGeminiSettings({
      apiKey: currentGemini.apiKey,
      modelId: file.gemini.modelId,
      useProjectContext: file.gemini.useProjectContext,
    });
  }

  saveActiveTranslationProvider(file.translationProvider);

  const appliedDeepL = getDeepLSettings();
  const appliedAzure = getAzureSettings();
  const appliedGemini = getGeminiSettings();

  return {
    translationProvider: getTranslationProviderSettings().provider,
    deepl: {
      apiKey: appliedDeepL.apiKey,
      apiType: appliedDeepL.apiType,
      formality: appliedDeepL.formality,
      persistKey: isPersistEnabled(),
    },
    azure: {
      apiKey: appliedAzure.apiKey,
      region: appliedAzure.region,
      endpoint: appliedAzure.endpoint,
      persistKey: isAzurePersistEnabled(),
    },
    gemini: {
      apiKey: appliedGemini.apiKey,
      modelId: appliedGemini.modelId,
      useProjectContext: appliedGemini.useProjectContext,
      persistKey: isGeminiPersistEnabled(),
    },
    preferences: file.preferences,
  };
}

export function createAppSettingsFilename(date = new Date()): string {
  return `glossboss-settings-${date.toISOString().replace(/[:.]/g, '-')}.json`;
}
