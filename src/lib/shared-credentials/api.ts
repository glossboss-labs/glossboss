/**
 * Shared Credentials API
 *
 * CRUD operations for org-scoped and project-scoped shared credentials.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  SharedCredentialRow,
  SharedCredentialInsert,
  SharedCredentialUpdate,
  SharedCredentialScope,
} from './types';

function supabase() {
  return getSupabaseClient('SharedCredentials');
}

/** List shared credentials visible to the current user within a scope. */
export async function listSharedCredentials(
  scope: SharedCredentialScope,
): Promise<SharedCredentialRow[]> {
  let query = supabase().from('shared_credentials').select('*');

  if (scope.orgId) {
    query = query.eq('organization_id', scope.orgId);
  }
  if (scope.projectId) {
    query = query.eq('project_id', scope.projectId);
  }

  const { data, error } = await query.order('provider').order('label');
  if (error) throw error;
  return data ?? [];
}

/**
 * List all shared credentials available for a project.
 * Includes both project-scoped and org-scoped credentials (if the project belongs to an org).
 */
export async function listAvailableCredentials(
  projectId: string,
  orgId: string | null,
): Promise<SharedCredentialRow[]> {
  const results: SharedCredentialRow[] = [];

  // Project-scoped credentials
  const projectCreds = await listSharedCredentials({ projectId });
  results.push(...projectCreds);

  // Org-scoped credentials (if project belongs to an org)
  if (orgId) {
    const orgCreds = await listSharedCredentials({ orgId });
    results.push(...orgCreds);
  }

  return results;
}

/** Create a new shared credential. */
export async function createSharedCredential(
  insert: SharedCredentialInsert,
): Promise<SharedCredentialRow> {
  const { data, error } = await supabase()
    .from('shared_credentials')
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Update an existing shared credential. */
export async function updateSharedCredential(
  id: string,
  updates: SharedCredentialUpdate,
): Promise<SharedCredentialRow> {
  const { data, error } = await supabase()
    .from('shared_credentials')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a shared credential. */
export async function deleteSharedCredential(id: string): Promise<void> {
  const { error } = await supabase().from('shared_credentials').delete().eq('id', id);
  if (error) throw error;
}
