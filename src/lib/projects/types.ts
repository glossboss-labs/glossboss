/**
 * Project Database Types
 *
 * TypeScript interfaces matching the Supabase project tables.
 * Used by the projects API and cloud storage adapter.
 */

import type { TranslationProviderId } from '@/lib/translation/types';

/** Row shape for the `projects` table */
export interface ProjectRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  name: string;
  description: string;
  website: string;
  visibility: 'private' | 'public' | 'unlisted';
  public_role: 'viewer' | 'translator' | 'reviewer';
  source_language: string | null;
  target_language: string | null;
  source_format: 'po' | 'i18next';
  source_filename: string | null;
  po_header: Record<string, string> | null;
  wp_project_type: 'plugin' | 'theme' | null;
  wp_slug: string | null;
  wp_track: 'stable' | 'dev' | null;
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
    | 'website'
    | 'visibility'
    | 'public_role'
    | 'source_language'
    | 'target_language'
    | 'source_format'
    | 'source_filename'
    | 'po_header'
    | 'wp_project_type'
    | 'wp_slug'
    | 'wp_track'
  >
>;

/** Row shape for the `project_languages` table */
export interface ProjectLanguageRow {
  id: string;
  project_id: string;
  locale: string;
  source_filename: string | null;
  po_header: Record<string, string> | null;
  wp_locale: string | null;
  repo_provider: 'github' | 'gitlab' | null;
  repo_owner: string | null;
  repo_name: string | null;
  repo_branch: string | null;
  repo_file_path: string | null;
  repo_default_branch: string | null;
  glossary_source: 'wordpress' | 'repo' | 'url' | null;
  glossary_url: string | null;
  glossary_repo_provider: 'github' | 'gitlab' | null;
  glossary_repo_owner: string | null;
  glossary_repo_name: string | null;
  glossary_repo_branch: string | null;
  glossary_repo_file_path: string | null;
  glossary_repo_default_branch: string | null;
  glossary_enforcement: boolean;
  translation_provider: TranslationProviderId | null;
  translation_instructions: string;
  stats_total: number;
  stats_translated: number;
  stats_fuzzy: number;
  stats_untranslated: number;
  created_at: string;
  updated_at: string;
}

/** Insert shape for `project_languages` */
export type ProjectLanguageInsert = Omit<
  ProjectLanguageRow,
  | 'id'
  | 'glossary_enforcement'
  | 'stats_total'
  | 'stats_translated'
  | 'stats_fuzzy'
  | 'stats_untranslated'
  | 'created_at'
  | 'updated_at'
>;

/** Updatable fields on `project_languages` */
export type ProjectLanguageUpdate = Partial<
  Pick<
    ProjectLanguageRow,
    | 'locale'
    | 'source_filename'
    | 'po_header'
    | 'wp_locale'
    | 'repo_provider'
    | 'repo_owner'
    | 'repo_name'
    | 'repo_branch'
    | 'repo_file_path'
    | 'repo_default_branch'
    | 'glossary_source'
    | 'glossary_url'
    | 'glossary_repo_provider'
    | 'glossary_repo_owner'
    | 'glossary_repo_name'
    | 'glossary_repo_branch'
    | 'glossary_repo_file_path'
    | 'glossary_repo_default_branch'
    | 'glossary_enforcement'
    | 'translation_provider'
    | 'translation_instructions'
  >
>;

/** Row shape for the `project_entries` table */
export interface ProjectEntryRow {
  id: string;
  project_id: string;
  language_id: string;
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

/** Project-level role type */
export type ProjectRole = ProjectMemberRow['role'];

/** Project member with profile info from a separate profiles fetch */
export interface ProjectMemberWithProfile extends ProjectMemberRow {
  profiles: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

/** Row shape for the `project_invites` table */
export interface ProjectInviteRow {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  expires_at: string;
  created_at: string;
}

/** Insert shape for `project_invites` */
export type ProjectInviteInsert = Pick<ProjectInviteRow, 'project_id' | 'email' | 'role'>;

/** Project with embedded languages from a join query */
export type ProjectWithLanguages = ProjectRow & {
  project_languages: ProjectLanguageRow[];
};
