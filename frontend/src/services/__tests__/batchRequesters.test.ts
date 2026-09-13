/**
 * Phase T5 — BatchRequester: a genuine bounded-concurrency batch executor over
 * the REAL seoApiService.analyzeSEO (POST /api/seo-dashboard/analyze-comprehensive).
 *
 * Only the transport layer (`../../api/client`) is mocked — the runner itself
 * exercises the real service, real classifyApiError retry classification and
 * real AbortSignal propagation. Retry/backoff follows the pollStrategyGeneration
 * contract (consecutiveFailures reset on success, 2^^n backoff, cap 30000).
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
}));

import { apiClient } from '../../api/client';
import { BatchRequester } from '../batchRequesters';
import type { SEOAnalysisData } from '../../types/seoCopilotTypes';

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

// Real axios-shaped transport errors — classified by classifyApiError like the
// pollStrategyGeneration behavioral tests do.
const networkError = (msg: string) => ({ isAxiosError: true, request: {}, message: msg });
const statusError = (status: number, msg = 'boom') => ({
  response: { status, data: { detail: msg } },
});

const analysis = (url: string): SEOAnalysisData =>
  ({ url, health_score: 80, status: 'completed' }) as SEOAnalysisData;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('BatchRequester — execution', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('runs every URL through analyzeSEO and reports counts + ordered per-item results', async () => {
    mockedPost.mockImplementation((endpoint: string, body: any) => {
      expect(endpoint).toBe('/api/seo-dashboard/analyze-comprehensive');
      return Promise.resolve({ data: analysis(body.url) });
    });

    const summary = await new BatchRequester().executeBatch(
      ['https://a.dev', 'https://b.dev', 'https://c.dev'],
      { retryOptions: { maxRetries: 0 } },
    );

    expect(apiClient.post).toHaveBeenCalledTimes(3);
    expect(summary.batchId).toEqual(expect.any(String));
    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.cancelled).toBe(0);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.results.map((r) => r.url)).toEqual(['https://a.dev', 'https://b.dev', 'https://c.dev']);
    expect(summary.results.map((r) => r.status)).toEqual(['success', 'success', 'success']);
    expect(summary.results.every((r) => r.attempts === 1 && r.data?.health_score === 80)).toBe(true);
  });

  it('passes per-item options through to the SEO service', async () => {
    mockedPost.mockImplementation((endpoint: string, body: any) =>
      Promise.resolve({ data: analysis(body.url) }),
    );

    await new BatchRequester().executeBatchItems(
      [{ url: 'https://a.dev', options: { strategy: 'DESKTOP' } }],
      { retryOptions: { maxRetries: 0 } },
    );

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/seo-dashboard/analyze-comprehensive',
      expect.objectContaining({ url: 'https://a.dev', strategy: 'DESKTOP' }),
      expect.objectContaining({}),
    );
  });

  it('never exceeds the configured concurrency cap', async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://n.dev/${i}`);
    const resolvers: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;

    mockedPost.mockImplementation(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise<void>((resolve) => {
        resolvers.push(() => {
          active -= 1;
          resolve();
        });
      }).then(() => ({ data: analysis('https://n.dev/x') }));
    });

    const summaryPromise = new BatchRequester().executeBatch(urls, {
      concurrency: 2,
      retryOptions: { maxRetries: 0 },
    });

    await tick();
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(resolvers.length).toBe(2);

    while (resolvers.length > 0) {
      resolvers.splice(0).forEach((release) => release());
      await tick();
    }

    const summary = await summaryPromise;
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(summary.succeeded).toBe(6);
    expect(summary.results.length).toBe(6);
  });

  it('reports progress after each completion when concurrency is 1', async () => {
    const urls = ['https://a.dev', 'https://b.dev', 'https://c.dev'];
    mockedPost.mockImplementation((endpoint: string, body: any) =>
      Promise.resolve({ data: analysis(body.url) }),
    );
    const onProgress = vi.fn();

    const summary = await new BatchRequester().executeBatch(urls, {
      concurrency: 1,
      retryOptions: { maxRetries: 0 },
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls[2][0].succeeded).toBe(3);
    expect(onProgress.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.succeeded).toBe(3);
  });

  it('propagates the AbortSignal into every apiClient.post call', async () => {
    const controller = new AbortController();
    mockedPost.mockResolvedValue({ data: analysis('https://a.dev') });

    await new BatchRequester().executeBatch(['https://a.dev'], {
      signal: controller.signal,
    });

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/seo-dashboard/analyze-comprehensive',
      expect.objectContaining({ url: 'https://a.dev' }),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe('BatchRequester — retry & classification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('backs off exponentially before retrying a retryable failure', async () => {
    mockedPost
      .mockRejectedValueOnce(networkError('blip'))
      .mockResolvedValue({ data: analysis('https://a.dev') });

    const summaryPromise = new BatchRequester().executeBatch(['https://a.dev'], {
      concurrency: 1,
      retryOptions: { maxRetries: 2, baseDelayMs: 100 },
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(mockedPost).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();

    const summary = await summaryPromise;
    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(summary.succeeded).toBe(1);
    expect(summary.results[0].attempts).toBe(2);
  });

  it('retries transient failures then succeeds without reporting an error', async () => {
    mockedPost
      .mockRejectedValueOnce(networkError('blip 1'))
      .mockRejectedValueOnce(networkError('blip 2'))
      .mockResolvedValue({ data: analysis('https://a.dev') });

    const summaryPromise = new BatchRequester().executeBatch(['https://a.dev'], {
      retryOptions: { maxRetries: 3, baseDelayMs: 2 },
    });
    await vi.runAllTimersAsync();

    const summary = await summaryPromise;
    expect(mockedPost).toHaveBeenCalledTimes(3);
    expect(summary.succeeded).toBe(1);
    expect(summary.results[0].status).toBe('success');
    expect(summary.results[0].errorKind).toBeUndefined();
    expect(summary.results[0].attempts).toBe(3);
  });

  it('never retries permanent failures', async () => {
    mockedPost.mockRejectedValue(statusError(400, 'bad url'));

    const summaryPromise = new BatchRequester().executeBatch(['https://a.dev'], {
      retryOptions: { maxRetries: 5, baseDelayMs: 2 },
    });
    await vi.runAllTimersAsync();

    const summary = await summaryPromise;
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(summary.failed).toBe(1);
    expect(summary.results[0].status).toBe('error');
    expect(summary.results[0].errorKind).toBe('validation');
    expect(summary.results[0].attempts).toBe(1);
  });

  it('marks the item failed with the classified kind after exhausting retries', async () => {
    mockedPost.mockRejectedValue(networkError('still down'));

    const summaryPromise = new BatchRequester().executeBatch(['https://a.dev'], {
      retryOptions: { maxRetries: 2, baseDelayMs: 2 },
    });
    await vi.runAllTimersAsync();

    const summary = await summaryPromise;
    expect(mockedPost).toHaveBeenCalledTimes(3);
    expect(summary.failed).toBe(1);
    expect(summary.results[0].status).toBe('error');
    expect(summary.results[0].errorKind).toBe('network');
    expect(summary.results[0].error).toEqual(expect.any(String));
    expect(summary.results[0].attempts).toBe(3);
  });

  it('classifies server failures with the server kind', async () => {
    mockedPost.mockRejectedValue(statusError(500, 'internal'));

    const summary = await new BatchRequester().executeBatch(['https://a.dev'], {
      retryOptions: { maxRetries: 0 },
    });

    expect(summary.failed).toBe(1);
    expect(summary.results[0].errorKind).toBe('server');
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});

describe('BatchRequester — cancellation', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('makes no API call at all when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const summary = await new BatchRequester().executeBatch(
      ['https://a.dev', 'https://b.dev'],
      { signal: controller.signal },
    );

    expect(mockedPost).not.toHaveBeenCalled();
    expect(summary.cancelled).toBe(2);
    expect(summary.results.every((r) => r.status === 'cancelled')).toBe(true);
  });

  it('cancels pending items and stops the pool when the signal fires mid-batch', async () => {
    let releaseFirst!: () => void;
    mockedPost.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }).then(() => ({ data: analysis('https://a.dev') })),
    );
    mockedPost.mockImplementation((endpoint: string, body: any) =>
      Promise.resolve({ data: analysis(body.url) }),
    );

    const controller = new AbortController();
    const summaryPromise = new BatchRequester().executeBatch(
      ['https://a.dev', 'https://b.dev'],
      { concurrency: 1, retryOptions: { maxRetries: 0 }, signal: controller.signal },
    );

    await tick();
    expect(mockedPost).toHaveBeenCalledTimes(1);

    controller.abort();
    releaseFirst();

    const summary = await summaryPromise;
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(summary.total).toBe(2);
    expect(summary.cancelled).toBe(1);
    expect(summary.results.find((r) => r.url === 'https://b.dev')?.status).toBe('cancelled');
  });
});