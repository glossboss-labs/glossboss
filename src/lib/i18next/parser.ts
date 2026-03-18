/**
 * i18next JSON Parser
 *
 * Parses i18next JSON translation files into POEntry[] for the editor.
 * Supports nested keys (flattened with dot notation) and plural forms.
 */

import type { POEntry, POFile, POHeader } from '@/lib/po/types';
import type { I18nextResource } from './types';
import { PLURAL_SUFFIXES } from './types';
import { hashString } from '@/lib/utils/hash';

/**
 * Generate a stable ID for an entry based on its key
 */
function generateEntryId(key: string, index: number): string {
  return `${index}-${hashString(key)}`;
}

/**
 * Flatten a nested i18next resource into dot-separated key-value pairs
 */
function flattenResource(obj: I18nextResource, prefix: string = ''): Array<[string, string]> {
  const result: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result.push([fullKey, value]);
    } else if (typeof value === 'object' && value !== null) {
      result.push(...flattenResource(value, fullKey));
    }
  }

  return result;
}

/**
 * Check if a key has a plural suffix and return the base key + suffix
 */
function parsePluralKey(key: string): { baseKey: string; suffix: string } | null {
  for (const suffix of PLURAL_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return { baseKey: key.slice(0, -suffix.length), suffix };
    }
  }
  return null;
}

/**
 * Group flat entries by plural base key
 */
function groupPlurals(
  flat: Array<[string, string]>,
): Array<{ key: string; value: string; plurals?: Map<string, string> }> {
  const pluralGroups = new Map<string, Map<string, string>>();
  const singular = new Map<string, string>();
  const keyOrder: string[] = [];

  for (const [key, value] of flat) {
    const plural = parsePluralKey(key);

    if (plural) {
      let group = pluralGroups.get(plural.baseKey);
      if (!group) {
        group = new Map();
        pluralGroups.set(plural.baseKey, group);
        if (!keyOrder.includes(plural.baseKey)) {
          keyOrder.push(plural.baseKey);
        }
      }
      group.set(plural.suffix, value);
    } else {
      singular.set(key, value);
      if (!keyOrder.includes(key)) {
        keyOrder.push(key);
      }
    }
  }

  const result: Array<{ key: string; value: string; plurals?: Map<string, string> }> = [];

  for (const key of keyOrder) {
    const pluralGroup = pluralGroups.get(key);
    if (pluralGroup) {
      // Use _one as singular form, _other as plural
      const singularValue = pluralGroup.get('_one') ?? pluralGroup.get('_other') ?? '';
      result.push({ key, value: singularValue, plurals: pluralGroup });
    } else {
      const value = singular.get(key);
      if (value !== undefined) {
        result.push({ key, value });
      }
    }
  }

  return result;
}

/**
 * Detect if content is valid i18next JSON
 */
export function isI18nextContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Parse an i18next JSON string into a POFile structure
 *
 * Keys become msgid, values become msgstr.
 * Nested keys are flattened with dots.
 * Plural suffixes (_one, _other, etc.) are grouped into plural entries.
 */
export function parseI18nextJSON(content: string, filename: string): POFile {
  const resource: I18nextResource = JSON.parse(content);
  const flat = flattenResource(resource);
  const grouped = groupPlurals(flat);

  const entries: POEntry[] = grouped.map((item, index) => {
    const entry: POEntry = {
      id: generateEntryId(item.key, index),
      msgid: item.key,
      msgstr: item.value,
      translatorComments: [],
      extractedComments: [],
      references: [],
      flags: [],
    };

    if (item.plurals) {
      // Map plural forms: _one → singular, _other → plural
      const one = item.plurals.get('_one') ?? '';
      const other = item.plurals.get('_other') ?? '';
      entry.msgidPlural = `${item.key}_other`;
      entry.msgstr = one;
      entry.msgstrPlural = [one, other];

      // Include additional plural forms if present
      const extra: string[] = [];
      for (const suffix of ['_zero', '_two', '_few', '_many'] as const) {
        const val = item.plurals.get(suffix);
        if (val !== undefined) {
          extra.push(val);
        }
      }
      if (extra.length > 0) {
        entry.msgstrPlural = [one, other, ...extra];
      }
    }

    return entry;
  });

  const header: POHeader = {
    language: '',
    contentType: 'application/json; charset=UTF-8',
  };

  return {
    filename,
    header,
    entries,
    charset: 'UTF-8',
  };
}
