-- Organization-wide settings defaults and shared credentials.
--
-- Settings cascade: Organization → Project → User.
-- Org admins can set defaults and optionally enforce them (preventing project override).
-- Shared credentials let org admins or project managers share API keys with members.

-- ============================================================
-- 1. Organization settings (defaults + enforcement)
-- ============================================================

CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Translation provider defaults
  default_translation_provider text
    CHECK (default_translation_provider IN ('deepl', 'azure', 'gemini')),
  enforce_translation_provider boolean NOT NULL DEFAULT false,

  -- Glossary defaults
  default_glossary_enforcement boolean NOT NULL DEFAULT true,
  enforce_glossary_enforcement boolean NOT NULL DEFAULT false,

  -- Audit
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Org members can read settings
CREATE POLICY "org_members_can_read_settings"
  ON public.organization_settings FOR SELECT
  USING (public.is_org_member(organization_id));

-- Org admins can manage settings
CREATE POLICY "org_admins_can_manage_settings"
  ON public.organization_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "org_admins_can_update_settings"
  ON public.organization_settings FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "org_admins_can_delete_settings"
  ON public.organization_settings FOR DELETE
  USING (public.is_org_admin(organization_id));

-- ============================================================
-- 2. Shared credentials (org-scoped or project-scoped)
-- ============================================================

CREATE TABLE public.shared_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: exactly one of org or project must be set
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(organization_id, project_id) = 1),

  -- Provider + display label
  provider text NOT NULL CHECK (provider IN ('deepl', 'azure', 'gemini', 'elevenlabs')),
  label text NOT NULL,

  -- Provider-specific config (apiKey, apiType, region, etc.)
  config jsonb NOT NULL DEFAULT '{}',

  -- Audit
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.shared_credentials ENABLE ROW LEVEL SECURITY;

-- Read: org members (org-scoped) or project members (project-scoped)
CREATE POLICY "shared_creds_readable_by_scope_members"
  ON public.shared_credentials FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (project_id IS NOT NULL AND public.is_project_member(project_id))
  );

-- Insert: org admins (org-scoped) or project managers (project-scoped)
CREATE POLICY "shared_creds_insertable_by_scope_admins"
  ON public.shared_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
    OR
    (project_id IS NOT NULL AND public.is_project_manager(project_id))
  );

-- Update: org admins (org-scoped) or project managers (project-scoped)
CREATE POLICY "shared_creds_updatable_by_scope_admins"
  ON public.shared_credentials FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
    OR
    (project_id IS NOT NULL AND public.is_project_manager(project_id))
  )
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
    OR
    (project_id IS NOT NULL AND public.is_project_manager(project_id))
  );

-- Delete: org admins (org-scoped) or project managers (project-scoped)
CREATE POLICY "shared_creds_deletable_by_scope_admins"
  ON public.shared_credentials FOR DELETE
  USING (
    (organization_id IS NOT NULL AND public.is_org_admin(organization_id))
    OR
    (project_id IS NOT NULL AND public.is_project_manager(project_id))
  );
