import { msgid } from '@/lib/app-language';
import type { WordPressPluginTranslationTrack, WordPressProjectType } from './references';

export interface WordPressProjectInfo {
  type: WordPressProjectType;
  slug: string;
  name: string;
  latestVersion: string | null;
  supportsDevelopmentTrack: boolean;
}

export interface FetchWordPressTranslationFileOptions {
  projectType: WordPressProjectType;
  slug: string;
  locale: string;
  track?: WordPressPluginTranslationTrack;
}

function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));

  const parsedA = parse(a);
  const parsedB = parse(b);
  const length = Math.max(parsedA.length, parsedB.length);

  for (let index = 0; index < length; index += 1) {
    const left = parsedA[index] ?? 0;
    const right = parsedB[index] ?? 0;

    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return left - right;
      continue;
    }

    const leftString = String(left);
    const rightString = String(right);
    if (leftString !== rightString) {
      return leftString < rightString ? -1 : 1;
    }
  }

  return 0;
}

function normalizeLocale(locale: string): string {
  return locale.trim().replaceAll('_', '-').toLowerCase();
}

function buildProjectInfoUrl(projectType: WordPressProjectType, slug: string): string {
  const url = new URL(
    projectType === 'theme'
      ? 'https://api.wordpress.org/themes/info/1.2/'
      : 'https://api.wordpress.org/plugins/info/1.2/',
  );

  if (projectType === 'theme') {
    url.searchParams.set('action', 'theme_information');
    url.searchParams.set('request[slug]', slug);
  } else {
    url.searchParams.set('action', 'plugin_information');
    url.searchParams.set('slug', slug);
  }

  return url.toString();
}

export async function fetchWordPressProjectInfo(
  projectType: WordPressProjectType,
  slug: string,
): Promise<WordPressProjectInfo | null> {
  try {
    const response = await fetch(buildProjectInfoUrl(projectType, slug));
    if (!response.ok) return null;

    const data = await response.json();
    if (data?.error || typeof data?.name !== 'string') {
      return null;
    }

    return {
      type: projectType,
      slug,
      name: data.name as string,
      latestVersion: typeof data.version === 'string' ? data.version : null,
      supportsDevelopmentTrack: projectType === 'plugin',
    };
  } catch {
    return null;
  }
}

export async function validateWordPressProjectSlug(
  projectType: WordPressProjectType,
  slug: string,
): Promise<boolean> {
  const info = await fetchWordPressProjectInfo(projectType, slug);
  return Boolean(info);
}

export function buildWordPressTranslationExportUrl({
  projectType,
  slug,
  locale,
  track = 'stable',
}: FetchWordPressTranslationFileOptions): string {
  const normalizedLocale = normalizeLocale(locale);
  if (projectType === 'theme') {
    return `https://translate.wordpress.org/projects/wp-themes/${slug}/${normalizedLocale}/default/export-translations/?format=po`;
  }

  return `https://translate.wordpress.org/projects/wp-plugins/${slug}/${track}/${normalizedLocale}/default/export-translations/?format=po`;
}

export async function fetchWordPressTranslationFile(
  options: FetchWordPressTranslationFileOptions,
): Promise<string> {
  const response = await fetch(buildWordPressTranslationExportUrl(options));
  if (!response.ok) {
    throw new Error(
      msgid('WordPress.org did not return a translation export for the selected project.'),
    );
  }

  return await response.text();
}

export function sortWordPressReleases(releases: string[]): string[] {
  return [...releases]
    .filter((release) => /^[\d]/.test(release))
    .sort((left, right) => compareVersions(right, left));
}
