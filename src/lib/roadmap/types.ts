/**
 * Roadmap types — matches the edge function response shape.
 */

export interface RoadmapIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  goal: string;
  tasksTotal: number;
  tasksDone: number;
  labels: Array<{ name: string; color: string }>;
  reactions: number;
  updatedAt: string;
  createdAt: string;
  url: string;
}

export type RoadmapStatus = 'all' | 'planned' | 'in-progress' | 'done';

export function deriveStatus(issue: RoadmapIssue): 'planned' | 'in-progress' | 'done' {
  if (issue.state === 'closed') return 'done';
  if (issue.tasksDone > 0) return 'in-progress';
  return 'planned';
}
