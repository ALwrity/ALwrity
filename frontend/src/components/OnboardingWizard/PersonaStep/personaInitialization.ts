import { useCallback } from 'react';

interface PersonaInitializationProps {
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
  generatePersonas: () => Promise<void>;
}

export const usePersonaInitialization = ({
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
    console.log('PersonaStep: Initialization started');

    // Header title/description owned by Wizard.tsx (Option B: "Define Your Brand Persona").

    // Check if we already have persona data from stepData (when navigating back)
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

    // Check session flag to avoid redundant server cache checks
    const serverCacheChecked = sessionStorage.getItem('persona_server_cache_checked');
    
    // Try to load from server cache first (skip if already checked this session and was 404)
    let foundCache = false;
    if (!serverCacheChecked || serverCacheChecked !== '404') {
      try {
        console.log('PersonaStep: Checking server cache');
        foundCache = await loadServerCachedPersonaData();
        if (foundCache) {
          console.log('PersonaStep: Server cache found, using it');
          sessionStorage.setItem('persona_server_cache_checked', 'found');
          setHasCheckedCache(true);
          return;
        } else {
          // Mark that we checked and got 404
          sessionStorage.setItem('persona_server_cache_checked', '404');
        }
      } catch (error: any) {
        console.warn('PersonaStep: Error loading server cache, trying local cache:', error);
        sessionStorage.setItem('persona_server_cache_checked', '404');
      }
    } else {
      console.log('PersonaStep: Skipping server cache check (already checked this session, was 404)');
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
