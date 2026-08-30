import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../api/queryClient';
import { fetchOnboardingTasksStatus, type OnboardingTasksStatusResponse } from '../api/onboarding';

export const ONBOARDING_TASKS_STATUS_KEY = ['onboarding', 'tasks', 'status'] as const;

export const ONBOARDING_RUNNING_CADENCE_MS = 15000;
export const ONBOARDING_PENDING_CADENCE_MS = 30000;

function onboardingTasksCadence(data: OnboardingTasksStatusResponse | undefined): number | false {
  if (!data) return ONBOARDING_RUNNING_CADENCE_MS;
  if (data.all_done) return false;
  const statuses = Object.values(data.tasks).map((t) => t?.status);
  if (statuses.includes('running')) return ONBOARDING_RUNNING_CADENCE_MS;
  if (statuses.includes('pending')) return ONBOARDING_PENDING_CADENCE_MS;
  return false;
}

export function invalidateOnboardingTasksStatus() {
  queryClient.invalidateQueries({ queryKey: ONBOARDING_TASKS_STATUS_KEY, exact: true });
}

export function useOnboardingTasksStatus(enabled: boolean = true) {
  return useQuery<OnboardingTasksStatusResponse>({
    queryKey: ONBOARDING_TASKS_STATUS_KEY,
    queryFn: fetchOnboardingTasksStatus,
    enabled,
    retry: 1,
    refetchInterval: (query) => onboardingTasksCadence(query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}