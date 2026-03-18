/**
 * WordPress.org project source reference helpers.
 */

import type { POHeader } from '@/lib/po/types';

export type WordPressProjectType = 'plugin' | 'theme';
export type WordPressPluginTranslationTrack = 'stable' | 'dev';

/** Parsed source reference */
export interface ParsedReference {
  path: string;
  line: number | null;
}

/** Normalized source path with optional explicit base-path override */
export interface NormalizedSourcePath {
  path: string;
  basePath: string | null;
}

export interface DetectedWordPressProject {
  type: WordPressProjectType;
  slug: string;
  version: string | null;
}

function isVersionLike(value: string): boolean {
  return /^[\d][\w.-]*$/.test(value);
}

export function parseReference(ref: string): ParsedReference {
  const trimmed = ref.trim();
  const colonIndex = trimmed.lastIndexOf(':');

  if (colonIndex > 0) {
    const possibleLine = trimmed.slice(colonIndex + 1);
    const lineNum = parseInt(possibleLine, 10);

    if (!Number.isNaN(lineNum) && lineNum > 0 && String(lineNum) === possibleLine) {
      return {
        path: trimmed.slice(0, colonIndex),
        line: lineNum,
      };
    }
  }

  return { path: trimmed, line: null };
}

export function parseReferences(references: string[]): ParsedReference[] {
  const parsed: ParsedReference[] = [];

  for (const refLine of references) {
    const parts = refLine.trim().split(/\s+/);
    for (const part of parts) {
      if (part) {
        parsed.push(parseReference(part));
      }
    }
  }

  return parsed;
}

export function normalizeSourcePath(
  path: string,
  slug?: string | null,
  projectType: WordPressProjectType = 'plugin',
): NormalizedSourcePath {
  let clean = path.replace(/\\/g, '/').trim();
  clean = clean.replace(/^\/+/, '').replace(/\/{2,}/g, '/');

  while (clean.startsWith('./')) {
    clean = clean.slice(2);
  }

  if (slug) {
    const wpPrefix =
      projectType === 'theme' ? `wp-content/themes/${slug}/` : `wp-content/plugins/${slug}/`;
    if (clean.toLowerCase().startsWith(wpPrefix.toLowerCase())) {
      clean = clean.slice(wpPrefix.length);
    }

    const slugPrefix = `${slug}/`;
    if (clean.toLowerCase().startsWith(slugPrefix.toLowerCase())) {
      clean = clean.slice(slugPrefix.length);
    }
  }

  if (projectType === 'plugin') {
    if (clean === 'trunk') {
      return { path: '', basePath: 'trunk' };
    }

    if (clean.startsWith('trunk/')) {
      return { path: clean.slice('trunk/'.length), basePath: 'trunk' };
    }

    const tagMatch = clean.match(/^tags\/([^/]+)(?:\/(.*))?$/);
    if (tagMatch) {
      return {
        path: tagMatch[2] ?? '',
        basePath: `tags/${tagMatch[1]}`,
      };
    }
  } else {
    const [head, ...rest] = clean.split('/');
    if (head && isVersionLike(head) && rest.length > 0) {
      return {
        path: rest.join('/'),
        basePath: head,
      };
    }
  }

  return { path: clean, basePath: null };
}

function extractVersion(projectIdVersion: string): string | null {
  const match = projectIdVersion.match(/[\s_-]+v?([\d][\d.]*(?:-[\w.]+)?)\s*$/);
  return match ? match[1]! : null;
}

function slugifyProjectName(value: string): string | null {
  const withoutVersion = value.replace(/[\s_-]+v?[\d][\d.]*[-\w]*\s*$/, '').trim();

  if (!withoutVersion) {
    return null;
  }

  const slug = withoutVersion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
}

function slugFromFilename(filename: string): string | null {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.pot?$/i, '');

  if (!base) return null;

  const withoutLocale = base.replace(/-[a-z]{2,3}(?:[_-][a-z0-9]{2,8})*$/i, '');

  if (!withoutLocale) return null;

  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(withoutLocale) ? withoutLocale : null;
}

function detectTypeFromHeader(header: POHeader): WordPressProjectType | null {
  const candidates = [
    header.reportMsgidBugsTo,
    header.projectIdVersion,
    header.xDomain,
    header['x-domain'],
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (lower.includes('/support/plugin/')) return 'plugin';
    if (lower.includes('/support/theme/')) return 'theme';
    if (lower.includes('wp-plugins')) return 'plugin';
    if (lower.includes('wp-themes')) return 'theme';
  }

  return null;
}

function detectSlugFromHeader(header: POHeader): string | null {
  const reportUrl = header.reportMsgidBugsTo ?? '';
  const reportMatch = reportUrl.match(/\/support\/(plugin|theme)\/([a-z0-9-]+)\//i);
  if (reportMatch) {
    return reportMatch[2]!.toLowerCase();
  }

  const domain =
    (typeof header.xDomain === 'string' && header.xDomain) ||
    (typeof header['x-domain'] === 'string' ? header['x-domain'] : '');
  if (domain && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(domain)) {
    return domain.toLowerCase();
  }

  return header.projectIdVersion ? slugifyProjectName(header.projectIdVersion) : null;
}

export function detectWordPressProject(
  header: POHeader,
  filename: string,
): DetectedWordPressProject | null {
  const type = detectTypeFromHeader(header) ?? 'plugin';
  const slug = detectSlugFromHeader(header) ?? slugFromFilename(filename);
  if (!slug) {
    return null;
  }

  return {
    type,
    slug,
    version: header.projectIdVersion ? extractVersion(header.projectIdVersion) : null,
  };
}

export function detectPluginSlug(
  header: POHeader,
  filename: string,
): DetectedWordPressProject | null {
  return detectWordPressProject(header, filename);
}

export function buildTracUrl(
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  line?: number,
  basePath?: string | null,
): string {
  const normalized = normalizeSourcePath(path, slug, projectType);
  const effectiveBasePath =
    normalized.basePath ?? basePath ?? (projectType === 'plugin' ? 'trunk' : '');
  const cleanPath = normalized.path.replace(/^\/+/, '');
  const rootBase =
    projectType === 'theme'
      ? `https://themes.trac.wordpress.org/browser/${slug}`
      : `https://plugins.trac.wordpress.org/browser/${slug}`;
  const root = effectiveBasePath ? `${rootBase}/${effectiveBasePath}` : rootBase;
  const url = cleanPath ? `${root}/${cleanPath}` : `${root}/`;
  return line ? `${url}#L${line}` : url;
}

export function buildSvnUrl(
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  basePath?: string | null,
): string {
  const normalized = normalizeSourcePath(path, slug, projectType);
  const effectiveBasePath =
    normalized.basePath ?? basePath ?? (projectType === 'plugin' ? 'trunk' : '');
  const cleanPath = normalized.path.replace(/^\/+/, '');
  const rootBase =
    projectType === 'theme'
      ? `https://themes.svn.wordpress.org/${slug}`
      : `https://plugins.svn.wordpress.org/${slug}`;
  const root = effectiveBasePath ? `${rootBase}/${effectiveBasePath}` : rootBase;
  return cleanPath ? `${root}/${cleanPath}` : `${root}/`;
}
