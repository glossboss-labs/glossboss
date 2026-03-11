import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { POEntry } from '@/lib/po';
import {
  createTranslationMemoryEntryFingerprint,
  createTranslationMemoryEntryFromPoEntry,
  createTranslationMemoryProjectKey,
  findTranslationMemorySuggestions,
  isApprovedTranslationEntry,
  type TranslationMemoryEntry,
  type TranslationMemoryProject,
  type TranslationMemoryScope,
  type TranslationMemorySuggestion,
} from '@/lib/translation-memory';

const STORAGE_KEY = 'glossboss-translation-memory';

interface TranslationMemoryState {
  projects: Record<string, TranslationMemoryProject>;
}

interface TranslationMemoryActions {
  getProject: (scope: TranslationMemoryScope) => TranslationMemoryProject | null;
  getEntryCount: (scope: TranslationMemoryScope) => number;
  upsertApprovedEntry: (scope: TranslationMemoryScope, entry: POEntry) => void;
  upsertApprovedEntries: (scope: TranslationMemoryScope, entries: POEntry[]) => void;
  getSuggestions: (scope: TranslationMemoryScope, entry: POEntry, limit?: number) => TranslationMemorySuggestion[];
  importEntries: (scope: TranslationMemoryScope, entries: TranslationMemoryEntry[]) => void;
  clearProject: (scope: TranslationMemoryScope) => void;
}

function upsertEntriesIntoProject(
  project: TranslationMemoryProject | null,
  scope: TranslationMemoryScope,
  entries: TranslationMemoryEntry[],
): TranslationMemoryProject {
  const key = createTranslationMemoryProjectKey(scope);
  const existing = project?.entries ?? [];
  const nextByFingerprint = new Map(
    existing.map((entry) => [createTranslationMemoryEntryFingerprint(entry), entry]),
  );

  for (const entry of entries) {
    nextByFingerprint.set(createTranslationMemoryEntryFingerprint(entry), entry);
  }

  return {
    key,
    projectName: scope.projectName,
    targetLanguage: scope.targetLanguage,
    sourceLanguage: scope.sourceLanguage ?? null,
    entries: Array.from(nextByFingerprint.values()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
    updatedAt: new Date().toISOString(),
  };
}

export const useTranslationMemoryStore = create<TranslationMemoryState & TranslationMemoryActions>()(
  persist(
    (set, get) => ({
      projects: {},

      getProject: (scope) => {
        return get().projects[createTranslationMemoryProjectKey(scope)] ?? null;
      },

      getEntryCount: (scope) => {
        return get().projects[createTranslationMemoryProjectKey(scope)]?.entries.length ?? 0;
      },

      upsertApprovedEntry: (scope, entry) => {
        if (!isApprovedTranslationEntry(entry)) return;

        set((state) => {
          const key = createTranslationMemoryProjectKey(scope);
          const current = state.projects[key] ?? null;
          const now = new Date().toISOString();
          const fingerprint = createTranslationMemoryEntryFingerprint({
            sourceText: entry.msgid,
            sourceTextPlural: entry.msgidPlural,
            context: entry.msgctxt,
          });
          const previous = current?.entries.find(
            (candidate) => createTranslationMemoryEntryFingerprint(candidate) === fingerprint,
          );
          const nextProject = upsertEntriesIntoProject(current, scope, [
            createTranslationMemoryEntryFromPoEntry(scope, entry, now, previous),
          ]);

          return {
            projects: {
              ...state.projects,
              [key]: nextProject,
            },
          };
        });
      },

      upsertApprovedEntries: (scope, entries) => {
        const approvedEntries = entries.filter(isApprovedTranslationEntry);
        if (approvedEntries.length === 0) return;

        set((state) => {
          const key = createTranslationMemoryProjectKey(scope);
          const current = state.projects[key] ?? null;
          const existingByFingerprint = new Map(
            (current?.entries ?? []).map((entry) => [createTranslationMemoryEntryFingerprint(entry), entry]),
          );
          const now = new Date().toISOString();
          const nextEntries = approvedEntries.map((entry) => {
            const fingerprint = createTranslationMemoryEntryFingerprint({
              sourceText: entry.msgid,
              sourceTextPlural: entry.msgidPlural,
              context: entry.msgctxt,
            });
            return createTranslationMemoryEntryFromPoEntry(
              scope,
              entry,
              now,
              existingByFingerprint.get(fingerprint),
            );
          });
          const nextProject = upsertEntriesIntoProject(current, scope, nextEntries);

          return {
            projects: {
              ...state.projects,
              [key]: nextProject,
            },
          };
        });
      },

      getSuggestions: (scope, entry, limit = 3) => {
        const project = get().projects[createTranslationMemoryProjectKey(scope)];
        if (!project) return [];

        return findTranslationMemorySuggestions(
          project.entries,
          {
            sourceText: entry.msgid,
            sourceTextPlural: entry.msgidPlural,
            context: entry.msgctxt,
          },
          limit,
        );
      },

      importEntries: (scope, entries) => {
        set((state) => {
          const key = createTranslationMemoryProjectKey(scope);
          const current = state.projects[key] ?? null;
          const nextProject = upsertEntriesIntoProject(current, scope, entries);

          return {
            projects: {
              ...state.projects,
              [key]: nextProject,
            },
          };
        });
      },

      clearProject: (scope) => {
        set((state) => {
          const key = createTranslationMemoryProjectKey(scope);
          const nextProjects = { ...state.projects };
          delete nextProjects[key];
          return { projects: nextProjects };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
