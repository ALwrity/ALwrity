import { useState, useCallback, useEffect, useRef } from 'react';
import { longRunningApiClient } from '../../../../../api/client';
import {
  clearCalendarSession,
  syncCalendarSessionStorage,
} from '../../../../../services/calendarStorageKeys';
import type { CalendarSessionIdentity } from '../../../../../services/calendarSessionKey';

/** Backend session statuses (Phase 2 canonical + legacy aliases). */
export type CalendarSessionStatus =
  | 'initializing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'error'
  | 'processing';

/** Terminal statuses: polling stops immediately. */
export const CALENDAR_TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'error',
  'failed',
  'cancelled',
]);

/** Non-retryable HTTP statuses: auth/ownership/missing. */
const TERMINAL_HTTP_STATUSES = new Set([401, 403, 404]);

/**
 * Surface the most useful message from backend errors, including structured
 * 422 details ({message, next_step}) emitted by strategy-grounded endpoints.
 */
export function extractPollErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object') {
    const message = typeof detail.message === 'string' ? detail.message : '';
    const nextStep = typeof detail.next_step === 'string' ? detail.next_step : '';
    const combined = [message, nextStep].filter(Boolean).join(' ');
    if (combined.trim()) return combined;
  }
  const firstError = error?.response?.data?.errors?.[0];
  if (typeof firstError === 'string' && firstError.trim()) return firstError;
  if (firstError && typeof firstError.message === 'string' && firstError.message.trim()) {
    return firstError.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface CalendarPollingContext extends CalendarSessionIdentity {
  /** Persist resume state on start (default true). */
  persistResume?: boolean;
}

// Pure step-analysis helpers (module scope so the poll loop can use them).
function calculateOverallQualityScore(qualityScores: any): number {
  const stepScores = [];
  for (let i = 1; i <= 12; i++) {
    const stepKey = `step_${i.toString().padStart(2, '0')}`;
    const score = Number(qualityScores[stepKey] || qualityScores[`step${i}`] || 0);
    if (score > 0) {
      stepScores.push(score);
    }
  }
  return stepScores.length > 0 ? stepScores.reduce((a, b) => a + b, 0) / stepScores.length : 0;
}

function calculateCompletedSteps(stepResults: any): number {
  let completed = 0;
  for (const stepKey in stepResults) {
    if (stepResults[stepKey]?.status === 'completed') {
      completed++;
    }
  }
  return completed;
}

function calculateFailedSteps(stepResults: any): number {
  let failed = 0;
  for (const stepKey in stepResults) {
    if (stepResults[stepKey]?.status === 'error' || stepResults[stepKey]?.status === 'failed') {
      failed++;
    }
  }
  return failed;
}

/**
 * Normalize backend step-result keys (`step_01`, `step1`) to numeric keys
 * (`1`) so existing numeric lookups (`stepResults[12]`, `getStepStatus(7)`)
 * hit. Unknown keys pass through untouched.
 */
export function normalizeStepResults(stepResults: any): Record<number, StepResult> {
  const normalized: Record<string | number, StepResult> = {};
  if (!stepResults || typeof stepResults !== 'object') {
    return normalized as Record<number, StepResult>;
  }
  for (const key of Object.keys(stepResults)) {
    const match = /^step_?(\d{1,2})$/i.exec(key);
    if (match) {
      normalized[Number(match[1])] = stepResults[key];
    } else {
      const numeric = Number(key);
      normalized[Number.isInteger(numeric) ? numeric : key] = stepResults[key];
    }
  }
  return normalized as Record<number, StepResult>;
}

// Enhanced types for 12-step support
interface StepResult {
  stepNumber: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  qualityScore?: number;
  data?: any;
  /** Legacy payload key — prefer `data` when both are present. */
  results?: any;
  errors?: string[];
  warnings?: string[];
  metadata?: {
    dataSources?: string[];
    qualityGates?: string[];
    performanceMetrics?: Record<string, number>;
  };
}

interface QualityScores {
  overall: number;
  step1: number;
  step2: number;
  step3: number;
  step4: number;
  step5: number;
  step6: number;
  step7: number;
  step8: number;
  step9: number;
  step10: number;
  step11: number;
  step12: number;
}

interface CalendarGenerationProgress {
  // Backend session status (canonical enum) plus legacy step labels.
  status:
    | CalendarSessionStatus
    | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6'
    | 'step7' | 'step8' | 'step9' | 'step10' | 'step11' | 'step12';
  currentStep: number;
  stepProgress: number;
  overallProgress: number;
  
  // Enhanced step results with detailed typing
  stepResults: Record<number, StepResult>;
  
  // Quality and transparency data
  qualityScores: QualityScores;
  transparencyMessages: string[];
  educationalContent: any[];
  
  // Error handling
  errors: Array<{
    step?: number;
    message: string;
    timestamp: string;
    severity: 'error' | 'warning' | 'info';
    recoverable: boolean;
  }>;
  warnings: Array<{
    step?: number;
    message: string;
    timestamp: string;
    severity: 'warning' | 'info';
  }>;

  // Final generated calendar payload (backend orchestrator result) — present
  // only when generation reached a real 'completed' status.
  result?: any;
  
  // Enhanced metadata
  metadata?: {
    sessionId: string;
    startTime: string;
    estimatedCompletionTime?: string;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    averageStepDuration?: number;
    performanceMetrics?: {
      averageQualityScore: number;
      totalErrors: number;
      totalWarnings: number;
      dataSourceUtilization: Record<string, number>;
    };
  };
}

// Step information for UI display
export const STEP_INFO = {
  1: { name: 'Content Strategy Analysis', description: 'Analyzing content strategy and business goals' },
  2: { name: 'Gap Analysis', description: 'Identifying content gaps and opportunities' },
  3: { name: 'Audience & Platform Strategy', description: 'Defining audience personas and platform strategies' },
  4: { name: 'Calendar Framework', description: 'Creating calendar structure and timeline' },
  5: { name: 'Content Pillar Distribution', description: 'Distributing content pillars across timeline' },
  6: { name: 'Platform-Specific Strategy', description: 'Optimizing content for specific platforms' },
  7: { name: 'Weekly Theme Development', description: 'Generating weekly content themes' },
  8: { name: 'Daily Content Planning', description: 'Creating detailed daily content schedules' },
  9: { name: 'Content Recommendations', description: 'Generating AI-powered content recommendations' },
  10: { name: 'Performance Optimization', description: 'Optimizing content for maximum performance' },
  11: { name: 'Strategy Alignment Validation', description: 'Validating alignment with original strategy' },
  12: { name: 'Final Calendar Assembly', description: 'Assembling final calendar with all components' }
} as const;

// Polling hook for calendar generation progress with enhanced 12-step support.
// Single canonical poller: long-running client, abort + unmount guards,
// backend status enum, persisted resume key. Server remains source of truth.
const useCalendarGenerationPolling = (
  sessionId: string,
  sessionContext?: CalendarPollingContext
) => {
  const [progress, setProgress] = useState<CalendarGenerationProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Guards against duplicate poll loops: the modal effect re-invoking
  // startPolling (e.g. when its deps change) must not spawn parallel loops.
  const pollLoopRef = useRef<{ running: boolean }>({ running: false });
  // Phase 5: pending timer, in-flight request, and mount guards so unmount
  // never leaves a live loop or a setState-after-unmount behind.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pollLoopRef.current.running = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const schedulePoll = useCallback((fn: () => void, delayMs: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (pollLoopRef.current.running && mountedRef.current) fn();
    }, delayMs);
  }, []);

  const finishPolling = useCallback((message: string | null) => {
    pollLoopRef.current.running = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    abortRef.current?.abort();
    if (!mountedRef.current) return;
    setIsPolling(false);
    if (message !== null) setError(message);
  }, []);

  const startPolling = useCallback(async () => {
    console.log('🎯 Starting polling for session:', sessionId);
    if (pollLoopRef.current.running) {
      console.log('⏭️ Poll loop already running, skipping duplicate start');
      return;
    }
    pollLoopRef.current.running = true;
    if (!mountedRef.current) return;
    setIsPolling(true);
    setError(null);
    setRetryCount(0);
    if (sessionContext?.persistResume !== false && sessionId) {
      syncCalendarSessionStorage(sessionId, {
        strategyId: sessionContext?.strategyId,
        calendarType: sessionContext?.calendarType,
        strategyDigest: sessionContext?.strategyDigest,
      });
    }

    let localRetryCount = 0;

    const poll = async () => {
      try {
        console.log('🔄 Polling session:', sessionId);
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const response = await longRunningApiClient.get(
          `/api/content-planning/calendar-generation/progress/${sessionId}`,
          { signal: abortRef.current.signal }
        );
        
        const data = response.data;
        console.log('📊 Received progress data:', data);
        
        // Transform backend data to frontend format
        const transformedProgress: CalendarGenerationProgress = {
          status: data.status,
          currentStep: data.current_step || 0,
          stepProgress: data.step_progress || 0,
          overallProgress: data.overall_progress || 0,
          
          // Transform step results - backend sends step_01 strings;
          // normalize to numeric keys for existing panel lookups.
          stepResults: normalizeStepResults(data.step_results),
          
          // Transform quality scores - calculate overall from individual steps
          qualityScores: {
            overall: calculateOverallQualityScore(data.quality_scores || {}),
            step1: Number(data.quality_scores?.step_01 || data.quality_scores?.step1 || 0),
            step2: Number(data.quality_scores?.step_02 || data.quality_scores?.step2 || 0),
            step3: Number(data.quality_scores?.step_03 || data.quality_scores?.step3 || 0),
            step4: Number(data.quality_scores?.step_04 || data.quality_scores?.step4 || 0),
            step5: Number(data.quality_scores?.step_05 || data.quality_scores?.step5 || 0),
            step6: Number(data.quality_scores?.step_06 || data.quality_scores?.step6 || 0),
            step7: Number(data.quality_scores?.step_07 || data.quality_scores?.step7 || 0),
            step8: Number(data.quality_scores?.step_08 || data.quality_scores?.step8 || 0),
            step9: Number(data.quality_scores?.step_09 || data.quality_scores?.step9 || 0),
            step10: Number(data.quality_scores?.step_10 || data.quality_scores?.step10 || 0),
            step11: Number(data.quality_scores?.step_11 || data.quality_scores?.step11 || 0),
            step12: Number(data.quality_scores?.step_12 || data.quality_scores?.step12 || 0)
          },
          transparencyMessages: data.transparency_messages || [],
          educationalContent: data.educational_content || [],
          
          // Enhanced error handling
          errors: data.errors || [],
          warnings: data.warnings || [],

          // Final generated calendar payload (real backend result)
          result: data.result || undefined,
          
          // Enhanced metadata
          metadata: {
            sessionId,
            startTime: data.start_time || new Date().toISOString(),
            estimatedCompletionTime: data.estimated_completion_time,
            totalSteps: 12,
            completedSteps: calculateCompletedSteps(data.step_results || {}),
            failedSteps: calculateFailedSteps(data.step_results || {}),
            skippedSteps: 0,
            averageStepDuration: data.average_step_duration,
            performanceMetrics: data.performance_metrics
          }
        };
        
        if (!mountedRef.current || !pollLoopRef.current.running) return;
        console.log('✅ Transformed progress:', transformedProgress);
        setProgress(transformedProgress);
        setRetryCount(0); // Reset retry count on successful response

        // Terminal states use the backend session enum (failed/cancelled unified).
        if (CALENDAR_TERMINAL_STATUSES.has(String(data.status))) {
          console.log('🏁 Process completed with status:', data.status);
          if (data.status !== 'completed') {
            const firstError =
              data.errors?.[0]?.message ||
              (data.status === 'cancelled'
                ? 'Calendar generation was cancelled.'
                : 'Unknown error occurred');
            finishPolling(firstError);
          } else {
            finishPolling(null);
          }
          return;
        }

        // Continue polling every 2 seconds
        schedulePoll(poll, 2000);
      } catch (error) {
        if (!mountedRef.current || !pollLoopRef.current.running) return;
        console.error('❌ Calendar generation polling error:', error);

        // Aborted by stop/unmount: stay quiet, the loop is already over.
        if ((error as any)?.code === 'ERR_CANCELED' || (error as any)?.name === 'CanceledError') {
          return;
        }

        // Permanent auth/ownership/missing failures are terminal (no retry).
        const pollStatus = (error as any)?.response?.status;
        if (TERMINAL_HTTP_STATUSES.has(pollStatus)) {
          if (pollStatus === 404) clearCalendarSession();
          const terminalMessage =
            pollStatus === 401
              ? 'Session expired. Please refresh the page.'
              : pollStatus === 403
                ? 'Not authorized to view this session.'
                : 'Session not found or expired. Please start a new generation.';
          console.error(`⛔ Terminal polling status ${pollStatus} — stopping polling`);
          finishPolling(extractPollErrorMessage(error, terminalMessage));
          return;
        }

        // Implement exponential backoff for retries
        localRetryCount += 1;
        setRetryCount(localRetryCount);

        if (localRetryCount <= 5) {
          // Retry with exponential backoff: 5s, 10s, 20s, 40s, 80s
          const retryDelay = Math.min(5000 * Math.pow(2, localRetryCount - 1), 80000);
          console.log(`🔄 Retrying in ${retryDelay}ms (attempt ${localRetryCount}/5)`);
          schedulePoll(poll, retryDelay);
        } else {
          finishPolling(
            extractPollErrorMessage(error, 'Maximum retry attempts reached. Please refresh the page.')
          );
        }
      }
    };

    poll();
  }, [sessionId, sessionContext, finishPolling, schedulePoll]);

  const stopPolling = useCallback(() => {
    pollLoopRef.current.running = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    abortRef.current?.abort();
    if (mountedRef.current) setIsPolling(false);
  }, []);

  const resetPolling = useCallback(() => {
    pollLoopRef.current.running = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    abortRef.current?.abort();
    clearCalendarSession();
    if (!mountedRef.current) return;
    setIsPolling(false);
    setError(null);
    setRetryCount(0);
    setProgress(null);
  }, []);
  
  // Helper functions for step analysis
  const getStepStatus = useCallback((stepNumber: number) => {
    if (!progress) return 'pending';
    return progress.stepResults[stepNumber]?.status || 'pending';
  }, [progress]);
  
  const getStepQualityScore = useCallback((stepNumber: number) => {
    if (!progress) return 0;
    return progress.qualityScores[`step${stepNumber}` as keyof QualityScores] || 0;
  }, [progress]);
  
  const getCompletedSteps = useCallback(() => {
    if (!progress) return 0;
    return progress.metadata?.completedSteps || 0;
  }, [progress]);
  
  const getFailedSteps = useCallback(() => {
    if (!progress) return 0;
    return Object.values(progress.stepResults).filter(result => result.status === 'failed').length;
  }, [progress]);
  
  const getStepErrors = useCallback((stepNumber: number) => {
    if (!progress) return [];
    return progress.stepResults[stepNumber]?.errors || [];
  }, [progress]);
  
  const getStepWarnings = useCallback((stepNumber: number) => {
    if (!progress) return [];
    return progress.stepResults[stepNumber]?.warnings || [];
  }, [progress]);
  
  return {
    progress, 
    isPolling, 
    error, 
    retryCount,
    startPolling, 
    stopPolling, 
    resetPolling,
    getStepStatus,
    getStepQualityScore,
    getCompletedSteps,
    getFailedSteps,
    getStepErrors,
    getStepWarnings
  };
};

export default useCalendarGenerationPolling;
export type { CalendarGenerationProgress, QualityScores, StepResult };
