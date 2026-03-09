import { createContext } from 'react';
import { translateAppMessage } from './catalog';
import type { AppLanguage } from './settings';

type TranslationValues = Record<string, string | number>;

export interface TranslationContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (msgid: string, values?: TranslationValues) => string;
}

export const TranslationContext = createContext<TranslationContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (msgid, values) => translateAppMessage('en', msgid, { values }),
});
