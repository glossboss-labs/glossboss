/**
 * TanStack Query hooks for the public roadmap.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchRoadmap } from './api';
import type { RoadmapIssue } from './types';

// ── Query key factory ────────────────────────────────────────

export const roadmapKeys = {
  all: ['roadmap'] as const,
};

// ── Query hooks ──────────────────────────────────────────────

export function useRoadmapItems() {
  return useQuery<RoadmapIssue[]>({
    queryKey: roadmapKeys.all,
    queryFn: fetchRoadmap,
    staleTime: 5 * 60_000, // 5 minutes — roadmap data changes infrequently
  });
}
