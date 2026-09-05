/**
 * Verify loadTodayWorkflow probes /status first so the "no plan yet" case
 * never produces a 404 on the wire (neither axios-level nor the browser's
 * native network log). When /status reports generated=false, the workflow
 * endpoint must NOT be called.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api client module used by the store. workflowStore imports
// `aiApiClient as apiClient` from '../api/client'.
vi.mock('../../api/client', () => ({
  aiApiClient: {
    get: vi.fn(),
  },
}));

import { aiApiClient } from '../../api/client';
import { useWorkflowStore } from '../workflowStore';

const mockedGet = vi.mocked(aiApiClient.get);

describe('workflowStore — loadTodayWorkflow: /status probe prevents 404', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state between tests.
    useWorkflowStore.setState({
      currentWorkflow: null,
      workflowProgress: null,
      navigationState: null,
      scheduleStatus: null,
      isLoading: false,
      error: null,
      isDegradedMode: false,
      degradedModeReason: null,
      lastCachedAt: null,
    });
  });

  it('does NOT call the workflow endpoint when /status reports generated=false', async () => {
    // /status returns 200 with generated=false (the "no plan yet" case).
    mockedGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          date: '2026-09-05',
          generated: false,
          scheduled_run_completed: false,
          source: null,
          created_at: null,
          skip_reason: 'Not yet generated — workflows run daily at 3:00 UTC.',
        },
      },
    });

    await useWorkflowStore.getState().loadTodayWorkflow();

    // Only /status should have been called.
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/today-workflow/status',
      expect.objectContaining({ params: expect.any(Object) }),
    );

    // The workflow endpoint must NOT have been called → no 404 on the wire.
    const calledUrls = mockedGet.mock.calls.map((c) => c[0]);
    expect(calledUrls).not.toContain('/api/today-workflow');

    // Store should reflect the empty state with scheduleStatus from the probe.
    const state = useWorkflowStore.getState();
    expect(state.currentWorkflow).toBeNull();
    expect(state.workflowProgress).toBeNull();
    expect(state.navigationState).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.scheduleStatus).toEqual(
      expect.objectContaining({ generated: false, skip_reason: expect.any(String) }),
    );
  });

  it('fetches the workflow when /status reports generated=true', async () => {
    mockedGet
      // First call: /status probe → generated=true
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            date: '2026-09-05',
            generated: true,
            scheduled_run_completed: true,
            source: 'scheduled',
            created_at: '2026-09-05T03:00:00Z',
            skip_reason: null,
          },
        },
      })
      // Second call: /today-workflow → full data
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            workflow: {
              id: 'daily-123',
              tasks: [
                { id: 't1', title: 'Task 1', status: 'pending' },
              ],
            },
            plan: { provenance_summary: 'auto' },
            schedule_status: { generated: true },
          },
        },
      });

    await useWorkflowStore.getState().loadTodayWorkflow();

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(mockedGet.mock.calls[0][0]).toBe('/api/today-workflow/status');
    expect(mockedGet.mock.calls[1][0]).toBe('/api/today-workflow');

    const state = useWorkflowStore.getState();
    expect(state.currentWorkflow).not.toBeNull();
    expect(state.currentWorkflow?.id).toBe('daily-123');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('treats unexpected /status shape (no data) as empty without calling workflow endpoint', async () => {
    mockedGet.mockResolvedValueOnce({ data: {} });

    await useWorkflowStore.getState().loadTodayWorkflow();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    const state = useWorkflowStore.getState();
    expect(state.currentWorkflow).toBeNull();
    expect(state.error).toBeNull();
  });
});
