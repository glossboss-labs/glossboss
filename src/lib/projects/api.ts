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

// ── Projects ─────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectWithLanguages[]> {
  // Try joined query first; fall back to projects-only if PostgREST
  // schema cache hasn't picked up the project_languages relationship yet.
  const joined = await supabase()
    .from('projects')
    .select('*, project_languages(*)')
    .order('updated_at', { ascending: false });

  if (!joined.error) {
    return (joined.data ?? []) as ProjectWithLanguages[];
  }

  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, project_languages: [] }) as ProjectWithLanguages);
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase().from('projects').select('*').eq('id', id).single();

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
  const { error } = await supabase().from('projects').delete().eq('id', id);

  if (error) throw error;
}

/** List public projects visible on /explore (excludes unlisted). */
export async function listPublicProjects(): Promise<ProjectWithLanguages[]> {
  const joined = await supabase()
    .from('projects')
    .select('*, project_languages(*)')
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false });

  if (!joined.error) {
    return (joined.data ?? []) as ProjectWithLanguages[];
  }

  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, project_languages: [] }) as ProjectWithLanguages);
}

// ── Project Languages ────────────────────────────────────────

export async function getProjectLanguages(projectId: string): Promise<ProjectLanguageRow[]> {
  const { data, error } = await supabase()
    .from('project_languages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getProjectLanguage(languageId: string): Promise<ProjectLanguageRow | null> {
  const { data, error } = await supabase()
    .from('project_languages')
    .select('*')
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
  const { data, error } = await supabase()
    .from('project_entries')
    .select('*')
    .eq('language_id', languageId)
    .order('entry_index', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Lightweight fetch of just entry keys for diffing. */
export async function getProjectEntryKeys(
  languageId: string,
): Promise<{ id: string; msgctxt: string | null; msgid: string }[]> {
  const { data, error } = await supabase()
    .from('project_entries')
    .select('id, msgctxt, msgid')
    .eq('language_id', languageId);

  if (error) throw error;
  return data ?? [];
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
    const entry = entries[i];
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
    .select('*')
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
    .select('*')
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
    .select('*')
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
    .select('*, project_languages(*)')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });

  if (!joined.error) {
    return (joined.data ?? []) as ProjectWithLanguages[];
  }

  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, project_languages: [] }) as ProjectWithLanguages);
}
