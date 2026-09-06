import { useCallback } from 'react';
import { PERSONA_REQUIRES_REGENERATION_FLAG } from '../common/onboardingStorageKeys';
import {
  clearPersonaServerCacheStatus,
  getPersonaServerCacheStatus,
  setPersonaServerCacheStatus,
} from '../PersonalizationStep/personaGenerationCache';

interface PersonaInitializationProps {
  websiteSessionKey: string;
  stepData?: {
    corePersona?: any;
    platformPersonas?: Record<string, any>;
    qualityMetrics?: any;
    selectedPlatforms?: string[];
  };
  setCorePersona: (persona: any) => void;
  setPlatformPersonas: (personas: Record<string, any>) => void;
  setQualityMetrics: (metrics: any) => void;
  setSelectedPlatforms: (platforms: string[]) => void;
  setShowPreview: (show: boolean) => void;
  setGenerationStep: (step: string) => void;
  setProgress: (progress: number) => void;
  setHasCheckedCache: (checked: boolean) => void;
  setSuccess: (message: string | null) => void;
  loadCachedPersonaData: () => boolean;
  loadServerCachedPersonaData: () => Promise<boolean>;
  generatePersonas: (force?: boolean) => Promise<void>;
}

export const usePersonaInitialization = ({
  websiteSessionKey,
  stepData,
  setCorePersona,
  setPlatformPersonas,
  setQualityMetrics,
  setSelectedPlatforms,
  setShowPreview,
  setGenerationStep,
  setProgress,
  setHasCheckedCache,
  setSuccess,
  loadCachedPersonaData,
  loadServerCachedPersonaData,
  generatePersonas
}: PersonaInitializationProps) => {
  
  const initialize = useCallback(async () => {
    console.log('PersonaStep: Initialization started', { websiteSessionKey });

    // Header title/description owned by Wizard.tsx (Option B: "Define Your Brand Persona").

    const personaRequiresRegeneration = (() => {
      try {
        return sessionStorage.getItem(PERSONA_REQUIRES_REGENERATION_FLAG) === '1';
      } catch {
        return false;
      }
    })();

    if (personaRequiresRegeneration) {
      console.log(
        'PersonaStep: Skipping stale stepData/server/local persona after website change; generating for current site'
      );
      await generatePersonas(true);
      setHasCheckedCache(true);
      return;
    }

    if (stepData?.corePersona) {
      console.log('PersonaStep: Loading persona data from stepData (navigation back)');
      setCorePersona(stepData.corePersona);
      setPlatformPersonas(stepData.platformPersonas || {});
      setQualityMetrics(stepData.qualityMetrics || null);
      if (stepData.selectedPlatforms) {
        setSelectedPlatforms(stepData.selectedPlatforms);
      }
      setShowPreview(true);
      setGenerationStep('preview');
      setProgress(100);
      setHasCheckedCache(true);
      return;
    }

    const serverCacheStatus = getPersonaServerCacheStatus(websiteSessionKey);
    
    // Try to load from server cache first (skip if already checked this session and was 404)
    let foundCache = false;
    if (serverCacheStatus !== '404') {
      try {
        console.log('PersonaStep: Checking server cache');
        foundCache = await loadServerCachedPersonaData();
        if (foundCache) {
          console.log('PersonaStep: Server cache found, using it');
          setPersonaServerCacheStatus(websiteSessionKey, 'found');
          setHasCheckedCache(true);
          return;
        } else {
          setPersonaServerCacheStatus(websiteSessionKey, '404');
        }
      } catch (error: any) {
        console.warn('PersonaStep: Error loading server cache, trying local cache:', error);
        setPersonaServerCacheStatus(websiteSessionKey, '404');
      }
    } else {
      console.log(
        'PersonaStep: Skipping server cache check (already checked for this website session, was 404)'
      );
    }

    // Try local cache
    console.log('PersonaStep: Checking local cache');
    foundCache = loadCachedPersonaData();
    if (foundCache) {
      console.log('PersonaStep: Local cache found, using it');
      setHasCheckedCache(true);
      return;
    }

    // No cache found, start generation
    console.log('PersonaStep: No cache found, starting generation');
    await generatePersonas();
    setHasCheckedCache(true);
  }, [
    websiteSessionKey,
    stepData,
    setCorePersona,
    setPlatformPersonas,
    setQualityMetrics,
    setSelectedPlatforms,
    setShowPreview,
    setGenerationStep,
    setProgress,
    setHasCheckedCache,
    loadCachedPersonaData,
    loadServerCachedPersonaData,
    generatePersonas
  ]);

  return {
    initialize
  };
};

export { clearPersonaServerCacheStatus };
