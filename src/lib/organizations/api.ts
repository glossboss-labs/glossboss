/**
 * Organizations API
 *
 * Supabase CRUD operations for organizations, members, and invites.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  OrganizationRow,
  OrganizationInsert,
  OrganizationUpdate,
  OrgMemberRow,
  OrgMemberWithProfile,
  OrgRole,
  InviteRow,
  InviteInsert,
} from './types';

function supabase() {
  return getSupabaseClient('Organizations');
}

// ── Organizations ─────────────────────────────────────────────

export async function listOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await supabase()
    .from('organizations')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getOrganization(id: string): Promise<OrganizationRow | null> {
  const { data, error } = await supabase().from('organizations').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getOrganizationBySlug(slug: string): Promise<OrganizationRow | null> {
  const { data, error } = await supabase()
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createOrganization(insert: OrganizationInsert): Promise<OrganizationRow> {
  const { data, error } = await supabase().from('organizations').insert(insert).select().single();

  if (error) throw error;
  return data;
}

export async function updateOrganization(
  id: string,
  updates: OrganizationUpdate,
): Promise<OrganizationRow> {
  const { data, error } = await supabase()
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrganization(id: string): Promise<void> {
  const { error } = await supabase().from('organizations').delete().eq('id', id);

  if (error) throw error;
}

// ── Members ───────────────────────────────────────────────────

export async function listOrgMembers(orgId: string): Promise<OrgMemberWithProfile[]> {
  const { data, error } = await supabase()
    .from('organization_members')
    .select('*, profiles(email, full_name, avatar_url)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as OrgMemberWithProfile[];
}

export async function addOrgMember(
  orgId: string,
  userId: string,
  role: OrgRole = 'member',
): Promise<OrgMemberRow> {
  const { data, error } = await supabase()
    .from('organization_members')
    .insert({ organization_id: orgId, user_id: userId, role })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrgMemberRole(memberId: string, role: OrgRole): Promise<OrgMemberRow> {
  const { data, error } = await supabase()
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeOrgMember(memberId: string): Promise<void> {
  const { error } = await supabase().from('organization_members').delete().eq('id', memberId);

  if (error) throw error;
}

// ── Invites ───────────────────────────────────────────────────

export async function listInvites(orgId: string): Promise<InviteRow[]> {
  const { data, error } = await supabase()
    .from('invites')
    .select('*')
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createInvite(insert: InviteInsert): Promise<InviteRow> {
  const { data, error } = await supabase().from('invites').insert(insert).select().single();

  if (error) throw error;
  return data;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase().from('invites').delete().eq('id', inviteId);

  if (error) throw error;
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase().rpc('accept_invite', { p_token: token });

  if (error) throw error;
  return data as string;
}

export async function getInviteByToken(token: string): Promise<InviteRow | null> {
  const { data, error } = await supabase()
    .from('invites')
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
