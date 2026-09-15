/**
 * Phase D — useCalendarSifStatus behavioral tests.
 *
 * The hook drives the Calendar Semantic Index card's read-only status:
 * mounts enabled, polls while the indexer is pending/running, and
 * settles on a terminal phase (success/skipped/failed/not_indexed)
 * or on error — never hammering the endpoint beyond the terminal
 * state. Mirrors useStrategySifStatus tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import {
  useCalendarSifStatus,
  DEFAULT_SIF_POLL_INTERVAL_MS,
  type CalendarSifIndexingPhase,
} from '../useCalendarSifStatus';
import { contentPlanningApi } from '../../services/contentPlanningApi';

vi.mock('../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    getCalendarSifStatus: vi.fn(),
  },
}));

const mockGetCalendarSifStatus = vi.mocked(contentPlanningApi.getCalendarSifStatus);

const terminalPayload = (phase: CalendarSifIndexingPhase, over: Record<string, any> = {}) => ({
  indexing: { phase, status: phase, embedding_count: 8, attempt: 1, ...over },
  watermark: { embedding_count: 8, indexed_at: '2026-01-01T00:00:01Z' },
  document_kinds: { names: Array(8).fill('doc'), doc_ids: Array(8).fill('d1'), count: 8 },
});

const flush = () => act(async () => {});

describe('useCalendarSifStatus — status polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetCalendarSifStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches once on mount and returns the payload', async () => {
    mockGetCalendarSifStatus.mockResolvedValue(terminalPayload('success'));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();
    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data?.indexing?.phase).toBe('success');
  });

  it('polls while pending until a terminal phase arrives', async () => {
    mockGetCalendarSifStatus
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('running'))
      .mockResolvedValueOnce(terminalPayload('success'));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

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

    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(4);
    expect(result.current.data?.indexing?.phase).toBe('success');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 5);
    });
    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(4);
  });

  it('stops polling on other terminal phases (skipped)', async () => {
    mockGetCalendarSifStatus
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('skipped'));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });

    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(2);
    expect(result.current.data?.indexing?.phase).toBe('skipped');
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 3);
    });
    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(2);
  });

  it('surfaces a network error and stops polling', async () => {
    mockGetCalendarSifStatus.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();

    expect(result.current.error).toBe('network down');
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 3);
    });
    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useCalendarSifStatus({ enabled: false }));

    expect(result.current.loading).toBe(false);
    expect(mockGetCalendarSifStatus).not.toHaveBeenCalled();
  });

  it('cleans up the pending poll timer on unmount', async () => {
    mockGetCalendarSifStatus.mockResolvedValue(terminalPayload('pending'));

    const { unmount } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();
    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(1);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS * 3);
    });
    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(1);
  });

  it('refresh re-fetches immediately', async () => {
    mockGetCalendarSifStatus
      .mockResolvedValueOnce(terminalPayload('failed'))
      .mockResolvedValueOnce(terminalPayload('success'));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();
    expect(result.current.data?.indexing?.phase).toBe('failed');

    await act(async () => {
      result.current.refresh();
    });
    await flush();

    expect(mockGetCalendarSifStatus).toHaveBeenCalledTimes(2);
    expect(result.current.data?.indexing?.phase).toBe('success');
  });

  it('keeps last data + retries when a background poll fails (R3.4)', async () => {
    mockGetCalendarSifStatus
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockRejectedValueOnce(new Error('poll exploded'))
      .mockResolvedValueOnce(terminalPayload('success'));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();
    expect(result.current.data?.indexing?.phase).toBe('pending');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });
    expect(result.current.data?.indexing?.phase).toBe('pending');

    // Background poll rejects: last data must be retained, error surfaced,
    // one retry scheduled (poll #3 → data kept; poll #4 arrives at success).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });
    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toBe('poll exploded');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });
    expect(result.current.data?.indexing?.phase).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('refreshing is true only while re-polling with data in hand (R3.4)', async () => {
    mockGetCalendarSifStatus
      .mockResolvedValueOnce(terminalPayload('pending'))
      .mockImplementationOnce(() => new Promise(() => undefined));

    const { result } = renderHook(() => useCalendarSifStatus({ enabled: true }));

    await flush();
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIF_POLL_INTERVAL_MS);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
  });
});
