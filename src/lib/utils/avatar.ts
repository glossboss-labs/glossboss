/**
 * Avatar utility functions.
 */

/**
 * Extract up to two initials from a display name.
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Append a size parameter to a GitHub avatar URL so the CDN serves a
 * right-sized image instead of the full 460x460 original.
 * Requests 2x the display size for retina screens.
 * Returns the URL unchanged for non-GitHub or falsy URLs.
 */
export function getSizedAvatarUrl(
  url: string | null | undefined,
  displaySize: number,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes('avatars.githubusercontent.com')) return url;
  const pixelSize = Math.round(displaySize * 2);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}s=${pixelSize}`;
}
