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
 *
 * This is a composition hook that delegates to:
 * - useCloudSettingsPush — debounced push of local changes
 * - useCloudSettingsPull — pull cloud settings on mount / on-demand
 */

import { useCallback, useState } from 'react';
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
import { useCloudSettingsPush } from './use-cloud-settings-push';
import { useCloudSettingsPull } from './use-cloud-settings-pull';

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

  const isActive = syncEnabled && isAuthenticated && isCloudBackendConfigured();

  // ── Push (debounced local -> cloud) ──────────────────────
  const { pushToCloud, cancelPending } = useCloudSettingsPush(
    isActive,
    isAuthenticated,
    syncEnabled,
    setSyncStatus,
    setLastSynced,
  );

  // ── Pull (cloud -> local on mount) ──────────────────────
  const { pullFromCloud } = useCloudSettingsPull(
    isAuthenticated,
    syncEnabled,
    setSyncStatus,
    setLastSynced,
  );

  // ── Enable/disable sync ──────────────────────────────────
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
        await pushToCloud();
      } else {
        // Disabling: clear cloud settings, revert to local-only
        setSyncEnabledState(false);
        localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, 'false');
        cancelPending();
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
    [pushToCloud, cancelPending],
  );

  // ── Resolve cloud vs local conflict ──────────────────────
  const resolveConflict = useCallback(
    async (choice: 'cloud' | 'local') => {
      const pending = pendingCloudSettings;
      setPendingCloudSettings(null);

      // Enable sync
      setSyncEnabledState(true);
      localStorage.setItem(CLOUD_SETTINGS_ENABLED_KEY, 'true');

      if (choice === 'cloud' && pending) {
        // Apply cloud settings locally, then push to keep in sync
        applyCloudSettings(pending);
        setLastSynced(pending.updatedAt);
        await pushToCloud();
      } else {
        // Keep local settings, overwrite cloud
        await pushToCloud();
      }
    },
    [pendingCloudSettings, pushToCloud],
  );

  const dismissPending = useCallback(() => {
    setPendingCloudSettings(null);
  }, []);

  // ── Enable/disable credential sync ───────────────────────
  const setCredentialSyncEnabled = useCallback(
    async (enabled: boolean) => {
      setCredentialSyncEnabledState(enabled);
      localStorage.setItem(CLOUD_CREDENTIAL_SYNC_KEY, String(enabled));

      if (!enabled && isActive) {
        // Re-push without credentials to strip them from cloud
        try {
          const payload = collectLocalSettings(false);
          await writeCloudSettings(payload);
          setLastSynced(payload.updatedAt);
        } catch {
          // Best-effort
        }
      } else if (enabled && isActive) {
        // Re-push with credentials
        await pushToCloud();
      }
    },
    [pushToCloud, isActive],
  );

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
