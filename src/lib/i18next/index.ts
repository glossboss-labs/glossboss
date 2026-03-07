/**
 * i18next JSON Library
 *
 * Utilities for parsing and serializing i18next JSON translation files.
 */

// Types
export type { I18nextResource, I18nextSerializeOptions, PluralSuffix } from './types';
export { PLURAL_SUFFIXES } from './types';

// Parser
export { parseI18nextJSON, isI18nextContent } from './parser';

// Serializer
export { serializeToI18next } from './serializer';
