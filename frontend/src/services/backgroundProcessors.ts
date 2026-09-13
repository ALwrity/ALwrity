/**
 * Phase T5 — BackgroundProcessors: timer-based scheduler for background tasks.
 *
 * The scheduler is deliberately generic — callers supply a `runner`, so the
 * tasks stay grounded in the repo's real primitives instead of duplicating
 * them: cache-cleanup runners drive a real CacheBlocker, health-check runners
 * call contentPlanningApi, batch runners compose a real BatchRequester.
 *
 * Lifecycle follows the house poll pattern: recursive setTimeout (never a
 * runaway setInterval), per-task pause/resume/cancel, bounded recurrence via
 * `maxRuns`, and retry-with-exponential-backoff for classifyApiError retryable
 * kinds only (network/timeout/rate_limit/server, 2^^n backoff capped at 30s).
 */
import { classifyApiError, ApiErrorKind } from './apiError';
import type { BatchRetryOptions } from './batchRequesters';

export type ProcessKind = 'batch_seo' | 'cache_cleanup' | 'health_check';

export interface ProcessTaskRunResult {
  status: 'success' | 'error';
  error?: string;
  errorKind?: ApiErrorKind;
  attempts: number;
  detail?: any;
}

export interface ScheduledProcess {
  id: string;
  kind: ProcessKind;
  intervalMs: number;
  immediate?: boolean;
  maxRuns?: number;
  retryOptions?: BatchRetryOptions;
  signal?: AbortSignal;
  runner: (context: { runNumber: number }) => Promise<unknown>;
}

export interface ProcessStatus {
  id: string;
  kind: ProcessKind;
  running: boolean;
  paused: boolean;
  cancelled: boolean;
  runCount: number;
  failureCount: number;
  lastRunAt?: number;
  lastResult?: ProcessTaskRunResult;
}

interface ManagedProcess {
  config: ScheduledProcess;
  timer?: ReturnType<typeof setTimeout>;
  abortHandler?: () => void;
  running: boolean;
  paused: boolean;
  cancelled: boolean;
  runCount: number;
  failureCount: number;
  lastRunAt?: number;
  lastResult?: ProcessTaskRunResult;
}

const MAX_BACKOFF_MS = 30000;

export class BackgroundProcessors {
  private tasks = new Map<string, ManagedProcess>();

  schedule(process: ScheduledProcess): void {
    if (this.tasks.has(process.id)) {
      throw new Error(`Process '${process.id}' is already scheduled`);
    }

    const task: ManagedProcess = {
      config: process,
      running: false,
      paused: false,
      cancelled: false,
      runCount: 0,
      failureCount: 0,
    };

    const handleAbort = () => this.cancel(process.id);
    if (process.signal) {
      if (process.signal.aborted) {
        task.cancelled = true;
      } else {
        process.signal.addEventListener('abort', handleAbort);
        task.abortHandler = handleAbort;
      }
    }

    this.tasks.set(process.id, task);
    if (task.cancelled) return;

    if (process.immediate) {
      void this.runTask(task);
    } else {
      this.scheduleNext(task);
    }
  }

  unschedule(id: string): void {
    this.cancel(id);
  }

  cancel(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.cancelled = true;
    task.running = false;
    if (task.timer) clearTimeout(task.timer);
    if (task.config.signal && task.abortHandler) {
      task.config.signal.removeEventListener('abort', task.abortHandler);
    }
  }

  pause(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.paused = true;
    if (task.timer) clearTimeout(task.timer);
  }

  resume(id: string): void {
    const task = this.tasks.get(id);
    if (!task || task.cancelled) return;
    task.paused = false;
    this.scheduleNext(task);
  }

  getStatus(id: string): ProcessStatus | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    return {
      id: task.config.id,
      kind: task.config.kind,
      running: task.running,
      paused: task.paused,
      cancelled: task.cancelled,
      runCount: task.runCount,
      failureCount: task.failureCount,
      lastRunAt: task.lastRunAt,
      lastResult: task.lastResult,
    };
  }

  getStatuses(): ProcessStatus[] {
    return Array.from(this.tasks.values()).map((task) => this.getStatus(task.config.id)!);
  }

  private scheduleNext(task: ManagedProcess): void {
    if (task.cancelled || task.paused) return;
    if (typeof task.config.maxRuns === 'number' && task.runCount >= task.config.maxRuns) return;
    task.timer = setTimeout(() => {
      void this.runTask(task);
    }, task.config.intervalMs);
  }

  private async runTask(task: ManagedProcess): Promise<void> {
    if (task.cancelled || task.paused || task.running) return;
    task.running = true;
    task.runCount += 1;
    task.lastRunAt = Date.now();

    const maxRetries = task.config.retryOptions?.maxRetries ?? 0;
    const baseDelayMs = task.config.retryOptions?.baseDelayMs ?? 2000;

    let attempts = 0;
    let consecutiveFailures = 0;
    let outcome: ProcessTaskRunResult | null = null;

    while (outcome === null) {
      attempts += 1;
      try {
        const detail = await task.config.runner({ runNumber: task.runCount });
        outcome = { status: 'success', attempts, detail };
      } catch (error: any) {
        if (task.cancelled) break;
        const apiErr = classifyApiError(error);
        outcome = { status: 'error', error: apiErr.message, errorKind: apiErr.kind, attempts };
        // Retry transient (retryable) failures with exponential backoff capped
        // at 30s; permanent failures commit the error immediately.
        if (apiErr.retryable && consecutiveFailures < maxRetries) {
          consecutiveFailures += 1;
          const delay = Math.min(baseDelayMs * 2 ** (consecutiveFailures - 1), MAX_BACKOFF_MS);
          outcome = null;
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
          if (task.cancelled) break;
        }
      }
    }

    task.running = false;
    if (task.cancelled) return;

    task.lastResult = outcome ?? undefined;
    if (outcome?.status === 'error') task.failureCount += 1;
    this.scheduleNext(task);
  }
}

// Publish a default scheduler singleton so app code can compose background
// tasks without owning instance lifecycle.
export const backgroundProcessors = new BackgroundProcessors();