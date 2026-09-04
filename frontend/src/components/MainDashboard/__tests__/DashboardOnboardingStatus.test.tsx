import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardingCompletion } from '../../../utils/useOnboardingCompletion';

// Mock the API module
vi.mock('../../../api/onboarding', () => ({
  fetchOnboardingTasksStatus: vi.fn(),
}));

import { fetchOnboardingTasksStatus } from '../../../api/onboarding';

describe('useOnboardingCompletion Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct state when onboarding is complete and no strategy exists', async () => {
    vi.mocked(fetchOnboardingTasksStatus).mockResolvedValue({
      tasks: {},
      total: 0,
      completed_count: 0,
      failed_count: 0,
      all_done: false,
      has_completed_onboarding: true,
      has_active_strategy: false,
      onboarding_data_available: true,
    });

    const { result } = renderHook(() => useOnboardingCompletion());

    // Initial state
    expect(result.current.loading).toBe(true);

    // Wait for the hook to finish
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(result.current.hasActiveStrategy).toBe(false);
    expect(result.current.onboardingDataAvailable).toBe(true);
  });

  it('returns correct state when strategy already exists', async () => {
    vi.mocked(fetchOnboardingTasksStatus).mockResolvedValue({
      tasks: {},
      total: 0,
      completed_count: 0,
      failed_count: 0,
      all_done: false,
      has_completed_onboarding: true,
      has_active_strategy: true,
      onboarding_data_available: true,
    });

    const { result } = renderHook(() => useOnboardingCompletion());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(result.current.hasActiveStrategy).toBe(true);
  });

  it('handles errors gracefully', async () => {
    vi.mocked(fetchOnboardingTasksStatus).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOnboardingCompletion());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });
});