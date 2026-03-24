/**
 * Project Export/Import
 *
 * Export a cloud project as a ZIP bundle containing any combination of:
 * - PO/JSON translation files (one per language)
 * - Project metadata manifest (for re-importing)
 * - Editor state snapshot (MT metadata, review status, fuzzy flags)
 * - App settings (provider configs, preferences)
 * - Translation memory (project-scoped TM entries)
 */

import type { ProjectRow, ProjectLanguageRow, ProjectEntryRow } from './types';
import { getProject, getProjectLanguages, getProjectEntries } from './api';
import { dbEntryToPOEntry, dbLanguageToHeader } from './conversions';
import { serializePOFile } from '@/lib/po';
import { serializeToI18next } from '@/lib/i18next';
import { serializeToCSV } from '@/lib/csv';
import { serializeToXLIFF } from '@/lib/xliff';
import type { POEntry } from '@/lib/po/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import { dbEntryToMTMeta, dbEntryToReviewState } from './conversions';
import type { ReviewEntryState } from '@/lib/review';

/** Options for what to include in a project export */
export interface ProjectExportOptions {
  includeTranslationFiles: boolean;
  includeMetadata: boolean;
  includeEditorState: boolean;
  includeSettings: boolean;
  includeTranslationMemory: boolean;
  /** Settings file content (pre-serialized JSON string) — provided by caller */
  settingsJson?: string;
  /** Translation memory entries (pre-serialized JSON string) — provided by caller */
  translationMemoryJson?: string;
}

/** Shape of the project manifest included in the ZIP */
interface ProjectManifest {
  schema: 'glossboss-project';
  version: 1;
  exportedAt: string;
  project: Omit<ProjectRow, 'owner_id'>;
  languages: Omit<ProjectLanguageRow, 'project_id'>[];
}

/** Per-language editor state snapshot */
interface LanguageStateSnapshot {
  locale: string;
  sourceFilename: string | null;
  entries: POEntry[];
  machineTranslationMeta: [string, MachineTranslationMeta][];
  reviewEntries: [string, ReviewEntryState][];
}

/** Full editor state export bundled in the ZIP */
interface EditorStateExport {
  schema: 'glossboss-editor-state';
  version: 1;
  exportedAt: string;
  projectName: string;
  sourceFormat: 'po' | 'i18next' | 'csv' | 'xliff';
  languages: LanguageStateSnapshot[];
}

/**
 * Export a cloud project as a ZIP blob.
 */
export async function exportProject(
  projectId: string,
  options: ProjectExportOptions,
): Promise<{ blob: Blob; filename: string }> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const now = new Date().toISOString();

  // Fetch project + languages
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found');

  const languages = await getProjectLanguages(projectId);

  // Fetch all entries per language
  const languageEntries = new Map<string, ProjectEntryRow[]>();
  await Promise.all(
    languages.map(async (lang) => {
      const entries = await getProjectEntries(lang.id);
      languageEntries.set(lang.id, entries);
    }),
  );

  // 1. Translation files
  if (options.includeTranslationFiles) {
    for (const lang of languages) {
      const dbEntries = languageEntries.get(lang.id) ?? [];
      const poEntries = dbEntries.map((row, i) => dbEntryToPOEntry(row, i));
      const header = dbLanguageToHeader(lang);

      const filename = lang.source_filename ?? `${project.name}-${lang.locale}.po`;

      const extPattern = /\.(po|pot|json|csv|xliff|xlf)$/i;

      if (project.source_format === 'i18next') {
        const content = serializeToI18next(poEntries);
        const jsonFilename = filename.replace(extPattern, '.json');
        zip.file(
          `translations/${jsonFilename.endsWith('.json') ? jsonFilename : jsonFilename + '.json'}`,
          content,
        );
      } else if (project.source_format === 'csv') {
        const content = serializeToCSV(poEntries, header ?? {});
        const csvFilename = filename.replace(extPattern, '.csv');
        zip.file(
          `translations/${csvFilename.endsWith('.csv') ? csvFilename : csvFilename + '.csv'}`,
          content,
        );
      } else if (project.source_format === 'xliff') {
        const content = serializeToXLIFF(poEntries, header ?? {});
        const xliffFilename = filename.replace(extPattern, '.xliff');
        zip.file(
          `translations/${xliffFilename.endsWith('.xliff') ? xliffFilename : xliffFilename + '.xliff'}`,
          content,
        );
      } else {
        const content = serializePOFile(
          { filename, header: header ?? {}, entries: poEntries, charset: 'UTF-8' },
          { updateRevisionDate: true },
        );
        zip.file(`translations/${filename}`, content);
      }
    }
  }

  // 2. Project metadata manifest
  if (options.includeMetadata) {
    const manifest: ProjectManifest = {
      schema: 'glossboss-project',
      version: 1,
      exportedAt: now,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        visibility: project.visibility,
        source_language: project.source_language,
        target_language: project.target_language,
        source_format: project.source_format,
        source_filename: project.source_filename,
        po_header: project.po_header,
        wp_project_type: project.wp_project_type,
        wp_slug: project.wp_slug,
        wp_track: project.wp_track,
        stats_total: project.stats_total,
        stats_translated: project.stats_translated,
        stats_fuzzy: project.stats_fuzzy,
        stats_untranslated: project.stats_untranslated,
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
      languages: languages.map((lang) => ({
        id: lang.id,
        locale: lang.locale,
        source_filename: lang.source_filename,
        po_header: lang.po_header,
        wp_locale: lang.wp_locale,
        repo_provider: lang.repo_provider,
        repo_owner: lang.repo_owner,
        repo_name: lang.repo_name,
        repo_branch: lang.repo_branch,
        repo_file_path: lang.repo_file_path,
        repo_default_branch: lang.repo_default_branch,
        stats_total: lang.stats_total,
        stats_translated: lang.stats_translated,
        stats_fuzzy: lang.stats_fuzzy,
        stats_untranslated: lang.stats_untranslated,
        created_at: lang.created_at,
        updated_at: lang.updated_at,
      })),
    };
    zip.file('project.json', JSON.stringify(manifest, null, 2));
  }

  // 3. Editor state snapshot (MT metadata, review status)
  if (options.includeEditorState) {
    const languageSnapshots: LanguageStateSnapshot[] = [];

    for (const lang of languages) {
      const dbEntries = languageEntries.get(lang.id) ?? [];
      const poEntries = dbEntries.map((row, i) => dbEntryToPOEntry(row, i));

      const mtMeta: [string, MachineTranslationMeta][] = [];
      const reviewEntries: [string, ReviewEntryState][] = [];

      for (let i = 0; i < dbEntries.length; i++) {
        const meta = dbEntryToMTMeta(dbEntries[i]!);
        if (meta) mtMeta.push([poEntries[i]!.id, meta]);

        const review = dbEntryToReviewState(dbEntries[i]!);
        if (review.status !== 'draft' || review.comments.length > 0) {
          reviewEntries.push([poEntries[i]!.id, review]);
        }
      }

      languageSnapshots.push({
        locale: lang.locale,
        sourceFilename: lang.source_filename,
        entries: poEntries,
        machineTranslationMeta: mtMeta,
        reviewEntries,
      });
    }

    const stateExport: EditorStateExport = {
      schema: 'glossboss-editor-state',
      version: 1,
      exportedAt: now,
      projectName: project.name,
      sourceFormat: project.source_format,
      languages: languageSnapshots,
    };
    zip.file('editor-state.json', JSON.stringify(stateExport, null, 2));
  }

  // 4. App settings
  if (options.includeSettings && options.settingsJson) {
    zip.file('settings.json', options.settingsJson);
  }

  // 5. Translation memory
  if (options.includeTranslationMemory && options.translationMemoryJson) {
    zip.file('translation-memory.json', options.translationMemoryJson);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = project.name.replace(/[^\w.-]+/g, '-').toLowerCase();
  const dateStr = now.slice(0, 10);
  const filename = `${safeName}-export-${dateStr}.zip`;

  return { blob, filename };
}

/**
 * Export the current local editor state as a full snapshot JSON.
 * Includes entries, MT metadata, review status — everything the partialize function captures.
 */
export function exportEditorSnapshot(state: {
  projectName: string;
  filename: string | null;
  sourceFormat: 'po' | 'i18next' | 'csv' | 'xliff';
  header: Record<string, string> | null;
  entries: POEntry[];
  machineTranslationMeta: Map<string, MachineTranslationMeta>;
  reviewEntries: Map<string, ReviewEntryState>;
}): string {
  return JSON.stringify(
    {
      schema: 'glossboss-editor-snapshot',
      version: 1,
      exportedAt: new Date().toISOString(),
      projectName: state.projectName,
      filename: state.filename,
      sourceFormat: state.sourceFormat,
      header: state.header,
      entries: state.entries,
      machineTranslationMeta: Array.from(state.machineTranslationMeta.entries()),
      reviewEntries: Array.from(state.reviewEntries.entries()),
    },
    null,
    2,
  );
}
