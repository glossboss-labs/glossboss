/**
 * Helpers for parsing DeepL error responses and handling common failure modes.
 */

export const DEEPL_GLOSSARY_FALLBACK_EVENT = 'deepl-glossary-fallback';

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Translation failed';
}

function tryExtractJson(message: string): unknown {
  const firstBrace = message.indexOf('{');
  if (firstBrace === -1) return null;
  const maybeJson = message.slice(firstBrace).trim();
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

/**
 * Detect stale/missing glossary failures from DeepL.
 */
export function isGlossaryNotFoundError(error: unknown): boolean {
  const message = toMessage(error).toLowerCase();
  return message.includes('glossary') && message.includes('not found');
}

/**
 * Emit a global event when translation has to fall back due to stale glossary IDs.
 */
export function notifyGlossaryFallback(context: 'single' | 'bulk'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(DEEPL_GLOSSARY_FALLBACK_EVENT, {
      detail: { context },
    }),
  );
}

/**
 * Convert noisy DeepL errors into cleaner end-user messages.
 */
export function formatDeepLError(error: unknown): string {
  const message = toMessage(error);
  const extracted = tryExtractJson(message);

  if (extracted && typeof extracted === 'object') {
    const payload = extracted as { message?: string; reason?: string };
    if (payload.message && payload.reason) {
      return `${payload.message} ${payload.reason}`;
    }
    if (payload.message) {
      return payload.message;
    }
  }

  return message;
}
