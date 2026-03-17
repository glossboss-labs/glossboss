/**
 * Cloud Settings API
 *
 * Read/write user settings to Supabase profiles.settings JSONB column.
 * Also provides helpers to collect settings from localStorage and apply
 * cloud settings back to localStorage.
 *
 * Credentials are encrypted with AES-256-GCM before storage — the
 * encryption key is derived server-side and never persisted in the database.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { getDeepLSettings, saveDeepLSettings } from '@/lib/deepl';
import { getAzureSettings, saveAzureSettings } from '@/lib/azure';
import { getGeminiSettings, saveGeminiSettings } from '@/lib/gemini';
import { getTtsSettings, saveTtsSettings } from '@/lib/tts';
import { getTranslationProviderSettings, saveActiveTranslationProvider } from '@/lib/translation';
import { getAppLanguage, saveAppLanguage } from '@/lib/app-language';
import { CONTAINER_WIDTH_KEY, type ContainerWidth } from '@/lib/container-width';
import { NAV_SKIP_TRANSLATED_KEY } from '@/components/editor/EditorTable';
import { encryptCredentials, decryptCredentials } from './crypto';
import type { CloudSettingsPayload, CloudSettingsCredentials } from './types';

const SPEECH_ENABLED_KEY = 'glossboss-speech-enabled';
const TRANSLATE_ENABLED_KEY = 'glossboss-translate-enabled';

function supabase() {
  return getSupabaseClient('Settings');
}

// ── Cloud read/write ────────────────────────────────────────

async function getUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user?.id) throw new Error('Not authenticated');
  return user.id;
}

/** Read the current user's cloud settings from profiles.settings. */
export async function readCloudSettings(): Promise<CloudSettingsPayload | null> {
  const userId = await getUserId();
  const { data, error } = await supabase()
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single();

  if (error || !data?.settings) return null;

  const payload = data.settings as Record<string, unknown>;
  if (payload.version !== 1) return null;

  const result = payload as unknown as CloudSettingsPayload;

  // Decrypt credentials if present (encrypted format takes priority)
  if (result.encryptedCredentials) {
    const decrypted = await decryptCredentials(result.encryptedCredentials);
    if (decrypted) {
      result.credentials = decrypted;
    }
    // Remove encrypted blob from the in-memory object — callers use .credentials
    delete result.encryptedCredentials;
  }
  // Legacy: if only plaintext .credentials exists, use it as-is (migration path)

  return result;
}

/** Write settings to the current user's profiles.settings column. */
export async function writeCloudSettings(payload: CloudSettingsPayload): Promise<void> {
  const userId = await getUserId();

  // Encrypt credentials before persisting — never write plaintext
  const toWrite = { ...payload };
  if (toWrite.credentials && Object.keys(toWrite.credentials).length > 0) {
    toWrite.encryptedCredentials = await encryptCredentials(toWrite.credentials);
  }
  // Strip plaintext credentials from the persisted payload
  delete toWrite.credentials;

  const { error } = await supabase()
    .from('profiles')
    .update({ settings: toWrite as unknown as Record<string, unknown> })
    .eq('id', userId);

  if (error) throw error;
}

/** Clear settings from the current user's profile (opt-out). */
export async function clearCloudSettings(): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase().from('profiles').update({ settings: {} }).eq('id', userId);

  if (error) throw error;
}

// ── Collect from localStorage ───────────────────────────────

/** Gather all current local settings into the cloud payload shape. */
export function collectLocalSettings(includeCredentials: boolean = false): CloudSettingsPayload {
  const deepl = getDeepLSettings();
  const azure = getAzureSettings();
  const gemini = getGeminiSettings();
  const tts = getTtsSettings();
  const translation = getTranslationProviderSettings();

  const containerWidth = (localStorage.getItem(CONTAINER_WIDTH_KEY) as ContainerWidth) || 'xl';
  const navSkip = localStorage.getItem(NAV_SKIP_TRANSLATED_KEY);
  const speechEnabled = localStorage.getItem(SPEECH_ENABLED_KEY);
  const translateEnabled = localStorage.getItem(TRANSLATE_ENABLED_KEY);

  const payload: CloudSettingsPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    preferences: {
      appLanguage: getAppLanguage(),
      containerWidth,
      navSkipTranslated: navSkip === 'true',
      speechEnabled: speechEnabled !== 'false',
      translateEnabled: translateEnabled !== 'false',
    },
    providers: {
      translationProvider: translation.provider,
      deepl: { apiType: deepl.apiType, formality: deepl.formality },
      azure: { region: azure.region, endpoint: azure.endpoint },
      gemini: { modelId: gemini.modelId, useProjectContext: gemini.useProjectContext },
    },
  };

  if (includeCredentials) {
    const credentials: CloudSettingsCredentials = {};
    if (deepl.apiKey) credentials.deepl = { apiKey: deepl.apiKey };
    if (azure.apiKey) credentials.azure = { apiKey: azure.apiKey };
    if (gemini.apiKey) credentials.gemini = { apiKey: gemini.apiKey };
    if (tts.apiKey) credentials.tts = { apiKey: tts.apiKey, provider: tts.provider };
    if (Object.keys(credentials).length > 0) {
      payload.credentials = credentials;
    }
  }

  return payload;
}

// ── Apply cloud settings to localStorage ────────────────────

/** Apply a cloud settings payload to localStorage, overwriting local values. */
export function applyCloudSettings(payload: CloudSettingsPayload): void {
  const { preferences, providers, credentials } = payload;

  // Preferences (glossary settings excluded — now per-project in DB)
  saveAppLanguage(preferences.appLanguage);
  localStorage.setItem(CONTAINER_WIDTH_KEY, preferences.containerWidth);
  localStorage.setItem(NAV_SKIP_TRANSLATED_KEY, String(preferences.navSkipTranslated));
  localStorage.setItem(SPEECH_ENABLED_KEY, String(preferences.speechEnabled));
  localStorage.setItem(TRANSLATE_ENABLED_KEY, String(preferences.translateEnabled));

  // Provider config (preserve existing API keys unless credentials are provided)
  const currentDeepL = getDeepLSettings();
  const currentAzure = getAzureSettings();
  const currentGemini = getGeminiSettings();

  saveActiveTranslationProvider(providers.translationProvider);

  saveDeepLSettings({
    apiKey: credentials?.deepl?.apiKey ?? currentDeepL.apiKey,
    apiType: providers.deepl.apiType,
    formality: providers.deepl.formality,
  });

  saveAzureSettings({
    apiKey: credentials?.azure?.apiKey ?? currentAzure.apiKey,
    region: providers.azure.region,
    endpoint: providers.azure.endpoint,
  });

  saveGeminiSettings({
    apiKey: credentials?.gemini?.apiKey ?? currentGemini.apiKey,
    modelId: providers.gemini.modelId,
    useProjectContext: providers.gemini.useProjectContext,
  });

  if (credentials?.tts) {
    saveTtsSettings({
      apiKey: credentials.tts.apiKey,
      provider: credentials.tts.provider,
    });
  }
}
