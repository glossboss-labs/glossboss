/**
 * useCloudSettingsPull — handles pulling cloud settings on mount.
 *
 * When sync is already enabled, applies cloud settings on page load.
 * Cloud data is fetched on-demand when the user enables sync (handled
 * by the composition hook).
 */

import { useCallback, useEffect } from 'react';
import { isCloudBackendConfigured } from '@/lib/supabase/client';
import { readCloudSettings, applyCloudSettings } from '@/lib/settings/cloud';
import type { CloudSyncStatus } from './use-cloud-settings-sync';

export interface CloudSettingsPullHandle {
  /** Pull settings from cloud and apply them locally. */
  pullFromCloud: () => Promise<void>;
}

export function useCloudSettingsPull(
  isAuthenticated: boolean,
  syncEnabled: boolean,
  setSyncStatus: (status: CloudSyncStatus) => void,
  setLastSynced: (ts: string) => void,
): CloudSettingsPullHandle {
  // Pull from cloud on mount — only apply when sync is already enabled.
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
  }, [isAuthenticated, setSyncStatus, setLastSynced]);

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
  }, [setSyncStatus, setLastSynced]);

  return { pullFromCloud };
}
