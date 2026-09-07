import { describe, it, expect } from 'vitest';
import {
  buildStepSavedSuccessMessage,
  getOnboardingResumeMessage,
} from './onboardingResumeMessage';

describe('onboardingResumeMessage', () => {
  describe('getOnboardingResumeMessage', () => {
    it('returns null for brand-new onboarding', () => {
      expect(
        getOnboardingResumeMessage({
          completionPercentage: 0,
          currentStep: 1,
          totalSteps: 4,
          isCompleted: false,
          stepLabels: ['Connect', 'Research', 'Personalization', 'Finish'],
        })
      ).toBeNull();
    });

    it('returns welcome-back copy with progress and current step label', () => {
      expect(
        getOnboardingResumeMessage({
          completionPercentage: 50,
          currentStep: 3,
          totalSteps: 4,
          isCompleted: false,
          stepLabels: ['Connect Platforms', 'Research', 'Personalization', 'Finish'],
        })
      ).toBe(
        "Welcome back! You're 50% through setup — continue at Personalization."
      );
    });

    it('returns null when onboarding is already complete', () => {
      expect(
        getOnboardingResumeMessage({
          completionPercentage: 100,
          currentStep: 4,
          totalSteps: 4,
          isCompleted: true,
          stepLabels: ['Connect', 'Research', 'Personalization', 'Finish'],
        })
      ).toBeNull();
    });
  });

  describe('buildStepSavedSuccessMessage', () => {
    it('builds a concise saved-progress toast message', () => {
      expect(buildStepSavedSuccessMessage(1, 4)).toBe(
        'Step saved — setup progress is now 25%.'
      );
    });
  });
});
