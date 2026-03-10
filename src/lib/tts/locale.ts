export function toSpeakLanguageTag(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length === 0) return null;

  const [base, region, ...rest] = parts;
  const normalized = [
    base.toLowerCase(),
    region ? region.toUpperCase() : undefined,
    ...rest,
  ].filter(Boolean);

  return normalized.join('-');
}
