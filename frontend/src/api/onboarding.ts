// Make sure to install axios: npm install axios
import { AxiosResponse } from 'axios';
import { apiClient } from './client';

export interface APIKeyRequest {
  provider: string;
  api_key: string;
  description?: string;
}

export interface APIKeyResponse {
  provider: string;
  api_key: string;
  description?: string;
}

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

export async function getApiKeys() {
  const maxRetries = 3;
  let lastError: any;
  
  console.log('getApiKeys: Starting API call to /api/onboarding/api-keys');
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`getApiKeys: Attempt ${attempt + 1}/${maxRetries}`);
      const res: AxiosResponse<Record<string, string>> = await apiClient.get('/api/onboarding/api-keys');
      console.log('getApiKeys: API call successful');
      return res.data;
    } catch (error: any) {
      lastError = error;
      console.log(`getApiKeys: Attempt ${attempt + 1} failed:`, error.response?.status, error.message);
      
      // If it's a rate limit error (429), wait and retry
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retry_after || 60;
        const delay = Math.min(retryAfter * 1000, 5000); // Max 5 seconds
        
        console.log(`getApiKeys: Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors, don't retry
      console.log('getApiKeys: Non-rate-limit error, not retrying');
      throw error;
    }
  }
  
  // If we've exhausted all retries, throw the last error
  console.log('getApiKeys: All retries exhausted');
  throw lastError;
}

export async function getApiKeysForOnboarding() {
  const maxRetries = 3;
  let lastError: any;
  
  console.log('getApiKeysForOnboarding: Starting API call to /api/onboarding/api-keys/onboarding');
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`getApiKeysForOnboarding: Attempt ${attempt + 1}/${maxRetries}`);
      const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/api-keys/onboarding');
      console.log('getApiKeysForOnboarding: API call successful');
      return res.data.api_keys || {};
    } catch (error: any) {
      lastError = error;
      console.log(`getApiKeysForOnboarding: Attempt ${attempt + 1} failed:`, error.response?.status, error.message);
      
      // If it's a rate limit error (429), wait and retry
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retry_after || 60;
        const delay = Math.min(retryAfter * 1000, 5000); // Max 5 seconds
        
        console.log(`getApiKeysForOnboarding: Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors, don't retry
      console.log('getApiKeysForOnboarding: Non-rate-limit error, not retrying');
      throw error;
    }
  }
  
  // If we've exhausted all retries, throw the last error
  console.log('getApiKeysForOnboarding: All retries exhausted');
  throw lastError;
}

export async function saveApiKey(provider: string, api_key: string, description?: string) {
  const res: AxiosResponse<APIKeyResponse> = await apiClient.post('/api/onboarding/api-keys', { 
    provider, 
    api_key,
    description 
  });
  return res.data;
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

export async function getStep1ApiKeysFromProgress(): Promise<{ gemini?: string; exa?: string; copilotkit?: string }> {
  try {
    const step = await getStepData(1);
    const keys = step?.data?.api_keys || {};
    return {
      gemini: keys.gemini || undefined,
      exa: keys.exa || undefined,
      copilotkit: keys.copilotkit || undefined,
    };
  } catch (_e) {
    return {};
  }
}

export async function skipStep(stepNumber: number) {
  const res: AxiosResponse<any> = await apiClient.post(`/api/onboarding/step/${stepNumber}/skip`);
  return res.data;
}

export async function validateApiKeys() {
  const res: AxiosResponse<any> = await apiClient.post('/api/onboarding/api-keys/validate');
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