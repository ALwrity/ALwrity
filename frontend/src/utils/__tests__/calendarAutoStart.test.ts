import { describe, it, expect } from 'vitest';
import {
  shouldAutoStartCalendar,
  buildStrategyActivationNavigationState,
} from '../calendarAutoStart';

describe('shouldAutoStartCalendar', () => {
  it('returns true when fromStrategyActivation is set', () => {
    expect(
      shouldAutoStartCalendar({ fromStrategyActivation: true })
    ).toBe(true);
  });

  it('returns false when navigation state is absent', () => {
    expect(shouldAutoStartCalendar(null)).toBe(false);
    expect(shouldAutoStartCalendar(undefined)).toBe(false);
  });

  it('returns false when flag is not set (direct navigation)', () => {
    expect(shouldAutoStartCalendar({ activeTab: 1 })).toBe(false);
    expect(shouldAutoStartCalendar({ fromOnboarding: true })).toBe(false);
  });

  it('returns false when user opted out via autoGenerate: false', () => {
    expect(
      shouldAutoStartCalendar({ fromStrategyActivation: true, autoGenerate: false })
    ).toBe(false);
  });

  it('returns true when autoGenerate is explicitly true', () => {
    expect(
      shouldAutoStartCalendar({ fromStrategyActivation: true, autoGenerate: true })
    ).toBe(true);
  });

  it('is safe against non-object state', () => {
    // @ts-expect-error defensive runtime check
    expect(shouldAutoStartCalendar('garbage')).toBe(false);
    // @ts-expect-error defensive runtime check
    expect(shouldAutoStartCalendar(42)).toBe(false);
  });
});

describe('buildStrategyActivationNavigationState', () => {
  it('builds calendar-tab navigation state for a strategy id', () => {
    const state = buildStrategyActivationNavigationState('strategy-123');
    expect(state).toEqual({
      activeTab: 1,
      fromStrategyActivation: true,
      autoGenerate: true,
      strategyId: 'strategy-123',
    });
  });

  it('round-trips with shouldAutoStartCalendar', () => {
    const state = buildStrategyActivationNavigationState('strategy-456');
    expect(shouldAutoStartCalendar(state)).toBe(true);
  });

  it('supports opt-out via autoGenerate flag', () => {
    const state = buildStrategyActivationNavigationState('strategy-789', { autoGenerate: false });
    expect(shouldAutoStartCalendar(state)).toBe(false);
  });
});
