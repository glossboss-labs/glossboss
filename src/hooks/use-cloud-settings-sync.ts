/**
 * useCloudSettingsSync — opt-in cloud settings synchronization.
 *
 * Default state: OFF. The user must explicitly enable sync.
 * When enabled, settings are debounced-written to Supabase on change
 * and pulled from cloud on page load.
 * Disabling clears cloud settings and reverts to local-only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { isCloudBackendConfigured } from '@/lib/supabase/client';
import {
  readCloudSettings,
  writeCloudSettings,
  clearCloudSettings,
  collectLocalSettings,
  applyCloudSettings,
} from '@/lib/settings/cloud';
import { CLOUD_SETTINGS_ENABLED_KEY, CLOUD_CREDENTIAL_SYNC_KEY } from '@/lib/settings/types';

export type CloudSyncStatus = 'idle' | 'syncing' | 'error';

export interface CloudSettingsSyncState {
  /** Whether cloud sync is enabled (opt-in). */
  syncEnabled: boolean;
  /** Toggle cloud sync on/off. */
  setSyncEnabled: (enabled: boolean) => Promise<void>;
  /** Current sync operation status. */
  syncStatus: CloudSyncStatus;
  /** Last successful sync timestamp. */
  lastSynced: string | null;
  /** Whether credentials are included in sync. */
  credentialSyncEnabled: boolean;
  /** Toggle credential sync on/off (only meaningful when syncEnabled). */
  setCredentialSyncEnabled: (enabled: boolean) => Promise<void>;
  /** Force an immediate sync. */
  syncNow: () => Promise<void>;
}

const DEBOUNCE_MS = 2000;

/** localStorage keys we watch for changes. */
const WATCHED_KEYS = [
  'glossboss-app-language',
  'glossboss-container-width',
  'glossboss-selected-glossary-locale',
  'glossboss-glossary-enforcement',
  'glossboss-nav-skip-translated',
  'glossboss-speech-enabled',
  'glossboss-translate-enabled',
  'glossboss-translation-provider-settings',
  'glossboss-deepl-settings',
  'glossboss-azure-settings',
  'glossboss-gemini-settings',
  'glossboss-tts-settings',
];

export function useCloudSettingsSync(): CloudSettingsSyncState {
  const { isAuthenticated } = useAuth();
  const [syncEnabled, setSyncEnabledState] = useState(
    () => localStorage.getItem(CLOUD_SETTINGS_ENABLED_KEY) === 'true',
  );
  const [credentialSyncEnabled, setCredentialSyncEnabledState] = useState(
    () => localStorage.getItem(CLOUD_CREDENTIAL_SYNC_KEY) === 'true',
  );
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(syncEnabled && isAuthenticated);

  // Keep ref in sync
  useEffect(() => {
    activeRef.current = syncEnabled && isAuthenticated && isCloudBackendConfigured();
  }, [syncEnabled, isAuthenticated]);

  // Pull from cloud on mount if sync is enabled OR if cloud has settings
  // (handles new browser where local flag hasn't been set yet)
  useEffect(() => {
    if (!isAuthenticated || !isCloudBackendConfigured()) return;

    let cancelled = false;

    async function pull() {
      try {
        setSyncStatus('syncing');
        const cloud = await readCloudSettings();
        if (cancelled) return;
        if (cloud) {
          applyCloudSettings(cloud);
          setLastSynced(cloud.updatedAt);
          // Auto-enable sync locally if cloud has settings but local flag isn't set
          if (!syncEnabled) {
            localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, 'true');
            setSyncEnabledState(true);
            activeRef.current = true;
          }
        }
        setSyncStatus('idle');
      } catch {
        if (!cancelled) setSyncStatus('error');
      }
    }

    void pull();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncEnabled intentionally excluded to avoid re-pull loops
  }, [isAuthenticated]);

  // Push to cloud (debounced)
  const pushToCloud = useCallback(async () => {
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
  }, []);

  const schedulePush = useCallback(() => {
    if (!activeRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void pushToCloud();
    }, DEBOUNCE_MS);
  }, [pushToCloud]);

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

  // Enable/disable sync
  const setSyncEnabled = useCallback(
    async (enabled: boolean) => {
      setSyncEnabledState(enabled);
      localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, String(enabled));

      if (enabled) {
        // Enabling: push current local settings to cloud
        activeRef.current = true;
        await pushToCloud();
      } else {
        // Disabling: clear cloud settings, revert to local-only
        activeRef.current = false;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        try {
          await clearCloudSettings();
        } catch {
          // Best-effort clear
        }
        setLastSynced(null);
        setSyncStatus('idle');
      }
    },
    [pushToCloud],
  );

  // Enable/disable credential sync
  const setCredentialSyncEnabled = useCallback(
    async (enabled: boolean) => {
      setCredentialSyncEnabledState(enabled);
      localStorage.setItem(CLOUD_CREDENTIAL_SYNC_KEY, String(enabled));

      if (!enabled && activeRef.current) {
        // Re-push without credentials to strip them from cloud
        try {
          const payload = collectLocalSettings(false);
          await writeCloudSettings(payload);
          setLastSynced(payload.updatedAt);
        } catch {
          // Best-effort
        }
      } else if (enabled && activeRef.current) {
        // Re-push with credentials
        await pushToCloud();
      }
    },
    [pushToCloud],
  );

  // Sync now (manual trigger)
  const syncNow = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await pushToCloud();
  }, [pushToCloud]);

  return {
    syncEnabled,
    setSyncEnabled,
    syncStatus,
    lastSynced,
    credentialSyncEnabled,
    setCredentialSyncEnabled,
    syncNow,
  };
}
