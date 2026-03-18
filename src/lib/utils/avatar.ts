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
