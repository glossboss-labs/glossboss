/**
 * Language-to-flag mapping
 *
 * Maps language/locale codes to ISO 3166-1 country codes for flag emoji display.
 * Language codes don't always map 1:1 to countries, so this uses the most
 * commonly associated country for each language.
 */

/**
 * Map of language codes (lowercase) to ISO 3166-1 alpha-2 country codes.
 * Includes both base languages and specific locale variants.
 */
const LANG_TO_COUNTRY: Record<string, string> = {
  // Locale variants (checked first)
  ar_sa: 'SA',
  ar_eg: 'EG',
  en_us: 'US',
  en_gb: 'GB',
  en_au: 'AU',
  en_ca: 'CA',
  es_ar: 'AR',
  es_mx: 'MX',
  es_co: 'CO',
  es_cl: 'CL',
  fr_be: 'BE',
  fr_ca: 'CA',
  fr_ch: 'CH',
  de_at: 'AT',
  de_ch: 'CH',
  it_ch: 'CH',
  nl_be: 'BE',
  pt_br: 'BR',
  pt_pt: 'PT',
  zh_cn: 'CN',
  zh_tw: 'TW',
  zh_hk: 'HK',
  sr_latn: 'RS',
  nb_no: 'NO',
  nn_no: 'NO',

  // DeepL-style codes
  'en-us': 'US',
  'en-gb': 'GB',
  'pt-br': 'BR',
  'pt-pt': 'PT',

  // Base languages → most associated country
  af: 'ZA',
  sq: 'AL',
  ar: 'SA',
  hy: 'AM',
  az: 'AZ',
  eu: 'ES',
  be: 'BY',
  bn: 'BD',
  bs: 'BA',
  bg: 'BG',
  ca: 'ES',
  zh: 'CN',
  hr: 'HR',
  cs: 'CZ',
  da: 'DK',
  nl: 'NL',
  en: 'GB',
  et: 'EE',
  fi: 'FI',
  fr: 'FR',
  gl: 'ES',
  ka: 'GE',
  de: 'DE',
  el: 'GR',
  gu: 'IN',
  he: 'IL',
  hi: 'IN',
  hu: 'HU',
  is: 'IS',
  id: 'ID',
  ga: 'IE',
  it: 'IT',
  ja: 'JP',
  kn: 'IN',
  kk: 'KZ',
  ko: 'KR',
  lv: 'LV',
  lt: 'LT',
  mk: 'MK',
  ms: 'MY',
  ml: 'IN',
  mt: 'MT',
  mr: 'IN',
  mn: 'MN',
  ne: 'NP',
  nb: 'NO',
  nn: 'NO',
  no: 'NO',
  fa: 'IR',
  pl: 'PL',
  pt: 'PT',
  pa: 'IN',
  ro: 'RO',
  ru: 'RU',
  sr: 'RS',
  sk: 'SK',
  sl: 'SI',
  es: 'ES',
  sw: 'KE',
  sv: 'SE',
  ta: 'IN',
  te: 'IN',
  th: 'TH',
  tr: 'TR',
  uk: 'UA',
  ur: 'PK',
  uz: 'UZ',
  vi: 'VN',
  cy: 'GB',
};

/**
 * Resolve a language/locale code to its ISO 3166-1 alpha-2 country code.
 *
 * Accepts formats like "nl", "en_US", "en-US", "EN-GB", "pt_BR", "zh_CN".
 * Returns the uppercase country code (e.g. "NL", "DE") or null if no mapping exists.
 */
export function getCountryCode(langCode: string): string | null {
  if (!langCode) return null;

  // Normalize: lowercase, replace hyphens with underscores
  const normalized = langCode.toLowerCase().replace(/-/g, '_');

  // Try full locale first (e.g. "en_us"), then base language (e.g. "en")
  return LANG_TO_COUNTRY[normalized] ?? LANG_TO_COUNTRY[normalized.split('_')[0]!] ?? null;
}

/**
 * Convert an ISO 3166-1 alpha-2 country code to a flag emoji.
 * Uses regional indicator symbols (U+1F1E6–U+1F1FF).
 */
function countryToEmoji(countryCode: string): string {
  const upper = countryCode.toUpperCase();
  return String.fromCodePoint(...Array.from(upper).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * Get a flag emoji for a language/locale code.
 *
 * Accepts formats like "nl", "en_US", "en-US", "EN-GB", "pt_BR", "zh_CN".
 * Returns the flag emoji or null if no mapping exists.
 *
 * @deprecated Use `CountryFlag` component or `getCountryCode()` instead —
 * flag emoji are not supported on Windows.
 */
export function getFlagEmoji(langCode: string): string | null {
  const country = getCountryCode(langCode);
  if (!country) return null;
  return countryToEmoji(country);
}
