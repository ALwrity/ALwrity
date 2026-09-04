import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarAutoStart } from '../useCalendarAutoStart';

describe('useCalendarAutoStart', () => {
  it('returns shouldAutoStart true when fromStrategyActivation prop is true', () => {
    const { result } = renderHook(() =>
      useCalendarAutoStart({ fromStrategyActivation: true, locationState: {} })
    );
    expect(result.current.shouldAutoStart).toBe(true);
  });

  it('returns shouldAutoStart true via location state (router-driven flow)', () => {
    const { result } = renderHook(() =>
      useCalendarAutoStart({
        fromStrategyActivation: false,
        locationState: { fromStrategyActivation: true, strategyId: 's1' },
      })
    );
    expect(result.current.shouldAutoStart).toBe(true);
    expect(result.current.strategyId).toBe('s1');
  });

  it('respects autoGenerate: false opt-out from location state', () => {
    const { result } = renderHook(() =>
      useCalendarAutoStart({
        fromStrategyActivation: true,
        locationState: { fromStrategyActivation: true, autoGenerate: false },
      })
    );
    expect(result.current.shouldAutoStart).toBe(false);
  });

  it('returns false when no activation source present', () => {
    const { result } = renderHook(() =>
      useCalendarAutoStart({ fromStrategyActivation: false, locationState: null })
    );
    expect(result.current.shouldAutoStart).toBe(false);
  });

  it('extracts strategyId from strategyContext when present', () => {
    const { result } = renderHook(() =>
      useCalendarAutoStart({
        fromStrategyActivation: true,
        locationState: {},
        strategyContext: { strategyId: 'ctx-9' },
      })
    );
    expect(result.current.strategyId).toBe('ctx-9');
  });

  it('consumeAutoStart fires the callback exactly once', () => {
    const onAutoStart = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAutoStart({
        fromStrategyActivation: true,
        locationState: {},
        onAutoStart,
      })
    );

    act(() => {
      result.current.consumeAutoStart();
    });
    act(() => {
      result.current.consumeAutoStart(); // second call must be a no-op
    });

    expect(onAutoStart).toHaveBeenCalledTimes(1);
  });

  it('consumeAutoStart is a no-op when shouldAutoStart is false', () => {
    const onAutoStart = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAutoStart({
        fromStrategyActivation: false,
        locationState: null,
        onAutoStart,
      })
    );

    act(() => {
      result.current.consumeAutoStart();
    });

    expect(onAutoStart).not.toHaveBeenCalled();
  });

  it('does not consume when isGenerating guard is set', () => {
    const onAutoStart = vi.fn();
    const { result } = renderHook(() =>
      useCalendarAutoStart({
        fromStrategyActivation: true,
        locationState: {},
        onAutoStart,
        isGenerating: true,
      })
    );

    act(() => {
      result.current.consumeAutoStart();
    });

    expect(onAutoStart).not.toHaveBeenCalled();
  });
});
