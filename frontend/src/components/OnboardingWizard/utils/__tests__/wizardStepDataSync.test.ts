import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mergeBackendStepsIntoStepData } from '../wizardStepDataSync';
import {
  applyDownstreamDirtyProgressOverride,
  ONBOARDING_DOWNSTREAM_DIRTY_KEY,
} from '../onboardingWebsiteReset';

describe('wizardStepDataSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('merges downstream steps when has_data is true and dirty flag is clear', () => {
    const merged = mergeBackendStepsIntoStepData(
      [
        {
          step_number: 1,
          has_data: true,
          data: {
            website: 'https://www.alwrity.com',
            analysis: { id: 1 },
            email: 'user@example.com',
          },
        },
        {
          step_number: 2,
          has_data: true,
          data: {
            competitors: [{ url: 'https://competitor.com' }],
          },
        },
        {
          step_number: 3,
          has_data: true,
          data: {
            corePersona: { name: 'Voice' },
          },
        },
      ],
      {}
    );

    expect(merged.competitors).toHaveLength(1);
    expect(merged.corePersona).toEqual({ name: 'Voice' });
  });

  it('does not merge downstream backend steps while dirty flag is set', () => {
    localStorage.setItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY, 'true');

    const merged = mergeBackendStepsIntoStepData(
      [
        {
          step_number: 1,
          data: {
            website: 'https://old.com',
            analysis: { id: 1 },
            email: 'user@example.com',
          },
        },
        {
          step_number: 2,
          data: {
            competitors: [{ url: 'https://competitor.com' }],
          },
        },
        {
          step_number: 3,
          data: {
            corePersona: { name: 'Old persona' },
          },
        },
      ],
      { website: 'https://old.com' }
    );

    expect(merged.email).toBe('user@example.com');
    expect(merged.competitors).toBeUndefined();
    expect(merged.corePersona).toBeUndefined();
    expect(merged.analysis).toBeUndefined();
  });

  it('locks wizard progress to step 0 while dirty flag is set', () => {
    localStorage.setItem(ONBOARDING_DOWNSTREAM_DIRTY_KEY, 'true');

    const locked = applyDownstreamDirtyProgressOverride({
      percent: 75,
      completedCount: 3,
      completedFrontier: 2,
      furthestAccessibleStep: 2,
    });

    expect(locked).toEqual({
      percent: 0,
      completedCount: 0,
      completedFrontier: -1,
      furthestAccessibleStep: 0,
    });
  });
});
