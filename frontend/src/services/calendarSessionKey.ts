/**
 * Stable identity for a calendar generation session (strategy + config digest).
 * Scopes resume caches to the current strategy/config so a stale session from
 * another strategy is never re-attached. Server remains source of truth.
 */

export interface CalendarSessionIdentity {
  strategyId?: string | number | null;
  calendarType?: string | null;
  strategyDigest?: Record<string, unknown> | null;
}

function normalizeStrategyId(strategyId: string | number | null | undefined): string {
  if (strategyId === undefined || strategyId === null) return '';
  return String(strategyId).trim();
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/** Short deterministic hash (djb2-xor, hex) for config digests. */
export function hashCalendarIdentity(value: unknown): string {
  const text = stableStringify(value);
  if (!text) return '';
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function buildCalendarSessionKey(identity: CalendarSessionIdentity): string {
  const strategyId = normalizeStrategyId(identity.strategyId);
  const calendarType = (identity.calendarType || 'monthly').trim().toLowerCase();
  const digestHash = hashCalendarIdentity(identity.strategyDigest ?? null);
  return `${strategyId}:${calendarType}:${digestHash}`;
}

export function isSameCalendarSession(
  keyA: string | null | undefined,
  keyB: string | null | undefined
): boolean {
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

export function parseCalendarSessionKey(key: string): {
  strategyId: string;
  calendarType: string;
  digestHash: string;
} {
  const [strategyId = '', calendarType = '', digestHash = ''] = key.split(':');
  return { strategyId, calendarType, digestHash };
}
