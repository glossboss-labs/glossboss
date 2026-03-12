import { parsePOFileWithDiagnostics, type POFile } from '@/lib/po';
import { fetchDirectoryListing, fetchSourceFile } from './fetcher';
import type { WordPressProjectType } from './references';

export interface UpstreamTemplate {
  file: POFile;
  path: string;
  basePath: string | null;
}

function getPotCandidatePaths(slug: string): string[] {
  return [
    `${slug}.pot`,
    `languages/${slug}.pot`,
    `lang/${slug}.pot`,
    `i18n/${slug}.pot`,
    `locale/${slug}.pot`,
  ];
}

function isPotFile(path: string): boolean {
  return /\.pot$/i.test(path);
}

export async function fetchUpstreamTemplate(
  projectType: WordPressProjectType,
  slug: string,
  release?: string | null,
): Promise<UpstreamTemplate | null> {
  const candidates = new Set<string>(getPotCandidatePaths(slug));

  try {
    const rootListing = await fetchDirectoryListing(projectType, slug, '', release);
    const preferredCandidates = [...candidates];
    const fallbackCandidates: string[] = [];

    for (const entry of rootListing.entries) {
      if (!entry.isDir && isPotFile(entry.name)) {
        if (candidates.has(entry.name)) {
          preferredCandidates.push(entry.name);
        } else {
          fallbackCandidates.push(entry.name);
        }
      }

      if (entry.isDir && ['languages', 'lang', 'i18n', 'locale'].includes(entry.name)) {
        try {
          const nested = await fetchDirectoryListing(projectType, slug, entry.name, release);
          for (const nestedEntry of nested.entries) {
            if (nestedEntry.isDir || !isPotFile(nestedEntry.name)) continue;
            const nestedPath = `${entry.name}/${nestedEntry.name}`;
            if (candidates.has(nestedPath)) {
              preferredCandidates.push(nestedPath);
            } else {
              fallbackCandidates.push(nestedPath);
            }
          }
        } catch {
          // Ignore directories that cannot be listed and continue scanning.
        }
      }
    }

    for (const path of [...preferredCandidates, ...fallbackCandidates]) {
      try {
        const source = await fetchSourceFile(projectType, slug, path, release);
        const result = parsePOFileWithDiagnostics(source.content, path);
        if (result.success && result.file) {
          return {
            file: result.file,
            path,
            basePath: source.basePath,
          };
        }
      } catch {
        // Keep scanning candidates.
      }
    }
  } catch {
    return null;
  }

  return null;
}
