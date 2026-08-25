// Make sure to install axios: npm install axios
import { AxiosResponse } from 'axios';
import { apiClient } from './client';
import type { WorkflowOptimizationSignals, WorkflowOutcomes } from '../types/workflow';

export interface OnboardingStepResponse {
  step: number;
  data?: any;
  validation_errors?: string[];
  detail?: string; // Error detail from HTTP responses
  message?: string; // Success message
  warnings?: string[]; // Warning messages
}

export interface OnboardingSessionResponse {
  id: number;
  user_id: number;
  current_step: number;
  progress: number;
}

export interface OnboardingProgressResponse {
  progress: number;
  current_step: number;
  total_steps: number;
  completion_percentage: number;
}

export async function startOnboarding() {
  const res: AxiosResponse<OnboardingSessionResponse> = await apiClient.post('/api/onboarding/start');
  return res.data;
}

export async function getCurrentStep() {
  // Get the current step from the onboarding status
  console.log('getCurrentStep: Calling /api/onboarding/status');
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/status');
  console.log('getCurrentStep: Backend returned:', res.data);
  return { step: res.data.current_step || 1 };
}

export async function setCurrentStep(step: number, stepData?: any) {
  // Complete the current step to move to the next one
  console.log('setCurrentStep: Completing step', step, 'with data:', stepData);
  try {
    const res: AxiosResponse<OnboardingStepResponse> = await apiClient.post(`/api/onboarding/step/${step}/complete`, {
      data: stepData || {},
      validation_errors: []
    });
    console.log('setCurrentStep: Backend response:', res.data);
    return { step, response: res.data }; // Include the full response data including warnings
  } catch (error: any) {
    // Handle HTTP errors from the backend
    console.error('setCurrentStep: Backend error:', error);
    if (error.response?.status >= 400) {
      const errorData = error.response.data;
      const errorMessage = errorData?.detail || errorData?.message || `Step completion failed with status ${error.response.status}`;
      throw new Error(errorMessage);
    }
    // Re-throw other errors
    throw error;
  }
}

export async function getProgress() {
  const res: AxiosResponse<OnboardingProgressResponse> = await apiClient.get('/api/onboarding/progress');
  return { progress: res.data.completion_percentage || 0 };
}

export async function setProgress(progress: number) {
  // Progress is managed automatically by the backend
  // This function is kept for compatibility but doesn't make a backend call
  return { progress };
}

// Additional functions for better integration
export async function getOnboardingConfig() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/config');
  return res.data;
}

export async function getStepData(stepNumber: number) {
  const res: AxiosResponse<any> = await apiClient.get(`/api/onboarding/step/${stepNumber}`);
  return res.data;
}

export async function skipStep(stepNumber: number) {
  const res: AxiosResponse<any> = await apiClient.post(`/api/onboarding/step/${stepNumber}/skip`);
  return res.data;
}

export async function completeOnboarding() {
  const res: AxiosResponse<any> = await apiClient.post('/api/onboarding/complete');
  return res.data;
}

export async function resetOnboarding() {
  const res: AxiosResponse<any> = await apiClient.post('/api/onboarding/reset');
  return res.data;
}

// New functions for FinalStep data loading
export async function getOnboardingSummary() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/summary');
  return res.data;
}

export async function getWebsiteAnalysisData() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/website-analysis');
  return res.data;
}

export async function getResearchPreferencesData() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/research-preferences');
  return res.data;
}

export async function getCompetitorAnalysis() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/competitor-analysis');
  return res.data;
}

export interface TodayPlanPreview {
  date: string;
  tasks: any[];
  committee_agent_count: number;
  fallback_used: boolean;
  proposals_by_agent: Record<string, any[]>;
  template_fallback_count?: number;
}

export async function previewTodayPlan(): Promise<TodayPlanPreview> {
  const res: AxiosResponse<any> = await apiClient.post('/api/today-workflow/preview');
  return res.data?.data;
}

export async function generateTodayPlan() {
  const res: AxiosResponse<any> = await apiClient.post('/api/today-workflow/generate');
  return res.data?.data;
}

export async function getWorkflowOutcomes(days = 30): Promise<WorkflowOutcomes> {
  const res: AxiosResponse<any> = await apiClient.get('/api/today-workflow/outcomes', {
    params: { days },
  });
  return {
    ...(res.data?.data?.outcomes || {}),
    real_outcomes: res.data?.data?.real_outcomes,
  } as WorkflowOutcomes;
}

export async function recordWorkflowTaskFeedback(
  taskId: string,
  score: -1 | 0 | 1,
  feedbackText?: string,
): Promise<void> {
  await apiClient.post(`/api/today-workflow/tasks/${encodeURIComponent(taskId)}/feedback`, {
    score,
    feedback_text: feedbackText,
  });
}

export async function getWorkflowOptimizationSignals(days = 30): Promise<WorkflowOptimizationSignals> {
  const res: AxiosResponse<any> = await apiClient.get('/api/today-workflow/optimization-signals', {
    params: { days },
  });
  return res.data?.data?.optimization;
}

export async function recordConversionEvent(event: {
  event_name: string;
  value?: number;
  currency?: string;
  source?: string;
  external_event_id?: string;
  occurred_at?: string;
  metadata?: Record<string, any>;
}): Promise<{ event_id: number | null; duplicate: boolean }> {
  const res: AxiosResponse<any> = await apiClient.post('/api/today-workflow/outcomes/conversions', event);
  return res.data?.data;
}

export interface ExecuteWorkflowTaskResult {
  task_id: string;
  status: string;
  execution: Record<string, any>;
}

export async function executeWorkflowTask(
  taskId: string,
  payload?: {
    action_type?: string;
    target_resource?: string;
    parameters?: Record<string, any>;
    expected_outcome?: string;
    risk_level?: number;
    requires_approval?: boolean;
  },
): Promise<ExecuteWorkflowTaskResult> {
  const res: AxiosResponse<any> = await apiClient.post(
    `/api/today-workflow/tasks/${encodeURIComponent(taskId)}/execute`,
    payload || {},
  );
  return res.data?.data;
}
