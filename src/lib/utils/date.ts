/**
 * Relative date formatting utilities.
 */

/**
 * Format an ISO date string as a human-readable relative time.
 * Returns strings like "just now", "5m ago", "3h ago", "2d ago",
 * or falls back to toLocaleDateString() for dates older than 30 days.
 */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
