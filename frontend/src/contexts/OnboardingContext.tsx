import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiClient } from '../api/client';
import { shouldSkipOnboarding } from '../utils/demoMode';

/**
 * Onboarding Context
 * 
 * Provides centralized onboarding state management across the application.
 * Eliminates redundant API calls by sharing state between components.
 * 
 * Features:
 * - Single API call on initialization
 * - Cached state shared across components
 * - Manual refresh capability
 * - Automatic state synchronization
 * - Loading and error states
 */

export interface OnboardingUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  clerk_user_id: string;
}

export interface OnboardingStep {
  step_number: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  has_data: boolean;
}

export interface OnboardingStatus {
  is_completed: boolean;
  current_step: number;
  completion_percentage: number;
  next_step: number | null;
  started_at: string;
  last_updated: string;
  completed_at: string | null;
  can_proceed_to_final: boolean;
  steps: OnboardingStep[];
}

export interface OnboardingSession {
  session_id: string;
  initialized_at: string;
}

export interface OnboardingData {
  user: OnboardingUser | null;
  onboarding: OnboardingStatus | null;
  session: OnboardingSession | null;
}

interface OnboardingContextValue {
  // State
  data: OnboardingData | null;
  loading: boolean;
  error: string | null;
  
  // Computed properties
  isOnboardingComplete: boolean;
  currentStep: number;
  completionPercentage: number;
  
  // Actions
  refresh: () => Promise<void>;
  markStepComplete: (stepNumber: number) => void;
  clearError: () => void;
  initializeOnboarding: () => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch onboarding data from batch endpoint
   */
  const fetchOnboardingData = useCallback(async () => {
    // Don't fetch if not signed in
    if (!isSignedIn) {
      console.log('OnboardingContext: User not signed in, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Skip onboarding fetch in demo mode - onboarding is disabled
      if (shouldSkipOnboarding()) {
        console.log('OnboardingContext: Skipping onboarding fetch in demo mode');
        setLoading(false);
        return;
      }
      
      console.log('OnboardingContext: Fetching onboarding data for authenticated user...');
      
      // Call batch init endpoint
      const response = await apiClient.get('/api/onboarding/init');
      const { user, onboarding, session } = response.data;
      
      console.log('OnboardingContext: Data fetched successfully', {
        user: user.id,
        step: onboarding.current_step,
        completed: onboarding.is_completed
      });
      
      // Update state
      setData({ user, onboarding, session });
      
      // Also cache in sessionStorage for backwards compatibility
      sessionStorage.setItem('onboarding_init', JSON.stringify(response.data));
      
      setLoading(false);
    } catch (err) {
      console.error('OnboardingContext: Error fetching data:', err);

      // Check if it's a connection error that should be handled at the app level
      if (err instanceof Error && (err.name === 'NetworkError' || err.name === 'ConnectionError')) {
        // Re-throw connection errors to be handled by the app-level error boundary
        throw err;
      }

      setError(err instanceof Error ? err.message : 'Failed to load onboarding data');
      setLoading(false);
    }
  }, [isSignedIn]);

  /**
   * Initialize when Clerk auth is loaded and user is signed in
   */
  useEffect(() => {
    if (!clerkLoaded) {
      console.log('OnboardingContext: Waiting for Clerk to load...');
      return;
    }

    console.log('OnboardingContext: Clerk loaded, isSignedIn:', isSignedIn);
    
    if (isSignedIn) {
      console.log('OnboardingContext: User signed in, but waiting for subscription check...');
      // Don't automatically fetch onboarding data - let InitialRouteHandler handle the flow
      setLoading(false);
    } else {
      console.log('OnboardingContext: User not signed in, skipping data fetch');
      setLoading(false);
    }
  }, [clerkLoaded, isSignedIn]);

  // Separate effect to fetch data when explicitly requested
  const initializeOnboarding = useCallback(() => {
    if (isSignedIn && clerkLoaded) {
      // Skip onboarding initialization in demo mode
      if (shouldSkipOnboarding()) {
        console.log('OnboardingContext: Skipping onboarding init in demo mode');
        setLoading(false);
        return;
      }
      console.log('OnboardingContext: Initializing onboarding data...');
      fetchOnboardingData();
    }
  }, [isSignedIn, clerkLoaded, fetchOnboardingData]);

  /**
   * Refresh onboarding data (e.g., after completing a step)
   */
  const refresh = useCallback(async () => {
    console.log('OnboardingContext: Refreshing data...');
    await fetchOnboardingData();
  }, [fetchOnboardingData]);

  /**
   * Mark a step as complete (optimistic update + refresh)
   */
  const markStepComplete = useCallback((stepNumber: number) => {
    if (!data || !data.onboarding) return;
    
    console.log(`OnboardingContext: Marking step ${stepNumber} as complete`);
    
    // Optimistic update
    setData(prevData => {
      if (!prevData || !prevData.onboarding) return prevData;
      
      const updatedSteps = prevData.onboarding.steps.map(step => 
        step.step_number === stepNumber
          ? { ...step, status: 'completed' as const, completed_at: new Date().toISOString() }
          : step
      );
      
      const completedSteps = updatedSteps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
      const completionPercentage = (completedSteps / updatedSteps.length) * 100;
      
      return {
        ...prevData,
        onboarding: {
          is_completed: prevData.onboarding.is_completed,
          current_step: Math.min(stepNumber + 1, updatedSteps.length),
          completion_percentage: completionPercentage,
          next_step: prevData.onboarding.next_step,
          started_at: prevData.onboarding.started_at,
          last_updated: new Date().toISOString(),
          completed_at: prevData.onboarding.completed_at,
          can_proceed_to_final: prevData.onboarding.can_proceed_to_final,
          steps: updatedSteps
        }
      };
    });
    
    // Refresh from backend to ensure consistency
    refresh();
  }, [data, refresh]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset onboarding progress and clear cache
   */
  const resetOnboarding = useCallback(() => {
    console.log('OnboardingContext: Resetting onboarding progress');
    
    // Clear all cached data
    sessionStorage.removeItem('onboarding_init');
    localStorage.removeItem('onboarding_step');
    localStorage.removeItem('onboarding_data');
    
    // Reset state
    setData(null);
    setError(null);
    setLoading(true);
    
    // Re-fetch fresh data
    fetchOnboardingData();
  }, [fetchOnboardingData]);

  /**
   * Computed properties
   */
  const isOnboardingComplete = shouldSkipOnboarding() || (data?.onboarding?.is_completed ?? false);
  const currentStep = data?.onboarding?.current_step ?? 1;
  const completionPercentage = data?.onboarding?.completion_percentage ?? 0;

  const value: OnboardingContextValue = {
    data,
    loading,
    error,
    isOnboardingComplete,
    currentStep,
    completionPercentage,
    refresh,
    markStepComplete,
    clearError,
    initializeOnboarding,
    resetOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

/**
 * Hook to use onboarding context
 * 
 * Usage:
 * const { data, loading, isOnboardingComplete, refresh } = useOnboarding();
 * 
 * if (loading) return <Loading />;
 * if (!isOnboardingComplete) return <Navigate to="/onboarding" />;
 */
export const useOnboarding = (): OnboardingContextValue => {
  const context = useContext(OnboardingContext);
  
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  
  return context;
};

/**
 * Hook to safely use onboarding context (returns null if not in provider)
 * 
 * Usage:
 * const onboarding = useOnboardingOptional();
 * if (onboarding) {
 *   // Use onboarding data
 * }
 */
export const useOnboardingOptional = (): OnboardingContextValue | null => {
  const context = useContext(OnboardingContext);
  return context ?? null;
};

export default OnboardingContext;

