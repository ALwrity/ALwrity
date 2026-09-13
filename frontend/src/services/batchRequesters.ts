/**
 * Phase T5 — BatchRequester: bounded-concurrency batch executor over the real
 * seoApiService.analyzeSEO (POST /api/seo-dashboard/analyze-comprehensive).
 *
 * Reuses the repo's real primitives instead of inventing parallel I/O:
 *  - the SEO service (and its shared Clerk-authed apiClient) does the network
 *    work; the batch layer only schedules and classifies,
 *  - retry/backoff follows the pollStrategyGeneration contract — bounded
 *    retries for classifyApiError retryable kinds only (network/timeout/
 *    rate_limit/server), exponential 2^^n backoff capped at 30s,
 *  - AbortSignal cancels pending work and is forwarded into every in-flight
 *    request (seoApiService.analyzeSEO now accepts the same config all its
 *    sibling methods do).
 */
import { seoApiService } from './seoApiService';
import { classifyApiError, ApiErrorKind } from './apiError';
import type { SEOAnalysisData } from '../types/seoCopilotTypes';

export type BatchItemStatus = 'pending' | 'in_flight' | 'success' | 'error' | 'cancelled';

export interface BatchRequestItem {
  url: string;
  options?: Record<string, any>;
}

export interface BatchRequestResult {
  url: string;
  status: BatchItemStatus;
  data?: SEOAnalysisData;
  error?: string;
  errorKind?: ApiErrorKind;
  attempts: number;
}

export interface BatchRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface BatchRequestOptions {
  concurrency?: number;
  retryOptions?: BatchRetryOptions;
  signal?: AbortSignal;
  onProgress?: (summary: BatchRequestSummary) => void;
}

export interface BatchRequestSummary {
  batchId: string;
  total: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  durationMs: number;
  results: BatchRequestResult[];
}

const MAX_BACKOFF_MS = 30000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRY_OPTIONS = { maxRetries: 0, baseDelayMs: 2000 };

let batchCounter = 0;
const nextBatchId = (): string => `batch-${Date.now()}-${batchCounter++}`;

export class BatchRequester {
  /**
   * Batch-analyze a list of URLs, honoring the concurrency cap, per-item retry
   * budget and AbortSignal. Results are ordered identically to the input.
   */
  executeBatch(urls: string[], options?: BatchRequestOptions): Promise<BatchRequestSummary> {
    return this.executeBatchItems(
      urls.map((url) => ({ url })),
      options,
    );
  }

  async executeBatchItems(
    items: BatchRequestItem[],
    options: BatchRequestOptions = {},
  ): Promise<BatchRequestSummary> {
    const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
    const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options.retryOptions };
    const signal = options.signal;
    const startedAt = Date.now();

    const results: BatchRequestResult[] = items.map((item) => ({
      url: item.url,
      status: 'pending',
      attempts: 0,
    }));

    let aborted = signal?.aborted ?? false;
    const handleAbort = () => {
      aborted = true;
      results.forEach((result) => {
        if (result.status === 'pending') result.status = 'cancelled';
      });
    };
    if (signal) {
      if (signal.aborted) {
        handleAbort();
      } else {
        signal.addEventListener('abort', handleAbort);
      }
    }

    const buildSummary = (): BatchRequestSummary => {
      let succeeded = 0;
      let failed = 0;
      let cancelled = 0;
      for (const result of results) {
        if (result.status === 'success') succeeded += 1;
        else if (result.status === 'error') failed += 1;
        else if (result.status === 'cancelled') cancelled += 1;
      }
      return {
        batchId: nextBatchId(),
        total: items.length,
        succeeded,
        failed,
        cancelled,
        durationMs: Date.now() - startedAt,
        results: results.map((result) => ({ ...result })),
      };
    };

    const runItem = async (result: BatchRequestResult, item: BatchRequestItem): Promise<void> => {
      result.status = 'in_flight';
      let consecutiveFailures = 0;
      while (true) {
        result.attempts += 1;
        try {
          const data = await seoApiService.analyzeSEO(item.url, item.options || {}, { signal });
          result.status = 'success';
          result.data = data;
          result.error = undefined;
          result.errorKind = undefined;
          return;
        } catch (error: any) {
          if (signal?.aborted) {
            result.status = 'cancelled';
            return;
          }
          const apiErr = classifyApiError(error);
          result.error = apiErr.message;
          result.errorKind = apiErr.kind;
          // Phase C #18/#43 policy: retransient (retryable) failures only, with
          // exponential backoff capped at 30s. Permanent errors fail the item.
          if (apiErr.retryable && consecutiveFailures < retryOptions.maxRetries) {
            consecutiveFailures += 1;
            const delay = Math.min(
              retryOptions.baseDelayMs * 2 ** (consecutiveFailures - 1),
              MAX_BACKOFF_MS,
            );
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
            continue;
          }
          result.status = 'error';
          return;
        }
      }
    };

    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        if (aborted) return;
        const index = nextIndex++;
        if (index >= items.length) return;
        await runItem(results[index], items[index]);
        options.onProgress?.(buildSummary());
      }
    };

    await Promise.allSettled(
      Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
    );

    if (signal) signal.removeEventListener('abort', handleAbort);

    return buildSummary();
  }
}