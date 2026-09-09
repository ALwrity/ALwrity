import { describe, it, expect } from 'vitest';
import {
  shouldRestoreStepArtifacts,
  shouldSkipExpensiveStepRerun,
} from '../onboardingArtifactRestore';

describe('onboardingArtifactRestore', () => {
  describe('shouldRestoreStepArtifacts', () => {
    it('restores when has_data matches website and stepData is empty', () => {
      expect(
        shouldRestoreStepArtifacts({
          hasData: true,
          websiteMatch: true,
          isStartFreshSession: false,
          stepDataAlreadyHasPayload: false,
        })
      ).toBe(true);
    });

    it('does not restore during start-fresh session', () => {
      expect(
        shouldRestoreStepArtifacts({
          hasData: true,
          websiteMatch: true,
          isStartFreshSession: true,
          stepDataAlreadyHasPayload: false,
        })
      ).toBe(false);
    });

    it('does not restore when website mismatches', () => {
      expect(
        shouldRestoreStepArtifacts({
          hasData: true,
          websiteMatch: false,
          isStartFreshSession: false,
          stepDataAlreadyHasPayload: false,
        })
      ).toBe(false);
    });

    it('does not restore when stepData already has payload', () => {
      expect(
        shouldRestoreStepArtifacts({
          hasData: true,
          websiteMatch: true,
          isStartFreshSession: false,
          stepDataAlreadyHasPayload: true,
        })
      ).toBe(false);
    });

    it('does not restore when backend reports no data', () => {
      expect(
        shouldRestoreStepArtifacts({
          hasData: false,
          websiteMatch: true,
          isStartFreshSession: false,
          stepDataAlreadyHasPayload: false,
        })
      ).toBe(false);
    });
  });

  describe('shouldSkipExpensiveStepRerun', () => {
    it('skips rerun when restorable artifacts exist', () => {
      expect(
        shouldSkipExpensiveStepRerun({
          hasRestorableArtifacts: true,
          isStartFreshSession: false,
        })
      ).toBe(true);
    });

    it('does not skip on start-fresh', () => {
      expect(
        shouldSkipExpensiveStepRerun({
          hasRestorableArtifacts: true,
          isStartFreshSession: true,
        })
      ).toBe(false);
    });
  });
});
