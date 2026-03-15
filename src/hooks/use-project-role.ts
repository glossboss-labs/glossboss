/**
 * useProjectRole — resolves the current user's role in a project.
 *
 * Returns granular permission booleans matching the role hierarchy:
 *   admin > maintainer > reviewer > translator > viewer
 */

import { useEffect, useState } from 'react';
import { getMyProjectRole } from '@/lib/projects/api';
import type { ProjectRole } from '@/lib/projects/types';

export interface ProjectRoleInfo {
  /** Raw role string, or null while loading / if not a member. */
  role: ProjectRole | null;
  /** True while the role is being fetched. */
  loading: boolean;
  /** admin only */
  isAdmin: boolean;
  /** admin | maintainer — can manage settings, languages, repo sync */
  isManager: boolean;
  /** admin | maintainer | reviewer — can approve/reject reviews */
  isReviewer: boolean;
  /** admin | maintainer | reviewer | translator — can edit entries */
  isContributor: boolean;
}

const MANAGER_ROLES: ProjectRole[] = ['admin', 'maintainer'];
const REVIEWER_ROLES: ProjectRole[] = ['admin', 'maintainer', 'reviewer'];
const CONTRIBUTOR_ROLES: ProjectRole[] = ['admin', 'maintainer', 'reviewer', 'translator'];

export function useProjectRole(projectId: string | undefined): ProjectRoleInfo {
  const [role, setRole] = useState<ProjectRole | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    getMyProjectRole(projectId).then((r) => {
      if (!cancelled) {
        setRole(r);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isManager: role !== null && MANAGER_ROLES.includes(role),
    isReviewer: role !== null && REVIEWER_ROLES.includes(role),
    isContributor: role !== null && CONTRIBUTOR_ROLES.includes(role),
  };
}
