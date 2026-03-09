function readTrimmedEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function isCloudBackendConfigured(): boolean {
  return readTrimmedEnv(import.meta.env.VITE_SUPABASE_URL).length > 0;
}

export function getSupabaseFunctionBaseUrl(featureLabel: string): string {
  const supabaseUrl = readTrimmedEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');

  if (!supabaseUrl) {
    throw new Error(`${featureLabel} is unavailable in this deployment.`);
  }

  return `${supabaseUrl}/functions/v1`;
}

export function getSupabaseAnonKey(): string | undefined {
  const anonKey = readTrimmedEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
  return anonKey || undefined;
}
