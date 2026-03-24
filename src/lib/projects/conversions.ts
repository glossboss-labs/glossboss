/**
 * Project Conversions
 *
 * Transforms between database rows and editor-state objects.
 * Used by the Supabase storage adapter and projects API.
 */

import type { POEntry, POEntryFlag, POHeader } from '@/lib/po/types';
import { generateEntryId } from '@/lib/po';
import type { ReviewComment, ReviewEntryState, ReviewHistoryEvent } from '@/lib/review';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { TranslationGlossaryMode, TranslationProviderId } from '@/lib/translation/types';
import type { ProjectEntryRow, ProjectLanguageRow, ProjectRow } from './types';

// ── DB → Editor ──────────────────────────────────────────────

/** Convert a project_entries row to a POEntry (with deterministic client ID). */
export function dbEntryToPOEntry(row: ProjectEntryRow, index: number): POEntry {
  return {
    id: generateEntryId({ msgctxt: row.msgctxt ?? undefined, msgid: row.msgid }, index),
    translatorComments: row.translator_comments,
    extractedComments: row.extracted_comments,
    references: row.file_references,
    flags: row.flags as POEntryFlag[],
    previousMsgid: row.previous_msgid ?? undefined,
    previousMsgctxt: row.previous_msgctxt ?? undefined,
    msgctxt: row.msgctxt ?? undefined,
    msgid: row.msgid,
    msgidPlural: row.msgid_plural ?? undefined,
    msgstr: row.msgstr,
    msgstrPlural: row.msgstr_plural ?? undefined,
  };
}

/** Extract MachineTranslationMeta from a DB row (null if no MT data). */
export function dbEntryToMTMeta(row: ProjectEntryRow): MachineTranslationMeta | null {
  if (!row.mt_provider) return null;
  return {
    provider: row.mt_provider as TranslationProviderId,
    usedGlossary: row.mt_used_glossary,
    glossaryMode: (row.mt_glossary_mode as TranslationGlossaryMode) ?? undefined,
    contextUsed: row.mt_context_used || undefined,
    timestamp: row.mt_timestamp ? new Date(row.mt_timestamp).getTime() : Date.now(),
  };
}

/** Extract ReviewEntryState from a DB row. */
export function dbEntryToReviewState(row: ProjectEntryRow): ReviewEntryState {
  return {
    status: row.review_status as ReviewEntryState['status'],
    comments: (row.review_comments ?? []) as ReviewComment[],
    history: (row.review_history ?? []) as ReviewHistoryEvent[],
  };
}

/** Derive the PO header from a project language row. */
export function dbLanguageToHeader(row: ProjectLanguageRow): POHeader | null {
  return (row.po_header as POHeader) ?? null;
}

/**
 * @deprecated Use dbLanguageToHeader instead. Kept for backward compat during migration.
 */
export function dbProjectToHeader(row: ProjectRow): POHeader | null {
  return (row.po_header as POHeader) ?? null;
}

// ── Editor → DB ──────────────────────────────────────────────

/** Natural key for matching PO entries across local/cloud. */
export function entryKey(msgctxt: string | null | undefined, msgid: string): string {
  return msgctxt ? `${msgctxt}\x04${msgid}` : msgid;
}

/** Build a project_entries insert/update payload from a POEntry. */
export function poEntryToDbFields(
  entry: POEntry,
  languageId: string,
  projectId: string,
  index: number,
  mtMeta: MachineTranslationMeta | undefined,
  reviewState: ReviewEntryState | undefined,
): Omit<ProjectEntryRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    project_id: projectId,
    language_id: languageId,
    entry_index: index,
    msgctxt: entry.msgctxt ?? null,
    msgid: entry.msgid,
    msgid_plural: entry.msgidPlural ?? null,
    msgstr: entry.msgstr,
    msgstr_plural: entry.msgstrPlural ?? null,
    flags: entry.flags,
    translator_comments: entry.translatorComments,
    extracted_comments: entry.extractedComments,
    file_references: entry.references,
    previous_msgid: entry.previousMsgid ?? null,
    previous_msgctxt: entry.previousMsgctxt ?? null,
    review_status: reviewState?.status ?? 'draft',
    review_comments: (reviewState?.comments ?? []) as unknown[],
    review_history: (reviewState?.history ?? []) as unknown[],
    mt_provider: mtMeta?.provider ?? null,
    mt_used_glossary: mtMeta?.usedGlossary ?? false,
    mt_glossary_mode: mtMeta?.glossaryMode ?? null,
    mt_context_used: mtMeta?.contextUsed ?? false,
    mt_timestamp: mtMeta?.timestamp ? new Date(mtMeta.timestamp).toISOString() : null,
  };
}

/** Build project metadata update from editor state fields (project-level only). */
export function editorStateToProjectUpdate(state: {
  projectName: string;
  sourceFormat: 'po' | 'i18next' | 'csv' | 'xliff';
}): {
  name: string;
  source_format: 'po' | 'i18next' | 'csv' | 'xliff';
} {
  return {
    name: state.projectName,
    source_format: state.sourceFormat,
  };
}

/** Build language metadata update from editor state fields. */
export function editorStateToLanguageUpdate(state: {
  header: POHeader | null;
  filename: string | null;
}): {
  source_filename: string | null;
  po_header: Record<string, string> | null;
} {
  return {
    source_filename: state.filename,
    po_header: state.header as Record<string, string> | null,
  };
}
