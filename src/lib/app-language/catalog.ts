import type { POEntry, POFile } from '@/lib/po';
import { DISCOVERED_APP_LANGUAGES } from './discovery';
import { DEFAULT_APP_LANGUAGE, type AppLanguage } from './settings';

type TranslationValue = string | number;

interface TranslationOptions {
  values?: Record<string, TranslationValue>;
  context?: string;
}

type TranslationCatalog = Record<string, string>;

function getCatalogKey(msgid: string, context?: string): string {
  return context ? `${context}\u0004${msgid}` : msgid;
}

function getEntryKey(entry: POEntry): string {
  return getCatalogKey(entry.msgid, entry.msgctxt);
}

function createCatalog(file: POFile, filename: string): TranslationCatalog {
  try {
    return file.entries.reduce<TranslationCatalog>((catalog, entry) => {
      const translated = entry.msgstr.trim() || entry.msgid;
      catalog[getEntryKey(entry)] = translated;
      return catalog;
    }, {});
  } catch (error) {
    console.error(`[App Language] Failed to parse ${filename}:`, error);
    return {};
  }
}

const catalogs = DISCOVERED_APP_LANGUAGES.reduce<Record<AppLanguage, TranslationCatalog>>(
  (allCatalogs, language) => {
    allCatalogs[language.value] = createCatalog(language.file, language.filename);
    return allCatalogs;
  },
  {},
);

const fallbackLanguage = DEFAULT_APP_LANGUAGE;

function interpolate(message: string, values?: Record<string, TranslationValue>): string {
  if (!values) return message;

  // Support both {{key}} (preferred) and {key} (legacy) interpolation in a
  // single pass so that replaced values are never re-interpreted as templates.
  return message.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (match, doubleKey, singleKey) => {
    const key = doubleKey ?? singleKey;
    return key && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
  });
}

/**
 * Identity function that marks a string for i18n extraction.
 * Use this for strings defined at module scope (outside React components)
 * that will later be passed to `t()` at render time.
 */
export function msgid(s: string): string {
  return s;
}

export function translateAppMessage(
  language: AppLanguage,
  msgid: string,
  options?: TranslationOptions,
): string {
  const catalog = catalogs[language] ?? catalogs[fallbackLanguage];
  const message = catalog?.[getCatalogKey(msgid, options?.context)] ?? msgid;
  return interpolate(message, options?.values);
}
