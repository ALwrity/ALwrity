/**
 * Persona API Client
 * Handles communication with the persona generation backend services.
 */

import { apiClient, aiApiClient } from './client';

export interface PersonaGenerationRequest {
  onboarding_data: {
    websiteAnalysis?: any;
    competitorResearch?: any;
    sitemapAnalysis?: any;
    businessData?: any;
    researchPreferences?: any;
    deepCompetitorAnalysis?: any;
  };
  selected_platforms: string[];
  user_preferences?: any;
  force?: boolean;
}

export interface SavePersonaRequest {
  core_persona?: any;
  platform_personas?: Record<string, any>;
  quality_metrics?: any;
  selected_platforms?: string[];
}

export interface SavePersonaResponse {
  success: boolean;
  message?: string;
}

/**
 * Persist an edited persona back to the server (used for debounced auto-save).
 */
export const savePersonaUpdate = async (
  request: SavePersonaRequest
): Promise<SavePersonaResponse> => {
  try {
    const response = await apiClient.post('/api/onboarding/step4/persona-save', request);
    return response.data;
  } catch (error: any) {
    console.error('Error saving persona:', error);
    return {
      success: false,
      message:
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error.message ||
        'Failed to save persona',
    };
  }
};

export interface PersonaPlatform {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scheduled: boolean;
}

/**
 * Fetch the canonical persona platform list (single source of truth, backend).
 */
export const getPersonaPlatforms = async (): Promise<PersonaPlatform[]> => {
  try {
    const response = await apiClient.get('/api/onboarding/step4/persona-platforms');
    return response.data?.platforms ?? [];
  } catch (error: any) {
    console.error('Error getting persona platforms:', error);
    return [];
  }
};

export interface GeneratePlatformPersonaResponse {
  success: boolean;
  platform?: string;
  persona?: any;
  message?: string;
  error?: string;
}

/**
 * Generate a single platform persona on demand (blocking; used by "Generate Now").
 */
export const generatePlatformPersona = async (
  platform: string
): Promise<GeneratePlatformPersonaResponse> => {
  try {
    const response = await aiApiClient.post('/api/onboarding/step4/generate-platform-persona', { platform });
    return response.data;
  } catch (error: any) {
    console.error('Error generating platform persona:', error);
    return {
      success: false,
      message:
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error.message ||
        'Failed to generate platform persona',
      error: 'network_error',
    };
  }
};

/**
 * Utility function to prepare onboarding data for persona generation.
 */
export const prepareOnboardingData = (stepData: any) => {
  const websiteAnalysis =
    stepData?.websiteAnalysis ??
    stepData?.analysis ??
    null;

  const competitorResearch =
    stepData?.competitorResearch ??
    {
      competitors: stepData?.competitors || [],
      researchSummary: stepData?.researchSummary || null,
      socialMediaAccounts: stepData?.socialMediaAccounts || {},
    };

  return {
    websiteAnalysis,
    competitorResearch,
    sitemapAnalysis: stepData?.sitemapAnalysis ?? null,
    businessData: stepData?.businessData ?? null,
    researchPreferences: stepData?.researchPreferences ?? null,
    deepCompetitorAnalysis: stepData?.deepCompetitorAnalysis ?? null,
  };
};
