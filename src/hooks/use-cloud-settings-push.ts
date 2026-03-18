/**
 * useCloudSettingsPush — handles debounced push of local settings to cloud.
 *
 * Watches localStorage for changes to settings keys and pushes them
 * to Supabase after a debounce delay. Only active when sync is enabled
 * and the user is authenticated.
 */

import { useCallback, useEffect, useRef } from 'react';
import { isCloudBackendConfigured } from '@/lib/supabase/client';
import { writeCloudSettings, collectLocalSettings } from '@/lib/settings/cloud';
import { CLOUD_CREDENTIAL_SYNC_KEY } from '@/lib/settings/types';
import {
  APP_LANGUAGE_KEY,
  CONTAINER_WIDTH_KEY,
  NAV_SKIP_TRANSLATED_KEY,
  SPEECH_ENABLED_KEY,
  TRANSLATE_ENABLED_KEY,
  TRANSLATION_PROVIDER_SETTINGS_KEY,
  DEEPL_SETTINGS_KEY,
  AZURE_SETTINGS_KEY,
  GEMINI_SETTINGS_KEY,
  LLM_SETTINGS_KEY,
  TTS_SETTINGS_KEY,
} from '@/lib/constants/storage-keys';
import type { CloudSyncStatus } from './use-cloud-settings-sync';

const DEBOUNCE_MS = 2000;

/** localStorage keys we watch for changes. */
const WATCHED_KEYS = [
  APP_LANGUAGE_KEY,
  CONTAINER_WIDTH_KEY,
  NAV_SKIP_TRANSLATED_KEY,
  SPEECH_ENABLED_KEY,
  TRANSLATE_ENABLED_KEY,
  TRANSLATION_PROVIDER_SETTINGS_KEY,
  DEEPL_SETTINGS_KEY,
  AZURE_SETTINGS_KEY,
  GEMINI_SETTINGS_KEY, // legacy — triggers sync for migrated users
  LLM_SETTINGS_KEY,
  TTS_SETTINGS_KEY,
];

export interface CloudSettingsPushHandle {
  /** Push current local settings to cloud immediately. */
  pushToCloud: () => Promise<void>;
  /** Schedule a debounced push to cloud. */
  schedulePush: () => void;
  /** Cancel any pending debounced push. */
  cancelPending: () => void;
}

export function useCloudSettingsPush(
  isActive: boolean,
  isAuthenticated: boolean,
  syncEnabled: boolean,
  setSyncStatus: (status: CloudSyncStatus) => void,
  setLastSynced: (ts: string) => void,
): CloudSettingsPushHandle {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(isActive);

  // Keep ref in sync
  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  // Push to cloud (debounced)
  const pushToCloudFn = useCallback(async () => {
    if (!activeRef.current) return;

    try {
      setSyncStatus('syncing');
      const credEnabled = localStorage.getItem(CLOUD_CREDENTIAL_SYNC_KEY) === 'true';
      const payload = collectLocalSettings(credEnabled);
      await writeCloudSettings(payload);
      setLastSynced(payload.updatedAt);
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    }
  }, [setSyncStatus, setLastSynced]);

  const schedulePush = useCallback(() => {
    if (!activeRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void pushToCloudFn();
    }, DEBOUNCE_MS);
  }, [pushToCloudFn]);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Listen for localStorage changes from the same tab and other tabs
  useEffect(() => {
    if (!syncEnabled || !isAuthenticated || !isCloudBackendConfigured()) return;

    function handleStorageChange(e: StorageEvent) {
      if (e.key && WATCHED_KEYS.includes(e.key)) {
        schedulePush();
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [syncEnabled, isAuthenticated, schedulePush]);

  // Manual push to cloud
  const pushToCloud = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await pushToCloudFn();
  }, [pushToCloudFn]);

  return { pushToCloud, schedulePush, cancelPending };
}
