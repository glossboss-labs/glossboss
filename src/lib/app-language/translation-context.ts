import { createContext } from 'react';
import { translateAppMessage } from './catalog';
import { DEFAULT_APP_LANGUAGE, type AppLanguage } from './settings';

type TranslationValues = Record<string, string | number>;

export interface TranslationContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (msgid: string, values?: TranslationValues) => string;
}

export const TranslationContext = createContext<TranslationContextValue>({
  language: DEFAULT_APP_LANGUAGE,
  setLanguage: () => undefined,
  t: (msgid, values) => translateAppMessage(DEFAULT_APP_LANGUAGE, msgid, { values }),
});
