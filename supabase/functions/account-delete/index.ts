/**
 * Account Delete Edge Function
 *
 * GDPR Article 17 — right to erasure. Deletes all user data from the database
 * and removes the auth user. The database schema uses ON DELETE CASCADE on all
 * user-referencing foreign keys, so deleting the auth user cascades to:
 *   - profiles
 *   - projects (→ project_languages → project_entries)
 *   - project_members
 *   - organizations (if sole owner → organization_members)
 *   - organization_members
 *   - notifications
 *   - subscriptions
 *   - invites (SET NULL on invited_by/accepted_by)
 *   - project_invites (SET NULL on invited_by/accepted_by)
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
        message: 'Account deletion backend is not configured correctly.',
      },
      { status: 500 },
    );
  }
  if (!originValidation.allowed) {
    return forbiddenOrigin(req);
  }

  // Authenticate the requesting user
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse(
      req,
      { ok: false, code: 'UNAUTHORIZED', message: 'Missing authorization header.' },
      { status: 401 },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseServiceKey) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Account deletion backend is not configured correctly.',
      },
      { status: 500 },
    );
  }

  // Verify the user's identity with their JWT
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

  // Use service role client for admin operations
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Check for organizations where user is the sole owner — transfer or delete
    const { data: ownedOrgs } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('owner_id', user.id);

    if (ownedOrgs && ownedOrgs.length > 0) {
      for (const org of ownedOrgs) {
        // Check if there are other members who could take ownership
        const { data: members } = await adminClient
          .from('organization_members')
          .select('user_id, role')
          .eq('organization_id', org.id)
          .neq('user_id', user.id);

        if (members && members.length > 0) {
          // Transfer ownership to the first admin, or first member
          const newOwner = members.find((m: { role: string }) => m.role === 'admin') || members[0];
          await adminClient
            .from('organizations')
            .update({ owner_id: newOwner.user_id })
            .eq('id', org.id);
        }
        // If no other members, the org will be deleted by CASCADE when the user is deleted
      }
    }

    // Cancel active Polar subscriptions if any
    const { data: subscriptions } = await adminClient
      .from('subscriptions')
      .select('polar_subscription_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due']);

    if (subscriptions && subscriptions.length > 0) {
      const polarToken = Deno.env.get('POLAR_ACCESS_TOKEN');
      if (polarToken) {
        for (const sub of subscriptions) {
          try {
            await fetch(`https://api.polar.sh/v1/subscriptions/${sub.polar_subscription_id}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${polarToken}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (err) {
            console.error(`Failed to cancel Polar subscription ${sub.polar_subscription_id}:`, err);
            // Continue with deletion even if Polar cancellation fails
          }
        }
      }
    }

    // Delete the auth user — this cascades to all related data
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'DELETION_FAILED',
          message: 'Failed to delete account. Please try again or contact support.',
        },
        { status: 500 },
      );
    }

    return jsonResponse(req, { ok: true, message: 'Account deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Account deletion error:', message);
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Account deletion failed. Please try again or contact support.',
      },
      { status: 500 },
    );
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleRequest);
}

export { handleRequest };
