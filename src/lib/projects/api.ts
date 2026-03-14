/**
 * Projects API
 *
 * Supabase CRUD operations for projects and project entries.
 * Used by the cloud storage adapter and project management UI.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type { ProjectRow, ProjectInsert, ProjectUpdate, ProjectEntryRow } from './types';
import { entryKey, poEntryToDbFields } from './conversions';
import type { POEntry } from '@/lib/po/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { ReviewEntryState } from '@/lib/review';

function supabase() {
  return getSupabaseClient('Projects');
}

// ── Projects ─────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
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

// ── Project Entries ──────────────────────────────────────────

export async function getProjectEntries(projectId: string): Promise<ProjectEntryRow[]> {
  const { data, error } = await supabase()
    .from('project_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('entry_index', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Lightweight fetch of just entry keys for diffing. */
export async function getProjectEntryKeys(
  projectId: string,
): Promise<{ id: string; msgctxt: string | null; msgid: string }[]> {
  const { data, error } = await supabase()
    .from('project_entries')
    .select('id, msgctxt, msgid')
    .eq('project_id', projectId);

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
  projectId: string,
  entries: POEntry[],
  mtMeta: Map<string, MachineTranslationMeta>,
  reviewEntries: Map<string, ReviewEntryState>,
): Promise<void> {
  // 1. Fetch existing entry keys
  const existing = await getProjectEntryKeys(projectId);
  const existingByKey = new Map(existing.map((e) => [entryKey(e.msgctxt, e.msgid), e.id]));

  // 2. Build upsert payload
  const processedKeys = new Set<string>();
  const toUpsert: (Omit<ProjectEntryRow, 'created_at' | 'updated_at'> & { id?: string })[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const key = entryKey(entry.msgctxt, entry.msgid);
    processedKeys.add(key);

    const dbId = existingByKey.get(key);
    const fields = poEntryToDbFields(
      entry,
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
