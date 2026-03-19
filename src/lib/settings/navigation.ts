import type { TranslationProviderId } from '@/lib/translation/types';

interface TranslationSettingsLinkOptions {
  provider?: TranslationProviderId | null;
  returnTo?: string | null;
}

export function buildTranslationSettingsHref(options: TranslationSettingsLinkOptions = {}): string {
  const params = new URLSearchParams();
  params.set('tab', 'translation');

  if (options.provider) {
    params.set('provider', options.provider);
  }

  if (options.returnTo) {
    params.set('returnTo', options.returnTo);
  }

  return `/settings?${params.toString()}`;
}
