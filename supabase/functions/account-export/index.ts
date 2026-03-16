/**
 * Account Export Edge Function
 *
 * GDPR Article 20 — right to data portability. Exports all user data as JSON.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  forbiddenOrigin,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  validateRequestOrigin,
} from '../_shared/http.ts';

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(req);
  }

  const originValidation = validateRequestOrigin(req);
  if (originValidation.allowedOrigins.length === 0) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Data export backend is not configured correctly.',
      },
      { status: 500 },
    );
  }
  if (!originValidation.allowed) {
    return forbiddenOrigin(req);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse(
      req,
      { ok: false, code: 'UNAUTHORIZED', message: 'Missing authorization header.' },
      { status: 401 },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  if (!supabaseServiceKey) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Data export backend is not configured correctly.',
      },
      { status: 500 },
    );
  }

  // Verify the user's identity
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse(
      req,
      { ok: false, code: 'UNAUTHORIZED', message: 'Invalid or expired session.' },
      { status: 401 },
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch projects with languages and entries
    const { data: projects } = await adminClient
      .from('projects')
      .select('*, project_languages(*, project_entries(*))')
      .eq('owner_id', user.id);

    // Fetch organization memberships
    const { data: orgMemberships } = await adminClient
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('user_id', user.id);

    // Fetch subscriptions
    const { data: subscriptions } = await adminClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id);

    // Fetch notifications
    const { data: notifications } = await adminClient
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    // Fetch project memberships (projects shared with user)
    const { data: projectMemberships } = await adminClient
      .from('project_members')
      .select('*, projects(name, slug)')
      .eq('user_id', user.id);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      profile: {
        email: user.email,
        name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        createdAt: user.created_at,
      },
      projects: (projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        sourceLanguage: project.source_language,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        languages: (project.project_languages ?? []).map((lang: Record<string, unknown>) => ({
          id: lang.id,
          code: lang.language_code,
          name: lang.language_name,
          entries: ((lang.project_entries as Record<string, unknown>[]) ?? []).map(
            (entry: Record<string, unknown>) => ({
              id: entry.id,
              msgid: entry.msgid,
              msgstr: entry.msgstr,
              context: entry.context,
              status: entry.status,
              reviewStatus: entry.review_status,
              createdAt: entry.created_at,
              updatedAt: entry.updated_at,
            }),
          ),
        })),
      })),
      organizations: (orgMemberships ?? []).map((membership: Record<string, unknown>) => ({
        role: membership.role,
        joinedAt: membership.created_at,
        organization: membership.organizations
          ? {
              name: (membership.organizations as Record<string, unknown>).name,
              slug: (membership.organizations as Record<string, unknown>).slug,
            }
          : null,
      })),
      projectMemberships: (projectMemberships ?? []).map((membership: Record<string, unknown>) => ({
        role: membership.role,
        joinedAt: membership.created_at,
        project: membership.projects
          ? {
              name: (membership.projects as Record<string, unknown>).name,
              slug: (membership.projects as Record<string, unknown>).slug,
            }
          : null,
      })),
      subscriptions: (subscriptions ?? []).map((sub: Record<string, unknown>) => ({
        plan: sub.plan,
        billingInterval: sub.billing_interval,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
        createdAt: sub.created_at,
        updatedAt: sub.updated_at,
      })),
      notifications: (notifications ?? []).map((n: Record<string, unknown>) => ({
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.created_at,
      })),
    };

    return jsonResponse(req, { ok: true, data: exportData });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Data export error:', message);
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Data export failed. Please try again.',
      },
      { status: 500 },
    );
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleRequest);
}

export { handleRequest };
