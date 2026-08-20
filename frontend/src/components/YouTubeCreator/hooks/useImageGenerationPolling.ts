/**
 * Custom hook for robust image generation polling
 * 
 * Handles:
 * - Proper cleanup on unmount
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error classification and handling
 * - Race condition prevention
 */

import { useRef, useCallback, useEffect } from 'react';

interface PollingOptions {
  taskId: string;
  sceneNumber: number;
  onComplete: (payload: { imageUrl: string; generation?: Record<string, unknown> }) => void;
  onError: (error: string) => void;
  onProgress?: (progress: number, message: string) => void;
  pollInterval?: number;
  maxPollTime?: number;
  maxRetries?: number;
  getStatus: (taskId: string) => Promise<any>;
}

export const useImageGenerationPolling = () => {
  const activePollingRef = useRef<Map<string, () => void>>(new Map());

  const startPolling = useCallback((options: PollingOptions) => {
    const {
      taskId,
      sceneNumber,
      onComplete,
      onError,
      onProgress,
      pollInterval = 3000,
      maxPollTime = 5 * 60 * 1000, // 5 minutes
      maxRetries = 3,
      getStatus,
    } = options;

    // If already polling this task, stop it first
    const existingCleanup = activePollingRef.current.get(taskId);
    if (existingCleanup) {
      existingCleanup();
    }

    const pollIntervalRef = { current: null as NodeJS.Timeout | null };
    const timeoutRef = { current: null as NodeJS.Timeout | null };
    const retryCountRef = { current: 0 };
    const startTime = Date.now();
    let isActive = true;

    const cleanup = () => {
      isActive = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      activePollingRef.current.delete(taskId);
    };

    const pollForStatus = async () => {
      if (!isActive) return;

      // Check if we've exceeded max poll time
      if (Date.now() - startTime > maxPollTime) {
        cleanup();
        onError(`Scene ${sceneNumber}: Image generation timed out after 5 minutes. Please try again.`);
        return;
      }

      try {
        const status = await getStatus(taskId);
        retryCountRef.current = 0; // Reset retry count on success

        if (!isActive) return;

        if (status.status === 'completed' && status.result) {
          cleanup();
          onComplete({
            imageUrl: status.result.image_url,
            generation: status.result.generation,
          });
        } else if (status.status === 'failed') {
          cleanup();
          const errorMsg = status.error || status.message || 'Image generation failed';
          onError(`Scene ${sceneNumber}: ${errorMsg}`);
        } else if (status.status === 'processing') {
          if (onProgress) {
            onProgress(status.progress || 0, status.message || 'Processing...');
          }
          // Continue polling
        }

      } catch (pollError: any) {
        if (!isActive) return;

        // Classify error type
        const isNetworkError = pollError.code === 'ECONNABORTED' || 
                               pollError.message?.includes('timeout') ||
                               pollError.message?.includes('Network');
        const isNotFoundError = pollError.response?.status === 404 || 
                                pollError.message?.includes('404') || 
                                pollError.message?.includes('not found');
        const isServerError = pollError.response?.status >= 500;

        if (isNotFoundError) {
          // Task not found - stop polling immediately
          cleanup();
          onError(`Scene ${sceneNumber}: Image generation task was lost. Please try again.`);
          return;
        }

        // For network/server errors, retry with exponential backoff
        if ((isNetworkError || isServerError) && retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          const backoffDelay = Math.min(
            pollInterval * Math.pow(2, retryCountRef.current), 
            30000 // Max 30s
          );
          
          console.warn(
            `[ImagePolling] Retrying poll for task ${taskId} ` +
            `(${retryCountRef.current}/${maxRetries}) after ${backoffDelay}ms`
          );
          
          // Clear current interval and retry after backoff
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          setTimeout(() => {
            if (isActive && !pollIntervalRef.current) {
              pollForStatus(); // Retry immediately
              pollIntervalRef.current = setInterval(pollForStatus, pollInterval);
            }
          }, backoffDelay);
        } else if (retryCountRef.current >= maxRetries) {
          // Max retries exceeded
          cleanup();
          onError(
            `Scene ${sceneNumber}: Failed to check image generation status after ${maxRetries} retries. ` +
            `Please refresh and try again.`
          );
        }
        // For other errors, continue polling (might be transient)
      }
    };

    // Start polling immediately, then every pollInterval
    pollForStatus();
    pollIntervalRef.current = setInterval(pollForStatus, pollInterval);

    // Set a timeout to stop polling after max time
    timeoutRef.current = setTimeout(() => {
      if (isActive) {
        cleanup();
        onError(`Scene ${sceneNumber}: Image generation timed out after 5 minutes. Please try again.`);
      }
    }, maxPollTime);

    // Store cleanup function
    activePollingRef.current.set(taskId, cleanup);

    return cleanup;
  }, []);

  // Cleanup all polling on unmount
  useEffect(() => {
    return () => {
      activePollingRef.current.forEach((cleanup) => cleanup());
      activePollingRef.current.clear();
    };
  }, []);

  const stopPolling = useCallback((taskId: string) => {
    const cleanup = activePollingRef.current.get(taskId);
    if (cleanup) {
      cleanup();
    }
  }, []);

  return { startPolling, stopPolling };
};

