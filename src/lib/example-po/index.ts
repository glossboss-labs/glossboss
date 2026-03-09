import type { TargetLanguage } from '@/lib/deepl/types';

export const EXAMPLE_PO_PLUGIN_SLUG = 'hello-dolly';
export const EXAMPLE_PO_FALLBACK_FILENAME = 'hello-dolly-nl_NL.po';
export const EXAMPLE_PO_CONTENT = `
msgid ""
msgstr ""
"Project-Id-Version: Hello Dolly 1.7.2\\n"
"Report-Msgid-Bugs-To: https://wordpress.org/support/plugin/hello-dolly/\\n"
"POT-Creation-Date: 2025-01-01 00:00+0000\\n"
"PO-Revision-Date: 2025-01-01 00:00+0000\\n"
"Last-Translator: GlossBoss Example\\n"
"Language-Team: Dutch\\n"
"Language: nl_NL\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"X-Domain: hello-dolly\\n"

#: hello.php:18
msgid "Hello Dolly"
msgstr "Hello Dolly"

#: hello.php:47
msgid "This is not just a plugin, it symbolizes the hope and enthusiasm of an entire generation summed up in two words sung most famously by Louis Armstrong."
msgstr "Dit is niet zomaar een plugin; het symboliseert de hoop en het enthousiasme van een hele generatie, samengevat in twee woorden die vooral bekend werden door Louis Armstrong."

#: hello.php:84
msgid "Donate"
msgstr "Doneren"
`.trim();

const EXAMPLE_FETCH_TIMEOUT_MS = 8000;
const EXAMPLE_PO_CACHE = new Map<string, ExamplePoAsset>();
const DEFAULT_EXAMPLE_NAVIGATOR = typeof navigator !== 'undefined' ? navigator : undefined;
const EXAMPLE_TIMEOUT_HOST = typeof window !== 'undefined' ? window : globalThis;
const EXAMPLE_TARGET_LANGUAGE_CANDIDATES = [
  'BG',
  'CS',
  'DA',
  'DE',
  'EL',
  'EN-GB',
  'EN-US',
  'ES',
  'ET',
  'FI',
  'FR',
  'HU',
  'ID',
  'IT',
  'JA',
  'KO',
  'LT',
  'LV',
  'NB',
  'NL',
  'PL',
  'PT-BR',
  'PT-PT',
  'RO',
  'RU',
  'SK',
  'SL',
  'SV',
  'TR',
  'UK',
  'ZH',
] as const satisfies readonly TargetLanguage[];
const TARGET_LANGUAGE_TO_PO_LANGUAGE: Partial<Record<TargetLanguage, string>> = {
  DE: 'de_DE',
  'EN-GB': 'en_GB',
  'EN-US': 'en_US',
  NL: 'nl_NL',
  'PT-BR': 'pt_BR',
  'PT-PT': 'pt_PT',
};

export interface ExamplePoAsset {
  content: string;
  filename: string;
}

/**
 * Testing utility: clear the in-memory example PO cache.
 */
export function clearExamplePoCacheForTests(): void {
  EXAMPLE_PO_CACHE.clear();
}

export function getBundledExamplePo(): ExamplePoAsset {
  return {
    content: EXAMPLE_PO_CONTENT,
    filename: EXAMPLE_PO_FALLBACK_FILENAME,
  };
}

export function getDeviceExampleTargetLanguage(
  navigatorLike: Pick<Navigator, 'language' | 'languages'> | undefined = DEFAULT_EXAMPLE_NAVIGATOR,
): TargetLanguage | null {
  if (!navigatorLike) {
    return null;
  }

  const locales = [...(navigatorLike.languages ?? []), navigatorLike.language].filter(
    (locale): locale is string => Boolean(locale),
  );

  for (const locale of locales) {
    const normalizedLocale = locale.trim().replaceAll('_', '-').toUpperCase();

    if (!normalizedLocale) {
      continue;
    }

    if (normalizedLocale === 'EN-GB') {
      return 'EN-GB';
    }

    if (normalizedLocale === 'EN' || normalizedLocale.startsWith('EN-')) {
      return 'EN-US';
    }

    if (normalizedLocale === 'PT-BR') {
      return 'PT-BR';
    }

    if (normalizedLocale === 'PT' || normalizedLocale === 'PT-PT') {
      return 'PT-PT';
    }

    const directMatch = EXAMPLE_TARGET_LANGUAGE_CANDIDATES.find(
      (value) => value === normalizedLocale,
    );
    if (directMatch) {
      return directMatch;
    }

    const baseLocale = normalizedLocale.split('-')[0];
    const baseMatch = EXAMPLE_TARGET_LANGUAGE_CANDIDATES.find((value) => value === baseLocale);
    if (baseMatch) {
      return baseMatch;
    }
  }

  return null;
}

export function buildExamplePoWordPressUrls(targetLanguage: TargetLanguage | null): string[] {
  const localeCandidates = targetLanguage
    ? (() => {
        const locales = new Set<string>();

        switch (targetLanguage) {
          case 'EN-GB':
            locales.add('en-gb');
            locales.add('en');
            break;
          case 'EN-US':
            locales.add('en-us');
            locales.add('en');
            break;
          case 'PT-BR':
            locales.add('pt-br');
            locales.add('pt');
            break;
          case 'PT-PT':
            locales.add('pt');
            break;
          default:
            locales.add(targetLanguage.toLowerCase());
            locales.add(targetLanguage.split('-')[0].toLowerCase());
            break;
        }

        return [...locales];
      })()
    : ['nl'];

  return localeCandidates.flatMap((locale) =>
    ['stable', 'dev'].map(
      (branch) =>
        `https://translate.wordpress.org/projects/wp-plugins/${EXAMPLE_PO_PLUGIN_SLUG}/${branch}/${locale}/default/export-translations/?format=po`,
    ),
  );
}

export function isValidHelloDollyPo(text: string): boolean {
  return text.includes('msgid ""') && text.includes('"Project-Id-Version: Hello Dolly');
}

export function buildExamplePoFilename(
  languageHeader?: string | null,
  targetLanguage?: TargetLanguage | null,
): string {
  const normalizedLanguage =
    normalizePoLanguage(languageHeader) ?? mapTargetLanguageToPoLanguage(targetLanguage);

  return normalizedLanguage
    ? `${EXAMPLE_PO_PLUGIN_SLUG}-${normalizedLanguage}.po`
    : EXAMPLE_PO_FALLBACK_FILENAME;
}

export async function fetchExamplePoFromWordPress(
  targetLanguage: TargetLanguage | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ExamplePoAsset | null> {
  const cacheKey = targetLanguage ?? 'nl';
  const cachedExample = EXAMPLE_PO_CACHE.get(cacheKey);
  if (cachedExample) {
    return cachedExample;
  }

  for (const url of buildExamplePoWordPressUrls(targetLanguage)) {
    const controller = new AbortController();
    const timeoutId = EXAMPLE_TIMEOUT_HOST.setTimeout(
      () => controller.abort(),
      EXAMPLE_FETCH_TIMEOUT_MS,
    );

    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      const text = await response.text();

      if (isValidHelloDollyPo(text)) {
        const example = {
          content: text,
          filename: buildExamplePoFilename(extractPoLanguageHeader(text), targetLanguage),
        };
        EXAMPLE_PO_CACHE.set(cacheKey, example);
        return example;
      }
    } catch {
      // Fall through to the next candidate URL and eventually use the bundled example.
    } finally {
      EXAMPLE_TIMEOUT_HOST.clearTimeout(timeoutId);
    }
  }

  return null;
}

function extractPoLanguageHeader(content: string): string | null {
  const match = content.match(/"Language:\s*([^"\\]+)\\n"/);
  return match?.[1]?.trim() || null;
}

function normalizePoLanguage(languageHeader?: string | null): string | null {
  if (!languageHeader) {
    return null;
  }

  const normalized = languageHeader.trim().replaceAll('-', '_');
  // Accept plain PO locales like `ja` plus language-country variants such as `de_DE`, `pt_BR`, or `zh_CN`.
  return /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(normalized) ? normalized : null;
}

function mapTargetLanguageToPoLanguage(targetLanguage?: TargetLanguage | null): string | null {
  if (!targetLanguage) {
    return null;
  }

  return TARGET_LANGUAGE_TO_PO_LANGUAGE[targetLanguage] ?? null;
}
