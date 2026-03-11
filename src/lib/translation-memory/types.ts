import type { POEntry } from '@/lib/po';

export interface TranslationMemoryScope {
  projectName: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
}

export interface TranslationMemoryEntry {
  id: string;
  projectName: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
  sourceText: string;
  sourceTextPlural?: string;
  targetText: string;
  targetTextPlural?: string[];
  context?: string;
  approvedAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface TranslationMemoryProject {
  key: string;
  projectName: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
  entries: TranslationMemoryEntry[];
  updatedAt: string;
}

export type TranslationMemoryMatchType = 'exact' | 'fuzzy';

export interface TranslationMemorySuggestion {
  entry: TranslationMemoryEntry;
  score: number;
  matchType: TranslationMemoryMatchType;
}

export interface TranslationMemoryJsonFile {
  version: 1;
  projectName: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
  exportedAt: string;
  entries: TranslationMemoryEntry[];
}

export function isApprovedTranslationEntry(entry: POEntry): boolean {
  if (entry.flags.includes('fuzzy')) return false;

  if (entry.msgidPlural) {
    const plurals = entry.msgstrPlural ?? [];
    return plurals.length >= 2 && plurals.every((value) => value.trim() !== '');
  }

  return entry.msgstr.trim() !== '';
}
