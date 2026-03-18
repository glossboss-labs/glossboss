/**
 * Fetches available models from a provider's API via the list-models edge function.
 *
 * Results are cached per provider+key combo for the session to avoid repeated calls.
 */

import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import type { LlmProviderId } from '@/lib/translation/types';

export interface RemoteModel {
  id: string;
  name: string;
}

interface ListModelsResponse {
  ok: boolean;
  models?: RemoteModel[];
  message?: string;
}

// Session-level cache keyed by "provider::keyHash"
const cache = new Map<string, RemoteModel[]>();

function cacheKey(provider: string, apiKey: string): string {
  return `${provider}::${apiKey.slice(-8)}`;
}

export async function fetchProviderModels(
  provider: LlmProviderId | 'custom',
  apiKey: string,
  baseURL?: string,
): Promise<RemoteModel[]> {
  if (!apiKey.trim()) return [];

  const key = cacheKey(provider, apiKey);
  const cached = cache.get(key);
  if (cached) return cached;

  const body: Record<string, unknown> = { provider, apiKey };
  if (baseURL) body.baseURL = baseURL;

  const { data, error, response } = await invokeSupabaseFunction<ListModelsResponse>(
    'list-models',
    { featureLabel: 'Models', body },
  );

  if (error || !data?.ok || !Array.isArray(data.models)) {
    const payload = await readSupabaseFunctionError(response);
    const msg = typeof payload.message === 'string' ? payload.message : 'Failed to fetch models';
    throw new Error(msg);
  }

  cache.set(key, data.models);
  return data.models;
}

/** Clear the model cache (e.g. when API key changes). */
export function clearModelCache(provider?: string): void {
  if (!provider) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(`${provider}::`)) cache.delete(k);
  }
}
