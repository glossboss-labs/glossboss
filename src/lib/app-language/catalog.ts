import { parsePOFile } from '@/lib/po';
import type { POEntry } from '@/lib/po';
import enRaw from './locales/app.en.po?raw';
import nlRaw from './locales/app.nl.po?raw';
import type { AppLanguage } from './settings';

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

function createCatalog(rawContent: string, filename: string): TranslationCatalog {
  try {
    const file = parsePOFile(rawContent, filename);

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

const catalogs: Record<AppLanguage, TranslationCatalog> = {
  en: createCatalog(enRaw, 'app.en.po'),
  nl: createCatalog(nlRaw, 'app.nl.po'),
};

function interpolate(message: string, values?: Record<string, TranslationValue>): string {
  if (!values) return message;

  return message.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{${key}}`,
  );
}

export function translateAppMessage(
  language: AppLanguage,
  msgid: string,
  options?: TranslationOptions,
): string {
  const catalog = catalogs[language] ?? catalogs.en;
  const message = catalog[getCatalogKey(msgid, options?.context)] ?? msgid;
  return interpolate(message, options?.values);
}
