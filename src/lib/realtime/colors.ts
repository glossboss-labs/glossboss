/**
 * Deterministic user color assignment.
 *
 * Maps a user ID to one of a fixed set of distinguishable colors,
 * ensuring the same user always gets the same color across all clients.
 */

/** Colors chosen for visibility in both light and dark modes. */
const PALETTE = [
  '#e03131', // red
  '#2f9e44', // green
  '#1971c2', // blue
  '#f08c00', // orange
  '#9c36b5', // purple
  '#0c8599', // teal
  '#e8590c', // burnt orange
  '#6741d9', // indigo
  '#c2255c', // pink
  '#66a80f', // lime
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUserColor(userId: string): string {
  return PALETTE[hashString(userId) % PALETTE.length]!;
}
