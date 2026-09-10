import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearRestoreToastFlags,
  getArtifactRestoreMessage,
  hasRestoreToastBeenShown,
  mapFrontendStepToArtifactStep,
  markRestoreToastShown,
} from '../onboardingArtifactRestoreMessage';

describe('onboardingArtifactRestoreMessage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearRestoreToastFlags();
  });

  it('maps frontend steps to artifact steps', () => {
    expect(mapFrontendStepToArtifactStep(0)).toBe('connect');
    expect(mapFrontendStepToArtifactStep(1)).toBe('research');
    expect(mapFrontendStepToArtifactStep(2)).toBe('personalization');
    expect(mapFrontendStepToArtifactStep(3)).toBeNull();
  });

  it('returns step-specific restore messages', () => {
    expect(getArtifactRestoreMessage('research')).toMatch(/competitor research/i);
  });

  it('tracks restore toast shown state per step', () => {
    expect(hasRestoreToastBeenShown('research')).toBe(false);
    markRestoreToastShown('research');
    expect(hasRestoreToastBeenShown('research')).toBe(true);
  });
});
