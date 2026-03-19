export interface AppLanguageDefinition {
  value: string;
  label: string;
  filename: string;
}

const localeModules = import.meta.glob('./locales/app.*.po', {
  import: 'default',
  query: '?raw',
}) as Record<string, () => Promise<string>>;

function normalizeDiscoveredLanguage(value?: string | null): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.split('-')[0] || null;
}

function extractLanguageFromFilename(filename: string): string | null {
  const match = filename.match(/^app\.([^.]+)\.po$/i);
  return normalizeDiscoveredLanguage(match?.[1] ?? null);
}

function getLanguageLabel(language: string): string {
  try {
    const label = new Intl.DisplayNames([language], { type: 'language' }).of(language);
    return label ?? language;
  } catch {
    return language;
  }
}

function compareDefinitions(a: AppLanguageDefinition, b: AppLanguageDefinition): number {
  if (a.value === 'en' && b.value !== 'en') return -1;
  if (b.value === 'en' && a.value !== 'en') return 1;
  return a.label.localeCompare(b.label);
}

function discoverAppLanguages(): AppLanguageDefinition[] {
  const discovered = new Map<string, AppLanguageDefinition>();

  for (const path of Object.keys(localeModules)) {
    const filename = path.split('/').pop() ?? path;
    const value = extractLanguageFromFilename(filename);

    if (!value) {
      console.error(
        `[App Language] Could not determine language for ${filename}. Use the app.[code].po naming pattern.`,
      );
      continue;
    }

    discovered.set(value, {
      value,
      label: getLanguageLabel(value),
      filename,
    });
  }

  return Array.from(discovered.values()).sort(compareDefinitions);
}

export const DISCOVERED_APP_LANGUAGES = discoverAppLanguages();

export function loadAppLanguageSource(
  language: string,
): Promise<{ filename: string; rawContent: string }> {
  const definition = DISCOVERED_APP_LANGUAGES.find((item) => item.value === language);
  if (!definition) {
    return Promise.reject(new Error(`[App Language] Unsupported app locale "${language}".`));
  }

  const matchingPath = Object.keys(localeModules).find((path) =>
    path.endsWith(definition.filename),
  );
  if (!matchingPath) {
    return Promise.reject(
      new Error(`[App Language] Could not find locale source for ${definition.filename}.`),
    );
  }

  return localeModules[matchingPath]().then((rawContent) => ({
    filename: definition.filename,
    rawContent,
  }));
}

if (DISCOVERED_APP_LANGUAGES.length === 0) {
  throw new Error(
    '[App Language] No app locale files were discovered. Add at least one valid src/lib/app-language/locales/app.[code].po file.',
  );
}
