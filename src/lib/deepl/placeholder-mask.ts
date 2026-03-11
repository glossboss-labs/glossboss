/**
 * Placeholder Masking for DeepL Translation
 *
 * Wraps printf-style and ICU placeholders in XML tokens so DeepL's
 * tag_handling: 'xml' mode preserves them during translation.
 * HTML tags are handled natively by DeepL's XML mode and don't need masking.
 */

/** Printf-style placeholders: %s, %d, %1$s, %% */
const PRINTF_RE = /%%|%(?:\d+\$)?[#+\-0 ]?(?:\d+)?(?:\.\d+)?[bcdeEufFgGiosxX]/g;

/** ICU variables: {name}, {count,plural,...} — but not empty {} */
const ICU_RE = /\{[a-zA-Z_][\w.,-]*(?:,[^{}]*)?\}/g;

interface MaskResult {
  text: string;
  tokens: Map<number, string>;
}

/**
 * Replace printf and ICU placeholders with numbered XML tokens.
 * Returns the masked text and a map to restore originals.
 */
export function maskPlaceholders(text: string): MaskResult {
  const tokens = new Map<number, string>();
  let id = 0;

  let masked = text.replace(PRINTF_RE, (match) => {
    tokens.set(id, match);
    return `<m id="${id++}" />`;
  });

  masked = masked.replace(ICU_RE, (match) => {
    tokens.set(id, match);
    return `<m id="${id++}" />`;
  });

  return { text: masked, tokens };
}

/**
 * Restore original placeholders from XML tokens in translated text.
 */
export function unmaskPlaceholders(text: string, tokens: Map<number, string>): string {
  return text.replace(/<m\s+id="(\d+)"\s*\/>/g, (_, idStr) => {
    return tokens.get(parseInt(idStr, 10)) ?? '';
  });
}

/**
 * Returns true when the text contains placeholders that need masking.
 */
export function hasPlaceholders(text: string): boolean {
  PRINTF_RE.lastIndex = 0;
  ICU_RE.lastIndex = 0;
  return PRINTF_RE.test(text) || ICU_RE.test(text);
}
