import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getPersonalizationConfigurationOptions,
} from '../../../api/componentLogic';
import { getLatestBrandAvatar, getLatestVoiceClone } from '../../../api/brandAssets';
import { usePersonaPolling } from '../../../hooks/usePersonaPolling';
import { aiApiClient } from '../../../api/client';
import { savePersonaUpdate, getPersonaPlatforms, generatePlatformPersona, type PersonaPlatform } from '../../../api/personaApi';
import { usePersonaInitialization } from '../PersonaStep/personaInitialization';
import { usePersonaGeneration } from '../PersonaStep/personaGeneration';
import { resolveCurrentWebsiteSessionKey } from '../common/onboardingStorageKeys';
import {
  canReuseServerPersona,
  readLiveWebsiteUrlFromStorage,
} from '../common/wizardLiveWebsiteSession';
import {
  mergePlatformPersonaIntoCache,
  readPersonaCache,
  writePersonaCache,
} from './personaGenerationCache';

export interface PersonalizationStepProps {
  onContinue: (data?: any) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataChange?: (data: any) => void;
  onboardingType?: string;
  onboardingData?: {
    websiteAnalysis?: any;
    competitorResearch?: any;
    sitemapAnalysis?: any;
    businessData?: any;
    website?: string;
  };
  stepData?: {
    corePersona?: any;
    platformPersonas?: Record<string, any>;
    qualityMetrics?: any;
    selectedPlatforms?: string[];
  };
}

interface QualityMetrics {
  overall_score: number;
  style_consistency: number;
  brand_alignment: number;
  platform_optimization: number;
  engagement_potential: number;
  recommendations: string[];
}

type PersonalizationTab = 'text' | 'image' | 'audio';

const TEST_DRIVE_SEEN_KEY = 'test_drive_modal_seen';

export function usePersonalizationStepController({
  onContinue: _onContinue,
  onValidationChange,
  onDataChange,
  onboardingType,
  onboardingData = {},
  stepData,
}: PersonalizationStepProps) {
  const websiteSessionKey = useMemo(
    () =>
      resolveCurrentWebsiteSessionKey(
        onboardingData?.website || '',
        onboardingData?.websiteAnalysis ?? null
      ),
    [onboardingData?.website, onboardingData?.websiteAnalysis]
  );

  const [activeTab, setActiveTab] = useState<PersonalizationTab>('text');

  const [generationStep, setGenerationStep] = useState<string>('analyzing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [corePersona, setCorePersona] = useState<any>(stepData?.corePersona ?? null);
  const [platformPersonas, setPlatformPersonas] = useState<Record<string, any>>(stepData?.platformPersonas ?? {});
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(stepData?.qualityMetrics ?? null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(stepData?.selectedPlatforms ?? ['linkedin', 'blog']);
  const [completeness, setCompleteness] = useState<{
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null>(null);
  const [dataSufficiency, setDataSufficiency] = useState<number | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [, setHasCheckedCache] = useState(false);
  const [configurationOptions, setConfigurationOptions] = useState<any>(null);
  const [platforms, setPlatforms] = useState<PersonaPlatform[]>([]);
  const [generatingPlatform, setGeneratingPlatform] = useState<string | null>(null);

  const [brandAvatarSet, setBrandAvatarSet] = useState(false);
  const [voiceCloneSet, setVoiceCloneSet] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [voiceUrl, setVoiceUrl] = useState<string>('');
  const [introVideoUrl, setIntroVideoUrl] = useState<string>('');

  const [showTestPersonaModal, setShowTestPersonaModal] = useState(false);
  const [hasTriggeredModal, setHasTriggeredModal] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(TEST_DRIVE_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const openTestDriveModal = useCallback(() => {
    setShowTestPersonaModal(true);
  }, []);

  const closeTestDriveModal = useCallback(() => {
    setShowTestPersonaModal(false);
    setHasTriggeredModal(true);
    try {
      sessionStorage.setItem(TEST_DRIVE_SEEN_KEY, '1');
    } catch { /* ignore */ }
  }, []);

  const checkAssetStatus = useCallback(async () => {
    try {
      const avatarResp = await getLatestBrandAvatar();
      let isAvatarSet = avatarResp.success;
      let avatarDisplayUrl = '';

      if (avatarResp.success) {
         avatarDisplayUrl = avatarResp.image_base64
            ? (avatarResp.image_base64.startsWith('data:') ? avatarResp.image_base64 : `data:image/png;base64,${avatarResp.image_base64}`)
            : avatarResp.image_url || '';
      } else {
        try {
          const localAvatar = localStorage.getItem('brand_avatar_selection');
          if (localAvatar) {
            const parsed = JSON.parse(localAvatar);
            if (parsed.set) {
              isAvatarSet = true;
              const studioImage = localStorage.getItem('brand_avatar_result');
              if (studioImage) {
                 avatarDisplayUrl = studioImage.startsWith('http') ? studioImage :
                    (studioImage.startsWith('data:') ? studioImage : `data:image/png;base64,${studioImage}`);
              }
            }
          }
        } catch (e) {}
      }

      setBrandAvatarSet(isAvatarSet);
      if (avatarDisplayUrl) setAvatarUrl(avatarDisplayUrl);

      const voiceResp = await getLatestVoiceClone();
      let isVoiceSet = voiceResp.success;
      let voiceDisplayUrl = '';

      if (voiceResp.success && voiceResp.preview_audio_url) {
         voiceDisplayUrl = voiceResp.preview_audio_url;
      } else {
         try {
           const localVoice = localStorage.getItem('brand_voice_selection');
           if (localVoice) {
             const parsed = JSON.parse(localVoice);
             if (parsed.set) {
               isVoiceSet = true;
               const studioVoice = localStorage.getItem('voice_clone_result_url');
               if (studioVoice) {
                  voiceDisplayUrl = studioVoice;
               }
             }
           }
         } catch (e) {}
      }

      setVoiceCloneSet(isVoiceSet);
      if (voiceDisplayUrl) setVoiceUrl(voiceDisplayUrl);
    } catch (e) {
      console.error("Failed to check asset status", e);
    }
  }, []);

  useEffect(() => {
    checkAssetStatus();
  }, [checkAssetStatus]);

  useEffect(() => {
    if (onDataChange) {
      const personaData = {
        corePersona,
        platformPersonas,
        qualityMetrics,
        selectedPlatforms,
        brandAvatar: {
          set: brandAvatarSet,
          url: avatarUrl
        },
        voiceClone: {
          set: voiceCloneSet,
          url: voiceUrl
        },
        introVideo: {
          set: !!introVideoUrl,
          url: introVideoUrl
        },
        stepType: 'personalization',
        completedAt: new Date().toISOString()
      };
      onDataChange(personaData);
    }
  }, [
    corePersona,
    platformPersonas,
    qualityMetrics,
    selectedPlatforms,
    brandAvatarSet,
    avatarUrl,
    voiceCloneSet,
    voiceUrl,
    introVideoUrl,
    onDataChange
  ]);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!corePersona || isGenerating) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      savePersonaUpdate({
        core_persona: corePersona,
        platform_personas: platformPersonas,
        quality_metrics: qualityMetrics ?? {},
        selected_platforms: selectedPlatforms,
      }).catch((err) => {
        console.warn('Persona auto-save failed:', err);
      });
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [corePersona, platformPersonas, qualityMetrics, selectedPlatforms, isGenerating]);

  const loadCachedPersonaData = useCallback(() => {
    try {
      const parsedData = readPersonaCache(websiteSessionKey);
      if (parsedData) {
        setCorePersona(parsedData.core_persona);
        setPlatformPersonas(parsedData.platform_personas || {});
        setQualityMetrics((parsedData.quality_metrics as QualityMetrics) || null);
        setCompleteness(parsedData.completeness ?? null);
        setDataSufficiency(
          typeof parsedData.data_sufficiency === 'number' ? parsedData.data_sufficiency : null
        );
        setShowPreview(true);
        setGenerationStep('preview');
        setProgress(100);
        setSuccess('Loaded your saved Brand Voice. Click "Regenerate" for a fresh analysis.');
        return true;
      }
    } catch (err) {
      console.warn('Failed to load cached Brand Voice:', err);
    }
    return false;
  }, [websiteSessionKey]);

  const loadServerCachedPersonaData = useCallback(async () => {
    try {
      const liveUrl = readLiveWebsiteUrlFromStorage() || onboardingData?.website || '';
      const resp = await aiApiClient.get('/api/onboarding/step4/persona-latest');
      if (resp.data && resp.data.success && resp.data.persona) {
        const p = resp.data.persona;
        if (
          !canReuseServerPersona(
            liveUrl,
            p.website_url || p.website,
            onboardingData?.website
          )
        ) {
          console.log(
            '[Personalization] Skipping server persona that does not belong to the live website'
          );
          return false;
        }
        setCorePersona(p.core_persona);
        setPlatformPersonas(p.platform_personas || {});
        setQualityMetrics(p.quality_metrics || null);
        setCompleteness(p.completeness ?? null);
        setDataSufficiency(typeof p.data_sufficiency === 'number' ? p.data_sufficiency : null);
        if (Array.isArray(p.selected_platforms)) {
          setSelectedPlatforms(p.selected_platforms);
        }
        setShowPreview(true);
        setGenerationStep('preview');
        setProgress(100);
        try {
          writePersonaCache(websiteSessionKey, {
            ...p,
            timestamp: p.timestamp || new Date().toISOString(),
          });
        } catch {}
        setSuccess('Loaded your saved Brand Voice from server. Click "Regenerate" for a fresh analysis.');
        return true;
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        console.log('No cached persona found on server');
      } else if (e?.response?.status === 401) {
        throw e;
      }
    }
    return false;
  }, [websiteSessionKey, onboardingData?.website]);

  const savePersonaDataToCache = useCallback((personaData: any) => {
    try {
      writePersonaCache(websiteSessionKey, {
        ...personaData,
        timestamp: new Date().toISOString(),
        selected_platforms: selectedPlatforms,
      });
    } catch (err) {
      console.warn('Failed to cache persona data:', err);
    }
  }, [selectedPlatforms, websiteSessionKey]);

  const { startPolling, progressMessages } = usePersonaPolling({
    onProgress: (message, progress) => {
      setProgress(progress);
      setGenerationStep(getStepFromMessage(message));
    },
    onComplete: (personaResult) => {
      if (personaResult && personaResult.success) {
        setCorePersona(personaResult.core_persona);
        setPlatformPersonas(personaResult.platform_personas);
        setQualityMetrics(personaResult.quality_metrics);
        setCompleteness(personaResult.completeness ?? null);
        setDataSufficiency(
          typeof personaResult.data_sufficiency === 'number'
            ? personaResult.data_sufficiency
            : null
        );
        setShowPreview(true);
        setGenerationStep('preview');
        setProgress(100);
        savePersonaDataToCache(personaResult);
      }
      setIsGenerating(false);
    },
    onError: (error) => {
      setError(error);
      setIsGenerating(false);
    }
  });

  const { generatePersonas, getStepFromMessage } = usePersonaGeneration({
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
  });

  const { initialize } = usePersonaInitialization({
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
  });

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initSequence = async () => {
      try {
        const options = await getPersonalizationConfigurationOptions();
        setConfigurationOptions(options.options);
      } catch (e) {
        console.error('Failed to load configuration options:', e);
      }

      try {
        const platformList = await getPersonaPlatforms();
        setPlatforms(platformList);
      } catch (e) {
        console.error('Failed to load persona platforms:', e);
      }

      await initialize();
    };

    initSequence();
  }, [initialize]);

  const handleRegenerate = () => {
    setShowPreview(false);
    setCorePersona(null);
    setPlatformPersonas({});
    setQualityMetrics(null);
    generatePersonas(true);
  };

  const handleGenerateNow = useCallback(async (platformId: string) => {
    setError(null);
    setGeneratingPlatform(platformId);

    try {
      const resp = await generatePlatformPersona(platformId);
      if (resp.success && resp.persona) {
        setPlatformPersonas((prev) => ({ ...prev, [platformId]: resp.persona }));
        mergePlatformPersonaIntoCache(websiteSessionKey, platformId, resp.persona);
        setSelectedPlatforms((prev) => (prev.includes(platformId) ? prev : [...prev, platformId]));
      } else {
        setError(resp.message || `Failed to generate ${platformId} persona.`);
      }
    } catch (err: any) {
      setError(err?.message || `Failed to generate ${platformId} persona.`);
    } finally {
      setGeneratingPlatform(null);
    }
  }, []);

  const generatingPlatformName = useMemo(
    () => platforms.find((p) => p.id === generatingPlatform)?.name || generatingPlatform || '',
    [platforms, generatingPlatform],
  );

  const refreshPersonaData = useCallback(async () => {
    try {
      const resp = await aiApiClient.get('/api/onboarding/step4/persona-latest');
      if (resp.data?.success && resp.data?.persona) {
        const p = resp.data.persona;
        const serverPlatforms = p.platform_personas || {};
        setPlatformPersonas((prev) => {
          const next = { ...prev };
          for (const [pid, pp] of Object.entries(serverPlatforms)) {
            if (!next[pid]) {
              next[pid] = pp;
            }
          }
          return next;
        });
        if (Array.isArray(p.selected_platforms)) {
          setSelectedPlatforms((prev) => Array.from(new Set([...prev, ...p.selected_platforms])));
        }
      }
    } catch (e) {
      // Non-critical: background generation status refresh is best-effort.
    }
  }, []);

  const handleTabChange = useCallback((tab: PersonalizationTab) => {
    setActiveTab(tab);
    if (tab === 'text') {
      refreshPersonaData();
    }
  }, [refreshPersonaData]);

  useEffect(() => {
    const hasValidData = !!(corePersona && platformPersonas && Object.keys(platformPersonas).length > 0 && qualityMetrics);
    const isLinkedIn = onboardingType === 'linkedin';
    const isComplete = !isGenerating && hasValidData && generationStep === 'preview' &&
      (isLinkedIn || (brandAvatarSet && voiceCloneSet));

    if (onValidationChange) {
      onValidationChange(isComplete);
    }

    if (isComplete && !hasTriggeredModal && !showTestPersonaModal) {
        setHasTriggeredModal(true);
        try {
          sessionStorage.setItem(TEST_DRIVE_SEEN_KEY, '1');
        } catch { /* ignore */ }
        setShowTestPersonaModal(true);
    }
  }, [corePersona, platformPersonas, qualityMetrics, isGenerating, generationStep, onValidationChange, brandAvatarSet, voiceCloneSet, hasTriggeredModal, showTestPersonaModal]);

  const domainName = useMemo(() => {
    const websiteUrl =
      onboardingData?.websiteAnalysis?.website_url ||
      onboardingData?.websiteAnalysis?.website ||
      onboardingData?.website ||
      '';
    try {
      const normalizedUrl = websiteUrl && !/^https?:\/\//i.test(websiteUrl) ? `https://${websiteUrl}` : websiteUrl;
      const hostname = normalizedUrl ? new URL(normalizedUrl).hostname : '';
      return hostname ? hostname.replace(/^www\./i, '') : undefined;
    } catch {
      return undefined;
    }
  }, [onboardingData?.website, onboardingData?.websiteAnalysis]);

  return {
    activeTab,
    generationStep,
    isGenerating,
    progress,
    error,
    success,
    corePersona,
    platformPersonas,
    qualityMetrics,
    completeness,
    dataSufficiency,
    showPreview,
    configurationOptions,
    platforms,
    generatingPlatform,
    generatingPlatformName,
    brandAvatarSet,
    voiceCloneSet,
    avatarUrl,
    voiceUrl,
    showTestPersonaModal,
    openTestDriveModal,
    closeTestDriveModal,
    checkAssetStatus,
    setCorePersona,
    setPlatformPersonas,
    setShowPreview,
    setSuccess,
    setBrandAvatarSet,
    setVoiceCloneSet,
    setIntroVideoUrl,
    handleRegenerate,
    handleGenerateNow,
    handleTabChange,
    generatePersonas,
    progressMessages,
    domainName,
  };
}
