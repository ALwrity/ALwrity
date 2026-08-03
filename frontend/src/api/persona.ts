/**
 * Persona API client for frontend
 * Handles writing persona generation and management
 */

import { apiClient } from './client';

export interface PersonaGenerationRequest {
  onboarding_session_id?: number;
  force_regenerate?: boolean;
}

export interface PersonaResponse {
  persona_id: number;
  persona_name: string;
  archetype: string;
  core_belief: string;
  confidence_score: number;
  platforms: string[];
  created_at: string;
}

export interface PersonaGenerationResponse {
  success: boolean;
  persona_id?: number;
  message: string;
  confidence_score?: number;
  data_sufficiency?: number;
  platforms_generated?: string[];
}

export interface PersonaReadinessResponse {
  ready: boolean;
  message: string;
  missing_steps: string[];
  data_sufficiency: number;
  recommendations?: string[];
}

export interface PersonaPreviewResponse {
  preview: {
    identity: {
      persona_name: string;
      archetype: string;
      core_belief: string;
      brand_voice_description: string;
    };
    linguistic_fingerprint: any;
    tonal_range: any;
    sample_platform: {
      platform: string;
      adaptation: any;
    };
  };
  confidence_score: number;
  data_sufficiency: number;
}

export interface PlatformInfo {
  id: string;
  name: string;
  description: string;
  character_limit?: number;
  optimal_length?: string;
  word_count?: string;
  seo_optimized?: boolean;
  storytelling_focus?: boolean;
  subscription_focus?: boolean;
}

export interface SupportedPlatformsResponse {
  platforms: PlatformInfo[];
}

/**
 * Check if user has sufficient onboarding data for persona generation
 */
export const checkPersonaReadiness = async (userId: number = 1): Promise<PersonaReadinessResponse> => {
  try {
    const response = await apiClient.get('/api/onboarding/persona-readiness', {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error checking persona readiness:', error);
    throw new Error(error.response?.data?.detail || 'Failed to check persona readiness');
  }
};

/**
 * Generate a preview of the writing persona without saving
 */
export const generatePersonaPreview = async (userId: number = 1): Promise<PersonaPreviewResponse> => {
  try {
    const response = await apiClient.get('/api/onboarding/persona-preview', {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating persona preview:', error);
    throw new Error(error.response?.data?.detail || 'Failed to generate persona preview');
  }
};

/**
 * Generate and save a writing persona from onboarding data
 */
export const generateWritingPersona = async (userId: number = 1, request: PersonaGenerationRequest = {}): Promise<PersonaGenerationResponse> => {
  try {
    const response = await apiClient.post('/api/personas/generate', request, {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating writing persona:', error);
    throw new Error(error.response?.data?.detail || 'Failed to generate writing persona');
  }
};

/**
 * Get all writing personas for a user
 * Note: user_id is extracted from Clerk JWT token, no need to pass it
 */
export const getUserPersonas = async (): Promise<{ personas: PersonaResponse[]; total_count: number } | null> => {
  try {
    const response = await apiClient.get('/api/personas/user');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    console.error('Error getting user personas:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get user personas');
  }
};

/**
 * Get detailed information about a specific persona
 */
export const getPersonaDetails = async (userId: number, personaId: number): Promise<any> => {
  try {
    const response = await apiClient.get(`/api/personas/${personaId}`, {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error getting persona details:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get persona details');
  }
};

/**
 * Get persona adaptation for a specific platform
 * Note: user_id is extracted from Clerk JWT token, no need to pass it
 */
export const getPlatformPersona = async (platform: string): Promise<any> => {
  try {
    const response = await apiClient.get(`/api/personas/platform/${platform}`, {
      // 404 is normal when the user has not generated a platform persona yet
      validateStatus: (status) => status === 200 || status === 404,
    });
    if (response.status === 404) return null;
    return response.data;
  } catch (error: any) {
    console.error('Error getting platform persona:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get platform persona');
  }
};

/**
 * Get list of supported platforms
 */
export const getSupportedPlatforms = async (): Promise<SupportedPlatformsResponse> => {
  try {
    const response = await apiClient.get('/api/personas/platforms');
    return response.data;
  } catch (error: any) {
    console.error('Error getting supported platforms:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get supported platforms');
  }
};

/**
 * Update an existing persona
 */
export const updatePersona = async (userId: number, personaId: number, updateData: any): Promise<any> => {
  try {
    const response = await apiClient.put(`/api/personas/${personaId}`, updateData, {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error updating persona:', error);
    throw new Error(error.response?.data?.detail || 'Failed to update persona');
  }
};

/**
 * Update platform-specific persona
 * Note: user_id is extracted from Clerk JWT token
 */
export const updatePlatformPersona = async (platform: string, updateData: any): Promise<any> => {
  try {
    const response = await apiClient.put(`/api/personas/platform/${platform}`, updateData);
    return response.data;
  } catch (error: any) {
    console.error('Error updating platform persona:', error);
    throw new Error(error.response?.data?.detail || 'Failed to update platform persona');
  }
};

/**
 * Generate a platform-specific persona from core persona
 * Note: user_id is extracted from Clerk JWT token
 */
export const generatePlatformPersona = async (platform: string): Promise<any> => {
  try {
    const response = await apiClient.post(`/api/personas/generate-platform/${platform}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error generating ${platform} persona:`, error);
    throw new Error(error.response?.data?.detail || `Failed to generate ${platform} persona`);
  }
};

/**
 * Check if Facebook persona exists for user
 * Note: user_id is extracted from Clerk JWT token or passed as parameter
 */
export const checkFacebookPersona = async (userId?: string): Promise<{
  has_persona: boolean;
  has_core_persona: boolean;
  persona: any;
  onboarding_completed: boolean;
}> => {
  try {
    // Get user_id from parameter or localStorage
    const user_id = userId || localStorage.getItem('user_id');
    if (!user_id) {
      return {
        has_persona: false,
        has_core_persona: false,
        persona: null,
        onboarding_completed: false
      };
    }
    
    const response = await apiClient.get(`/api/personas/facebook-persona/check/${user_id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error checking Facebook persona:', error);
    // Return safe defaults on error
    return {
      has_persona: false,
      has_core_persona: false,
      persona: null,
      onboarding_completed: false
    };
  }
};

/**
 * Delete a persona
 */
export const deletePersona = async (userId: number, personaId: number): Promise<any> => {
  try {
    const response = await apiClient.delete(`/api/personas/${personaId}`, {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error deleting persona:', error);
    throw new Error(error.response?.data?.detail || 'Failed to delete persona');
  }
};

/**
 * Generate content using persona replication engine
 */
export const generateContentWithPersona = async (
  userId: number, 
  platform: string, 
  contentRequest: string, 
  contentType: string = 'post'
): Promise<any> => {
  try {
    const response = await apiClient.post('/api/personas/generate-content', {
      user_id: userId,
      platform,
      content_request: contentRequest,
      content_type: contentType
    });
    return response.data;
  } catch (error: any) {
    console.error('Error generating content with persona:', error);
    throw new Error(error.response?.data?.detail || 'Failed to generate content with persona');
  }
};

/**
 * Export hardened persona prompt for external use
 */
export const exportPersonaPrompt = async (userId: number, platform: string): Promise<any> => {
  try {
    const response = await apiClient.get(`/api/personas/export/${platform}`, {
      params: { user_id: userId }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error exporting persona prompt:', error);
    throw new Error(error.response?.data?.detail || 'Failed to export persona prompt');
  }
};