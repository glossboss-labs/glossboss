/**
 * WordPress project source store.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SOURCE_STORE_KEY } from '@/lib/constants/storage-keys';
import type {
  ParsedReference,
  WordPressPluginTranslationTrack,
  WordPressProjectType,
} from '@/lib/wp-source/references';
import type { DirectoryEntry } from '@/lib/wp-source/fetcher';
import {
  fetchSourceFile,
  fetchDirectoryListing,
  validateWordPressProject,
  clearCache,
} from '@/lib/wp-source/fetcher';
import { msgid } from '@/lib/app-language';
import {
  getEffectiveSlug,
  getEffectiveProjectType,
  getEffectiveRelease,
} from '@/lib/wp-source/effective-project';

export { getEffectiveSlug, getEffectiveProjectType, getEffectiveRelease };

export interface SourceState {
  projectType: WordPressProjectType | null;
  projectSlug: string | null;
  autoDetectedProjectType: WordPressProjectType | null;
  autoDetectedSlug: string | null;
  projectVersion: string | null;
  selectedRelease: string | null;
  pluginTranslationTrack: WordPressPluginTranslationTrack;
  isProjectValid: boolean | null;
  activeReference: ParsedReference | null;
  sourceContent: string | null;
  isLoadingSource: boolean;
  sourceError: string | null;
  directoryTree: DirectoryEntry[] | null;
  browsingPath: string;
  isLoadingDirectory: boolean;
  directoryError: string | null;
  resolvedBasePath: string | null;
}

export interface SourceActions {
  setProjectType: (projectType: WordPressProjectType | null) => void;
  setProjectSlug: (slug: string | null) => void;
  setSelectedRelease: (release: string | null) => void;
  setPluginTranslationTrack: (track: WordPressPluginTranslationTrack) => void;
  setProjectContext: (
    projectType: WordPressProjectType,
    slug: string | null,
    options?: { release?: string | null; track?: WordPressPluginTranslationTrack },
  ) => void;
  setAutoDetectedProject: (
    projectType: WordPressProjectType | null,
    slug: string | null,
    version?: string | null,
  ) => void;
  setActiveReference: (ref: ParsedReference | null) => void;
  fetchSource: (path: string) => Promise<void>;
  fetchDirectory: (path: string) => Promise<void>;
  validateCurrentProject: () => Promise<void>;
  clearSource: () => void;
}

const STORAGE_KEY = SOURCE_STORE_KEY;
const STORAGE_VERSION = 2;

const initialState: SourceState = {
  projectType: null,
  projectSlug: null,
  autoDetectedProjectType: null,
  autoDetectedSlug: null,
  projectVersion: null,
  selectedRelease: null,
  pluginTranslationTrack: 'stable',
  isProjectValid: null,
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

function resetProjectData(set: (value: Partial<SourceState>) => void) {
  clearCache();
  set({
    sourceContent: null,
    directoryTree: null,
    browsingPath: '',
    directoryError: null,
    sourceError: null,
    resolvedBasePath: null,
    activeReference: null,
  });
}

export const useSourceStore = create<SourceState & SourceActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProjectType: (projectType) => {
        const prevType = getEffectiveProjectType(get());
        set({ projectType, isProjectValid: null });
        const nextType = projectType || get().autoDetectedProjectType;
        if (prevType !== nextType) {
          resetProjectData(set);
        }
      },

      setProjectSlug: (slug) => {
        const prevSlug = getEffectiveSlug(get());
        set({ projectSlug: slug, isProjectValid: null });
        const nextSlug = slug || get().autoDetectedSlug;
        if (prevSlug !== nextSlug) {
          resetProjectData(set);
        }
      },

      setSelectedRelease: (selectedRelease) => {
        const prevRelease = getEffectiveRelease(get());
        set({ selectedRelease });
        const nextRelease = getEffectiveRelease(get());
        if (prevRelease !== nextRelease) {
          resetProjectData(set);
        }
      },

      setPluginTranslationTrack: (pluginTranslationTrack) => {
        set({ pluginTranslationTrack });
      },

      setProjectContext: (projectType, slug, options = {}) => {
        const prevState = get();
        const prevKey = `${getEffectiveProjectType(prevState) ?? 'none'}:${getEffectiveSlug(prevState) ?? ''}:${getEffectiveRelease(prevState) ?? ''}`;
        set({
          projectType,
          projectSlug: slug,
          selectedRelease: options.release ?? null,
          pluginTranslationTrack: options.track ?? prevState.pluginTranslationTrack,
          isProjectValid: null,
        });
        const nextState = get();
        const nextKey = `${getEffectiveProjectType(nextState) ?? 'none'}:${getEffectiveSlug(nextState) ?? ''}:${getEffectiveRelease(nextState) ?? ''}`;
        if (prevKey !== nextKey) {
          resetProjectData(set);
        }
      },

      setAutoDetectedProject: (projectType, slug, version = null) => {
        const prev = get();
        const prevKey = `${getEffectiveProjectType(prev) ?? 'none'}:${getEffectiveSlug(prev) ?? ''}:${getEffectiveRelease(prev) ?? ''}`;

        set({
          autoDetectedProjectType: projectType,
          autoDetectedSlug: slug,
          projectVersion: version ?? null,
          selectedRelease: null,
          isProjectValid: null,
        });

        const next = get();
        const nextKey = `${getEffectiveProjectType(next) ?? 'none'}:${getEffectiveSlug(next) ?? ''}:${getEffectiveRelease(next) ?? ''}`;
        if (prevKey !== nextKey) {
          resetProjectData(set);
        }
      },

      setActiveReference: (ref) => {
        set({ activeReference: ref, sourceContent: null, sourceError: null });
        if (ref) {
          void get().fetchSource(ref.path);
        }
      },

      fetchSource: async (path) => {
        const state = get();
        const projectType = getEffectiveProjectType(state);
        const slug = getEffectiveSlug(state);
        if (!projectType || !slug) return;

        set({ isLoadingSource: true, sourceError: null });

        try {
          const result = await fetchSourceFile(projectType, slug, path, getEffectiveRelease(get()));
          set({
            sourceContent: result.content,
            resolvedBasePath: result.basePath,
            isLoadingSource: false,
          });
        } catch (error) {
          set({
            sourceContent: null,
            isLoadingSource: false,
            sourceError: error instanceof Error ? error.message : msgid('Failed to fetch source'),
          });
        }
      },

      fetchDirectory: async (path) => {
        const state = get();
        const projectType = getEffectiveProjectType(state);
        const slug = getEffectiveSlug(state);
        if (!projectType || !slug) return;

        set({ isLoadingDirectory: true, browsingPath: path, directoryError: null });

        try {
          const result = await fetchDirectoryListing(
            projectType,
            slug,
            path,
            getEffectiveRelease(get()),
          );
          set({
            directoryTree: result.entries,
            resolvedBasePath: result.basePath,
            isLoadingDirectory: false,
            directoryError: null,
          });
        } catch (error) {
          set({
            directoryTree: null,
            isLoadingDirectory: false,
            directoryError:
              error instanceof Error ? error.message : msgid('Failed to load directory listing'),
          });
        }
      },

      validateCurrentProject: async () => {
        const state = get();
        const projectType = getEffectiveProjectType(state);
        const slug = getEffectiveSlug(state);

        if (!projectType || !slug) {
          set({ isProjectValid: null });
          return;
        }

        try {
          const valid = await validateWordPressProject(projectType, slug);
          set({ isProjectValid: valid });
        } catch {
          set({ isProjectValid: false });
        }
      },

      clearSource: () => {
        clearCache();
        set(initialState);
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectType: state.projectType,
        projectSlug: state.projectSlug,
        selectedRelease: state.selectedRelease,
        pluginTranslationTrack: state.pluginTranslationTrack,
      }),
      migrate: (persistedState: unknown, version) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as SourceState;
        }

        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          return {
            projectType: state.projectType ?? (state.pluginSlug ? 'plugin' : null),
            projectSlug:
              typeof state.projectSlug === 'string'
                ? state.projectSlug
                : typeof state.pluginSlug === 'string'
                  ? state.pluginSlug
                  : null,
            selectedRelease:
              typeof state.selectedRelease === 'string' ? state.selectedRelease : null,
            pluginTranslationTrack: state.pluginTranslationTrack === 'dev' ? 'dev' : 'stable',
          };
        }

        return persistedState as SourceState;
      },
    },
  ),
);
