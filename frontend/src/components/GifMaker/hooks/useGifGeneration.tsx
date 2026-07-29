/** Hook + context provider for GIF generation state and API calls.
 *
 * Manages loading/error/result state for the generate endpoint.
 * Zero ALwrity dependencies.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { generateGif } from '../gifMakerApi';
import type { Frame, GifSettings, GifResult } from '../types';

// ── Context types ────────────────────────────────────────────────────────────

interface GifGenerationState {
  /** True while the generate request is in flight */
  isGenerating: boolean;
  /** The latest generation result, or null */
  result: GifResult | null;
  /** Error message from the last failed generation, or null */
  error: string | null;
  /** Progress: 0–1 indicating upload progress */
  progress: number;
}

interface GifGenerationContextValue extends GifGenerationState {
  /** Call to generate a GIF from the given frames + settings */
  generate: (frames: Frame[], settings: GifSettings) => Promise<GifResult>;
  /** Clear the result and error, returning to idle */
  reset: () => void;
  /** API base URL injected by the parent */
  apiBaseUrl: string;
  /** Optional API key injected by the parent */
  apiKey?: string;
}

const GifGenerationContext = createContext<GifGenerationContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

interface GifGenerationProviderProps {
  children: React.ReactNode;
  apiBaseUrl?: string;
  apiKey?: string;
}

export const GifGenerationProvider: React.FC<GifGenerationProviderProps> = ({
  children,
  apiBaseUrl = '',
  apiKey,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GifResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (frames: Frame[], settings: GifSettings): Promise<GifResult> => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setError(null);
      setResult(null);
      setProgress(0);

      try {
        // Simulate indeterminate progress (fetch doesn't natively support
        // upload progress for FormData, so we show activity-based steps)
        setProgress(0.3);

        const gifResult = await generateGif({
          frames: frames.map((f) => f.file),
          settings,
          apiBaseUrl,
          apiKey,
          signal: controller.signal,
        });

        setProgress(1);
        setResult(gifResult);
        return gifResult;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          // Silently handle cancellations
          setProgress(0);
          throw err;
        }
        const message = (err as Error)?.message || 'Generation failed';
        setError(message);
        setProgress(0);
        throw err;
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [apiBaseUrl, apiKey],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  const value: GifGenerationContextValue = {
    isGenerating,
    result,
    error,
    progress,
    generate,
    reset,
    apiBaseUrl,
    apiKey,
  };

  return (
    <GifGenerationContext.Provider value={value}>
      {children}
    </GifGenerationContext.Provider>
  );
};

// ── Consumer hook ────────────────────────────────────────────────────────────

export function useGifGeneration(): GifGenerationContextValue {
  const ctx = useContext(GifGenerationContext);
  if (!ctx) {
    throw new Error(
      'useGifGeneration must be used inside a <GifGenerationProvider>.',
    );
  }
  return ctx;
}
