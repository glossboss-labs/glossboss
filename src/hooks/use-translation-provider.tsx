/**
 * Translation provider resolution with org → project → user cascade.
 *
 * Resolution order:
 * 1. Org enforcement (if org enforces a provider, it's locked)
 * 2. Per-language override (from project_languages.translation_provider)
 * 3. Org default (from organization_settings.default_translation_provider)
 * 4. User's global default (from localStorage)
 *
 * Components use useTranslationProvider() which returns the resolved provider.
 * useTranslationProviderInfo() returns additional metadata (source, enforced).
 */

/* eslint-disable react-refresh/only-export-components -- context + hooks are co-located by design */

import { createContext, use, useMemo, type ReactNode } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import {
  TRANSLATION_PROVIDER_STORAGE_KEY,
  type TranslationProviderSettings,
} from '@/lib/translation/settings';
import type { TranslationProviderId } from '@/lib/translation/types';

/** Where the active provider setting came from. */
export type ProviderSource = 'org-enforced' | 'language' | 'org-default' | 'personal';

interface TranslationProviderContextValue {
  /** Per-language provider override (from project_languages.translation_provider). */
  languageProvider: TranslationProviderId | null;
  /** Org default provider (from organization_settings.default_translation_provider). */
  orgDefaultProvider: TranslationProviderId | null;
  /** Whether the org enforces its provider choice (no project/user override). */
  orgEnforced: boolean;
}

const TranslationProviderContext = createContext<TranslationProviderContextValue | null>(null);

interface TranslationProviderOverrideProps {
  /** Per-language provider override — null means inherit from org/user default. */
  provider: TranslationProviderId | null;
  /** Org default provider — null means no org default. */
  orgDefaultProvider?: TranslationProviderId | null;
  /** Whether the org enforces the provider (locks it). */
  orgEnforced?: boolean;
  children: ReactNode;
}

/** Wrap editor tree to provide org + language provider overrides. */
export function TranslationProviderOverride({
  provider,
  orgDefaultProvider = null,
  orgEnforced = false,
  children,
}: TranslationProviderOverrideProps) {
  const value = useMemo(
    () => ({
      languageProvider: provider,
      orgDefaultProvider,
      orgEnforced,
    }),
    [provider, orgDefaultProvider, orgEnforced],
  );

  return (
    <TranslationProviderContext.Provider value={value}>
      {children}
    </TranslationProviderContext.Provider>
  );
}

/** Resolved provider info including where it came from. */
export interface TranslationProviderInfo {
  provider: TranslationProviderId;
  source: ProviderSource;
  enforced: boolean;
}

/**
 * Read the active translation provider with full cascade resolution.
 * Returns the provider ID + metadata about where it came from.
 */
export function useTranslationProviderInfo(): TranslationProviderInfo {
  const ctx = use(TranslationProviderContext);
  const [providerState] = useLocalStorage<TranslationProviderSettings>({
    key: TRANSLATION_PROVIDER_STORAGE_KEY,
    defaultValue: { provider: 'deepl', updatedAt: 0 },
  });

  // 1. Org enforcement (locked)
  if (ctx?.orgEnforced && ctx.orgDefaultProvider) {
    return { provider: ctx.orgDefaultProvider, source: 'org-enforced', enforced: true };
  }

  // 2. Per-language override
  if (ctx?.languageProvider) {
    return { provider: ctx.languageProvider, source: 'language', enforced: false };
  }

  // 3. Org default
  if (ctx?.orgDefaultProvider) {
    return { provider: ctx.orgDefaultProvider, source: 'org-default', enforced: false };
  }

  // 4. User's global default
  return { provider: providerState.provider, source: 'personal', enforced: false };
}

/**
 * Read the active translation provider ID (shorthand).
 * For full info including source and enforcement, use useTranslationProviderInfo().
 */
export function useTranslationProvider(): TranslationProviderId {
  return useTranslationProviderInfo().provider;
}
