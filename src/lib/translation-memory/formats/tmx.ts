import type { TranslationMemoryEntry, TranslationMemoryScope } from '../types';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function readProp(props: Map<string, string>, key: string): string | undefined {
  const value = props.get(key);
  return value ? decodeXml(value) : undefined;
}

export function serializeTranslationMemoryToTmx(
  scope: TranslationMemoryScope,
  entries: TranslationMemoryEntry[],
): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  const body = entries
    .map((entry) => {
      const props = [
        `<prop type="x-glossboss-project">${escapeXml(scope.projectName)}</prop>`,
        `<prop type="x-glossboss-target-language">${escapeXml(scope.targetLanguage)}</prop>`,
        entry.sourceLanguage
          ? `<prop type="x-glossboss-source-language">${escapeXml(entry.sourceLanguage)}</prop>`
          : '',
        entry.context ? `<prop type="x-glossboss-context">${escapeXml(entry.context)}</prop>` : '',
        entry.sourceTextPlural
          ? `<prop type="x-glossboss-msgid-plural">${escapeXml(entry.sourceTextPlural)}</prop>`
          : '',
        entry.targetTextPlural?.length
          ? `<prop type="x-glossboss-msgstr-plural">${escapeXml(
              JSON.stringify(entry.targetTextPlural),
            )}</prop>`
          : '',
        `<prop type="x-glossboss-approved-at">${escapeXml(entry.approvedAt)}</prop>`,
        `<prop type="x-glossboss-updated-at">${escapeXml(entry.updatedAt)}</prop>`,
      ]
        .filter(Boolean)
        .join('');

      return `<tu tuid="${escapeXml(entry.id)}" creationtool="GlossBoss" changedate="${now}">${props}<tuv xml:lang="${escapeXml(
        entry.sourceLanguage ?? 'und',
      )}"><seg>${escapeXml(entry.sourceText)}</seg></tuv><tuv xml:lang="${escapeXml(
        scope.targetLanguage,
      )}"><seg>${escapeXml(entry.targetText)}</seg></tuv></tu>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><tmx version="1.4"><header creationtool="GlossBoss" creationtoolversion="1.2.0" segtype="sentence" adminlang="en" srclang="${escapeXml(
    scope.sourceLanguage ?? 'und',
  )}" datatype="PlainText" /><body>${body}</body></tmx>`;
}

export function parseTranslationMemoryTmx(content: string): {
  scope: TranslationMemoryScope;
  entries: TranslationMemoryEntry[];
} {
  const tuMatches = content.match(/<tu\b[\s\S]*?<\/tu>/g) ?? [];
  if (tuMatches.length === 0) {
    throw new Error('Invalid TMX file.');
  }

  const entries: TranslationMemoryEntry[] = [];
  let scope: TranslationMemoryScope | null = null;

  for (const tu of tuMatches) {
    const id = tu.match(/tuid="([^"]+)"/)?.[1] ?? crypto.randomUUID();
    const props = new Map<string, string>();
    const propMatches = tu.matchAll(/<prop type="([^"]+)">([\s\S]*?)<\/prop>/g);
    for (const match of propMatches) {
      props.set(match[1]!, match[2]!);
    }

    const tuvMatches = Array.from(
      tu.matchAll(/<tuv xml:lang="([^"]+)"><seg>([\s\S]*?)<\/seg><\/tuv>/g),
    );
    if (tuvMatches.length < 2) continue;

    const sourceLang = decodeXml(tuvMatches[0]![1]!);
    const sourceText = decodeXml(tuvMatches[0]![2]!);
    const targetLanguage = decodeXml(
      readProp(props, 'x-glossboss-target-language') ?? tuvMatches[1]![1]! ?? 'und',
    );
    const targetText = decodeXml(tuvMatches[1]![2]!);
    const projectName = readProp(props, 'x-glossboss-project') ?? 'Imported TMX';

    scope ??= {
      projectName,
      targetLanguage,
      sourceLanguage: readProp(props, 'x-glossboss-source-language') ?? sourceLang,
    };

    entries.push({
      id: decodeXml(id),
      projectName,
      targetLanguage,
      sourceLanguage: readProp(props, 'x-glossboss-source-language') ?? sourceLang,
      sourceText,
      sourceTextPlural: readProp(props, 'x-glossboss-msgid-plural'),
      targetText,
      targetTextPlural: (() => {
        const serialized = readProp(props, 'x-glossboss-msgstr-plural');
        if (!serialized) return undefined;
        try {
          return JSON.parse(serialized) as string[];
        } catch {
          return undefined;
        }
      })(),
      context: readProp(props, 'x-glossboss-context'),
      approvedAt: readProp(props, 'x-glossboss-approved-at') ?? new Date().toISOString(),
      updatedAt: readProp(props, 'x-glossboss-updated-at') ?? new Date().toISOString(),
      usageCount: 1,
    });
  }

  if (!scope) {
    throw new Error('Invalid TMX file.');
  }

  return { scope, entries };
}
