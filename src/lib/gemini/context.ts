import { fetchSourceFile } from '@/lib/wp-source/fetcher';
import { parseReferences } from '@/lib/wp-source/references';
import { getEffectiveSlug, useSourceStore } from '@/stores/source-store';
import type { TranslationContextExcerpt } from '@/lib/translation/types';

const MAX_CONTEXT_FILES = 2;
const EXCERPT_RADIUS = 12;
const MAX_EXCERPT_CHARS = 2400;

function buildExcerpt(content: string, line: number | null): string {
  if (!content.trim()) {
    return '';
  }

  const lines = content.split('\n');
  if (!line || line < 1 || line > lines.length) {
    return content.slice(0, MAX_EXCERPT_CHARS);
  }

  const start = Math.max(0, line - EXCERPT_RADIUS - 1);
  const end = Math.min(lines.length, line + EXCERPT_RADIUS);
  const excerpt = lines
    .slice(start, end)
    .map((entry, index) => `${start + index + 1}: ${entry}`)
    .join('\n');

  return excerpt.slice(0, MAX_EXCERPT_CHARS);
}

export async function resolveGeminiContextExcerpts(
  references: string[] | undefined,
  pluginSlug?: string | null,
): Promise<TranslationContextExcerpt[]> {
  if (!references?.length) {
    return [];
  }

  const sourceState = useSourceStore.getState();
  const effectiveSlug = pluginSlug ?? getEffectiveSlug(sourceState);
  if (!effectiveSlug) {
    return [];
  }

  const uniqueReferences = parseReferences(references)
    .filter((reference) => reference.path.trim().length > 0)
    .filter(
      (reference, index, all) =>
        all.findIndex((item) => item.path === reference.path && item.line === reference.line) ===
        index,
    )
    .slice(0, MAX_CONTEXT_FILES);

  const excerpts = await Promise.all(
    uniqueReferences.map(async (reference) => {
      try {
        const result = await fetchSourceFile(
          effectiveSlug,
          reference.path,
          sourceState.pluginVersion,
        );
        const content = buildExcerpt(result.content, reference.line);
        if (!content) {
          return null;
        }

        return {
          path: reference.path,
          line: reference.line,
          content,
        } satisfies TranslationContextExcerpt;
      } catch {
        return null;
      }
    }),
  );

  return excerpts.filter((excerpt): excerpt is TranslationContextExcerpt => Boolean(excerpt));
}
