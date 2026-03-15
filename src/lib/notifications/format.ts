/**
 * Relative time formatting for notification timestamps.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - Date.parse(isoDate);

  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`;

  return new Date(isoDate).toLocaleDateString();
}
