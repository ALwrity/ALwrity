/**
 * Phase T5 — BackgroundProcessors: a timer-based scheduled-task runner.
 *
 * The scheduler itself is generic; the tasks are grounded in real seams —
 * real CacheBlocker state (cache-cleanup), real contentPlanningApi
 * (health-check), real BatchRequester (batch_seo). Only the transport layer
 * (`../../api/client`) is mocked. Retry with exponential backoff follows the
 * pollStrategyGeneration contract (retryable kinds only, 2^^n backoff capped
 * at 30s, consecutive-failure reset on success).
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';

vi.mock('../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
  aiApiClient: { post: vi.fn() },
  getAuthTokenGetter: vi.fn(() => null),
}));

import { apiClient } from '../../api/client';
import { contentPlanningApi } from '../contentPlanningApi';
import { BatchRequester } from '../batchRequesters';
import CacheBlocker from '../cacheBlocker';
import { BackgroundProcessors } from '../backgroundProcessors';

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

const networkError = (msg: string) => ({ isAxiosError: true, request: {}, message: msg });
const statusError = (status: number, msg = 'boom') => ({
  response: { status, data: { detail: msg } },
});

describe('BackgroundProcessors — scheduling & lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs immediately when configured and repeats on the interval up to maxRuns', async () => {
    const calls = vi.fn(async () => ({ ok: true }));
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'repeat',
      kind: 'health_check',
      intervalMs: 50,
      immediate: true,
      maxRuns: 3,
      runner: calls,
    });

    await vi.runAllTimersAsync();

    expect(calls).toHaveBeenCalledTimes(3);
    const status = processors.getStatus('repeat');
    expect(status?.runCount).toBe(3);
    expect(status?.cancelled).toBe(false);
    expect(status?.lastResult?.status).toBe('success');
  });

  it('does not run before the interval elapses when immediate is false', async () => {
    const calls = vi.fn(async () => ({}));
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'delayed',
      kind: 'health_check',
      intervalMs: 100,
      immediate: false,
      maxRuns: 2,
      runner: calls,
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(calls).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('sets running true while a run is in flight, then false', async () => {
    let resolveRunner!: () => void;
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'inflight',
      kind: 'health_check',
      intervalMs: 50,
      immediate: true,
      maxRuns: 1,
      runner: () =>
        new Promise<void>((resolve) => {
          resolveRunner = resolve;
        }),
    });

    expect(processors.getStatus('inflight')?.running).toBe(true);

    resolveRunner();
    await vi.runAllTimersAsync();

    expect(processors.getStatus('inflight')?.running).toBe(false);
    expect(processors.getStatus('inflight')?.runCount).toBe(1);
  });

  it('unschedule cancels the process and stops future runs', async () => {
    const calls = vi.fn(async () => ({}));
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'stop',
      kind: 'health_check',
      intervalMs: 10,
      immediate: true,
      maxRuns: 100,
      runner: calls,
    });

    await vi.advanceTimersByTimeAsync(35);
    const before = calls.mock.calls.length;
    expect(before).toBeGreaterThanOrEqual(4);

    processors.unschedule('stop');
    expect(processors.getStatus('stop')?.cancelled).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveBeenCalledTimes(before);
  });

  it('pause halts scheduling and resume restarts it', async () => {
    const calls = vi.fn(async () => ({}));
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'paused',
      kind: 'health_check',
      intervalMs: 10,
      immediate: true,
      maxRuns: 100,
      runner: calls,
    });

    await vi.advanceTimersByTimeAsync(25);
    expect(calls).toHaveBeenCalledTimes(3);

    processors.pause('paused');
    expect(processors.getStatus('paused')?.paused).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveBeenCalledTimes(3);

    processors.resume('paused');
    expect(processors.getStatus('paused')?.paused).toBe(false);

    await vi.advanceTimersByTimeAsync(25);
    expect(calls.mock.calls.length).toBeGreaterThan(3);
  });
});

describe('BackgroundProcessors — retry with backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a retryable runner failure with exponential backoff, then records success', async () => {
    const calls = vi
      .fn()
      .mockRejectedValueOnce(networkError('blip'))
      .mockResolvedValue({ ok: true });
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'retry-ok',
      kind: 'health_check',
      intervalMs: 1000,
      immediate: true,
      maxRuns: 1,
      retryOptions: { maxRetries: 3, baseDelayMs: 100 },
      runner: calls,
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(calls).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();

    const status = processors.getStatus('retry-ok');
    expect(status?.lastResult?.status).toBe('success');
    expect(status?.lastResult?.attempts).toBe(2);
    expect(status?.failureCount).toBe(0);
  });

  it('records the classified error after retries are exhausted', async () => {
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'retry-exhausted',
      kind: 'health_check',
      intervalMs: 1000,
      immediate: true,
      maxRuns: 1,
      retryOptions: { maxRetries: 2, baseDelayMs: 2 },
      runner: () => Promise.reject(networkError('down')),
    });

    await vi.runAllTimersAsync();

    const status = processors.getStatus('retry-exhausted');
    expect(status?.lastResult?.status).toBe('error');
    expect(status?.lastResult?.errorKind).toBe('network');
    expect(status?.lastResult?.attempts).toBe(3);
    expect(status?.failureCount).toBe(1);
  });

  it('never retries permanent failures', async () => {
    const calls = vi.fn(() => Promise.reject(statusError(403)));
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'permanent',
      kind: 'health_check',
      intervalMs: 1000,
      immediate: true,
      maxRuns: 1,
      retryOptions: { maxRetries: 5, baseDelayMs: 2 },
      runner: calls,
    });

    await vi.runAllTimersAsync();

    expect(calls).toHaveBeenCalledTimes(1);
    const status = processors.getStatus('permanent');
    expect(status?.lastResult?.status).toBe('error');
    expect(status?.lastResult?.errorKind).toBe('auth');
    expect(status?.failureCount).toBe(1);
  });
});

describe('BackgroundProcessors — grounded tasks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborting the task signal cancels the process and clears its timer', async () => {
    const controller = new AbortController();
    const calls = vi.fn(async () => ({}));
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'signal-cancel',
      kind: 'health_check',
      intervalMs: 10,
      immediate: true,
      maxRuns: 100,
      signal: controller.signal,
      runner: calls,
    });

    await vi.advanceTimersByTimeAsync(30);
    expect(calls).toHaveBeenCalledTimes(4);

    controller.abort();
    expect(processors.getStatus('signal-cancel')?.cancelled).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveBeenCalledTimes(4);
  });

  it('cache-cleanup runner drops only stale entries from a real CacheBlocker', async () => {
    const cache = new CacheBlocker({ default_ttl: 60000 });
    const t0 = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(t0);
    cache.set('ns', { k: 'short' }, { v: 1 }, 1000);
    cache.set('ns', { k: 'long' }, { v: 2 }, 60000);

    const runner = () => {
      const before = cache.getStats().total_entries;
      cache.cleanup();
      const after = cache.getStats().total_entries;
      return Promise.resolve({ removed: before - after });
    };

    vi.setSystemTime(new Date(t0.getTime() + 2000));

    const processors = new BackgroundProcessors();
    processors.schedule({
      id: 'cache-clean',
      kind: 'cache_cleanup',
      intervalMs: 1000,
      immediate: true,
      maxRuns: 1,
      runner,
    });

    await vi.runAllTimersAsync();

    const status = processors.getStatus('cache-clean');
    expect(status?.lastResult?.status).toBe('success');
    expect(status?.lastResult?.detail?.removed).toBe(1);
    expect(cache.get('ns', { k: 'short' })).toBeUndefined();
    expect(cache.get('ns', { k: 'long' })).toEqual({ v: 2 });
  });

  it('health-check runner uses the real contentPlanningApi.checkBackendHealth', async () => {
    mockedGet.mockResolvedValue({ data: { status: 'healthy' } });
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'health',
      kind: 'health_check',
      intervalMs: 1000,
      immediate: true,
      maxRuns: 1,
      runner: () => contentPlanningApi.checkBackendHealth(),
    });

    await vi.runAllTimersAsync();

    expect(mockedGet).toHaveBeenCalledWith('/api/content-planning/health/backend');
    const status = processors.getStatus('health');
    expect(status?.lastResult?.status).toBe('success');
    expect(status?.lastResult?.detail?.status).toBe('healthy');
  });

  it('batch runner keeps the BatchRequester summary in detail', async () => {
    mockedPost.mockImplementation((endpoint: string, body: any) =>
      Promise.resolve({ data: { url: body.url, health_score: 90, status: 'completed' } }),
    );
    const processors = new BackgroundProcessors();

    processors.schedule({
      id: 'batch',
      kind: 'batch_seo',
      intervalMs: 1000,
      immediate: true,
      maxRuns: 1,
      runner: () =>
        new BatchRequester().executeBatch(
          ['https://a.dev', 'https://b.dev'],
          { retryOptions: { maxRetries: 0 } },
        ),
    });

    await vi.runAllTimersAsync();

    const status = processors.getStatus('batch');
    expect(status?.lastResult?.status).toBe('success');
    expect(status?.lastResult?.detail?.succeeded).toBe(2);
    expect(status?.lastResult?.detail?.total).toBe(2);
  });
});