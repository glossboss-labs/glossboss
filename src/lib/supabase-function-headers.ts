function isJwtLike(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

export function buildSupabaseFunctionHeaders(
  supabaseKey: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!supabaseKey) {
    return headers;
  }

  headers.apikey = supabaseKey;

  // Supabase publishable keys are not JWTs and must not be sent as Bearer tokens.
  if (isJwtLike(supabaseKey)) {
    headers.Authorization = `Bearer ${supabaseKey}`;
  }

  return headers;
}
