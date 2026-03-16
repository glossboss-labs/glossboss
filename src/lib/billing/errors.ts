/**
 * Detect plan-limit RLS errors and return user-friendly messages.
 */

const RLS_VIOLATION_PATTERN = /row-level security|violates.*policy/i;

export type LimitResource = 'projects' | 'strings' | 'members';

const TABLE_TO_RESOURCE: Record<string, LimitResource> = {
  projects: 'projects',
  project_entries: 'strings',
  project_members: 'members',
  organization_members: 'members',
};

/**
 * Check if an error is a plan-limit RLS violation.
 * Returns the resource type if detected, null otherwise.
 */
export function detectLimitError(error: unknown): LimitResource | null {
  const message = extractMessage(error);
  if (!RLS_VIOLATION_PATTERN.test(message)) return null;

  for (const [table, resource] of Object.entries(TABLE_TO_RESOURCE)) {
    if (message.includes(`"${table}"`)) return resource;
  }

  // Generic RLS violation — likely a limit
  return 'projects';
}

/**
 * Return a user-friendly error message for a plan-limit violation.
 */
export function getLimitErrorMessage(resource: LimitResource): string {
  switch (resource) {
    case 'projects':
      return 'You have reached the project limit on your current plan. Upgrade to create more projects.';
    case 'strings':
      return 'You have reached the string limit on your current plan. Upgrade to add more strings.';
    case 'members':
      return 'You have reached the member limit on your current plan. Upgrade to add more members.';
  }
}

function extractMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return '';
}
