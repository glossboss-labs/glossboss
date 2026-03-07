/**
 * i18next JSON Types
 *
 * Represents the structure of i18next JSON translation files.
 */

/** i18next JSON value: string or nested object */
export type I18nextValue = string | I18nextResource;

/** i18next resource object (possibly nested) */
export interface I18nextResource {
  [key: string]: I18nextValue;
}

/** i18next plural suffixes (CLDR-based, used in i18next v4+) */
export const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'] as const;

export type PluralSuffix = (typeof PLURAL_SUFFIXES)[number];

/** Options for serializing to i18next JSON */
export interface I18nextSerializeOptions {
  /** Use nested keys (dot-separated keys become nested objects). Default: true */
  nested?: boolean;
  /** Pretty-print with indentation. Default: 2 */
  indent?: number;
  /** Only include translated entries. Default: false */
  skipUntranslated?: boolean;
}
