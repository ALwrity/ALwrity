import { describe, expect, it } from 'vitest';
import {
  buildCalendarSessionKey,
  hashCalendarIdentity,
  isSameCalendarSession,
  parseCalendarSessionKey,
} from '../calendarSessionKey';

describe('buildCalendarSessionKey', () => {
  it('builds a stable key for the same identity', () => {
    const identity = { strategyId: '7', calendarType: 'monthly', strategyDigest: { a: 1 } };
    expect(buildCalendarSessionKey(identity)).toBe(buildCalendarSessionKey(identity));
  });

  it('separates strategies, types, and digests', () => {
    const base = { strategyId: '7', calendarType: 'monthly' };
    expect(buildCalendarSessionKey({ ...base, strategyId: '8' })).not.toBe(
      buildCalendarSessionKey(base)
    );
    expect(buildCalendarSessionKey({ ...base, calendarType: 'weekly' })).not.toBe(
      buildCalendarSessionKey(base)
    );
    expect(
      buildCalendarSessionKey({ ...base, strategyDigest: { pillars: ['AI'] } })
    ).not.toBe(buildCalendarSessionKey(base));
  });

  it('is key-order insensitive for digests', () => {
    const a = buildCalendarSessionKey({
      strategyId: '7',
      strategyDigest: { x: 1, y: 2 },
    });
    const b = buildCalendarSessionKey({
      strategyId: '7',
      strategyDigest: { y: 2, x: 1 },
    });
    expect(a).toBe(b);
  });

  it('defaults missing calendar type to monthly', () => {
    expect(buildCalendarSessionKey({ strategyId: '7' })).toBe(
      buildCalendarSessionKey({ strategyId: '7', calendarType: 'monthly' })
    );
  });
});

describe('hashCalendarIdentity', () => {
  it('returns empty string for empty input', () => {
    expect(hashCalendarIdentity(null)).toBe('');
    expect(hashCalendarIdentity(undefined)).toBe('');
  });

  it('is deterministic', () => {
    expect(hashCalendarIdentity({ a: [1, 2] })).toBe(hashCalendarIdentity({ a: [1, 2] }));
  });
});

describe('isSameCalendarSession', () => {
  it('matches identical keys only', () => {
    expect(isSameCalendarSession('a', 'a')).toBe(true);
    expect(isSameCalendarSession('a', 'b')).toBe(false);
    expect(isSameCalendarSession(null, 'a')).toBe(false);
    expect(isSameCalendarSession(undefined, undefined)).toBe(false);
  });
});

describe('parseCalendarSessionKey', () => {
  it('round-trips strategy, type, and digest hash', () => {
    const key = buildCalendarSessionKey({
      strategyId: '7',
      calendarType: 'weekly',
      strategyDigest: { a: 1 },
    });
    const parsed = parseCalendarSessionKey(key);
    expect(parsed.strategyId).toBe('7');
    expect(parsed.calendarType).toBe('weekly');
    expect(parsed.digestHash).toHaveLength(8);
  });
});
