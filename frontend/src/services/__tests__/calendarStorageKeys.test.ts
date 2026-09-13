import { beforeEach, describe, expect, it } from 'vitest';
import {
  CALENDAR_STORAGE_KEYS,
  clearCalendarSession,
  getResumableCalendarSession,
  syncCalendarSessionStorage,
} from '../calendarStorageKeys';

describe('CALENDAR_STORAGE_KEYS', () => {
  it('registers calendar resume keys', () => {
    expect(CALENDAR_STORAGE_KEYS.sessionId).toBe('calendar_generation_session_id');
    expect(CALENDAR_STORAGE_KEYS.sessionKey).toBe('calendar_generation_session_key');
    expect(CALENDAR_STORAGE_KEYS.strategyId).toBe('calendar_generation_strategy_id');
  });
});

describe('syncCalendarSessionStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists session id and key without invalidation on first sync', () => {
    const result = syncCalendarSessionStorage('sid-1', { strategyId: '7' });
    expect(result.didInvalidatePrevious).toBe(false);
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionId)).toBe('sid-1');
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionKey)).toBe(result.sessionKey);
  });

  it('flags invalidation when the strategy changes', () => {
    syncCalendarSessionStorage('sid-1', { strategyId: '7' });
    const result = syncCalendarSessionStorage('sid-2', { strategyId: '8' });
    expect(result.didInvalidatePrevious).toBe(true);
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionId)).toBe('sid-2');
  });
});

describe('getResumableCalendarSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the stored session for the same identity', () => {
    syncCalendarSessionStorage('sid-1', { strategyId: '7', calendarType: 'monthly' });
    expect(getResumableCalendarSession({ strategyId: '7', calendarType: 'monthly' })).toBe(
      'sid-1'
    );
  });

  it('discards stale sessions from other strategies', () => {
    syncCalendarSessionStorage('sid-1', { strategyId: '7' });
    expect(getResumableCalendarSession({ strategyId: '8' })).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(getResumableCalendarSession({ strategyId: '7' })).toBeNull();
  });
});

describe('clearCalendarSession', () => {
  it('removes all resume keys', () => {
    syncCalendarSessionStorage('sid-1', { strategyId: '7' });
    clearCalendarSession();
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionId)).toBeNull();
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionKey)).toBeNull();
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.strategyId)).toBeNull();
  });
});
