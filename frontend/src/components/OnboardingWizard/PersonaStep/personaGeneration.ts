import { useCallback } from 'react';
import { aiApiClient } from '../../../api/client';
import { 
  generateWritingPersonas, 
  assessPersonaQuality, 
  prepareOnboardingData,
  validatePersonaRequest,
  PersonaGenerationRequest 
} from '../../../api/personaApi';

interface PersonaGenerationProps {
  onboardingData: any;
  selectedPlatforms: string[];
  setCorePersona: (persona: any) => void;
  setPlatformPersonas: (personas: Record<string, any>) => void;
  setQualityMetrics: (metrics: any) => void;
  setShowPreview: (show: boolean) => void;
  setGenerationStep: (step: string) => void;
  setProgress: (progress: number) => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  savePersonaDataToCache: (data: any) => void;
  startPolling: (taskId: string) => void;
}

export const usePersonaGeneration = ({
  onboardingData,
  selectedPlatforms,
  setCorePersona,
  setPlatformPersonas,
  setQualityMetrics,
  setShowPreview,
  setGenerationStep,
  setProgress,
  setIsGenerating,
  setError,
  savePersonaDataToCache,
  startPolling
}: PersonaGenerationProps) => {

  const generatePersonas = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setShowPreview(false);
    
    // Clear session cache flag since we're generating fresh
    sessionStorage.removeItem('persona_server_cache_checked');

    try {
      // Start async persona generation
      const request: PersonaGenerationRequest = {
        onboarding_data: prepareOnboardingData(onboardingData),
        selected_platforms: selectedPlatforms,
        user_preferences: null
      };

      console.log('Starting async persona generation...');
      const response = await aiApiClient.post('/api/onboarding/step4/generate-personas-async', request);
      
      if (response.data.task_id) {
        console.log('Persona generation task response:', response.data);
        
        // Check if the task is already completed (cache hit)
        if (response.data.status === 'completed') {
          console.log('Task already completed (cache hit), fetching result immediately');
          // Fetch the completed task result
          const taskResponse = await aiApiClient.get(`/api/onboarding/step4/persona-task/${response.data.task_id}`);
          if (taskResponse.data && taskResponse.data.result) {
            const result = taskResponse.data.result;
            setCorePersona(result.core_persona);
            setPlatformPersonas(result.platform_personas);
            setQualityMetrics(result.quality_metrics);
            setShowPreview(true);
            setGenerationStep('preview');
            setProgress(100);
            savePersonaDataToCache(result);
            setIsGenerating(false);
            return;
          }
        }
        
        // Start polling for the task
        console.log('Starting polling for task:', response.data.task_id);
        startPolling(response.data.task_id);
      } else {
        throw new Error('Failed to start persona generation task');
      }

    } catch (err) {
      console.error('Failed to start persona generation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start persona generation');
      setIsGenerating(false);
    }
  }, [onboardingData, selectedPlatforms, startPolling, setIsGenerating, setError, setProgress, setShowPreview, setCorePersona, setPlatformPersonas, setQualityMetrics, setGenerationStep, savePersonaDataToCache]);

  const generateCorePersona = async (data: any) => {
    const request: PersonaGenerationRequest = {
      onboarding_data: prepareOnboardingData(data),
      selected_platforms: selectedPlatforms,
      user_preferences: null
    };

    // Validate request
    const validationErrors = validatePersonaRequest(request);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const response = await generateWritingPersonas(request);
    if (!response.success) {
      throw new Error(response.error || 'Failed to generate core persona');
    }

    return response.core_persona;
  };

  const generatePlatformPersonas = async (corePersona: any, platforms: string[]) => {
    const request: PersonaGenerationRequest = {
      onboarding_data: prepareOnboardingData(onboardingData),
      selected_platforms: platforms,
      user_preferences: null
    };

    const response = await generateWritingPersonas(request);
    if (!response.success) {
      throw new Error(response.error || 'Failed to generate platform personas');
    }

    return response.platform_personas || {};
  };

  const assessPersonaQualityInternal = async (corePersona: any, platformPersonas: any) => {
    const response = await assessPersonaQuality({
      core_persona: corePersona,
      platform_personas: platformPersonas,
      user_feedback: null
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to assess persona quality');
    }

    return response.quality_metrics;
  };

  const getStepFromMessage = (message: string): string => {
    if (message.includes('Initializing')) return 'analyzing';
    if (message.includes('core persona')) return 'generating';
    if (message.includes('platform')) return 'adapting';
    if (message.includes('quality')) return 'assessing';
    if (message.includes('completed')) return 'preview';
    return 'generating';
  };

  return {
    generatePersonas,
    generateCorePersona,
    generatePlatformPersonas,
    assessPersonaQualityInternal,
    getStepFromMessage
  };
};
