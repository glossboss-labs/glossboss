/**
 * Shared sort functions for projects and project languages.
 */

import type { ProjectWithLanguages, ProjectLanguageRow } from '@/lib/projects/types';

/* ------------------------------------------------------------------ */
/*  Project sorting                                                    */
/* ------------------------------------------------------------------ */

export type ProjectSortOption =
  | 'updated'
  | 'name'
  | 'most-strings'
  | 'least-complete'
  | 'most-complete';

export function sortProjects(
  projects: ProjectWithLanguages[],
  sort: ProjectSortOption,
): ProjectWithLanguages[] {
  const sorted = [...projects];
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'most-strings':
      return sorted.sort((a, b) => b.stats_total - a.stats_total);
    case 'most-complete': {
      const pct = (p: ProjectWithLanguages) =>
        p.stats_total > 0 ? p.stats_translated / p.stats_total : 0;
      return sorted.sort((a, b) => pct(b) - pct(a));
    }
    case 'least-complete': {
      const pct = (p: ProjectWithLanguages) =>
        p.stats_total > 0 ? p.stats_translated / p.stats_total : 0;
      return sorted.sort((a, b) => pct(a) - pct(b));
    }
    case 'updated':
    default:
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Language sorting                                                   */
/* ------------------------------------------------------------------ */

export type LangSortOption =
  | 'locale'
  | 'most-complete'
  | 'least-complete'
  | 'most-strings'
  | 'updated';

export function sortLanguages(
  languages: ProjectLanguageRow[],
  sort: LangSortOption,
): ProjectLanguageRow[] {
  const sorted = [...languages];
  switch (sort) {
    case 'locale':
      return sorted.sort((a, b) => a.locale.localeCompare(b.locale));
    case 'most-complete': {
      const pct = (l: ProjectLanguageRow) =>
        l.stats_total > 0 ? l.stats_translated / l.stats_total : 0;
      return sorted.sort((a, b) => pct(b) - pct(a));
    }
    case 'least-complete': {
      const pct = (l: ProjectLanguageRow) =>
        l.stats_total > 0 ? l.stats_translated / l.stats_total : 0;
      return sorted.sort((a, b) => pct(a) - pct(b));
    }
    case 'most-strings':
      return sorted.sort((a, b) => b.stats_total - a.stats_total);
    case 'updated':
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    default:
      return sorted;
  }
}
