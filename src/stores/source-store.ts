/**
 * Source Store
 *
 * Zustand store for WordPress plugin source code viewing.
 * Manages plugin slug, active references, and source content.
 */

import { create } from 'zustand';
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
  isSlugValid: boolean | null;
  activeReference: ParsedReference | null;
  sourceContent: string | null;
  isLoadingSource: boolean;
  sourceError: string | null;
  directoryTree: DirectoryEntry[] | null;
  browsingPath: string;
  isLoadingDirectory: boolean;
}

/** Source store actions */
export interface SourceActions {
  setPluginSlug: (slug: string | null) => void;
  setAutoDetectedSlug: (slug: string | null) => void;
  setActiveReference: (ref: ParsedReference | null) => void;
  fetchSource: (path: string) => Promise<void>;
  fetchDirectory: (path: string) => Promise<void>;
  validateCurrentSlug: () => Promise<void>;
  clearSource: () => void;
}

const initialState: SourceState = {
  pluginSlug: null,
  autoDetectedSlug: null,
  isSlugValid: null,
  activeReference: null,
  sourceContent: null,
  isLoadingSource: false,
  sourceError: null,
  directoryTree: null,
  browsingPath: '',
  isLoadingDirectory: false,
};

/** Get the effective slug (manual override or auto-detected) */
export function getEffectiveSlug(state: SourceState): string | null {
  return state.pluginSlug || state.autoDetectedSlug;
}

export const useSourceStore = create<SourceState & SourceActions>()((set, get) => ({
  ...initialState,

  setPluginSlug: (slug: string | null) => {
    const prev = getEffectiveSlug(get());
    set({ pluginSlug: slug, isSlugValid: null });

    // Clear cache if slug changed
    const next = slug || get().autoDetectedSlug;
    if (prev !== next) {
      clearCache();
      set({ sourceContent: null, directoryTree: null, browsingPath: '' });
    }
  },

  setAutoDetectedSlug: (slug: string | null) => {
    set({ autoDetectedSlug: slug, isSlugValid: null });
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
      const content = await fetchSourceFile(slug, path);
      set({ sourceContent: content, isLoadingSource: false });
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

    set({ isLoadingDirectory: true, browsingPath: path });

    try {
      const entries = await fetchDirectoryListing(slug, path);
      set({ directoryTree: entries, isLoadingDirectory: false });
    } catch {
      set({ directoryTree: null, isLoadingDirectory: false });
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
}));
