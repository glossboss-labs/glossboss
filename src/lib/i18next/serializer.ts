/**
 * i18next JSON Serializer
 *
 * Converts POEntry[] to i18next JSON format.
 * Supports nested keys and plural forms.
 */

import type { POEntry } from '@/lib/po/types';
import type { I18nextResource, I18nextSerializeOptions } from './types';

/**
 * Set a value in a nested object using a dot-separated key path
 */
function setNestedValue(obj: I18nextResource, key: string, value: string): void {
  const parts = key.split('.');
  let current: I18nextResource = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as I18nextResource;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Derive the i18next key from a PO entry
 *
 * Uses msgctxt as key if available (common pattern when PO was generated from i18next),
 * otherwise uses msgid.
 */
function getI18nextKey(entry: POEntry): string {
  return entry.msgctxt ?? entry.msgid;
}

/**
 * Serialize PO entries to i18next JSON format
 *
 * @param entries - PO translation entries
 * @param options - Serialization options
 * @returns JSON string in i18next format
 */
export function serializeToI18next(
  entries: POEntry[],
  options: I18nextSerializeOptions = {},
): string {
  const { nested = true, indent = 2, skipUntranslated = false } = options;
  const resource: I18nextResource = {};

  for (const entry of entries) {
    // Skip empty msgid (header entry)
    if (!entry.msgid && !entry.msgctxt) continue;

    // Skip untranslated if requested
    if (skipUntranslated && !entry.msgstr.trim()) continue;

    const key = getI18nextKey(entry);

    if (entry.msgidPlural && entry.msgstrPlural && entry.msgstrPlural.length > 0) {
      // Plural entry
      const [one, other, ...rest] = entry.msgstrPlural;
      const suffixes = ['_one', '_other', '_zero', '_two', '_few', '_many'];
      const values: Array<[string, string]> = [];

      if (one !== undefined) values.push([`${key}_one`, one]);
      if (other !== undefined) values.push([`${key}_other`, other]);
      rest.forEach((val, i) => {
        if (val !== undefined && suffixes[i + 2]) {
          values.push([`${key}${suffixes[i + 2]}`, val]);
        }
      });

      for (const [pluralKey, value] of values) {
        if (nested) {
          setNestedValue(resource, pluralKey, value);
        } else {
          resource[pluralKey] = value;
        }
      }
    } else {
      // Singular entry
      if (nested) {
        setNestedValue(resource, key, entry.msgstr);
      } else {
        resource[key] = entry.msgstr;
      }
    }
  }

  return JSON.stringify(resource, null, indent) + '\n';
}
