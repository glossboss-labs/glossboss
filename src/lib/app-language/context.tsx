import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ensureAppLanguageCatalog,
  hasLoadedAppLanguageCatalog,
  translateAppMessage,
} from './catalog';
import {
  DEFAULT_APP_LANGUAGE,
  getAppLanguage,
  saveAppLanguage,
  type AppLanguage,
} from './settings';
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
  const [catalogVersion, setCatalogVersion] = useState(0);

  useEffect(() => {
    saveAppLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (hasLoadedAppLanguageCatalog(language)) return;

    let cancelled = false;
    void ensureAppLanguageCatalog(language).then(() => {
      if (!cancelled) {
        setCatalogVersion((value) => value + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  const activeLanguage = hasLoadedAppLanguageCatalog(language) ? language : DEFAULT_APP_LANGUAGE;

  const t = useCallback(
    (msgid: string, values?: TranslationValues) =>
      translateAppMessage(activeLanguage, msgid, { values }),
    [activeLanguage, catalogVersion],
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
