import {
  buildCalendarSessionKey,
  isSameCalendarSession,
  type CalendarSessionIdentity,
} from './calendarSessionKey';

const LOG_PREFIX = '[calendar:storage]';

/** localStorage keys for calendar generation resume state (server is SSOT). */
export const CALENDAR_STORAGE_KEYS = {
  sessionId: 'calendar_generation_session_id',
  sessionKey: 'calendar_generation_session_key',
  strategyId: 'calendar_generation_strategy_id',
} as const;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read "${key}":`, err);
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to store "${key}":`, err);
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to remove "${key}":`, err);
  }
}

export interface SyncCalendarSessionResult {
  sessionKey: string;
  didInvalidatePrevious: boolean;
}

/**
 * Persist the active calendar session, discarding a previous session that
 * belongs to a different strategy/config. Never trusts cached payloads —
 * resume only re-attaches polling; progress always comes from the server.
 */
export function syncCalendarSessionStorage(
  sessionId: string,
  identity: CalendarSessionIdentity
): SyncCalendarSessionResult {
  const sessionKey = buildCalendarSessionKey(identity);
  const previousKey = safeGet(CALENDAR_STORAGE_KEYS.sessionKey);
  const didInvalidatePrevious =
    !!previousKey && !isSameCalendarSession(previousKey, sessionKey);

  if (didInvalidatePrevious) {
    console.log(`${LOG_PREFIX} Strategy session changed`, { previousKey, sessionKey });
  }

  safeSet(CALENDAR_STORAGE_KEYS.sessionId, sessionId);
  safeSet(CALENDAR_STORAGE_KEYS.sessionKey, sessionKey);
  if (identity.strategyId !== undefined && identity.strategyId !== null) {
    safeSet(CALENDAR_STORAGE_KEYS.strategyId, String(identity.strategyId));
  }

  return { sessionKey, didInvalidatePrevious };
}

/** Stored session ID only when it still matches the current strategy/config. */
export function getResumableCalendarSession(
  identity: CalendarSessionIdentity
): string | null {
  const sessionKey = buildCalendarSessionKey(identity);
  const storedKey = safeGet(CALENDAR_STORAGE_KEYS.sessionKey);
  if (!storedKey || !isSameCalendarSession(storedKey, sessionKey)) {
    return null;
  }
  return safeGet(CALENDAR_STORAGE_KEYS.sessionId);
}

export function clearCalendarSession(): void {
  safeRemove(CALENDAR_STORAGE_KEYS.sessionId);
  safeRemove(CALENDAR_STORAGE_KEYS.sessionKey);
  safeRemove(CALENDAR_STORAGE_KEYS.strategyId);
}
