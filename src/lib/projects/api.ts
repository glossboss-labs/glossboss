/**
 * Projects API
 *
 * Supabase CRUD operations for projects, project languages, and project entries.
 * Used by the cloud storage adapter and project management UI.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  ProjectRow,
  ProjectInsert,
  ProjectUpdate,
  ProjectEntryRow,
  ProjectMemberRow,
  ProjectMemberWithProfile,
  ProjectRole,
  ProjectInviteRow,
  ProjectInviteInsert,
  ProjectLanguageRow,
  ProjectLanguageInsert,
  ProjectLanguageUpdate,
  ProjectWithLanguages,
} from './types';
import { entryKey, poEntryToDbFields } from './conversions';
import type { POEntry } from '@/lib/po/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { ReviewEntryState } from '@/lib/review';

function supabase() {
  return getSupabaseClient('Projects');
}

const PROJECT_SELECT = [
  'id',
  'owner_id',
  'organization_id',
  'name',
  'description',
  'website',
  'visibility',
  'public_role',
  'source_language',
  'target_language',
  'source_format',
  'source_filename',
  'po_header',
  'wp_project_type',
  'wp_slug',
  'wp_track',
  'stats_total',
  'stats_translated',
  'stats_fuzzy',
  'stats_untranslated',
  'created_at',
  'updated_at',
].join(', ');

const PROJECT_LANGUAGE_SELECT = [
  'id',
  'project_id',
  'locale',
  'source_filename',
  'po_header',
  'wp_locale',
  'repo_provider',
  'repo_owner',
  'repo_name',
  'repo_branch',
  'repo_file_path',
  'repo_default_branch',
  'glossary_source',
  'glossary_url',
  'glossary_repo_provider',
  'glossary_repo_owner',
  'glossary_repo_name',
  'glossary_repo_branch',
  'glossary_repo_file_path',
  'glossary_repo_default_branch',
  'glossary_enforcement',
  'translation_provider',
  'translation_instructions',
  'stats_total',
  'stats_translated',
  'stats_fuzzy',
  'stats_untranslated',
  'created_at',
  'updated_at',
].join(', ');

const PROJECT_MEMBER_SELECT = 'id, project_id, user_id, role, created_at, updated_at';
const PROJECT_INVITE_SELECT =
  'id, project_id, email, role, token, invited_by, accepted_at, accepted_by, expires_at, created_at';
const PROJECT_ENTRY_SELECT =
  'id, project_id, language_id, entry_index, msgctxt, msgid, msgid_plural, msgstr, msgstr_plural, flags, translator_comments, extracted_comments, file_references, previous_msgid, previous_msgctxt, review_status, review_comments, review_history, mt_provider, mt_used_glossary, mt_glossary_mode, mt_context_used, mt_timestamp, created_at, updated_at';

// ── Projects ─────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectWithLanguages[]> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Inner-join on project_members so only projects the current user belongs
  // to are returned.  Without this, the public-read RLS policy for unlisted
  // projects causes other users' unlisted projects to leak into the list.
  const joined = await supabase()
    .from('projects')
    .select(
      `${PROJECT_SELECT}, project_languages(${PROJECT_LANGUAGE_SELECT}), project_members!inner(user_id)`,
    )
    .eq('project_members.user_id', user.id)
    .order('updated_at', { ascending: false });

  if (!joined.error) {
    return (joined.data ?? []).map(({ project_members: _pm, ...p }) => p) as ProjectWithLanguages[];
  }

  // Fallback: projects-only if PostgREST schema cache hasn't picked up
  // the project_languages relationship yet.
  const { data, error } = await supabase()
    .from('projects')
    .select(`${PROJECT_SELECT}, project_members!inner(user_id)`)
    .eq('project_members.user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(({ project_members: _pm, ...p }) => ({
    ...p,
    project_languages: [],
  })) as ProjectWithLanguages[];
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase()
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data;
}

export async function createProject(project: ProjectInsert): Promise<ProjectRow> {
  const { data, error } = await supabase().from('projects').insert(project).select().single();

  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: ProjectUpdate): Promise<ProjectRow> {
  const { data, error } = await supabase()
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase().from('projects').delete().eq('id', id).select('id').single();

  if (error) throw error;
}

/** List public projects visible on /explore (excludes unlisted). */
export async function listPublicProjects(): Promise<ProjectWithLanguages[]> {
  const joined = await supabase()
    .from('projects')
    .select(`${PROJECT_SELECT}, project_languages(${PROJECT_LANGUAGE_SELECT})`)
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false });

  if (!joined.error) {
    return (joined.data ?? []) as ProjectWithLanguages[];
  }

  const { data, error } = await supabase()
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const projects = data ?? [];
  if (projects.length === 0) return [];

  const { data: languages, error: languagesError } = await supabase()
    .from('project_languages')
    .select(PROJECT_LANGUAGE_SELECT)
    .in(
      'project_id',
      projects.map((project) => project.id),
    );

  if (languagesError) {
    return projects.map((p) => ({ ...p, project_languages: [] }) as ProjectWithLanguages);
  }

  const languagesByProjectId = new Map<string, ProjectLanguageRow[]>();
  for (const language of languages ?? []) {
    const existing = languagesByProjectId.get(language.project_id) ?? [];
    existing.push(language);
    languagesByProjectId.set(language.project_id, existing);
  }

  return projects.map(
    (project) =>
      ({
        ...project,
        project_languages: languagesByProjectId.get(project.id) ?? [],
      }) as ProjectWithLanguages,
  );
}

// ── Project Languages ────────────────────────────────────────

export async function getProjectLanguages(projectId: string): Promise<ProjectLanguageRow[]> {
  const { data, error } = await supabase()
    .from('project_languages')
    .select(PROJECT_LANGUAGE_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getProjectLanguage(languageId: string): Promise<ProjectLanguageRow | null> {
  const { data, error } = await supabase()
    .from('project_languages')
    .select(PROJECT_LANGUAGE_SELECT)
    .eq('id', languageId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createProjectLanguage(
  insert: ProjectLanguageInsert,
): Promise<ProjectLanguageRow> {
  const { data, error } = await supabase()
    .from('project_languages')
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectLanguage(
  id: string,
  updates: ProjectLanguageUpdate,
): Promise<ProjectLanguageRow> {
  const { data, error } = await supabase()
    .from('project_languages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectLanguage(id: string): Promise<void> {
  const { error } = await supabase().from('project_languages').delete().eq('id', id);

  if (error) throw error;
}

export async function cloneLanguageEntries(
  sourceLanguageId: string,
  targetLanguageId: string,
): Promise<void> {
  const { error } = await supabase().rpc('clone_language_entries', {
    p_source_language_id: sourceLanguageId,
    p_target_language_id: targetLanguageId,
  });

  if (error) throw error;
}

// ── Project Entries ──────────────────────────────────────────

export async function getProjectEntries(languageId: string): Promise<ProjectEntryRow[]> {
  const PAGE_SIZE = 1000;
  const all: ProjectEntryRow[] = [];
  let from = 0;

  // Supabase defaults to 1000 rows — paginate to fetch all entries
  while (true) {
    const { data, error } = await supabase()
      .from('project_entries')
      .select(PROJECT_ENTRY_SELECT)
      .eq('language_id', languageId)
      .order('entry_index', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export async function getProjectEntryPreview(
  languageId: string,
  limit = 5,
): Promise<Pick<ProjectEntryRow, 'id' | 'msgctxt' | 'msgid' | 'msgstr'>[]> {
  const { data, error } = await supabase()
    .from('project_entries')
    .select('id, msgctxt, msgid, msgstr')
    .eq('language_id', languageId)
    .order('entry_index', { ascending: true })
    .range(0, Math.max(limit - 1, 0));

  if (error) throw error;
  return data ?? [];
}

/** Lightweight fetch of just entry keys for diffing. */
export async function getProjectEntryKeys(
  languageId: string,
): Promise<{ id: string; msgctxt: string | null; msgid: string }[]> {
  const PAGE_SIZE = 1000;
  const all: { id: string; msgctxt: string | null; msgid: string }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase()
      .from('project_entries')
      .select('id, msgctxt, msgid')
      .eq('language_id', languageId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/**
 * Sync editor entries to Supabase.
 *
 * Compares the editor's entry list against what's in the database,
 * then upserts changed/new entries and deletes removed ones.
 */
export async function syncProjectEntries(
  languageId: string,
  projectId: string,
  entries: POEntry[],
  mtMeta: Map<string, MachineTranslationMeta>,
  reviewEntries: Map<string, ReviewEntryState>,
): Promise<void> {
  // 1. Fetch existing entry keys
  const existing = await getProjectEntryKeys(languageId);
  const existingByKey = new Map(existing.map((e) => [entryKey(e.msgctxt, e.msgid), e.id]));

  // 2. Build upsert payload
  const processedKeys = new Set<string>();
  const toUpsert: (Omit<ProjectEntryRow, 'created_at' | 'updated_at'> & { id?: string })[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const key = entryKey(entry.msgctxt, entry.msgid);
    if (processedKeys.has(key)) continue;
    processedKeys.add(key);

    const dbId = existingByKey.get(key);
    const fields = poEntryToDbFields(
      entry,
      languageId,
      projectId,
      i,
      mtMeta.get(entry.id),
      reviewEntries.get(entry.id),
    );

    if (dbId) {
      toUpsert.push({ id: dbId, ...fields });
    } else {
      toUpsert.push(fields as (typeof toUpsert)[number]);
    }
  }

  // 3. Delete entries no longer in editor
  const toDelete = existing
    .filter((e) => !processedKeys.has(entryKey(e.msgctxt, e.msgid)))
    .map((e) => e.id);

  // 4. Execute (batch upserts in chunks to avoid payload limits)
  const CHUNK_SIZE = 500;

  for (let i = 0; i < toUpsert.length; i += CHUNK_SIZE) {
    const chunk = toUpsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase().from('project_entries').upsert(chunk);

    if (error) throw error;
  }

  if (toDelete.length > 0) {
    const { error } = await supabase().from('project_entries').delete().in('id', toDelete);

    if (error) throw error;
  }
}

// ── Project Members ─────────────────────────────────────────

/** Get the current user's role in a project. */
export async function getMyProjectRole(projectId: string): Promise<ProjectRole | null> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase()
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return null;
  return (data?.role as ProjectRole) ?? null;
}

export async function listProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const { data: members, error } = await supabase()
    .from('project_members')
    .select(PROJECT_MEMBER_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!members?.length) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase()
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => ({
    ...m,
    profiles: profileMap.get(m.user_id) ?? { email: '', full_name: null, avatar_url: null },
  })) as ProjectMemberWithProfile[];
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole = 'translator',
): Promise<ProjectMemberRow> {
  const { data, error } = await supabase()
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectMemberRole(
  memberId: string,
  role: ProjectRole,
): Promise<ProjectMemberRow> {
  const { data, error } = await supabase()
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Join a public project with the project's configured public_role (self-insert via RLS). */
export async function joinPublicProject(
  projectId: string,
  userId: string,
  role: ProjectRole = 'translator',
): Promise<ProjectMemberRow> {
  const { data, error } = await supabase()
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeProjectMember(memberId: string): Promise<void> {
  const { error } = await supabase().from('project_members').delete().eq('id', memberId);

  if (error) throw error;
}

export async function findProfileByEmail(email: string): Promise<{
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
} | null> {
  const { data, error } = await supabase()
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// ── Project Invites ─────────────────────────────────────────

export async function listProjectInvites(projectId: string): Promise<ProjectInviteRow[]> {
  const { data, error } = await supabase()
    .from('project_invites')
    .select(PROJECT_INVITE_SELECT)
    .eq('project_id', projectId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createProjectInvite(insert: ProjectInviteInsert): Promise<ProjectInviteRow> {
  const { data, error } = await supabase().from('project_invites').insert(insert).select().single();

  if (error) throw error;
  return data;
}

export async function revokeProjectInvite(inviteId: string): Promise<void> {
  const { error } = await supabase().from('project_invites').delete().eq('id', inviteId);

  if (error) throw error;
}

export async function acceptProjectInvite(token: string): Promise<string> {
  const { data, error } = await supabase().rpc('accept_project_invite', { p_token: token });

  if (error) throw error;
  return data as string;
}

export async function getProjectInviteByToken(token: string): Promise<ProjectInviteRow | null> {
  const { data, error } = await supabase()
    .from('project_invites')
    .select(PROJECT_INVITE_SELECT)
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// ── Org Projects ────────────────────────────────────────────

export async function listOrgProjects(orgId: string): Promise<ProjectWithLanguages[]> {
  const joined = await supabase()
    .from('projects')
    .select(`${PROJECT_SELECT}, project_languages(${PROJECT_LANGUAGE_SELECT})`)
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });

  if (!joined.error) {
    return (joined.data ?? []) as ProjectWithLanguages[];
  }

  const { data, error } = await supabase()
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, project_languages: [] }) as ProjectWithLanguages);
}

export interface ProjectEditorPageData {
  project: ProjectRow | null;
  language: ProjectLanguageRow | null;
  entries: ProjectEntryRow[];
}

export interface ProjectSettingsPageData {
  project: ProjectRow | null;
  languages: ProjectLanguageRow[];
  members: ProjectMemberWithProfile[];
  invites: ProjectInviteRow[];
}

export async function getProjectEditorPage(
  projectId: string,
  languageId: string,
): Promise<ProjectEditorPageData> {
  const [project, language, entries] = await Promise.all([
    getProject(projectId),
    getProjectLanguage(languageId),
    getProjectEntries(languageId),
  ]);

  return { project, language, entries };
}

export async function getProjectSettingsPage(projectId: string): Promise<ProjectSettingsPageData> {
  const [project, languages, members, invites] = await Promise.all([
    getProject(projectId),
    getProjectLanguages(projectId),
    listProjectMembers(projectId),
    listProjectInvites(projectId).catch(() => [] as ProjectInviteRow[]),
  ]);

  return { project, languages, members, invites };
}
