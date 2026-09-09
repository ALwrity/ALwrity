import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOnboardingArtifactRestoreToast } from '../useOnboardingArtifactRestoreToast';
import { clearRestoreToastFlags } from '../onboardingArtifactRestoreMessage';

describe('useOnboardingArtifactRestoreToast', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearRestoreToastFlags();
  });

  it('shows restore toast when backend step has_data on active research step', async () => {
    const { result } = renderHook(() =>
      useOnboardingArtifactRestoreToast({
        loading: false,
        activeStep: 1,
        backendSteps: [{ step_number: 2, has_data: true }],
        isStartFreshSession: false,
        restoredSteps: [],
      })
    );

    await waitFor(() => {
      expect(result.current.restoreToast).toMatch(/competitor research/i);
    });
  });

  it('does not show restore toast during start-fresh session', async () => {
    const { result } = renderHook(() =>
      useOnboardingArtifactRestoreToast({
        loading: false,
        activeStep: 1,
        backendSteps: [{ step_number: 2, has_data: true }],
        isStartFreshSession: true,
        restoredSteps: [],
      })
    );

    await waitFor(() => {
      expect(result.current.restoreToast).toBeNull();
    });
  });
});
