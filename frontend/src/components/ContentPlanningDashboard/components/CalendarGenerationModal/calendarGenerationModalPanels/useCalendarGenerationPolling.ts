import { useState, useCallback } from 'react';

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
  // Enhanced status to support all 12 steps
  status: 'initializing' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7' | 'step8' | 'step9' | 'step10' | 'step11' | 'step12' | 'completed' | 'error';
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

// Polling hook for calendar generation progress with enhanced 12-step support
const useCalendarGenerationPolling = (sessionId: string) => {
  const [progress, setProgress] = useState<CalendarGenerationProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const startPolling = useCallback(async () => {
    console.log('🎯 Starting polling for session:', sessionId);
    setIsPolling(true);
    setError(null);
    setRetryCount(0);
    
    const poll = async () => {
      try {
        console.log('🔄 Polling session:', sessionId);
        const response = await fetch(`/api/content-planning/calendar-generation/progress/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Received progress data:', data);
        
        // Transform backend data to frontend format
        const transformedProgress: CalendarGenerationProgress = {
          status: data.status,
          currentStep: data.current_step || 0,
          stepProgress: data.step_progress || 0,
          overallProgress: data.overall_progress || 0,
          
          // Transform step results - handle both formats
          stepResults: data.step_results || {},
          
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
        
        console.log('✅ Transformed progress:', transformedProgress);
        setProgress(transformedProgress);
        setRetryCount(0); // Reset retry count on successful response
        
        // Check for completion or error
        if (data.status === 'completed' || data.status === 'error') {
          console.log('🏁 Process completed with status:', data.status);
          setIsPolling(false);
          if (data.status === 'error') {
            const errorMessage = data.errors?.[0]?.message || 'Unknown error occurred';
            setError(errorMessage);
          }
          return;
        }
        
        // Continue polling every 2 seconds
        setTimeout(poll, 2000);
      } catch (error) {
        console.error('❌ Calendar generation polling error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Polling failed';
        setError(errorMessage);
        
        // Implement exponential backoff for retries
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        if (newRetryCount <= 5) {
          // Retry with exponential backoff: 5s, 10s, 20s, 40s, 80s
          const retryDelay = Math.min(5000 * Math.pow(2, newRetryCount - 1), 80000);
          console.log(`🔄 Retrying in ${retryDelay}ms (attempt ${newRetryCount}/5)`);
          setTimeout(poll, retryDelay);
        } else {
          setIsPolling(false);
          setError('Maximum retry attempts reached. Please refresh the page.');
        }
      }
    };
    
    poll();
  }, [sessionId, retryCount]);
  
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);
  
  const resetPolling = useCallback(() => {
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
  
  // Helper functions for data transformation
  const calculateOverallQualityScore = (qualityScores: any): number => {
    const stepScores = [];
    for (let i = 1; i <= 12; i++) {
      const stepKey = `step_${i.toString().padStart(2, '0')}`;
      const score = Number(qualityScores[stepKey] || qualityScores[`step${i}`] || 0);
      if (score > 0) {
        stepScores.push(score);
      }
    }
    return stepScores.length > 0 ? stepScores.reduce((a, b) => a + b, 0) / stepScores.length : 0;
  };
  
  const calculateCompletedSteps = (stepResults: any): number => {
    let completed = 0;
    for (const stepKey in stepResults) {
      if (stepResults[stepKey]?.status === 'completed') {
        completed++;
      }
    }
    return completed;
  };
  
  const calculateFailedSteps = (stepResults: any): number => {
    let failed = 0;
    for (const stepKey in stepResults) {
      if (stepResults[stepKey]?.status === 'error' || stepResults[stepKey]?.status === 'failed') {
        failed++;
      }
    }
    return failed;
  };
  
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
