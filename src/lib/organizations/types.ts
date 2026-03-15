/**
 * Organization Database Types
 *
 * TypeScript interfaces matching the Supabase organization tables.
 * Used by the organizations API and org management UI.
 */

/** Row shape for the `organizations` table */
export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** Insert shape for `organizations` (id auto-generated) */
export type OrganizationInsert = Omit<OrganizationRow, 'id' | 'created_at' | 'updated_at'>;

/** Updatable fields on `organizations` */
export type OrganizationUpdate = Partial<
  Pick<OrganizationRow, 'name' | 'slug' | 'description' | 'avatar_url'>
>;

/** Org-level role hierarchy: owner > admin > member */
export type OrgRole = 'owner' | 'admin' | 'member';

/** Row shape for the `organization_members` table */
export interface OrgMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  updated_at: string;
}

/** Organization member with profile info from a join query */
export interface OrgMemberWithProfile extends OrgMemberRow {
  profiles: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

/** Row shape for the `invites` table */
export interface InviteRow {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'member';
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  expires_at: string;
  created_at: string;
}

/** Insert shape for `invites` */
export type InviteInsert = Pick<InviteRow, 'organization_id' | 'email' | 'role'>;

/** Organization with member count for listing */
export interface OrganizationWithCounts extends OrganizationRow {
  member_count: number;
}
