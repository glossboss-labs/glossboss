/**
 * useCloudSettingsSync — opt-in cloud settings synchronization.
 *
 * Default state: OFF. The user must explicitly enable sync.
 * When enabled, settings are debounced-written to Supabase on change
 * and pulled from cloud on page load.
 * Disabling clears cloud settings and reverts to local-only.
 *
 * Conflict handling: when cloud data exists and the user enables sync,
 * a conflict dialog lets them choose between cloud and local settings.
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
import type { CloudSettingsPayload } from '@/lib/settings/types';
import { CLOUD_SETTINGS_ENABLED_KEY, CLOUD_CREDENTIAL_SYNC_KEY } from '@/lib/settings/types';

export type CloudSyncStatus = 'idle' | 'syncing' | 'error';

export interface CloudSettingsSyncState {
  /** Whether cloud sync is enabled (opt-in). */
  syncEnabled: boolean;
  /** Toggle cloud sync on/off. When enabling with existing cloud data, sets pendingCloudSettings. */
  setSyncEnabled: (enabled: boolean) => Promise<void>;
  /** Current sync operation status. */
  syncStatus: CloudSyncStatus;
  /** Last successful sync timestamp. */
  lastSynced: string | null;
  /** Whether credentials are included in sync. */
  credentialSyncEnabled: boolean;
  /** Toggle credential sync on/off (only meaningful when syncEnabled). */
  setCredentialSyncEnabled: (enabled: boolean) => Promise<void>;
  /** Push current local settings to cloud. */
  pushToCloud: () => Promise<void>;
  /** Pull settings from cloud and apply them locally. */
  pullFromCloud: () => Promise<void>;
  /** Cloud settings awaiting conflict resolution (non-null when user enables sync and cloud has data). */
  pendingCloudSettings: CloudSettingsPayload | null;
  /** Resolve a cloud vs local conflict. */
  resolveConflict: (choice: 'cloud' | 'local') => Promise<void>;
  /** Dismiss pending cloud settings without applying. */
  dismissPending: () => void;
}

const DEBOUNCE_MS = 2000;

/** localStorage keys we watch for changes. */
const WATCHED_KEYS = [
  'glossboss-app-language',
  'glossboss-container-width',
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
  const [pendingCloudSettings, setPendingCloudSettings] = useState<CloudSettingsPayload | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(syncEnabled && isAuthenticated);

  // Keep ref in sync
  useEffect(() => {
    activeRef.current = syncEnabled && isAuthenticated && isCloudBackendConfigured();
  }, [syncEnabled, isAuthenticated]);

  // Pull from cloud on mount — only apply when sync is already enabled.
  // If sync is disabled but cloud has data, hold it for a future conflict dialog.
  useEffect(() => {
    if (!isAuthenticated || !isCloudBackendConfigured()) return;

    let cancelled = false;

    async function pull() {
      try {
        setSyncStatus('syncing');
        const cloud = await readCloudSettings();
        if (cancelled) return;
        if (cloud && syncEnabled) {
          applyCloudSettings(cloud);
          setLastSynced(cloud.updatedAt);
        }
        // Don't auto-enable sync or auto-apply when sync is off.
        // Cloud data is fetched on-demand when the user enables sync.
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
  }, []);

  const schedulePush = useCallback(() => {
    if (!activeRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void pushToCloudFn();
    }, DEBOUNCE_MS);
  }, [pushToCloudFn]);

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
      if (enabled) {
        // Check for existing cloud data before enabling
        try {
          setSyncStatus('syncing');
          const cloud = await readCloudSettings();
          if (cloud) {
            // Cloud has existing settings — present conflict dialog
            setPendingCloudSettings(cloud);
            setSyncStatus('idle');
            // Don't enable sync yet — wait for resolveConflict
            return;
          }
        } catch {
          // No cloud data or error — just enable and push
        }

        // No cloud data — enable sync and push local settings
        setSyncEnabledState(true);
        localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, 'true');
        activeRef.current = true;
        await pushToCloudFn();
      } else {
        // Disabling: clear cloud settings, revert to local-only
        setSyncEnabledState(false);
        localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, 'false');
        activeRef.current = false;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        try {
          await clearCloudSettings();
        } catch {
          // Best-effort clear
        }
        setLastSynced(null);
        setSyncStatus('idle');
        setPendingCloudSettings(null);
      }
    },
    [pushToCloudFn],
  );

  // Resolve cloud vs local conflict
  const resolveConflict = useCallback(
    async (choice: 'cloud' | 'local') => {
      const pending = pendingCloudSettings;
      setPendingCloudSettings(null);

      // Enable sync
      setSyncEnabledState(true);
      localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, 'true');
      activeRef.current = true;

      if (choice === 'cloud' && pending) {
        // Apply cloud settings locally, then push to keep in sync
        applyCloudSettings(pending);
        setLastSynced(pending.updatedAt);
        await pushToCloudFn();
      } else {
        // Keep local settings, overwrite cloud
        await pushToCloudFn();
      }
    },
    [pendingCloudSettings, pushToCloudFn],
  );

  const dismissPending = useCallback(() => {
    setPendingCloudSettings(null);
  }, []);

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
        await pushToCloudFn();
      }
    },
    [pushToCloudFn],
  );

  // Manual pull from cloud
  const pullFromCloud = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      const cloud = await readCloudSettings();
      if (cloud) {
        applyCloudSettings(cloud);
        setLastSynced(cloud.updatedAt);
      }
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  // Manual push to cloud
  const pushToCloud = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await pushToCloudFn();
  }, [pushToCloudFn]);

  return {
    syncEnabled,
    setSyncEnabled,
    syncStatus,
    lastSynced,
    credentialSyncEnabled,
    setCredentialSyncEnabled,
    pushToCloud,
    pullFromCloud,
    pendingCloudSettings,
    resolveConflict,
    dismissPending,
  };
}
