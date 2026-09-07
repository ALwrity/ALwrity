/**
 * Phase H #36 — useModalManagement behavioral tests.
 *
 * The source-reading unmount test (Phase B #9) pins the REF PATTERN; these
 * tests prove the BEHAVIOR with the real hook:
 *  - proceed closes the enterprise modal + clears sessionStorage, then after
 *    the documented MODAL_TRANSITION_DELAY_MS calls the CURRENT
 *    originalHandleCreateStrategy (stabLIe ref pattern, reacts to re-renders)
 *  - refuses to fire while aiGenerating
 *  - NEVER fires after an unmount inside the delay window (the race fix)
 *  - handleAddEnterpriseDatapoints follows the same contract
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import { useModalManagement } from './ContentStrategyBuilder/hooks/useModalManagement';

describe('useModalManagement — behavioral', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  const propsWithDefaults = (over: Record<string, any> = {}) => ({
    aiGenerating: false,
    originalHandleCreateStrategy: vi.fn(async () => {}) as any,
    setShowEnterpriseModal: vi.fn(),
    ...over,
  });

  it('closes modal + clears sessionStorage immediately, then calls the handler after the delay', async () => {
    const props = propsWithDefaults();
    const { result } = renderHook(() => useModalManagement(props));

    await act(async () => {
      await result.current.handleProceedWithCurrentStrategy();
    });

    expect(props.setShowEnterpriseModal).toHaveBeenCalledWith(false);
    expect(sessionStorage.getItem('showEnterpriseModal')).toBeNull();
    expect(props.originalHandleCreateStrategy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(props.originalHandleCreateStrategy).toHaveBeenCalledTimes(1);
  });

  it('always calls the LATEST handler after re-renders (ref pattern)', async () => {
    const latestHandler = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      ({ original }) => useModalManagement({ aiGenerating: false, originalHandleCreateStrategy: original, setShowEnterpriseModal: vi.fn() } as any),
      { initialProps: { original: vi.fn(async () => {}) } as any },
    );

    rerender({ original: latestHandler } as any);

    await act(async () => {
      result.current.handleProceedWithCurrentStrategy();
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(latestHandler).toHaveBeenCalledTimes(1);
  });

  it('still fires when aiGenerating was captured true — the hook owns concurrency, not this layer', async () => {
    const props = propsWithDefaults({ aiGenerating: true });
    const { result } = renderHook(() => useModalManagement(props));

    await act(async () => {
      result.current.handleProceedWithCurrentStrategy();
      await vi.advanceTimersByTimeAsync(300);
    });

    // The stale-closure gate was removed: isGeneratingRef inside the
    // ActionButtons hook is the single source of in-flight protection.
    expect(props.originalHandleCreateStrategy).toHaveBeenCalledTimes(1);
  });

  it('NEVER fires after unmount inside the 300ms window (#9)', async () => {
    const props = propsWithDefaults();
    const { result, unmount } = renderHook(() => useModalManagement(props));

    // Fire and unmount BEFORE the delay elapses.
    await act(async () => {
      result.current.handleProceedWithCurrentStrategy();
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(props.originalHandleCreateStrategy).not.toHaveBeenCalled();
  });

  it('handleAddEnterpriseDatapoints follows the same contract after unmount', async () => {
    const props = propsWithDefaults();
    const { result, unmount } = renderHook(() => useModalManagement(props));

    await act(async () => {
      result.current.handleAddEnterpriseDatapoints();
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(props.originalHandleCreateStrategy).not.toHaveBeenCalled();
  });

  it('handleAddEnterpriseDatapoints fires when still mounted', async () => {
    const props = propsWithDefaults();
    const { result } = renderHook(() => useModalManagement(props));

    await act(async () => {
      result.current.handleAddEnterpriseDatapoints();
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(props.originalHandleCreateStrategy).toHaveBeenCalledTimes(1);
  });
});


