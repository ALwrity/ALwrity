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
  maxDuration?: number; // Absolute safety net in ms (default: 30 minutes). The backend drives terminal state (completed/failed); this only guards against a truly hung backend.
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
    maxDuration = 1800000, // 30 minutes — generous safety net; backend drives terminal state
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
  const currentTaskIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    console.log('stopPersonaPolling called');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('Setting isPolling to false');
    setIsPolling(false);
    currentTaskIdRef.current = null;
    startTimeRef.current = 0;
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
    startTimeRef.current = Date.now();

    const poll = async () => {
      if (!currentTaskIdRef.current) {
        stopPolling();
        return;
      }

      // Absolute safety net against a truly hung backend. The backend drives
      // the terminal state (completed/failed) — including its own LLM timeout —
      // so this should only fire if the backend never responds.
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
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Persona polling error:', errorMessage);

        // A 404 means the task is gone (expired, or lost on a server restart).
        // Recover by falling back to the latest persisted persona instead of
        // surfacing a terminal error to the user.
        if (errorMessage.includes('404') || errorMessage.includes('Task not found')) {
          stopPolling();
          try {
            const resp = await aiApiClient.get('/api/onboarding/step4/persona-latest');
            const persona = resp.data?.persona;
            if (resp.data?.success && persona) {
              onComplete?.({
                success: true,
                core_persona: persona.core_persona,
                platform_personas: persona.platform_personas || {},
                quality_metrics: persona.quality_metrics || null,
                completeness: null,
                data_sufficiency: null,
              });
            } else {
              setError('Persona generation was lost. Please regenerate your persona.');
              onError?.('Persona generation was lost. Please regenerate your persona.');
            }
          } catch {
            setError('Persona generation was lost. Please regenerate your persona.');
            onError?.('Persona generation was lost. Please regenerate your persona.');
          }
          return;
        }
        // For other errors (timeouts, network issues), continue polling
        // The backend will eventually complete or fail, and we'll catch it
      }
    };

    // Start polling immediately, then at intervals
    poll();
    intervalRef.current = setInterval(poll, interval);
  }, [isPolling, interval, maxDuration, onProgress, onComplete, onError, stopPolling]);

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
