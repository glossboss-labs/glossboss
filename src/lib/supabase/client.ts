import {
  createClient as createSupabaseJsClient,
  type FunctionInvokeOptions,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { msgid } from '@/lib/app-language';

function readTrimmedEnv(value: string | undefined): string {
  return value?.trim() ?? '';
}

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

function getUnavailableMessage(featureLabel: string): string {
  return unavailableMessages[featureLabel] ?? `${featureLabel} is unavailable in this deployment.`;
}

export function getSupabaseUrl(): string | undefined {
  const supabaseUrl = readTrimmedEnv(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
  return supabaseUrl || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  const anonKey = readTrimmedEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
  return anonKey || undefined;
}

export function isCloudBackendConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

let clientInstance: SupabaseClient | null = null;
let clientCacheKey: string | null = null;

export function resetSupabaseClient(): void {
  clientInstance = null;
  clientCacheKey = null;
}

function resolveClientConfig(featureLabel: string): { url: string; anonKey: string } {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(getUnavailableMessage(featureLabel));
  }

  return { url, anonKey };
}

export function createClient(featureLabel: string): SupabaseClient {
  const { url, anonKey } = resolveClientConfig(featureLabel);
  return createSupabaseJsClient(url, anonKey);
}

export function getSupabaseClient(featureLabel: string): SupabaseClient {
  const { url, anonKey } = resolveClientConfig(featureLabel);
  const nextCacheKey = `${url}::${anonKey}`;

  if (!clientInstance || clientCacheKey !== nextCacheKey) {
    clientInstance = createSupabaseJsClient(url, anonKey);
    clientCacheKey = nextCacheKey;
  }

  return clientInstance;
}

export interface InvokeSupabaseFunctionOptions extends FunctionInvokeOptions {
  featureLabel: string;
}

export async function invokeSupabaseFunction<T>(
  functionName: string,
  { featureLabel, ...options }: InvokeSupabaseFunctionOptions,
): Promise<{ data: T | null; error: unknown; response?: Response }> {
  return await getSupabaseClient(featureLabel).functions.invoke<T>(functionName, options);
}

export async function readSupabaseFunctionError(
  response?: Response,
): Promise<Record<string, unknown>> {
  if (!response) {
    return {};
  }

  return (await response
    .clone()
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
}
