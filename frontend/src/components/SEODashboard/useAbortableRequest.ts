import { useCallback, useEffect, useRef } from 'react';

/**
 * Mount-safe request helper (Phase 6 hardening).
 * Each call aborts the previous in-flight request and returns a fresh
 * AbortSignal; unmount aborts whatever is pending. Callers pass the signal
 * to apiClient and swallow `ERR_CANCELED` — cancellation is not a failure,
 * so it must never surface as an error state.
 */
export function useAbortableRequest(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const nextSignal = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);

  return nextSignal;
}

/** True when an axios error is an intentional cancellation. */
export function isCancelError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ERR_CANCELED';
}
