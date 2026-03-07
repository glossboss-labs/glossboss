/**
 * Editor Store
 * 
 * Zustand store for PO editor state with localStorage persistence.
 * Manages loaded entries, selection, dirty state, and undo history.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { POFile, POEntry, POHeader } from '@/lib/po/types';
import type { GlossaryAnalysisResult } from '@/lib/glossary/types';
import { STORAGE_KEY } from '@/lib/storage';

/** Available filter types */
export type FilterType = 'untranslated' | 'fuzzy' | 'translated' | 'modified' | 'glossary-review' | 'manual-edit' | 'machine-translated';

/** Filter state: include (show only) or exclude (don't show) */
export type FilterState = 'include' | 'exclude';

/** Machine translation metadata */
export interface MachineTranslationMeta {
  usedGlossary: boolean;
  timestamp: number;
}

/** Editor state */
export interface EditorState {
  /** Currently loaded file info */
  filename: string | null;
  
  /** File header metadata */
  header: POHeader | null;
  
  /** All translation entries */
  entries: POEntry[];
  
  /** IDs of entries that have been modified */
  dirtyEntryIds: Set<string>;
  
  /** IDs of entries that were machine translated (DeepL) */
  machineTranslatedIds: Set<string>;
  
  /** IDs of entries that were manually edited (user typed, not MT) */
  manualEditIds: Set<string>;
  
  /** Metadata for machine translations (glossary usage, etc.) */
  machineTranslationMeta: Map<string, MachineTranslationMeta>;
  
  /** Glossary analysis results per entry */
  glossaryAnalysis: Map<string, GlossaryAnalysisResult>;
  
  /** Currently selected entry ID */
  selectedEntryId: string | null;
  
  /** Search query for filtering */
  filterQuery: string;
  
  /** Active filters with their state (include/exclude) */
  activeFilters: Map<FilterType, FilterState>;
  
  /** @deprecated - kept for migration, use activeFilters instead */
  filterMode: 'all' | 'untranslated' | 'fuzzy' | 'translated';
  
  /** Last saved timestamp */
  lastSavedAt: number | null;
  
  /** Whether file has unsaved changes */
  hasUnsavedChanges: boolean;
}

/** Editor actions */
export interface EditorActions {
  /** Load a PO file into the editor */
  loadFile: (file: POFile) => void;
  
  /** Update a single entry's translation */
  updateEntry: (entryId: string, msgstr: string) => void;
  
  /** Update entry with plural translations */
  updateEntryPlural: (entryId: string, msgstrPlural: string[]) => void;
  
  /** Toggle fuzzy flag on an entry */
  toggleFuzzy: (entryId: string) => void;
  
  /** Update header metadata field */
  updateHeader: (field: string, value: string) => void;
  
  /** Select an entry */
  selectEntry: (entryId: string | null) => void;
  
  /** Set filter query */
  setFilterQuery: (query: string) => void;
  
  /** Toggle a filter on/off */
  toggleFilter: (filter: FilterType) => void;
  
  /** Set a specific filter state */
  setFilterState: (filter: FilterType, state: FilterState | null) => void;
  
  /** Get the current state of a filter */
  getFilterState: (filter: FilterType) => FilterState | null;
  
  /** Clear all active filters */
  clearFilters: () => void;
  
  /** @deprecated - use toggleFilter instead */
  setFilterMode: (mode: EditorState['filterMode']) => void;
  
  /** Mark current state as saved */
  markAsSaved: () => void;
  
  /** Clear the editor (reset to empty state) */
  clearEditor: () => void;
  
  /** Mark an entry as machine translated */
  markAsMachineTranslated: (entryId: string, usedGlossary?: boolean) => void;
  
  /** Clear machine translated flag for an entry (when manually edited) */
  clearMachineTranslated: (entryId: string) => void;
  
  /** Check if an entry was machine translated */
  isMachineTranslated: (entryId: string) => boolean;
  
  /** Get machine translation metadata for an entry */
  getMachineTranslationMeta: (entryId: string) => MachineTranslationMeta | undefined;
  
  /** Set glossary analysis for an entry */
  setGlossaryAnalysis: (entryId: string, analysis: GlossaryAnalysisResult) => void;
  
  /** Set glossary analysis for multiple entries at once */
  setGlossaryAnalysisBatch: (analyses: Map<string, GlossaryAnalysisResult>) => void;
  
  /** Get glossary analysis for an entry */
  getGlossaryAnalysis: (entryId: string) => GlossaryAnalysisResult | undefined;
  
  /** Clear all glossary analysis (e.g., when glossary changes) */
  clearGlossaryAnalysis: () => void;
  
  /** Get filtered entries based on current filters */
  getFilteredEntries: () => POEntry[];
  
  /** Get entry by ID */
  getEntryById: (entryId: string) => POEntry | undefined;
  
  /** Check if an entry was manually edited */
  isManuallyEdited: (entryId: string) => boolean;
  
  /** Get count of entries that would be overwritten by bulk translation */
  getOverwriteWarningCount: () => number;
  
  /** Get translation statistics */
  getStats: () => {
    total: number;
    translated: number;
    untranslated: number;
    fuzzy: number;
    modified: number;
    machineTranslated: number;
    manualEdits: number;
    glossaryNeedsReview: number;
  };
}

/** Initial state */
const initialState: EditorState = {
  filename: null,
  header: null,
  entries: [],
  dirtyEntryIds: new Set(),
  machineTranslatedIds: new Set(),
  manualEditIds: new Set(),
  machineTranslationMeta: new Map(),
  glossaryAnalysis: new Map(),
  selectedEntryId: null,
  filterQuery: '',
  activeFilters: new Map(),
  filterMode: 'all',
  lastSavedAt: null,
  hasUnsavedChanges: false,
};

/**
 * Check if an entry matches a specific filter
 */
function entryMatchesFilter(
  entry: POEntry, 
  filter: FilterType, 
  dirtyEntryIds: Set<string>,
  glossaryAnalysis: Map<string, GlossaryAnalysisResult>,
  machineTranslatedIds: Set<string>,
  manualEditIds: Set<string>
): boolean {
  switch (filter) {
    case 'untranslated': {
      // Check for plural entries
      if (entry.msgidPlural) {
        const plurals = entry.msgstrPlural ?? [];
        return plurals.length < 2 || plurals.some(p => !p.trim());
      }
      return !entry.msgstr.trim();
    }
    case 'fuzzy':
      return entry.flags.includes('fuzzy');
    case 'translated': {
      // Check for plural entries - all forms must be filled
      if (entry.msgidPlural) {
        const plurals = entry.msgstrPlural ?? [];
        return plurals.length >= 2 && plurals.every(p => p.trim() !== '') && !entry.flags.includes('fuzzy');
      }
      return Boolean(entry.msgstr.trim()) && !entry.flags.includes('fuzzy');
    }
    case 'modified':
      return dirtyEntryIds.has(entry.id);
    case 'glossary-review': {
      const analysis = glossaryAnalysis.get(entry.id);
      return analysis ? analysis.needsReviewCount > 0 : false;
    }
    case 'manual-edit':
      return manualEditIds.has(entry.id) && !machineTranslatedIds.has(entry.id);
    case 'machine-translated':
      return machineTranslatedIds.has(entry.id);
    default:
      return false;
  }
}

/**
 * Check if an entry matches the search query
 */
function entryMatchesSearch(entry: POEntry, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    entry.msgid.toLowerCase().includes(lowerQuery) ||
    entry.msgstr.toLowerCase().includes(lowerQuery) ||
    (entry.msgctxt?.toLowerCase().includes(lowerQuery) ?? false) ||
    entry.translatorComments.some(c => c.toLowerCase().includes(lowerQuery)) ||
    entry.extractedComments.some(c => c.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Editor store with persistence
 */
export const useEditorStore = create<EditorState & EditorActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      loadFile: (file: POFile) => {
        set({
          filename: file.filename,
          header: file.header,
          entries: file.entries,
          dirtyEntryIds: new Set(),
          machineTranslatedIds: new Set(),
          manualEditIds: new Set(),
          machineTranslationMeta: new Map(),
          glossaryAnalysis: new Map(),
          selectedEntryId: file.entries[0]?.id ?? null,
          filterQuery: '',
          activeFilters: new Map(),
          filterMode: 'all',
          lastSavedAt: Date.now(),
          hasUnsavedChanges: false,
        });
      },
      
      updateEntry: (entryId: string, msgstr: string) => {
        set(state => {
          const entries = state.entries.map(entry =>
            entry.id === entryId
              ? { ...entry, msgstr, isDirty: true }
              : entry
          );
          
          const dirtyEntryIds = new Set(state.dirtyEntryIds);
          dirtyEntryIds.add(entryId);
          
          return {
            entries,
            dirtyEntryIds,
            hasUnsavedChanges: true,
          };
        });
      },
      
      updateEntryPlural: (entryId: string, msgstrPlural: string[]) => {
        set(state => {
          const entries = state.entries.map(entry =>
            entry.id === entryId
              ? { ...entry, msgstrPlural, isDirty: true }
              : entry
          );
          
          const dirtyEntryIds = new Set(state.dirtyEntryIds);
          dirtyEntryIds.add(entryId);
          
          return {
            entries,
            dirtyEntryIds,
            hasUnsavedChanges: true,
          };
        });
      },
      
      toggleFuzzy: (entryId: string) => {
        set(state => {
          const entries = state.entries.map(entry => {
            if (entry.id !== entryId) return entry;
            
            const hasFuzzy = entry.flags.includes('fuzzy');
            const flags = hasFuzzy
              ? entry.flags.filter(f => f !== 'fuzzy')
              : [...entry.flags, 'fuzzy' as const];
            
            return { ...entry, flags, isDirty: true };
          });
          
          const dirtyEntryIds = new Set(state.dirtyEntryIds);
          dirtyEntryIds.add(entryId);
          
          return {
            entries,
            dirtyEntryIds,
            hasUnsavedChanges: true,
          };
        });
      },
      
      updateHeader: (field: string, value: string) => {
        set(state => ({
          header: {
            ...state.header,
            [field]: value || undefined, // Remove empty values
          },
          hasUnsavedChanges: true,
        }));
      },
      
      selectEntry: (entryId: string | null) => {
        set({ selectedEntryId: entryId });
      },
      
      setFilterQuery: (query: string) => {
        set({ filterQuery: query });
      },
      
      toggleFilter: (filter: FilterType) => {
        set(state => {
          const activeFilters = new Map(state.activeFilters);
          const currentState = activeFilters.get(filter);
          
          // Cycle: none -> include -> exclude -> none
          if (currentState === undefined) {
            activeFilters.set(filter, 'include');
          } else if (currentState === 'include') {
            activeFilters.set(filter, 'exclude');
          } else {
            activeFilters.delete(filter);
          }
          
          return { activeFilters };
        });
      },
      
      setFilterState: (filter: FilterType, state: FilterState | null) => {
        set(currentState => {
          const activeFilters = new Map(currentState.activeFilters);
          if (state === null) {
            activeFilters.delete(filter);
          } else {
            activeFilters.set(filter, state);
          }
          return { activeFilters };
        });
      },
      
      getFilterState: (filter: FilterType) => {
        return get().activeFilters.get(filter) ?? null;
      },
      
      clearFilters: () => {
        set({ activeFilters: new Map(), filterQuery: '' });
      },
      
      setFilterMode: (mode: EditorState['filterMode']) => {
        // Legacy support - convert to new filter system
        const activeFilters = new Map<FilterType, FilterState>();
        if (mode !== 'all') {
          activeFilters.set(mode, 'include');
        }
        set({ filterMode: mode, activeFilters });
      },
      
      markAsSaved: () => {
        set(state => ({
          dirtyEntryIds: new Set(),
          entries: state.entries.map(e => ({ ...e, isDirty: false })),
          lastSavedAt: Date.now(),
          hasUnsavedChanges: false,
        }));
      },
      
      clearEditor: () => {
        set(initialState);
      },
      
      markAsMachineTranslated: (entryId: string, usedGlossary: boolean = false) => {
        set(state => {
          const machineTranslatedIds = new Set(state.machineTranslatedIds);
          machineTranslatedIds.add(entryId);
          
          const machineTranslationMeta = new Map(state.machineTranslationMeta);
          machineTranslationMeta.set(entryId, {
            usedGlossary,
            timestamp: Date.now(),
          });
          
          return { machineTranslatedIds, machineTranslationMeta };
        });
      },
      
      clearMachineTranslated: (entryId: string) => {
        set(state => {
          const machineTranslatedIds = new Set(state.machineTranslatedIds);
          machineTranslatedIds.delete(entryId);
          
          const machineTranslationMeta = new Map(state.machineTranslationMeta);
          machineTranslationMeta.delete(entryId);
          
          // Mark as manually edited since user cleared the MT flag (by editing)
          const manualEditIds = new Set(state.manualEditIds);
          manualEditIds.add(entryId);
          
          return { machineTranslatedIds, machineTranslationMeta, manualEditIds };
        });
      },
      
      isMachineTranslated: (entryId: string) => {
        return get().machineTranslatedIds.has(entryId);
      },
      
      getMachineTranslationMeta: (entryId: string) => {
        return get().machineTranslationMeta.get(entryId);
      },
      
      setGlossaryAnalysis: (entryId: string, analysis: GlossaryAnalysisResult) => {
        set(state => {
          const glossaryAnalysis = new Map(state.glossaryAnalysis);
          glossaryAnalysis.set(entryId, analysis);
          return { glossaryAnalysis };
        });
      },
      
      setGlossaryAnalysisBatch: (analyses: Map<string, GlossaryAnalysisResult>) => {
        set(state => {
          const glossaryAnalysis = new Map(state.glossaryAnalysis);
          analyses.forEach((analysis, entryId) => {
            glossaryAnalysis.set(entryId, analysis);
          });
          return { glossaryAnalysis };
        });
      },
      
      getGlossaryAnalysis: (entryId: string) => {
        return get().glossaryAnalysis.get(entryId);
      },
      
      clearGlossaryAnalysis: () => {
        set({ glossaryAnalysis: new Map() });
      },
      
      getFilteredEntries: () => {
        const { entries, filterQuery, activeFilters, dirtyEntryIds, glossaryAnalysis, machineTranslatedIds, manualEditIds } = get();
        
        let filtered = entries;
        
        // Separate include and exclude filters
        const includeFilters: FilterType[] = [];
        const excludeFilters: FilterType[] = [];
        
        // Map.forEach callback is (value, key) not (key, value)
        activeFilters.forEach((filterState, filterType) => {
          if (filterState === 'include') {
            includeFilters.push(filterType);
          } else if (filterState === 'exclude') {
            excludeFilters.push(filterType);
          }
        });
        
        // Apply include filters (OR logic - entry matches if it matches ANY include filter)
        if (includeFilters.length > 0) {
          filtered = filtered.filter(entry =>
            includeFilters.some(filter =>
              entryMatchesFilter(entry, filter, dirtyEntryIds, glossaryAnalysis, machineTranslatedIds, manualEditIds)
            )
          );
        }
        
        // Apply exclude filters (AND logic - entry is excluded if it matches ANY exclude filter)
        if (excludeFilters.length > 0) {
          filtered = filtered.filter(entry =>
            !excludeFilters.some(filter =>
              entryMatchesFilter(entry, filter, dirtyEntryIds, glossaryAnalysis, machineTranslatedIds, manualEditIds)
            )
          );
        }
        
        // Apply search filter (AND with status filters)
        if (filterQuery.trim()) {
          filtered = filtered.filter(entry => entryMatchesSearch(entry, filterQuery));
        }
        
        return filtered;
      },
      
      getEntryById: (entryId: string) => {
        return get().entries.find(e => e.id === entryId);
      },
      
      getStats: () => {
        const { entries, dirtyEntryIds, machineTranslatedIds, manualEditIds, glossaryAnalysis } = get();
        const total = entries.length;
        
        // Helper to check if an entry is fully translated (handles plurals)
        const isFullyTranslated = (e: POEntry): boolean => {
          if (e.msgidPlural) {
            // Plural entry - all forms must be filled
            const plurals = e.msgstrPlural ?? [];
            return plurals.length >= 2 && plurals.every(p => p.trim() !== '');
          }
          return e.msgstr.trim() !== '';
        };
        
        // Helper to check if an entry is untranslated (any form empty)
        const isUntranslated = (e: POEntry): boolean => {
          if (e.msgidPlural) {
            const plurals = e.msgstrPlural ?? [];
            return plurals.length < 2 || plurals.some(p => !p.trim());
          }
          return !e.msgstr.trim();
        };
        
        const translated = entries.filter(e => isFullyTranslated(e) && !e.flags.includes('fuzzy')).length;
        const fuzzy = entries.filter(e => e.flags.includes('fuzzy')).length;
        const untranslated = entries.filter(e => isUntranslated(e)).length;
        const modified = dirtyEntryIds.size;
        const machineTranslated = machineTranslatedIds.size;
        const manualEdits = manualEditIds.size;
        const glossaryNeedsReview = Array.from(glossaryAnalysis).filter(([_, analysis]) => analysis.needsReviewCount > 0).length;
        
        return { total, translated, untranslated, fuzzy, modified, machineTranslated, manualEdits, glossaryNeedsReview };
      },
      
      /** Check if an entry was manually edited */
      isManuallyEdited: (entryId: string) => {
        return get().manualEditIds.has(entryId);
      },
      
      /** Get count of entries that would be overwritten by bulk translation */
      getOverwriteWarningCount: () => {
        const { entries, manualEditIds, machineTranslatedIds } = get();
        // Count entries with translations that are either manual edits or have been modified
        // but are NOT currently marked as machine translated
        return entries.filter(e => {
          const hasTranslation = e.msgstr.trim() !== '';
          const isManual = manualEditIds.has(e.id);
          const isMT = machineTranslatedIds.has(e.id);
          // Entry would be overwritten if it has translation and is manual (not MT)
          return hasTranslation && (isManual || !isMT);
        }).length;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filename: state.filename,
        header: state.header,
        entries: state.entries,
        dirtyEntryIds: Array.from(state.dirtyEntryIds),
        machineTranslatedIds: Array.from(state.machineTranslatedIds),
        manualEditIds: Array.from(state.manualEditIds),
        // Serialize Map to array of [key, value] pairs
        machineTranslationMeta: state.machineTranslationMeta instanceof Map 
          ? Array.from(state.machineTranslationMeta.entries())
          : [],
        lastSavedAt: state.lastSavedAt,
        hasUnsavedChanges: state.hasUnsavedChanges,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        
        // Convert dirtyEntryIds array back to Set after rehydration
        if (Array.isArray(state.dirtyEntryIds)) {
          state.dirtyEntryIds = new Set(state.dirtyEntryIds as unknown as string[]);
        } else {
          state.dirtyEntryIds = new Set();
        }
        
        // Convert machineTranslatedIds array back to Set after rehydration
        if (Array.isArray(state.machineTranslatedIds)) {
          state.machineTranslatedIds = new Set(state.machineTranslatedIds as unknown as string[]);
        } else {
          state.machineTranslatedIds = new Set();
        }
        
        // Convert manualEditIds array back to Set after rehydration
        if (Array.isArray(state.manualEditIds)) {
          state.manualEditIds = new Set(state.manualEditIds as unknown as string[]);
        } else {
          state.manualEditIds = new Set();
        }
        
        // Convert machineTranslationMeta array back to Map after rehydration
        // The array format is [[entryId, {usedGlossary, timestamp}], ...]
        if (Array.isArray(state.machineTranslationMeta) && state.machineTranslationMeta.length > 0) {
          try {
            const entries = state.machineTranslationMeta as unknown as [string, MachineTranslationMeta][];
            // Validate structure before creating Map
            const validEntries = entries.filter(entry => 
              Array.isArray(entry) && 
              entry.length === 2 && 
              typeof entry[0] === 'string' &&
              entry[1] && 
              typeof entry[1] === 'object'
            );
            state.machineTranslationMeta = new Map(validEntries);
          } catch {
            state.machineTranslationMeta = new Map();
          }
        } else {
          state.machineTranslationMeta = new Map();
        }
        
        // Initialize activeFilters as empty Set
        state.activeFilters = new Map();
        
        // Initialize glossaryAnalysis as empty Map (not persisted, recalculated on demand)
        state.glossaryAnalysis = new Map();
      },
    }
  )
);
