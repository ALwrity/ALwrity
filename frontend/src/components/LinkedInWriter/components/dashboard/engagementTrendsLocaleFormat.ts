/**
 * Locale-aware formatting for Engagement Trends timestamps.
 * Converts UTC API values into the end user's local timezone and regional format
 * (e.g. 12-hour US, 24-hour EU) via the browser Intl APIs.
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

/** Resolve the end user's locale from the browser (falls back to en-US). */
export function getUserLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  return 'en-US';
}

/** IANA timezone for the end user's device, e.g. America/New_York or Asia/Kolkata. */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatTimeZoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, ' ');
}

/** Relative time in the user's locale, e.g. "5 minutes ago" / "hace 5 minutos". */
export function formatLocalizedRelativeTime(iso: string, locale = getUserLocale()): string {
  const date = parseUtcIso(iso);
  if (Number.isNaN(date.getTime())) return 'just now';

  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const [unit, secondsInUnit] of units) {
      if (absSec >= secondsInUnit || unit === 'second') {
        const value = Math.round(diffSec / secondsInUnit);
        return rtf.format(value, unit);
      }
    }
  } catch {
    // Fallback below
  }

  const min = Math.floor(Math.abs(diffSec) / 60);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Absolute date/time in the user's locale and local timezone. */
export function formatLocalizedDateTime(
  iso: string,
  locale = getUserLocale(),
  timeZone = getUserTimeZone()
): string {
  const date = parseUtcIso(iso);
  if (Number.isNaN(date.getTime())) return 'unknown time';

  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}

export interface LocalizedSnapshotLabel {
  relative: string;
  absolute: string;
  display: string;
}

/** Relative + absolute label localized for the end user. */
export function formatLocalizedSnapshotLabel(
  iso: string,
  locale = getUserLocale(),
  timeZone = getUserTimeZone()
): LocalizedSnapshotLabel {
  const relative = formatLocalizedRelativeTime(iso, locale);
  const absolute = formatLocalizedDateTime(iso, locale, timeZone);
  return {
    relative,
    absolute,
    display: `${relative} (${absolute})`,
  };
}

export interface LocalizedComparisonPeriod {
  previous: LocalizedSnapshotLabel;
  latest: LocalizedSnapshotLabel;
  timeZoneLabel: string;
}

/** Build localized labels for the comparison period block. */
export function formatLocalizedComparisonPeriod(
  from: string,
  to: string,
  locale = getUserLocale(),
  timeZone = getUserTimeZone()
): LocalizedComparisonPeriod {
  return {
    previous: formatLocalizedSnapshotLabel(from, locale, timeZone),
    latest: formatLocalizedSnapshotLabel(to, locale, timeZone),
    timeZoneLabel: formatTimeZoneLabel(timeZone),
  };
}

export function hasInsufficientSnapshots(period: { from: string; to: string }): boolean {
  return period.from === period.to;
}
