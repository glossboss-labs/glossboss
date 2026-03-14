/**
 * Project Database Types
 *
 * TypeScript interfaces matching the Supabase project tables.
 * Used by the projects API and cloud storage adapter.
 */

/** Row shape for the `projects` table */
export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: 'private' | 'public' | 'unlisted';
  source_language: string | null;
  target_language: string | null;
  source_format: 'po' | 'i18next';
  source_filename: string | null;
  po_header: Record<string, string> | null;
  stats_total: number;
  stats_translated: number;
  stats_fuzzy: number;
  stats_untranslated: number;
  created_at: string;
  updated_at: string;
}

/** Insert shape for `projects` (id auto-generated, stats managed by trigger) */
export type ProjectInsert = Omit<
  ProjectRow,
  | 'id'
  | 'stats_total'
  | 'stats_translated'
  | 'stats_fuzzy'
  | 'stats_untranslated'
  | 'created_at'
  | 'updated_at'
>;

/** Updatable fields on `projects` */
export type ProjectUpdate = Partial<
  Pick<
    ProjectRow,
    | 'name'
    | 'description'
    | 'visibility'
    | 'source_language'
    | 'target_language'
    | 'source_format'
    | 'source_filename'
    | 'po_header'
  >
>;

/** Row shape for the `project_entries` table */
export interface ProjectEntryRow {
  id: string;
  project_id: string;
  entry_index: number;
  msgctxt: string | null;
  msgid: string;
  msgid_plural: string | null;
  msgstr: string;
  msgstr_plural: string[] | null;
  flags: string[];
  translator_comments: string[];
  extracted_comments: string[];
  file_references: string[];
  previous_msgid: string | null;
  previous_msgctxt: string | null;
  review_status: string;
  review_comments: unknown[];
  review_history: unknown[];
  mt_provider: string | null;
  mt_used_glossary: boolean;
  mt_glossary_mode: string | null;
  mt_context_used: boolean;
  mt_timestamp: string | null;
  created_at: string;
  updated_at: string;
}

/** Insert shape for `project_entries` (id auto-generated) */
export type ProjectEntryInsert = Omit<ProjectEntryRow, 'id' | 'created_at' | 'updated_at'>;

/** Row shape for the `project_members` table */
export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: 'admin' | 'maintainer' | 'reviewer' | 'translator' | 'viewer';
  created_at: string;
  updated_at: string;
}
