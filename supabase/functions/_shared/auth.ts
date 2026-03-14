/**
 * Edge function auth helpers — extract and validate Supabase JWT.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse } from './http.ts';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Extracts the authenticated user from the request's Authorization header.
 * Returns the user if valid, or null if unauthenticated.
 */
export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email };
}

/**
 * Requires authentication. Returns an HTTP 401 response if not authenticated.
 * Use in edge functions that need a signed-in user.
 */
export async function requireAuth(
  req: Request,
): Promise<
  { user: AuthenticatedUser; errorResponse?: never } | { user?: never; errorResponse: Response }
> {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return {
      errorResponse: jsonResponse(
        req,
        { ok: false, code: 'UNAUTHORIZED', message: 'Authentication required.' },
        { status: 401 },
      ),
    };
  }

  return { user };
}
