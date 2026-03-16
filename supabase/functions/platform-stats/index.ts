/**
 * Platform Stats edge function — returns aggregate public metrics
 * for the landing page counters (total strings, projects, members).
 *
 * No authentication required. Cached for 5 minutes.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  forbiddenOrigin,
  jsonResponse,
  optionsResponse,
  validateRequestOrigin,
} from '../_shared/http.ts';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface PlatformStats {
  totalStrings: number;
  totalProjects: number;
  totalMembers: number;
  totalLanguages: number;
}

const EMPTY_STATS: PlatformStats = {
  totalStrings: 0,
  totalProjects: 0,
  totalMembers: 0,
  totalLanguages: 0,
};

let cache: { data: PlatformStats; timestamp: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  const originCheck = validateRequestOrigin(req);
  if (!originCheck.allowed) {
    return forbiddenOrigin(originCheck);
  }

  // Return cached data if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return jsonResponse(req, { ok: true, stats: cache.data });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { ok: true, stats: EMPTY_STATS });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [projectsResult, membersResult, languagesResult] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('project_languages').select('id, stats_total', { count: 'exact' }),
    ]);

    const totalProjects = projectsResult.count ?? 0;
    const totalMembers = membersResult.count ?? 0;
    const totalLanguages = languagesResult.count ?? 0;

    const totalStrings =
      languagesResult.data?.reduce(
        (sum: number, row: { stats_total?: number }) => sum + (row.stats_total ?? 0),
        0,
      ) ?? 0;

    const stats: PlatformStats = { totalStrings, totalProjects, totalMembers, totalLanguages };
    cache = { data: stats, timestamp: Date.now() };

    return jsonResponse(req, { ok: true, stats });
  } catch (error) {
    console.error('Platform stats error:', error);
    return jsonResponse(req, { ok: false, stats: EMPTY_STATS }, { status: 500 });
  }
});
