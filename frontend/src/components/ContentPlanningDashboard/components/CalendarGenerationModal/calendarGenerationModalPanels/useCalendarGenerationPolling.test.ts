import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { longRunningApiClient } from '../../../../../api/client';
import { CALENDAR_STORAGE_KEYS } from '../../../../../services/calendarStorageKeys';
import useCalendarGenerationPolling, {
  CALENDAR_TERMINAL_STATUSES,
  extractPollErrorMessage,
  normalizeStepResults,
} from './useCalendarGenerationPolling';

vi.mock('../../../../../api/client', () => ({
  longRunningApiClient: { get: vi.fn(), post: vi.fn() },
}));

const mockedGet = longRunningApiClient.get as unknown as ReturnType<typeof vi.fn>;

describe('CALENDAR_TERMINAL_STATUSES', () => {
  it('covers the backend session enum', () => {
    expect(CALENDAR_TERMINAL_STATUSES.has('completed')).toBe(true);
    expect(CALENDAR_TERMINAL_STATUSES.has('failed')).toBe(true);
    expect(CALENDAR_TERMINAL_STATUSES.has('cancelled')).toBe(true);
    expect(CALENDAR_TERMINAL_STATUSES.has('error')).toBe(true);
    expect(CALENDAR_TERMINAL_STATUSES.has('running')).toBe(false);
  });
});

describe('extractPollErrorMessage', () => {
  it('returns string details verbatim', () => {
    expect(
      extractPollErrorMessage({ response: { data: { detail: 'Denied' } } }, 'fallback')
    ).toBe('Denied');
  });

  it('combines structured message + next_step', () => {
    expect(
      extractPollErrorMessage(
        { response: { data: { detail: { message: 'No priors.', next_step: 'Retry later.' } } } },
        'fallback'
      )
    ).toBe('No priors. Retry later.');
  });

  it('falls back to errors array and Error instances', () => {
    expect(
      extractPollErrorMessage({ response: { data: { errors: [{ message: 'Boom' }] } } }, 'fb')
    ).toBe('Boom');
    expect(extractPollErrorMessage(new Error('kaput'), 'fb')).toBe('kaput');
    expect(extractPollErrorMessage({}, 'fb')).toBe('fb');
  });
});

describe('normalizeStepResults', () => {
  it('maps step_01 strings to numeric keys', () => {
    const out = normalizeStepResults({
      step_01: { status: 'completed' },
      step_12: { status: 'running' },
    });
    expect(out[1]).toEqual({ status: 'completed' });
    expect(out[12]).toEqual({ status: 'running' });
  });

  it('keeps numeric and unknown keys intact', () => {
    const out = normalizeStepResults({
      7: { status: 'completed' },
      summary: { status: 'completed' },
    });
    expect(out[7]).toEqual({ status: 'completed' });
    expect((out as any).summary).toEqual({ status: 'completed' });
  });

  it('tolerates nullish input', () => {
    expect(normalizeStepResults(null)).toEqual({});
    expect(normalizeStepResults(undefined)).toEqual({});
  });
});

describe('useCalendarGenerationPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('delivers the completed result and stops', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'completed',
        current_step: 12,
        step_progress: 100,
        overall_progress: 100,
        result: { daily_schedule: [] },
      },
    });
    const { result } = renderHook(() => useCalendarGenerationPolling('sid-1'));

    await act(async () => {
      await result.current.startPolling();
    });

    expect(result.current.progress?.status).toBe('completed');
    expect(result.current.progress?.result).toEqual({ daily_schedule: [] });
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('normalizes backend step_12 keys for numeric lookups', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        status: 'completed',
        current_step: 12,
        step_results: { step_12: { status: 'completed' }, step_07: { status: 'completed' } },
        result: { daily_schedule: [] },
      },
    });
    const { result } = renderHook(() => useCalendarGenerationPolling('sid-1'));

    await act(async () => {
      await result.current.startPolling();
    });

    expect(result.current.progress?.stepResults[12]).toEqual({ status: 'completed' });
    expect(result.current.getStepStatus(12)).toBe('completed');
    expect(result.current.getStepStatus(7)).toBe('completed');
  });

  it('stops without retry on 403 and surfaces the backend detail', async () => {
    mockedGet.mockRejectedValueOnce({
      response: { status: 403, data: { detail: 'Not authorized to view this session' } },
    });
    const { result } = renderHook(() => useCalendarGenerationPolling('sid-1'));

    await act(async () => {
      await result.current.startPolling();
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBe('Not authorized to view this session');
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('clears stored resume state when the session is gone (404)', async () => {
    localStorage.setItem(CALENDAR_STORAGE_KEYS.sessionId, 'sid-1');
    localStorage.setItem(CALENDAR_STORAGE_KEYS.sessionKey, '7:monthly:');
    mockedGet.mockRejectedValueOnce({ response: { status: 404, data: {} } });
    const { result } = renderHook(() => useCalendarGenerationPolling('sid-1'));

    await act(async () => {
      await result.current.startPolling();
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toMatch(/not found/i);
    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionId)).toBeNull();
  });

  it('persists resume state on start when context is provided', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { status: 'completed', current_step: 12, result: { daily_schedule: [] } },
    });
    const { result } = renderHook(() =>
      useCalendarGenerationPolling('sid-9', { strategyId: '7', calendarType: 'monthly' })
    );

    await act(async () => {
      await result.current.startPolling();
    });

    expect(localStorage.getItem(CALENDAR_STORAGE_KEYS.sessionId)).toBe('sid-9');
    expect(result.current.isPolling).toBe(false);
  });

  it('unmounts cleanly with a poll in flight', async () => {
    const gate: { resolve?: (value: unknown) => void } = {};
    mockedGet.mockImplementationOnce(
      () => new Promise((resolve) => { gate.resolve = resolve; })
    );
    const { result, unmount } = renderHook(() => useCalendarGenerationPolling('sid-1'));

    let started: Promise<void> | null = null;
    act(() => {
      started = result.current.startPolling();
    });
    unmount();
    gate.resolve?.({ data: { status: 'running' } });
    await act(async () => {
      await started;
    });

    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});
