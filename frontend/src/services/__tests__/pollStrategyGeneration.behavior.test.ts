/**
 * Phase H #38 — pollStrategyGeneration behavioral tests (completion
 * conditions, timeout, retry-with-backoff, cancellation).
 *
 * These run the REAL ContentPlanningAPI.pollStrategyGeneration with only the
 * axios layer mocked, fake timers driving the recursive setTimeout loop —
 * proving the behavior the source-reading pollCancellation/pollRetry tests
 * only pin textually.
 *
 * Drive pattern: pollStrategyGeneration returns as soon as the first poll is
 * kicked off (the loop is timer-scheduled), so every test calls it, then
 * `await vi.runAllTimersAsync()` to drain the queue (network promises are
 * awaited between timer firings).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
  aiApiClient: { post: vi.fn() },
  getAuthTokenGetter: vi.fn(() => null),
}));

import { contentPlanningApi } from '../contentPlanningApi';
import { apiClient } from '../../api/client';

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

const statusBody = (status: string, over: Record<string, any> = {}) => ({
  data: { status, progress: over.progress ?? 10, ...over },
});

// Real axios transport errors carry `request` (no response) — bare `new Error()`
// is correctly classified non-retryable by classifyApiError.
const networkError = (msg: string) => ({ isAxiosError: true, request: {}, message: msg });

const poll = (
  callbacks: { onProgress?: any; onComplete?: any; onError?: any },
  opts: { interval?: number; maxAttempts?: number; signal?: AbortSignal; retry?: any } = {},
) =>
  contentPlanningApi.pollStrategyGeneration(
    'task-1',
    callbacks.onProgress ?? vi.fn(),
    callbacks.onComplete ?? vi.fn(),
    callbacks.onError ?? vi.fn(),
    opts.interval ?? 10,
    opts.maxAttempts ?? 3,
    opts.signal,
    opts.retry ?? { maxRetries: 0, baseDelayMs: 1 },
  );

beforeEach(() => {
  vi.useFakeTimers();
  mockedGet.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pollStrategyGeneration — completion conditions', () => {
  it('calls onComplete with the strategy when status is completed', async () => {
    mockedGet.mockResolvedValue(statusBody('completed', { progress: 100, strategy: { id: 9, name: 'AI Strategy' } }));

    const onComplete = vi.fn();
    const onError = vi.fn();

    poll({ onComplete, onError });
    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledWith({ id: 9, name: 'AI Strategy' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('completes via the 100%-progress edge case (progress>=100 + strategy, status not completed)', async () => {
    mockedGet.mockResolvedValue(statusBody('processing', { progress: 100, strategy: { id: 5 } }));

    const onComplete = vi.fn();
    poll({ onComplete });
    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledWith({ id: 5 });
  });

  it('calls onError when the task status is failed', async () => {
    mockedGet.mockResolvedValue(statusBody('failed', { error: 'AI boom' }));

    const onError = vi.fn();
    poll({ onError });
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledWith('AI boom');
  });

  it('streams in-progress updates to onProgress, then completes', async () => {
    mockedGet
      .mockResolvedValueOnce(statusBody('in_progress', { progress: 40, message: 'crunching' }))
      .mockResolvedValue(statusBody('completed', { progress: 100, strategy: { id: 12 } }));

    const onProgress = vi.fn();
    const onComplete = vi.fn();

    poll({ onProgress, onComplete });
    await vi.runAllTimersAsync();

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ id: 12 });
  });
});

describe('pollStrategyGeneration — timeout', () => {
  it('surfaces a timeout error after maxAttempts in-progress polls', async () => {
    mockedGet.mockResolvedValue(statusBody('in_progress', { progress: 10 }));

    const onError = vi.fn();
    poll({ onError }, { maxAttempts: 2 });
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0])).toMatch(/timed out/i);
  });
});

describe('pollStrategyGeneration — retry with backoff (#18/#43)', () => {
  it('retries transient failures and completes without onError', async () => {
    mockedGet
      .mockRejectedValueOnce(networkError('network blip 1'))
      .mockRejectedValueOnce(networkError('network blip 2'))
      .mockResolvedValue(statusBody('completed', { progress: 100, strategy: { id: 1 } }));

    const onComplete = vi.fn();
    const onError = vi.fn();

    poll({ onComplete, onError }, { retry: { maxRetries: 3, baseDelayMs: 2 } });
    await vi.runAllTimersAsync();

    // 3 transport attempts: 2 failed + the succeeded one
    expect(apiClient.get).toHaveBeenCalledTimes(3);
    expect(onComplete).toHaveBeenCalledWith({ id: 1 });
    expect(onError).not.toHaveBeenCalled();
  });

  it('gives up after exhausting maxRetries and reports once', async () => {
    mockedGet.mockRejectedValue(networkError('server down'));

    const onError = vi.fn();
    poll({ onError }, { maxAttempts: 72, retry: { maxRetries: 1, baseDelayMs: 2 } });
    await vi.runAllTimersAsync();

    // attempt 1 (fail) + attempt 2 after one retry (fail) → final onError
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('never retries permanent (non-retryable) failures', async () => {
    // 403 → auth → non-retryable
    mockedGet.mockRejectedValue({ response: { status: 403, data: { detail: 'forbidden' } } });

    const onError = vi.fn();
    poll({ onError }, { maxAttempts: 72, retry: { maxRetries: 3, baseDelayMs: 2 } });
    await vi.runAllTimersAsync();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('pollStrategyGeneration — cancellation (#7)', () => {
  it('aborts a pre-aborted signal without any network call', async () => {
    const controller = new AbortController();
    controller.abort();

    poll({}, { signal: controller.signal });
    await vi.runAllTimersAsync();

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('stops the loop when the signal fires mid-generation', async () => {
    mockedGet.mockResolvedValue(statusBody('in_progress', { progress: 10 }));
    const controller = new AbortController();

    poll({}, { maxAttempts: 72, signal: controller.signal });

    // Flush the first poll (micro-only: await pending promise continuations).
    await vi.advanceTimersByTimeAsync(0);
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);

    // No further polls: the cleared timer never fires again.
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
