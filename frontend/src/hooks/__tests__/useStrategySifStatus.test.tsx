/**
 * Phase 2 — useStrategySifStatus behavioral tests.
 *
 * The hook drives the Semantic Index card's read-only status: mounts enabled,
 * polls while the indexer is pending/running, and settles on a terminal phase
 * (success/skipped/failed/not_indexed/no_active_strategy) or on error —
 * never hammering the endpoint beyond the terminal state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import { useStrategySifStatus, DEFAULT_SIF_POLL_INTERVAL_MS } from '../useStrategySifStatus';
import { contentPlanningApi } from '../../services/contentPlanningApi';

vi.mock('../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    getStrategySifStatus: vi.fn(),
  },
}));

const mockGetStrategySifStatus = vi.mocked(contentPlanningApi.getStrategySifStatus);

const terminalPayload = (phase: string, over: Record<string, any> = {}) => ({
  activation: { strategy_id: 1, activated_at: '2026-01-01T00:00:00Z' },
  indexing: { phase, status: phase, embedding_count: 8, attempt: 1, ...over },
  watermark: { embedding_count: 8, indexed_at: '2026-01-01T00:00:01Z' },
  vfs_mirror: { exists: true },
  document_kinds: { names: Array(8).fill('doc'), doc_ids: Array(8).fill('d1'), checked: false },
});

/** Flush the effect's initial tick (microtask queue) inside act(). */
const flush = () => act(async () => {});

describe('useStrategySifStatus — Phase 2: status polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetStrategySifStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches once on mount and returns the payload', async () => {
    mockGetStrategySifStatus.mockResolvedValue(terminalPayload('success'));

    const { result } = renderHook(() => useStrategySifStatus({ enabled: true }));

    await flush();
    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data?.indexing?.phase).toBe('success');
  });

  it('polls while pending until a terminal phase arrives', async () => {
    mockGetStrategySifStatus
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('running'))
      .mockResolvedValueOnce(terminalPayload('success'));

    const { result } = renderHook(() => useStrategySifStatus({ enabled: true }));

    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });

    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(4);
    expect(result.current.data?.indexing?.phase).toBe('success');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 5);
    });
    // Terminal phase → no further polling.
    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(4);
  });

  it('stops polling on other terminal phases (skipped)', async () => {
    mockGetStrategySifStatus
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('skipped'));

    const { result } = renderHook(() => useStrategySifStatus({ enabled: true }));

    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });

    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(2);
    expect(result.current.data?.indexing?.phase).toBe('skipped');
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 3);
    });
    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(2);
  });

  it('surfaces a network error and stops polling', async () => {
    mockGetStrategySifStatus.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useStrategySifStatus({ enabled: true }));

    await flush();

    expect(result.current.error).toBe('network down');
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 3);
    });
    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useStrategySifStatus({ enabled: false }));

    expect(result.current.loading).toBe(false);
    expect(mockGetStrategySifStatus).not.toHaveBeenCalled();
  });

  it('cleans up the pending poll timer on unmount', async () => {
    mockGetStrategySifStatus.mockResolvedValue(terminalPayload('pending'));

    const { unmount } = renderHook(() => useStrategySifStatus({ enabled: true }));

    await flush();
    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(1);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 3);
    });
    // Unmounted → the scheduled poll must not fire.
    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(1);
  });

  it('refresh re-fetches immediately', async () => {
    mockGetStrategySifStatus
      .mockResolvedValueOnce(terminalPayload('failed'))
      .mockResolvedValueOnce(terminalPayload('success'));

    const { result } = renderHook(() => useStrategySifStatus({ enabled: true }));

    await flush();
    expect(result.current.data?.indexing?.phase).toBe('failed');

    await act(async () => {
      result.current.refresh();
    });
    await flush();

    expect(mockGetStrategySifStatus).toHaveBeenCalledTimes(2);
    expect(result.current.data?.indexing?.phase).toBe('success');
  });
});