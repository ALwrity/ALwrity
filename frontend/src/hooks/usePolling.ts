import { useState, useEffect, useCallback, useRef } from 'react';
import { blogWriterApi, TaskStatusResponse } from '../services/blogWriterApi';
import { researchEngineApi } from '../services/researchEngineApi';
import { storyWriterApi } from '../services/storyWriterApi';
import { pollVideoTaskStatus } from '../api/videoStudioApi';
import { triggerSubscriptionError } from '../api/client';

export interface UsePollingOptions<T = any> {
  interval?: number; // Polling interval in milliseconds
  maxAttempts?: number; // Maximum number of polling attempts
  onProgress?: (message: string) => void; // Callback for progress updates
  onComplete?: (result: T) => void; // Callback when task completes
  onError?: (error: string) => void; // Callback when task fails
}

export interface UsePollingReturn<T = any> {
  isPolling: boolean;
  currentStatus: string;
  progressMessages: Array<{ timestamp: string; message: string }>;
  result: T | null;
  error: string | null;
  startPolling: (taskId: string) => void;
  stopPolling: () => void;
}

export function usePolling<T = any>(
  pollFunction: (taskId: string) => Promise<TaskStatusResponse<T>>,
  options: UsePollingOptions<T> = {}
): UsePollingReturn<T> {
  const {
    interval = 5000, // 5 seconds default - increased to reduce load
    onProgress,
    onComplete,
    onError
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('idle');
  const [progressMessages, setProgressMessages] = useState<Array<{ timestamp: string; message: string }>>([]);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debug state changes only in development and when state actually changes meaningfully
  const prevStateRef = useRef({ isPolling: false, currentStatus: 'idle', progressCount: 0 });
  useEffect(() => {
    const currentState = { isPolling, currentStatus, progressCount: progressMessages.length };
    const prevState = prevStateRef.current;
    
    // Only log if state meaningfully changed (not just a re-render)
    if (process.env.NODE_ENV === 'development' && 
        (prevState.isPolling !== currentState.isPolling || 
         prevState.currentStatus !== currentState.currentStatus ||
         (prevState.isPolling && currentState.progressCount !== prevState.progressCount))) {
      console.log('Polling state changed:', currentState);
      prevStateRef.current = currentState;
    }
  }, [isPolling, currentStatus, progressMessages.length]);


  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  const currentTaskIdRef = useRef<string | null>(null);

  /* const stopPolling = useCallback(() => {
    // Only log and clear if actually polling (not just cleanup on unmount when idle)
    const wasPolling = intervalRef.current !== null || isPolling;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Only update state if actually was polling (prevents unnecessary state updates)
    if (wasPolling) {
      setIsPolling(false);
      attemptsRef.current = 0;
      currentTaskIdRef.current = null;
      
      // Only log meaningful stops (when actually stopping active polling)
      if (process.env.NODE_ENV === 'development') {
        console.log('stopPolling: Stopped active polling');
      }
    }
    // Silently handle cleanup when not polling (common on unmount/re-render)
  }, [isPolling]); */

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    attemptsRef.current = 0;
    currentTaskIdRef.current = null;
  }, []);

  const startPolling = useCallback((taskId: string) => {
    if (isPolling) {
      stopPolling();
    }

    currentTaskIdRef.current = taskId;
    setIsPolling(true);
    setCurrentStatus('pending');
    setProgressMessages([]);
    setResult(null);
    setError(null);
    attemptsRef.current = 0;

    const poll = async () => {
      if (!currentTaskIdRef.current) {
        stopPolling();
        return;
      }

      try {
        const status = await pollFunction(currentTaskIdRef.current);
        setCurrentStatus(status.status);

        // Update progress messages
        if (status.progress_messages && status.progress_messages.length > 0) {
          setProgressMessages(status.progress_messages);
          
          // Call onProgress with the latest message for backward compatibility
          const latestMessage = status.progress_messages[status.progress_messages.length - 1];
          onProgress?.(latestMessage.message);
        }

        if (status.status === 'completed') {
          console.info('[usePolling] ✅ Task completed', { taskId: currentTaskIdRef.current });
          setResult(status.result ?? null);
          if (status.result !== undefined) {
            onComplete?.(status.result);
          }
          stopPolling();
          return; // Exit early to prevent further processing
        } else if (status.status === 'failed') {
          console.error('[usePolling] ❌ Task failed:', status.error);
          setError(status.error || 'Task failed');
          onError?.(status.error || 'Task failed');
          
          // Check if this is a subscription error and trigger modal
          if (status.error_status === 429 || status.error_status === 402 || status.error_status === 403) {
            console.log('usePolling: Detected subscription error in task status', {
              error_status: status.error_status,
              error_data: status.error_data,
              error: status.error
            });
            
            // Create a mock error object with the subscription error data
            const errorData = status.error_data || {};
            
            // Ensure usage_info is properly nested - it might be at the top level or nested
            const usageInfo = errorData.usage_info || 
                             (errorData.current_calls !== undefined ? errorData : null) ||
                             errorData;
            
            const mockError = {
              response: {
                status: status.error_status,
                data: {
                  error: errorData.error || status.error || 'Subscription limit exceeded',
                  message: errorData.message || errorData.error || status.error || 'You have reached your usage limit.',
                  provider: errorData.provider || usageInfo?.provider || 'unknown',
                  usage_info: usageInfo
                }
              }
            };
            
            console.log('usePolling: Triggering subscription error handler with:', mockError);
            const handled = await triggerSubscriptionError(mockError);
            
            if (!handled) {
              console.warn('usePolling: Subscription error handler did not handle the error');
            }
          }
          
          stopPolling();
          return; // Exit early to prevent further processing
        }

        attemptsRef.current++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Polling error:', errorMessage, err);
        
        // Check if this is an axios error with subscription limit status
        // This is a fallback in case the interceptor doesn't catch it
        const axiosError = err as any;
        if (axiosError?.response?.status === 429 || axiosError?.response?.status === 402 || axiosError?.response?.status === 403) {
          // Trigger subscription error handler (modal will show)
          // Note: The interceptor may have already called this, but we call it again to be safe
          const handled = await triggerSubscriptionError(axiosError);
          
          if (handled) {
            const errorMsg = axiosError.response?.data?.message || 
                           axiosError.response?.data?.error || 
                           'Subscription limit exceeded';
            setError(errorMsg);
            onError?.(errorMsg);
            stopPolling();
            return; // Exit early - don't continue processing
          } else {
            console.warn('[usePolling] Subscription error not handled by global handler');
            try {
              window.dispatchEvent(new CustomEvent('subscription-error', { detail: axiosError }));
            } catch (eventError) {
              console.error('usePolling: Failed to dispatch subscription-error event', eventError);
            }
          }
        }
        
        // Stop polling for task failures and rate limiting
        if (errorMessage.includes('404') || errorMessage.includes('Task not found')) {
          setError('Task not found - it may have expired or been cleaned up');
          onError?.('Task not found - it may have expired or been cleaned up');
          stopPolling();
        } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
          console.warn('Rate limited - stopping polling to prevent further issues');
          setError('Rate limited - please try again later');
          onError?.('Rate limited - please try again later');
          stopPolling();
        }
        // For other errors (timeouts, network issues), continue polling
        // The backend will eventually complete or fail, and we'll catch it
      }
    };

    // Start polling immediately, then at intervals
    poll();
    intervalRef.current = setInterval(poll, interval);
  }, [isPolling, interval, onProgress, onComplete, onError, pollFunction, stopPolling]);

  // Cleanup on unmount - only if actually polling
  // Use a ref to access the latest stopPolling function without triggering re-runs
  const stopPollingRef = useRef(stopPolling);
  useEffect(() => {
    stopPollingRef.current = stopPolling;
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      // Only call stopPolling if we have an active interval (actually polling)
      // This prevents unnecessary cleanup calls when component unmounts while idle
      if (intervalRef.current) {
        stopPollingRef.current();
      }
    };
  }, []); // Empty dependency array ensures this only runs on unmount

  return {
    isPolling,
    currentStatus,
    progressMessages,
    result,
    error,
    startPolling,
    stopPolling
  };
}

// Specialized hooks for specific operations
export function useResearchPolling(options: UsePollingOptions = {}) {
  // Use new Research Engine polling endpoint
  return usePolling(
    async (taskId: string): Promise<TaskStatusResponse> => {
      const response = await researchEngineApi.pollStatus(taskId);
      // Transform ResearchTaskStatusResponse to TaskStatusResponse
      return {
        task_id: taskId,
        status: response.status as 'pending' | 'running' | 'completed' | 'failed',
        created_at: new Date().toISOString(),
        progress_messages: response.progress_messages || [],
        result: response.result || undefined,
        error: response.error,
        error_status: response.error_status,
        error_data: response.error_data,
      };
    },
    options
  );
}

export function useBlogWriterResearchPolling(options: UsePollingOptions = {}) {
  // Use Blog Writer research polling endpoint - direct import (already imported at top)
  return usePolling(blogWriterApi.pollResearchStatus, options);
}

export function useOutlinePolling(options: UsePollingOptions = {}) {
  return usePolling(blogWriterApi.pollOutlineStatus, options);
}

export function useMediumGenerationPolling(options: UsePollingOptions = {}) {
  // Lazy import to avoid circular: poll function from mediumBlogApi
  const pollFn = (taskId: string) => import('../services/blogWriterApi').then(m => m.mediumBlogApi.pollMediumGeneration(taskId));
  // Wrap to satisfy type
  const wrapped = (taskId: string) => pollFn(taskId) as unknown as Promise<TaskStatusResponse>;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePolling(wrapped, options);
}

export function useRewritePolling(options: UsePollingOptions = {}) {
  // Lazy import to avoid circular: poll function from blogWriterApi
  const pollFn = (taskId: string) => import('../services/blogWriterApi').then(m => m.blogWriterApi.pollRewriteStatus(taskId));
  // Wrap to satisfy type
  const wrapped = (taskId: string) => pollFn(taskId) as unknown as Promise<TaskStatusResponse>;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePolling(wrapped, options);
}

export function useVideoGenerationPolling(options: UsePollingOptions = {}) {
  return usePolling(pollVideoTaskStatus, options);
}

export function useStoryOutlinePolling(options: UsePollingOptions = {}) {
  return usePolling(storyWriterApi.pollOutlineTaskStatus, options);
}
