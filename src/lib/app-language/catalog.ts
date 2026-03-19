import { parsePOFile, type POEntry, type POFile } from '@/lib/po';
import { loadAppLanguageSource } from './discovery';
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

const catalogs: Partial<Record<AppLanguage, TranslationCatalog>> = {};
const catalogPromises = new Map<AppLanguage, Promise<TranslationCatalog>>();
const fallbackLanguage = DEFAULT_APP_LANGUAGE;

function interpolate(message: string, values?: Record<string, TranslationValue>): string {
  if (!values) return message;

  return message.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (match, doubleKey, singleKey) => {
    const key = doubleKey ?? singleKey;
    return key && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
  });
}

export function msgid(s: string): string {
  return s;
}

export function hasLoadedAppLanguageCatalog(language: AppLanguage): boolean {
  return language === fallbackLanguage || Boolean(catalogs[language]);
}

export async function ensureAppLanguageCatalog(language: AppLanguage): Promise<void> {
  if (language === fallbackLanguage || catalogs[language]) return;

  const existingPromise = catalogPromises.get(language);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const loadPromise = loadAppLanguageSource(language)
    .then(({ filename, rawContent }) => {
      const file = parsePOFile(rawContent, filename);
      const catalog = createCatalog(file, filename);
      catalogs[language] = catalog;
      return catalog;
    })
    .finally(() => {
      catalogPromises.delete(language);
    });

  catalogPromises.set(language, loadPromise);
  await loadPromise;
}

export function translateAppMessage(
  language: AppLanguage,
  msgid: string,
  options?: TranslationOptions,
): string {
  const catalog = language === fallbackLanguage ? undefined : catalogs[language];
  const message = catalog?.[getCatalogKey(msgid, options?.context)] ?? msgid;
  return interpolate(message, options?.values);
}
