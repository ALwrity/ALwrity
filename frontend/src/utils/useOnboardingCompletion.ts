/**
 * Onboarding completion hook for Main Dashboard.
 * Detects when onboarding is complete and strategy is not active to trigger CTA.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchOnboardingTasksStatus } from '../api/onboarding';

interface OnboardingCompletionState {
  hasCompletedOnboarding: boolean;
  hasActiveStrategy: boolean;
  onboardingDataAvailable: boolean;
  loading: boolean;
  error: string | null;
}

export const useOnboardingCompletion = (): OnboardingCompletionState => {
  const [state, setState] = useState<OnboardingCompletionState>({
    hasCompletedOnboarding: false,
    hasActiveStrategy: false,
    onboardingDataAvailable: false,
    loading: true,
    error: null,
  });

  const fetchOnboardingStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetchOnboardingTasksStatus();
      
      // Extract onboarding status from response
      // Backend returns has_completed_onboarding, has_active_strategy, onboarding_data_available
      const hasCompletedOnboarding = (response as any).has_completed_onboarding || false;
      const hasActiveStrategy = (response as any).has_active_strategy || false;
      const onboardingDataAvailable = (response as any).onboarding_data_available !== false;
      
      setState({
        hasCompletedOnboarding,
        hasActiveStrategy,
        onboardingDataAvailable,
        loading: false,
        error: null,
      });
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch onboarding status',
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    fetchOnboardingStatus();
    
    // Refetch every 30 seconds while component is mounted
    const interval = setInterval(() => {
      fetchOnboardingStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchOnboardingStatus]);

  return state;
};