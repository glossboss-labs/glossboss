export type WordPressProjectType = 'plugin' | 'theme';
export type WordPressPluginTranslationTrack = 'stable' | 'dev';

export interface WordPressProjectLocale {
  locale: string;
  label: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#0*38;|&amp;/gi, '&')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#0*34;|&quot;/gi, '"')
    .replace(/&#0*60;|&lt;/gi, '<')
    .replace(/&#0*62;|&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeWhitespace(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseProjectLocalesFromHtml(
  html: string,
  projectType: WordPressProjectType,
  slug: string,
  track: WordPressPluginTranslationTrack = 'stable',
): WordPressProjectLocale[] {
  const results = new Map<string, string>();
  const escapedSlug = escapeRegExp(slug);
  const regex =
    projectType === 'plugin'
      ? new RegExp(
          `<strong><a href="/projects/wp-plugins/${escapedSlug}/${track}/([^/]+)/default/">([\\s\\S]*?)</a></strong>`,
          'gi',
        )
      : new RegExp(
          `<th[^>]*>\\s*<a href="/locale/([^/]+)/default/wp-themes/${escapedSlug}/">([\\s\\S]*?)</a>\\s*</th>`,
          'gi',
        );

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const locale = match[1]?.trim().toLowerCase();
    const label = normalizeWhitespace(match[2] ?? '');
    if (!locale || !label || results.has(locale)) continue;
    results.set(locale, label);
  }

  return Array.from(results.entries()).map(([locale, label]) => ({ locale, label }));
}

export function buildWordPressTranslationExportUrl(
  projectType: WordPressProjectType,
  slug: string,
  locale: string,
  track: WordPressPluginTranslationTrack = 'stable',
): string {
  const normalizedLocale = locale.trim().replaceAll('_', '-').toLowerCase();
  if (projectType === 'theme') {
    return `https://translate.wordpress.org/projects/wp-themes/${slug}/${normalizedLocale}/default/export-translations/?format=po`;
  }

  return `https://translate.wordpress.org/projects/wp-plugins/${slug}/${track}/${normalizedLocale}/default/export-translations/?format=po`;
}
