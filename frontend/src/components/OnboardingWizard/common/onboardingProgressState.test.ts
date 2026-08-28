import { describe, expect, it } from 'vitest';
import {
  getOnboardingProgressState,
  progressPercentAfterStepComplete,
} from './onboardingProgressState';

describe('getOnboardingProgressState', () => {
  it('returns zero progress for a fresh 4-step wizard', () => {
    const state = getOnboardingProgressState(0, 4, false);
    expect(state.percent).toBe(0);
    expect(state.completedCount).toBe(0);
    expect(state.completedFrontier).toBe(-1);
    expect(state.furthestAccessibleStep).toBe(0);
  });

  it('derives checkmarks and access from completion_percentage', () => {
    const state = getOnboardingProgressState(50, 4, false);
    expect(state.percent).toBe(50);
    expect(state.completedCount).toBe(2);
    expect(state.completedFrontier).toBe(1);
    expect(state.furthestAccessibleStep).toBe(2);
  });

  it('forces 100% when onboarding is completed', () => {
    const state = getOnboardingProgressState(75, 4, true);
    expect(state.percent).toBe(100);
    expect(state.completedCount).toBe(4);
    expect(state.completedFrontier).toBe(3);
    expect(state.furthestAccessibleStep).toBe(3);
  });

  it('rejects invalid totalSteps', () => {
    const state = getOnboardingProgressState(25, 0, false);
    expect(state.percent).toBe(0);
    expect(state.furthestAccessibleStep).toBe(0);
  });
});

describe('progressPercentAfterStepComplete', () => {
  it('matches backend complete_step formula', () => {
    expect(progressPercentAfterStepComplete(1, 4)).toBe(25);
    expect(progressPercentAfterStepComplete(2, 4)).toBe(50);
    expect(progressPercentAfterStepComplete(3, 4)).toBe(75);
    expect(progressPercentAfterStepComplete(4, 4)).toBe(100);
  });
});
