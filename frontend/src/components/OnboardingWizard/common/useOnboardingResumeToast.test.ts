import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RESUME_TOAST_DISMISS_MS,
  useOnboardingResumeToast,
} from './useOnboardingResumeToast';

describe('useOnboardingResumeToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows resume toast once when partial onboarding loads, then auto-dismisses', () => {
    const { result, rerender } = renderHook(
      (props) => useOnboardingResumeToast(props),
      {
        initialProps: {
          loading: true,
          completionPercentage: 50,
          currentStep: 3,
          totalSteps: 4,
          isCompleted: false,
          stepLabels: ['Connect Platforms', 'Research', 'Personalization', 'Finish'],
        },
      }
    );

    expect(result.current.resumeToast).toBeNull();

    rerender({
      loading: false,
      completionPercentage: 50,
      currentStep: 3,
      totalSteps: 4,
      isCompleted: false,
      stepLabels: ['Connect Platforms', 'Research', 'Personalization', 'Finish'],
    });

    expect(result.current.resumeToast).toBe(
      "Welcome back! You're 50% through setup — continue at Personalization."
    );

    act(() => {
      vi.advanceTimersByTime(RESUME_TOAST_DISMISS_MS);
    });

    expect(result.current.resumeToast).toBeNull();
  });

  it('does not show resume toast for brand-new onboarding', () => {
    const { result } = renderHook(() =>
      useOnboardingResumeToast({
        loading: false,
        completionPercentage: 0,
        currentStep: 1,
        totalSteps: 4,
        isCompleted: false,
        stepLabels: ['Connect Platforms', 'Research', 'Personalization', 'Finish'],
      })
    );

    expect(result.current.resumeToast).toBeNull();
  });

  it('allows manual dismiss before auto-dismiss', () => {
    const { result } = renderHook(() =>
      useOnboardingResumeToast({
        loading: false,
        completionPercentage: 25,
        currentStep: 2,
        totalSteps: 4,
        isCompleted: false,
        stepLabels: ['Connect Platforms', 'Research', 'Personalization', 'Finish'],
      })
    );

    expect(result.current.resumeToast).toContain('Welcome back');

    act(() => {
      result.current.dismissResumeToast();
    });

    expect(result.current.resumeToast).toBeNull();
  });
});
