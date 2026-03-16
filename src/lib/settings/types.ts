/**
 * Cloud Settings Types
 *
 * Defines the payload shape for syncing user settings to Supabase.
 * Cloud sync is fully opt-in — disabled by default.
 */

import type { ContainerWidth } from '@/lib/container-width';
import type { AppLanguage } from '@/lib/app-language';
import type { TranslationProviderId } from '@/lib/translation';
import type { DeepLApiType, DeepLFormality } from '@/lib/deepl';
import type { TtsProviderId } from '@/lib/tts';

/** Always-synced user preferences (no sensitive data). */
export interface CloudSettingsPreferences {
  appLanguage: AppLanguage;
  containerWidth: ContainerWidth;
  glossaryLocale: string;
  glossaryEnforcementEnabled: boolean;
  navSkipTranslated: boolean;
  speechEnabled: boolean;
  translateEnabled: boolean;
}

/** Always-synced provider configuration (no API keys). */
export interface CloudSettingsProviders {
  translationProvider: TranslationProviderId;
  deepl: { apiType: DeepLApiType; formality: DeepLFormality };
  azure: { region: string; endpoint: string };
  gemini: { modelId: string; useProjectContext: boolean };
}

/** Opt-in only — API keys stored in the cloud. */
export interface CloudSettingsCredentials {
  deepl?: { apiKey: string };
  azure?: { apiKey: string };
  gemini?: { apiKey: string };
  tts?: { apiKey: string; provider: TtsProviderId };
}

/** Full cloud settings payload stored in profiles.settings JSONB. */
export interface CloudSettingsPayload {
  version: 1;
  updatedAt: string;
  preferences: CloudSettingsPreferences;
  providers: CloudSettingsProviders;
  /** @deprecated Legacy plaintext credentials — read for migration, never written. */
  credentials?: CloudSettingsCredentials;
  /** AES-256-GCM encrypted credentials (base64). */
  encryptedCredentials?: string;
}

/** localStorage key controlling whether cloud sync is enabled. */
export const CLOUD_SETTINGS_ENABLED_KEY = 'glossboss-cloud-settings-enabled';

/** localStorage key controlling whether credentials are included in sync. */
export const CLOUD_CREDENTIAL_SYNC_KEY = 'glossboss-cloud-credential-sync';
