import { useEffect, useRef, useState } from 'react';
import { youtubeApi, type TaskStatus, type VideoPlan } from '../../../services/youtubeApi';
import { POLLING_INTERVAL_MS } from '../constants';

interface UsePlanPollingResult {
  planStatus: TaskStatus | null;
  planProgress: number;
  planMessage: string | null;
  error: string | null;
}

export const usePlanPolling = (
  planTaskId: string | null,
  onSuccess?: (plan: VideoPlan) => void,
  onError?: (error: string) => void
): UsePlanPollingResult => {
  const [planStatus, setPlanStatus] = useState<TaskStatus | null>(null);
  const [planProgress, setPlanProgress] = useState(0);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!planTaskId) {
      return;
    }

    const pollStatus = async () => {
      try {
        const status = await youtubeApi.getPlanStatus(planTaskId);
        if (!status) {
          const missingTaskMessage = 'Plan task not found. Please generate the plan again.';
          setError(missingTaskMessage);
          onError?.(missingTaskMessage);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        setPlanStatus(status);
        setPlanProgress(status.progress || 0);
        setPlanMessage(status.message || null);

        if (status.status === 'completed') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          const generatedPlan = status.result?.plan;
          if (!generatedPlan) {
            const missingPlanMessage = 'Plan generation completed, but no plan data was returned.';
            setError(missingPlanMessage);
            onError?.(missingPlanMessage);
            return;
          }

          onSuccess?.(generatedPlan as VideoPlan);
          return;
        }

        if (status.status === 'failed') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          const failureMessage =
            status.error ||
            status.message ||
            status.error_data?.message ||
            'Video plan generation failed. Please try again.';
          setError(failureMessage);
          onError?.(failureMessage);
        }
      } catch (pollError: any) {
        const pollMessage = pollError?.message || 'Failed to check plan generation status';
        setError(pollMessage);
        onError?.(pollMessage);
      }
    };

    pollStatus();
    intervalRef.current = setInterval(pollStatus, POLLING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [planTaskId, onSuccess, onError]);

  return { planStatus, planProgress, planMessage, error };
};

