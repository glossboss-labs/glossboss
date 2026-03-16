/**
 * Roadmap API client — fetches roadmap issues via the edge function.
 */

import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import type { RoadmapIssue } from './types';

export async function fetchRoadmap(): Promise<RoadmapIssue[]> {
  const { data, error, response } = await invokeSupabaseFunction<{
    ok: boolean;
    issues?: RoadmapIssue[];
    message?: string;
  }>('roadmap', { featureLabel: 'Roadmap' });

  if (error || !data?.ok) {
    const body = await readSupabaseFunctionError(response);
    const message =
      (body.message as string) ||
      (data as Record<string, unknown>)?.message ||
      'Failed to load roadmap';
    throw new Error(String(message));
  }

  return data.issues ?? [];
}
