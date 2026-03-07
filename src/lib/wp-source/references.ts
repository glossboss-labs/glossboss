/**
 * WordPress Plugin Source Code References
 *
 * Utilities for parsing PO source references and building
 * URLs to plugins.trac.wordpress.org / plugins.svn.wordpress.org.
 */

import type { POHeader } from '@/lib/po/types';

/** Parsed source reference */
export interface ParsedReference {
  path: string;
  line: number | null;
}

/**
 * Parse a single source reference string (e.g., "includes/class-foo.php:123")
 */
export function parseReference(ref: string): ParsedReference {
  const trimmed = ref.trim();
  const colonIndex = trimmed.lastIndexOf(':');

  if (colonIndex > 0) {
    const possibleLine = trimmed.slice(colonIndex + 1);
    const lineNum = parseInt(possibleLine, 10);

    if (!isNaN(lineNum) && lineNum > 0 && String(lineNum) === possibleLine) {
      return {
        path: trimmed.slice(0, colonIndex),
        line: lineNum,
      };
    }
  }

  return { path: trimmed, line: null };
}

/**
 * Parse all references from a PO entry's references array.
 * Each reference string can contain multiple space-separated references.
 */
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

/**
 * Detect plugin slug from PO header and/or filename.
 *
 * Tries two strategies:
 * 1. From `projectIdVersion` header: "Plugin Name 1.0" → "plugin-name"
 * 2. From filename: "plugin-name-nl_NL.po" → "plugin-name"
 */
export function detectPluginSlug(header: POHeader, filename: string): string | null {
  // Strategy 1: From Project-Id-Version header
  if (header.projectIdVersion) {
    const slug = slugFromProjectId(header.projectIdVersion);
    if (slug) return slug;
  }

  // Strategy 2: From filename
  const slug = slugFromFilename(filename);
  if (slug) return slug;

  return null;
}

/**
 * Extract slug from Project-Id-Version header.
 * Pattern: "Plugin Name 1.0.2" → "plugin-name"
 * Also handles: "Plugin Name" (no version)
 */
function slugFromProjectId(projectIdVersion: string): string | null {
  // Remove version suffix (digits, dots, dashes at the end)
  const withoutVersion = projectIdVersion.replace(/[\s_-]+v?[\d][\d.]*[-\w]*\s*$/, '').trim();

  if (!withoutVersion) return null;

  // Convert to slug: lowercase, replace spaces/underscores with hyphens
  const slug = withoutVersion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
}

/**
 * Extract slug from PO filename.
 * Pattern: "plugin-name-nl_NL.po" → "plugin-name"
 * Pattern: "plugin-name.po" → "plugin-name"
 */
function slugFromFilename(filename: string): string | null {
  // Remove path prefix and extension
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.pot?$/i, '');

  if (!base) return null;

  // Remove locale suffix (e.g., "-nl_NL", "-de_DE", "-fr")
  const withoutLocale = base.replace(/-[a-z]{2}(_[A-Z]{2})?$/, '');

  if (!withoutLocale) return null;

  // Validate it looks like a slug
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(withoutLocale)) {
    return withoutLocale;
  }

  return null;
}

/**
 * Build a URL to plugins.trac.wordpress.org for viewing source.
 */
export function buildTracUrl(slug: string, path: string, line?: number): string {
  const cleanPath = path.replace(/^\/+/, '');
  const url = `https://plugins.trac.wordpress.org/browser/${slug}/trunk/${cleanPath}`;
  return line ? `${url}#L${line}` : url;
}

/**
 * Build a URL to plugins.svn.wordpress.org for fetching raw files.
 */
export function buildSvnUrl(slug: string, path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  return `https://plugins.svn.wordpress.org/${slug}/trunk/${cleanPath}`;
}
