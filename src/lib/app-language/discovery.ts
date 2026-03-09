import { parsePOFile } from '@/lib/po';
import type { POFile } from '@/lib/po';

export interface AppLanguageDefinition {
  value: string;
  label: string;
  filename: string;
  file: POFile;
}

const localeModules = import.meta.glob('./locales/app.*.po', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

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

  for (const [path, rawContent] of Object.entries(localeModules)) {
    const filename = path.split('/').pop() ?? path;

    try {
      const file = parsePOFile(rawContent, filename);
      const value =
        normalizeDiscoveredLanguage(file.header.language) ?? extractLanguageFromFilename(filename);

      if (!value) {
        console.error(
          `[App Language] Could not determine language for ${filename}. Add "Language: <code>" to the PO file header or use the app.[code].po naming pattern.`,
        );
        continue;
      }

      discovered.set(value, {
        value,
        label: getLanguageLabel(value),
        filename,
        file,
      });
    } catch (error) {
      console.error(
        `[App Language] Failed to discover ${filename}. Check that the PO file is valid and can be parsed:`,
        error,
      );
    }
  }

  return Array.from(discovered.values()).sort(compareDefinitions);
}

export const DISCOVERED_APP_LANGUAGES = discoverAppLanguages();

if (DISCOVERED_APP_LANGUAGES.length === 0) {
  throw new Error(
    '[App Language] No app locale files were discovered. Add at least one valid src/lib/app-language/locales/app.[code].po file.',
  );
}
