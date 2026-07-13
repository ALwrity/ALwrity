import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  TodayTask, 
  DailyWorkflow, 
  WorkflowProgress, 
  UserWorkflowPreferences,
  NavigationState,
  WorkflowStatus,
  WorkflowError,
  TodayWorkflowScheduleStatus
} from '../types/workflow';
import { taskWorkflowOrchestrator } from '../services/TaskWorkflowOrchestrator';
import { aiApiClient as apiClient } from '../api/client';

const isServerWorkflowId = (workflowId: string) => workflowId.startsWith('daily-');
const DAILY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours


const normalizeDependencies = (dependencies: unknown): string[] => {
  if (Array.isArray(dependencies)) {
    return dependencies.map(dep => String(dep).trim()).filter(Boolean);
  }

  if (typeof dependencies === 'string') {
    const raw = dependencies.trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(dep => String(dep).trim()).filter(Boolean);
      }
    } catch {}

    return [raw];
  }

  return [];
};

const normalizeServerWorkflow = (workflow: DailyWorkflow): DailyWorkflow => ({
  ...workflow,
  tasks: Array.isArray(workflow.tasks)
    ? workflow.tasks.map(task => ({
        ...task,
        dependencies: normalizeDependencies(task.dependencies),
      }))
    : [],
});

const toWorkflowError = (error: unknown, fallbackMessage: string): WorkflowError => {
  if (error instanceof WorkflowError) return error;

  const message = error instanceof Error ? error.message : fallbackMessage;
  return new WorkflowError({
    code: 'WORKFLOW_ERROR',
    message,
    timestamp: new Date(),
    recoverable: false,
  });
};

const computeProgressAndNavigation = (workflow: DailyWorkflow): { progress: WorkflowProgress; navigation: NavigationState } => {
  const tasks = Array.isArray(workflow.tasks) ? workflow.tasks : [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'skipped').length;
  const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const currentIndex = (() => {
    if (typeof workflow.currentTaskIndex === 'number' && workflow.currentTaskIndex >= 0 && workflow.currentTaskIndex < totalTasks) {
      return workflow.currentTaskIndex;
    }
    const idx = tasks.findIndex(t => t.status !== 'completed' && t.status !== 'skipped');
    return idx >= 0 ? idx : Math.max(0, totalTasks - 1);
  })();

  const currentTask = tasks[currentIndex] || null;
  const nextTask = tasks.slice(currentIndex + 1).find(t => t.status !== 'completed' && t.status !== 'skipped') || null;
  const previousTask = currentIndex > 0 ? tasks[currentIndex - 1] : null;

  const estimatedTimeRemaining = tasks
    .filter(t => t.status !== 'completed' && t.status !== 'skipped')
    .reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

  return {
    progress: {
      completedTasks,
      totalTasks,
      completionPercentage,
      currentTask: currentTask || undefined,
      nextTask: nextTask || undefined,
      estimatedTimeRemaining,
      actualTimeSpent: workflow.actualTimeSpent || 0,
    },
    navigation: {
      currentTask,
      previousTask,
      nextTask,
      canGoBack: currentIndex > 0,
      canGoForward: Boolean(nextTask),
    }
  };
};

interface WorkflowState {
  // Current workflow state
  currentWorkflow: DailyWorkflow | null;
  workflowProgress: WorkflowProgress | null;
  navigationState: NavigationState | null;
  scheduleStatus: TodayWorkflowScheduleStatus | null;
  
  // User preferences
  userPreferences: UserWorkflowPreferences | null;
  
  // UI state
  isWorkflowModalOpen: boolean;
  isLoading: boolean;
  error: WorkflowError | null;
  generationProgress: string | null;
  isDegradedMode: boolean;
  degradedModeReason: string | null;
  lastCachedAt: number | null;
  
  // Actions
  loadTodayWorkflow: (date?: string, workflowType?: string) => Promise<void>;
  refreshScheduleStatus: (date?: string) => Promise<void>;
  generateDailyWorkflow: (userId: string, date?: string, workflowType?: string) => Promise<void>;
  startWorkflow: (workflowId: string) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  stopWorkflow: (workflowId: string) => Promise<void>;
  completeTask: (taskId: string, completionData?: any) => Promise<void>;
  skipTask: (taskId: string) => Promise<void>;
  moveToNextTask: () => Promise<void>;
  moveToPreviousTask: () => Promise<void>;
  
  // UI actions
  openWorkflowModal: () => void;
  closeWorkflowModal: () => void;
  setError: (error: WorkflowError | null) => void;
  clearError: () => void;
  
  // Preferences
  updateUserPreferences: (preferences: Partial<UserWorkflowPreferences>) => void;
  
  // Utility actions
  refreshWorkflowProgress: () => void;
  getCurrentTask: () => TodayTask | null;
  getNextTask: () => TodayTask | null;
  isWorkflowComplete: () => boolean;
  getCompletionPercentage: () => number;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentWorkflow: null,
      workflowProgress: null,
      navigationState: null,
      scheduleStatus: null,
      userPreferences: null,
      isWorkflowModalOpen: false,
      isLoading: false,
      error: null,
      generationProgress: null,
      isDegradedMode: false,
      degradedModeReason: null,
      lastCachedAt: null,

      loadTodayWorkflow: async (date?: string, workflowType?: string) => {
        const { currentWorkflow, lastCachedAt } = get();
        if (currentWorkflow && lastCachedAt && (Date.now() - lastCachedAt < DAILY_CACHE_TTL)) {
          const requestedDate = date || new Date().toISOString().slice(0, 10);
          if (currentWorkflow.date === requestedDate) {
            return;
          }
        }

        set({ isLoading: true, error: null });

        try {
          const params: Record<string, string> = {};
          if (date) params.date = date;
          if (workflowType) params.workflow_type = workflowType;
          const resp = await apiClient.get('/api/today-workflow', { params });
          const serverWorkflow = resp?.data?.data?.workflow as DailyWorkflow | undefined;
          const planSummary = resp?.data?.data?.plan?.provenance_summary;
          const scheduleStatus = resp?.data?.data?.schedule_status as TodayWorkflowScheduleStatus | undefined;

          if (serverWorkflow && Array.isArray(serverWorkflow.tasks)) {
            if (planSummary && !serverWorkflow.provenanceSummary) {
              serverWorkflow.provenanceSummary = planSummary;
            }
            const normalizedWorkflow = normalizeServerWorkflow(serverWorkflow);
            const derived = computeProgressAndNavigation(normalizedWorkflow);
            set({
              currentWorkflow: normalizedWorkflow,
              workflowProgress: derived.progress,
              navigationState: derived.navigation,
              scheduleStatus: scheduleStatus || null,
              isLoading: false,
              isDegradedMode: false,
              degradedModeReason: null,
              lastCachedAt: Date.now(),
            });
            return;
          }

          throw new WorkflowError({
            code: 'WORKFLOW_SCHEMA_INVALID',
            message: 'Server workflow response is missing a valid tasks array.',
            timestamp: new Date(),
            recoverable: false,
            suggestedAction: 'Refresh and try again. If this persists, contact support.'
          });
        } catch (error: any) {
          if (error?.response?.status === 404) {
            set({
              currentWorkflow: null,
              workflowProgress: null,
              navigationState: null,
              isLoading: false,
              isDegradedMode: false,
              degradedModeReason: null,
              lastCachedAt: null,
            });
            await get().refreshScheduleStatus(date);
            return;
          }

          set({
            error: toWorkflowError(error, 'Failed to load workflow from server.'),
            isLoading: false,
            isDegradedMode: false,
            degradedModeReason: null,
          });
        }
      },

      refreshScheduleStatus: async (date?: string) => {
        try {
          const resp = await apiClient.get('/api/today-workflow/status', { params: date ? { date } : {} });
          const scheduleStatus = resp?.data?.data as TodayWorkflowScheduleStatus | undefined;
          set({ scheduleStatus: scheduleStatus || null });
        } catch {
          set({ scheduleStatus: null });
        }
      },

      // Generate daily workflow
      generateDailyWorkflow: async (userId: string, date?: string, workflowType?: string) => {
        set({ isLoading: true, error: null, generationProgress: "Starting..." });
        
        try {
          const params: Record<string, string> = {};
          if (date) params.date = date;
          if (workflowType) params.workflow_type = workflowType;

          // Poll progress while generation runs
          const pollDate = date || new Date().toISOString().slice(0, 10);
          const abortCtrl = new AbortController();
          let resp: any;

          const pollProgress = async () => {
            while (!abortCtrl.signal.aborted) {
              await new Promise(r => setTimeout(r, 2000));
              if (abortCtrl.signal.aborted) break;
              try {
                const p = await apiClient.get('/api/today-workflow/progress', { params: { date: pollDate } });
                const msg = p?.data?.progress as string | undefined;
                if (msg) set({ generationProgress: msg });
              } catch { /* ignore polling errors */ }
            }
          };
          pollProgress();

          try {
            resp = await apiClient.post('/api/today-workflow/generate', null, { params });
          } finally {
            abortCtrl.abort();
            set({ generationProgress: null });
          }

          const serverWorkflow = resp?.data?.data?.workflow as DailyWorkflow | undefined;
          const planSummary = resp?.data?.data?.plan?.provenance_summary;
          const scheduleStatus = resp?.data?.data?.schedule_status as TodayWorkflowScheduleStatus | undefined;
          
          if (serverWorkflow && Array.isArray(serverWorkflow.tasks)) {
            if (planSummary && !serverWorkflow.provenanceSummary) {
              serverWorkflow.provenanceSummary = planSummary;
            }
            const normalizedWorkflow = normalizeServerWorkflow(serverWorkflow);
            const derived = computeProgressAndNavigation(normalizedWorkflow);
            set({
              currentWorkflow: normalizedWorkflow,
              workflowProgress: derived.progress,
              navigationState: derived.navigation,
              scheduleStatus: scheduleStatus || null,
              isLoading: false,
              isDegradedMode: false,
              degradedModeReason: null,
              lastCachedAt: Date.now(),
            });
            return;
          }

          throw new WorkflowError({
            code: 'WORKFLOW_SCHEMA_INVALID',
            message: 'Server workflow response is missing a valid tasks array.',
            timestamp: new Date(),
            recoverable: false,
            suggestedAction: 'Refresh and try again. If this persists, contact support.'
          });
        } catch (error) {
          set({
            error: toWorkflowError(error, 'Failed to generate workflow from server.'),
            generationProgress: null,
            isLoading: false,
            isDegradedMode: false,
            degradedModeReason: null,
            lastCachedAt: null,
          });
        }
      },

      // Start workflow
      startWorkflow: async (workflowId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const current = get().currentWorkflow;
          if (current && current.id === workflowId && isServerWorkflowId(workflowId)) {
            const tasks = current.tasks.map((t, idx) => {
              if (idx === current.currentTaskIndex && t.status === 'pending') {
                return { ...t, status: 'in_progress' as const, startedAt: new Date() };
              }
              return t;
            });
            const updated: DailyWorkflow = { ...current, workflowStatus: 'in_progress', startedAt: new Date(), tasks };
            const derived = computeProgressAndNavigation(updated);
            set({ currentWorkflow: updated, workflowProgress: derived.progress, navigationState: derived.navigation, isLoading: false });
            return;
          }

          const workflow = await taskWorkflowOrchestrator.startWorkflow(workflowId);
          const progress = taskWorkflowOrchestrator.getWorkflowProgress(workflow.id);
          const navigation = taskWorkflowOrchestrator.getNavigationState(workflow.id);
          set({ currentWorkflow: workflow, workflowProgress: progress, navigationState: navigation, isLoading: false });
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // Pause workflow
      pauseWorkflow: async (workflowId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // For now, we'll just update the workflow status to paused
          // In a real implementation, this would call the orchestrator
          const currentWorkflow = get().currentWorkflow;
          if (currentWorkflow && currentWorkflow.id === workflowId) {
            const pausedWorkflow = {
              ...currentWorkflow,
              workflowStatus: 'paused' as const,
              pausedAt: new Date()
            };
            
            set({
              currentWorkflow: pausedWorkflow,
              isLoading: false
            });
          }
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // Stop workflow
      stopWorkflow: async (workflowId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // For now, we'll just update the workflow status to stopped
          // In a real implementation, this would call the orchestrator
          const currentWorkflow = get().currentWorkflow;
          if (currentWorkflow && currentWorkflow.id === workflowId) {
            const stoppedWorkflow = {
              ...currentWorkflow,
              workflowStatus: 'stopped' as const,
              completedAt: new Date()
            };
            
            set({
              currentWorkflow: stoppedWorkflow,
              isLoading: false
            });
          }
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // Complete task
      completeTask: async (taskId: string, completionData?: any) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({ isLoading: true, error: null });
        
        try {
          if (isServerWorkflowId(currentWorkflow.id)) {
            await apiClient.post(`/api/today-workflow/tasks/${taskId}/status`, {
              status: 'completed',
              completion_notes: completionData?.userNotes
            });

            const tasks = currentWorkflow.tasks.map(t => (t.id === taskId ? { ...t, status: 'completed' as const, completedAt: new Date() } : t));
            const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'skipped').length;
            const totalTasks = tasks.length;
            const workflowStatus: WorkflowStatus = totalTasks > 0 && completedTasks === totalTasks ? 'completed' : 'in_progress';
            const updated: DailyWorkflow = {
              ...currentWorkflow,
              tasks,
              completedTasks,
              totalTasks,
              workflowStatus,
              completedAt: workflowStatus === 'completed' ? new Date() : currentWorkflow.completedAt,
            };
            const derived = computeProgressAndNavigation(updated);
            set({ currentWorkflow: updated, workflowProgress: derived.progress, navigationState: derived.navigation, isLoading: false });
            return;
          }

          const progress = await taskWorkflowOrchestrator.completeTask(currentWorkflow.id, taskId, completionData);
          const navigation = taskWorkflowOrchestrator.getNavigationState(currentWorkflow.id);
          const updatedWorkflow = taskWorkflowOrchestrator.getWorkflow(currentWorkflow.userId, currentWorkflow.date);
          set({ currentWorkflow: updatedWorkflow, workflowProgress: progress, navigationState: navigation, isLoading: false });
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // Skip task
      skipTask: async (taskId: string) => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({ isLoading: true, error: null });
        
        try {
          if (isServerWorkflowId(currentWorkflow.id)) {
            await apiClient.post(`/api/today-workflow/tasks/${taskId}/status`, { status: 'skipped' });
            const tasks = currentWorkflow.tasks.map(t => (t.id === taskId ? { ...t, status: 'skipped' as const, completedAt: new Date() } : t));
            const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'skipped').length;
            const totalTasks = tasks.length;
            const workflowStatus: WorkflowStatus = totalTasks > 0 && completedTasks === totalTasks ? 'completed' : currentWorkflow.workflowStatus;
            const updated: DailyWorkflow = { ...currentWorkflow, tasks, completedTasks, totalTasks, workflowStatus };
            const derived = computeProgressAndNavigation(updated);
            set({ currentWorkflow: updated, workflowProgress: derived.progress, navigationState: derived.navigation, isLoading: false });
            return;
          }

          const progress = await taskWorkflowOrchestrator.skipTask(currentWorkflow.id, taskId);
          const navigation = taskWorkflowOrchestrator.getNavigationState(currentWorkflow.id);
          const updatedWorkflow = taskWorkflowOrchestrator.getWorkflow(currentWorkflow.userId, currentWorkflow.date);
          set({ currentWorkflow: updatedWorkflow, workflowProgress: progress, navigationState: navigation, isLoading: false });
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // Move to next task
      moveToNextTask: async () => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({ isLoading: true, error: null });
        
        try {
          if (isServerWorkflowId(currentWorkflow.id)) {
            const tasks = currentWorkflow.tasks;
            const nextIndex = tasks.findIndex((t, idx) => idx > currentWorkflow.currentTaskIndex && t.status !== 'completed' && t.status !== 'skipped');
            const updated: DailyWorkflow = {
              ...currentWorkflow,
              currentTaskIndex: nextIndex >= 0 ? nextIndex : currentWorkflow.currentTaskIndex,
            };
            const derived = computeProgressAndNavigation(updated);
            set({ currentWorkflow: updated, workflowProgress: derived.progress, navigationState: derived.navigation, isLoading: false });
            return;
          }

          await taskWorkflowOrchestrator.moveToNextTask(currentWorkflow.id);
          const progress = taskWorkflowOrchestrator.getWorkflowProgress(currentWorkflow.id);
          const navigation = taskWorkflowOrchestrator.getNavigationState(currentWorkflow.id);
          const updatedWorkflow = taskWorkflowOrchestrator.getWorkflow(currentWorkflow.userId, currentWorkflow.date);
          set({ currentWorkflow: updatedWorkflow, workflowProgress: progress, navigationState: navigation, isLoading: false });
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // Move to previous task
      moveToPreviousTask: async () => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        set({ isLoading: true, error: null });
        
        try {
          // This would need to be implemented in the orchestrator
          // For now, we'll just refresh the navigation state
          const navigation = taskWorkflowOrchestrator.getNavigationState(currentWorkflow.id);
          
          set({
            navigationState: navigation,
            isLoading: false
          });
        } catch (error) {
          const workflowError = error as WorkflowError;
          set({ 
            error: workflowError, 
            isLoading: false 
          });
        }
      },

      // UI actions
      openWorkflowModal: () => set({ isWorkflowModalOpen: true }),
      closeWorkflowModal: () => set({ isWorkflowModalOpen: false }),
      setError: (error: WorkflowError | null) => set({ error }),
      clearError: () => set({ error: null }),

      // Update user preferences
      updateUserPreferences: (preferences: Partial<UserWorkflowPreferences>) => {
        const { userPreferences } = get();
        set({
          userPreferences: {
            ...userPreferences,
            ...preferences
          } as UserWorkflowPreferences
        });
      },

      // Utility actions
      refreshWorkflowProgress: () => {
        const { currentWorkflow } = get();
        if (!currentWorkflow) return;

        try {
          if (isServerWorkflowId(currentWorkflow.id)) {
            const derived = computeProgressAndNavigation(currentWorkflow);
            set({ workflowProgress: derived.progress, navigationState: derived.navigation });
            return;
          }

          const progress = taskWorkflowOrchestrator.getWorkflowProgress(currentWorkflow.id);
          const navigation = taskWorkflowOrchestrator.getNavigationState(currentWorkflow.id);
          set({ workflowProgress: progress, navigationState: navigation });
        } catch (error) {
          console.warn('Failed to refresh workflow progress:', error);
        }
      },

      getCurrentTask: () => {
        const { navigationState } = get();
        return navigationState?.currentTask || null;
      },

      getNextTask: () => {
        const { navigationState } = get();
        return navigationState?.nextTask || null;
      },

      isWorkflowComplete: () => {
        const { workflowProgress } = get();
        return workflowProgress ? workflowProgress.completedTasks === workflowProgress.totalTasks : false;
      },

      getCompletionPercentage: () => {
        const { workflowProgress } = get();
        return workflowProgress?.completionPercentage || 0;
      }
    }),
    {
      name: 'workflow-store',
      partialize: (state) => ({
        userPreferences: state.userPreferences,
        currentWorkflow: state.currentWorkflow,
        lastCachedAt: state.lastCachedAt,
      })
    }
  )
);

export default useWorkflowStore;
