import { useEffect, useState } from 'react';

/**
 * Defer loading a heavy section background until after first paint (TC 039).
 * Hero backgrounds should pass `eager={true}` or use CSS directly for LCP.
 */
export function useDeferredBackground(url: string, eager = false): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(eager ? url : undefined);

  useEffect(() => {
    if (eager) {
      setResolved(url);
      return;
    }

    let cancelled = false;

    const load = () => {
      if (cancelled) return;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setResolved(url);
      };
      img.onerror = () => {
        if (!cancelled) setResolved(url);
      };
      img.src = url;
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(load, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [url, eager]);

  return resolved;
}
