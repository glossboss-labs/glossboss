/**
 * Source Store
 *
 * Zustand store for WordPress plugin source code viewing.
 * Manages plugin slug, active references, and source content.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ParsedReference } from '@/lib/wp-source/references';
import type { DirectoryEntry } from '@/lib/wp-source/fetcher';
import {
  fetchSourceFile,
  fetchDirectoryListing,
  validateSlug,
  clearCache,
} from '@/lib/wp-source/fetcher';

/** Source store state */
export interface SourceState {
  pluginSlug: string | null;
  autoDetectedSlug: string | null;
  /** Version from PO header (e.g. "8.4.2") — used to fetch the matching tag */
  pluginVersion: string | null;
  isSlugValid: boolean | null;
  activeReference: ParsedReference | null;
  sourceContent: string | null;
  isLoadingSource: boolean;
  sourceError: string | null;
  directoryTree: DirectoryEntry[] | null;
  browsingPath: string;
  isLoadingDirectory: boolean;
  directoryError: string | null;
  /** Resolved base path from SVN (e.g. "trunk" or "tags/8.4.2") */
  resolvedBasePath: string | null;
}

/** Source store actions */
export interface SourceActions {
  setPluginSlug: (slug: string | null) => void;
  setAutoDetectedSlug: (slug: string | null, version?: string | null) => void;
  setActiveReference: (ref: ParsedReference | null) => void;
  fetchSource: (path: string) => Promise<void>;
  fetchDirectory: (path: string) => Promise<void>;
  validateCurrentSlug: () => Promise<void>;
  clearSource: () => void;
}

const STORAGE_KEY = 'glossboss-source-store';

const initialState: SourceState = {
  pluginSlug: null,
  autoDetectedSlug: null,
  pluginVersion: null,
  isSlugValid: null,
  activeReference: null,
  sourceContent: null,
  isLoadingSource: false,
  sourceError: null,
  directoryTree: null,
  browsingPath: '',
  isLoadingDirectory: false,
  directoryError: null,
  resolvedBasePath: null,
};

/** Get the effective slug (manual override or auto-detected) */
export function getEffectiveSlug(state: SourceState): string | null {
  return state.pluginSlug || state.autoDetectedSlug;
}

export const useSourceStore = create<SourceState & SourceActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPluginSlug: (slug: string | null) => {
        const prev = getEffectiveSlug(get());
        set({ pluginSlug: slug, isSlugValid: null });

        // Clear cache if effective slug changed
        const next = slug || get().autoDetectedSlug;
        if (prev !== next) {
          clearCache();
          set({
            sourceContent: null,
            directoryTree: null,
            browsingPath: '',
            directoryError: null,
            resolvedBasePath: null,
          });
        }
      },

      setAutoDetectedSlug: (slug: string | null, version?: string | null) => {
        const prev = get();
        const nextVersion = version ?? null;
        const prevEffectiveSlug = getEffectiveSlug(prev);
        const nextEffectiveSlug = prev.pluginSlug || slug;
        const versionChanged = prev.pluginVersion !== nextVersion;
        const effectiveSlugChanged = prevEffectiveSlug !== nextEffectiveSlug;

        set({ autoDetectedSlug: slug, pluginVersion: nextVersion, isSlugValid: null });

        // Version and effective-slug changes can both invalidate cached source content.
        if (versionChanged || effectiveSlugChanged) {
          clearCache();
          set({
            sourceContent: null,
            directoryTree: null,
            browsingPath: '',
            directoryError: null,
            resolvedBasePath: null,
          });
        }
      },

      setActiveReference: (ref: ParsedReference | null) => {
        set({ activeReference: ref, sourceContent: null, sourceError: null });

        if (ref) {
          get().fetchSource(ref.path);
        }
      },

      fetchSource: async (path: string) => {
        const slug = getEffectiveSlug(get());
        if (!slug) return;

        set({ isLoadingSource: true, sourceError: null });

        try {
          const result = await fetchSourceFile(slug, path, get().pluginVersion);
          set({
            sourceContent: result.content,
            resolvedBasePath: result.basePath,
            isLoadingSource: false,
          });
        } catch (err) {
          set({
            sourceContent: null,
            isLoadingSource: false,
            sourceError: err instanceof Error ? err.message : 'Failed to fetch source',
          });
        }
      },

      fetchDirectory: async (path: string) => {
        const slug = getEffectiveSlug(get());
        if (!slug) return;

        set({ isLoadingDirectory: true, browsingPath: path, directoryError: null });

        try {
          const result = await fetchDirectoryListing(slug, path, get().pluginVersion);
          set({
            directoryTree: result.entries,
            resolvedBasePath: result.basePath,
            isLoadingDirectory: false,
            directoryError: null,
          });
        } catch (err) {
          set({
            directoryTree: null,
            isLoadingDirectory: false,
            directoryError: err instanceof Error ? err.message : 'Failed to load directory listing',
          });
        }
      },

      validateCurrentSlug: async () => {
        const slug = getEffectiveSlug(get());
        if (!slug) {
          set({ isSlugValid: null });
          return;
        }

        try {
          const valid = await validateSlug(slug);
          set({ isSlugValid: valid });
        } catch {
          set({ isSlugValid: false });
        }
      },

      clearSource: () => {
        clearCache();
        set(initialState);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pluginSlug: state.pluginSlug,
      }),
    },
  ),
);
