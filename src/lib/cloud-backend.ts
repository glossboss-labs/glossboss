import { msgid } from '@/lib/app-language';

function readTrimmedEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function isCloudBackendConfigured(): boolean {
  return readTrimmedEnv(import.meta.env.VITE_SUPABASE_URL).length > 0;
}

/**
 * Pre-marked error messages so i18n extraction picks them up.
 * At runtime the thrown string is passed through `t()` in UI catch handlers.
 */
const unavailableMessages: Record<string, string> = {
  Feedback: msgid('Feedback is unavailable in this deployment.'),
  Speech: msgid('Speech is unavailable in this deployment.'),
  Translation: msgid('Translation is unavailable in this deployment.'),
  'WordPress glossary loading': msgid(
    'WordPress glossary loading is unavailable in this deployment.',
  ),
  'WordPress source browsing': msgid(
    'WordPress source browsing is unavailable in this deployment.',
  ),
};

export function getSupabaseFunctionBaseUrl(featureLabel: string): string {
  const supabaseUrl = readTrimmedEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');

  if (!supabaseUrl) {
    throw new Error(
      unavailableMessages[featureLabel] ?? `${featureLabel} is unavailable in this deployment.`,
    );
  }

  return `${supabaseUrl}/functions/v1`;
}

export function getSupabaseAnonKey(): string | undefined {
  const anonKey = readTrimmedEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
  return anonKey || undefined;
}
