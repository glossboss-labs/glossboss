export function toSpeakLanguageTag(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length === 0) return null;

  const [base, second, ...rest] = parts;
  if (!base) return null;
  const normalizedSecond = !second
    ? undefined
    : second.length === 4
      ? `${second[0]!.toUpperCase()}${second.slice(1).toLowerCase()}`
      : second.toUpperCase();
  const normalized = [base!.toLowerCase(), normalizedSecond, ...rest].filter(Boolean);

  return normalized.join('-');
}
