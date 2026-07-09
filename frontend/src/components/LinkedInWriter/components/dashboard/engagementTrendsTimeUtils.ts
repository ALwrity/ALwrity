/**
 * UTC-safe time formatting for Engagement Trends snapshots and sync timestamps.
 * Backend stores naive UTC datetimes — always parse as UTC, display in local time.
 */

/** Parse an ISO timestamp from the API as UTC (appends Z when timezone is absent). */
export function parseUtcIso(iso: string): Date {
  const normalized = iso.trim();
  if (!normalized) return new Date(NaN);
  if (normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  return new Date(`${normalized}Z`);
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - parseUtcIso(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Locale-aware absolute timestamp for end-user clarity. */
export function formatAbsoluteLocal(iso: string): string {
  const d = parseUtcIso(iso);
  if (Number.isNaN(d.getTime())) return 'unknown time';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Relative + absolute label, e.g. "5 minutes ago (Thu, Jul 9, 2:55 PM)". */
export function formatSnapshotMoment(iso: string): string {
  return `${formatTimeAgo(iso)} (${formatAbsoluteLocal(iso)})`;
}

export function hasInsufficientSnapshots(period: { from: string; to: string }): boolean {
  return period.from === period.to;
}
