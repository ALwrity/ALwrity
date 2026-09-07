import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOnboardingResumeMessage,
  type OnboardingResumeMessageInput,
} from './onboardingResumeMessage';

export const RESUME_TOAST_DISMISS_MS = 4000;

interface UseOnboardingResumeToastInput extends OnboardingResumeMessageInput {
  loading: boolean;
}

export function useOnboardingResumeToast({
  loading,
  completionPercentage,
  currentStep,
  totalSteps,
  isCompleted,
  stepLabels,
}: UseOnboardingResumeToastInput) {
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (loading || hasShownRef.current) {
      return;
    }

    const message = getOnboardingResumeMessage({
      completionPercentage,
      currentStep,
      totalSteps,
      isCompleted,
      stepLabels,
    });

    if (!message) {
      return;
    }

    hasShownRef.current = true;
    setResumeToast(message);

    const timer = window.setTimeout(() => {
      setResumeToast(null);
    }, RESUME_TOAST_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    completionPercentage,
    currentStep,
    totalSteps,
    isCompleted,
    stepLabels,
  ]);

  const dismissResumeToast = useCallback(() => {
    setResumeToast(null);
  }, []);

  return { resumeToast, dismissResumeToast };
}
