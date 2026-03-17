/**
 * Shared Credentials Types
 *
 * API keys shared at organization or project scope.
 * Org admins and project managers can share credentials
 * so team members can translate without personal API keys.
 */

import type { TranslationProviderId } from '@/lib/translation/types';

export type SharedCredentialProvider = TranslationProviderId | 'elevenlabs';

/** Row shape for the `shared_credentials` table */
export interface SharedCredentialRow {
  id: string;
  organization_id: string | null;
  project_id: string | null;
  provider: SharedCredentialProvider;
  label: string;
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Insert shape for `shared_credentials` */
export type SharedCredentialInsert = Pick<
  SharedCredentialRow,
  'organization_id' | 'project_id' | 'provider' | 'label' | 'config'
>;

/** Updatable fields on `shared_credentials` */
export type SharedCredentialUpdate = Partial<Pick<SharedCredentialRow, 'label' | 'config'>>;

/** Scope for listing shared credentials */
export interface SharedCredentialScope {
  orgId?: string;
  projectId?: string;
}
