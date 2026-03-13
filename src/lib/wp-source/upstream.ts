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

    const i18nDirs: string[] = [];

    for (const entry of rootListing.entries) {
      if (!entry.isDir && isPotFile(entry.name)) {
        if (candidates.has(entry.name)) {
          preferredCandidates.push(entry.name);
        } else {
          fallbackCandidates.push(entry.name);
        }
      }

      if (entry.isDir && ['languages', 'lang', 'i18n', 'locale'].includes(entry.name)) {
        i18nDirs.push(entry.name);
      }
    }

    const nestedResults = await Promise.allSettled(
      i18nDirs.map((dir) => fetchDirectoryListing(projectType, slug, dir, release)),
    );

    for (let i = 0; i < i18nDirs.length; i += 1) {
      const result = nestedResults[i];
      if (result.status !== 'fulfilled') continue;
      for (const nestedEntry of result.value.entries) {
        if (nestedEntry.isDir || !isPotFile(nestedEntry.name)) continue;
        const nestedPath = `${i18nDirs[i]}/${nestedEntry.name}`;
        if (candidates.has(nestedPath)) {
          preferredCandidates.push(nestedPath);
        } else {
          fallbackCandidates.push(nestedPath);
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
