import { useState, useEffect, useCallback, useRef } from 'react';
import { aiApiClient } from '../api/client';

export interface PersonaTaskStatus {
  task_id: string;
  status: string; // 'pending', 'running', 'completed', 'failed'
  progress: number; // 0-100
  current_step: string;
  progress_messages: Array<{
    timestamp: string;
    message: string;
    progress?: number;
  }>;
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface UsePersonaPollingOptions {
  interval?: number; // Polling interval in milliseconds
  maxAttempts?: number; // Maximum number of polling attempts (default: 180 = 6 minutes at 2s interval)
  maxDuration?: number; // Maximum polling duration in milliseconds (default: 10 minutes)
  onProgress?: (message: string, progress: number) => void; // Callback for progress updates
  onComplete?: (result: any) => void; // Callback when task completes
  onError?: (error: string) => void; // Callback when task fails
}

export interface UsePersonaPollingReturn {
  isPolling: boolean;
  currentStatus: string;
  progress: number;
  currentStep: string;
  progressMessages: Array<{ timestamp: string; message: string; progress?: number }>;
  result: any;
  error: string | null;
  startPolling: (taskId: string) => void;
  stopPolling: () => void;
}

export function usePersonaPolling(options: UsePersonaPollingOptions = {}): UsePersonaPollingReturn {
  const {
    interval = 2000, // 2 seconds default
    maxAttempts = 180, // 6 minutes at 2s interval
    maxDuration = 600000, // 10 minutes in milliseconds
    onProgress,
    onComplete,
    onError
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progressMessages, setProgressMessages] = useState<Array<{ timestamp: string; message: string; progress?: number }>>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Debug state changes
  useEffect(() => {
    console.log('Persona polling state changed:', { 
      isPolling, 
      currentStatus, 
      progress, 
      currentStep,
      progressCount: progressMessages.length 
    });
  }, [isPolling, currentStatus, progress, currentStep, progressMessages.length]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  const currentTaskIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const stuckProgressRef = useRef<number>(0);
  const stuckCountRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    console.log('stopPersonaPolling called');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('Setting isPolling to false');
    setIsPolling(false);
    attemptsRef.current = 0;
    currentTaskIdRef.current = null;
    startTimeRef.current = 0;
    stuckProgressRef.current = 0;
    stuckCountRef.current = 0;
  }, []);

  const startPolling = useCallback((taskId: string) => {
    console.log('startPersonaPolling called with taskId:', taskId);
    if (isPolling) {
      console.log('Already polling, stopping first');
      stopPolling();
    }

    currentTaskIdRef.current = taskId;
    console.log('Setting isPolling to true');
    setIsPolling(true);
    setCurrentStatus('pending');
    setProgress(0);
    setCurrentStep('Initializing...');
    setProgressMessages([]);
    setResult(null);
    setError(null);
    attemptsRef.current = 0;
    startTimeRef.current = Date.now();
    stuckProgressRef.current = 0;
    stuckCountRef.current = 0;

    const poll = async () => {
      if (!currentTaskIdRef.current) {
        stopPolling();
        return;
      }

      // Check max attempts
      if (attemptsRef.current >= maxAttempts) {
        console.error('Persona polling: Max attempts reached');
        setError('Persona generation timed out - please try again later');
        onError?.('Persona generation timed out after maximum attempts');
        stopPolling();
        return;
      }

      // Check max duration
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= maxDuration) {
        console.error('Persona polling: Max duration reached');
        setError('Persona generation timed out - please try again later');
        onError?.('Persona generation exceeded maximum duration');
        stopPolling();
        return;
      }

      try {
        const response = await aiApiClient.get(`/api/onboarding/step4/persona-task/${currentTaskIdRef.current}`);
        const status: PersonaTaskStatus = response.data;
        
        console.log('Persona polling status update:', status);
        setCurrentStatus(status.status);
        setProgress(status.progress);
        setCurrentStep(status.current_step);

        // Detect stuck progress (same progress for 20+ consecutive polls = ~40 seconds)
        if (status.progress === stuckProgressRef.current) {
          stuckCountRef.current++;
          if (stuckCountRef.current >= 20) {
            console.error('Persona polling: Progress stuck at', status.progress, 'for too long');
            setError('Persona generation appears stuck - please try again or contact support');
            onError?.('Persona generation stuck - no progress for extended period');
            stopPolling();
            return;
          }
        } else {
          stuckProgressRef.current = status.progress;
          stuckCountRef.current = 0;
        }

        // Update progress messages
        if (status.progress_messages && status.progress_messages.length > 0) {
          console.log('Progress messages received:', status.progress_messages);
          setProgressMessages(status.progress_messages);
          
          // Call onProgress with the latest message
          const latestMessage = status.progress_messages[status.progress_messages.length - 1];
          console.log('Latest progress message:', latestMessage.message);
          onProgress?.(latestMessage.message, status.progress);
        }

        if (status.status === 'completed') {
          setResult(status.result);
          onComplete?.(status.result);
          // Trigger global usage stats refresh
          window.dispatchEvent(new Event('alwrity:refresh-usage'));
          stopPolling();
        } else if (status.status === 'failed') {
          setError(status.error || 'Persona generation failed');
          onError?.(status.error || 'Persona generation failed');
          stopPolling();
        }

        attemptsRef.current++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Persona polling error:', errorMessage);
        
        // Only stop polling for actual task failures (404, task not found)
        // For network errors, timeouts, etc., continue polling
        if (errorMessage.includes('404') || errorMessage.includes('Task not found')) {
          setError('Task not found - it may have expired or been cleaned up');
          onError?.('Task not found - it may have expired or been cleaned up');
          stopPolling();
        }
        // For other errors (timeouts, network issues), continue polling
        // The backend will eventually complete or fail, and we'll catch it
      }
    };

    // Start polling immediately, then at intervals
    poll();
    intervalRef.current = setInterval(poll, interval);
  }, [isPolling, interval, maxAttempts, maxDuration, onProgress, onComplete, onError, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    isPolling,
    currentStatus,
    progress,
    currentStep,
    progressMessages,
    result,
    error,
    startPolling,
    stopPolling
  };
}
