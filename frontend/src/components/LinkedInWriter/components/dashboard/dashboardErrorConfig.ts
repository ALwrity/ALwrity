import type { LinkedInProfileAnalysisError } from '../../../../api/linkedinSocial';

export interface DashboardErrorConfig {
  error: LinkedInProfileAnalysisError;
  onRetry?: () => void;
  isRetrying?: boolean;
  title?: string;
  /** Stable key for dismiss tracking */
  key: string;
}

export function buildDashboardErrorConfig(input: {
  centered: boolean;
  foundationStatus: string;
  foundationError: LinkedInProfileAnalysisError | null;
  optimizationPanelState: string;
  optimizationError: LinkedInProfileAnalysisError | null;
  optimizationUserError: string | null;
  topicState: string;
  topicError: LinkedInProfileAnalysisError | null;
  submitError: string | null;
  recommendationsError: string | null;
  onRetryFoundation: () => void;
  onRetryOptimization: () => void;
  onRetryTopic: () => void;
  isOptimizationLoading: boolean;
  isAnalyzing: boolean;
}): DashboardErrorConfig | null {
  if (!input.centered) return null;

  if (
    input.optimizationPanelState === 'error' &&
    (input.optimizationError || input.optimizationUserError)
  ) {
    const error =
      input.optimizationError ??
      ({
        failed_phase: 7,
        phase_label: 'Profile Optimization',
        error_code: 'optimization_failed',
        user_message:
          input.optimizationUserError ??
          "We couldn't load profile suggestions right now. Please try again.",
      } as LinkedInProfileAnalysisError);

    return {
      error,
      onRetry: input.onRetryOptimization,
      isRetrying: input.isOptimizationLoading,
      title: 'Profile optimisation',
      key: `opt-${error.error_code}-${error.user_message}`,
    };
  }

  if (input.optimizationUserError && input.optimizationPanelState === 'complete') {
    const error: LinkedInProfileAnalysisError = {
      failed_phase: 7,
      phase_label: 'Profile Optimization',
      error_code: 'batch_progression_failed',
      user_message: input.optimizationUserError,
    };
    return {
      error,
      onRetry: input.onRetryOptimization,
      title: 'Profile optimisation',
      key: `opt-batch-${error.user_message}`,
    };
  }

  if (input.foundationStatus === 'error' && input.foundationError) {
    return {
      error: input.foundationError,
      onRetry: input.onRetryFoundation,
      title: 'Profile setup',
      key: `foundation-${input.foundationError.error_code}`,
    };
  }

  if (input.topicState === 'error' && input.topicError) {
    return {
      error: input.topicError,
      onRetry: input.onRetryTopic,
      isRetrying: input.isAnalyzing,
      title: 'Topic ideas',
      key: `topic-${input.topicError.error_code}`,
    };
  }

  if (input.submitError) {
    return {
      error: {
        failed_phase: 0,
        phase_label: 'Profile completion',
        error_code: 'submit_failed',
        user_message: input.submitError,
      },
      title: 'Profile completion',
      key: `submit-${input.submitError}`,
    };
  }

  if (input.recommendationsError) {
    return {
      error: {
        failed_phase: 6,
        phase_label: 'Topic recommendations',
        error_code: 'recommendations_failed',
        user_message: input.recommendationsError,
      },
      onRetry: input.onRetryTopic,
      isRetrying: input.isAnalyzing,
      title: 'Topic ideas',
      key: `rec-${input.recommendationsError}`,
    };
  }

  return null;
}
