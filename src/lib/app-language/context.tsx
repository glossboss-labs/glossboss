import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translateAppMessage } from './catalog';
import { getAppLanguage, saveAppLanguage, type AppLanguage } from './settings';
import { TranslationContext } from './translation-context';

type TranslationValues = Record<string, string | number>;

export function TranslationProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: AppLanguage;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(
    () => initialLanguage ?? getAppLanguage(),
  );

  useEffect(() => {
    saveAppLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback(
    (msgid: string, values?: TranslationValues) => translateAppMessage(language, msgid, { values }),
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
