import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  InfoOutlined,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { 
  getPersonalizationConfigurationOptions,
} from '../../api/componentLogic';
import { getLatestBrandAvatar, getLatestVoiceClone } from '../../api/brandAssets';
import { usePersonaPolling } from '../../hooks/usePersonaPolling';
import { aiApiClient } from '../../api/client';
import { type GenerationStep } from './PersonaStep/PersonaGenerationProgress';
import { usePersonaInitialization } from './PersonaStep/personaInitialization';
import { usePersonaGeneration } from './PersonaStep/personaGeneration';
import { PersonaPreviewSection } from './PersonaStep/PersonaPreviewSection';
import { PersonaLoadingState } from './PersonaStep/PersonaLoadingState';
import { ComingSoonSection } from './PersonaStep/ComingSoonSection';
import { BrandAvatarStudio } from './PersonalizationStep/components/BrandAvatarStudio';
import { VoiceAvatarPlaceholder } from './PersonalizationStep/components/VoiceAvatarPlaceholder';
import { TestPersonaModal } from './PersonalizationStep/components/TestPersonaModal';
import { Step4Hero } from './PersonaStep/Step4Hero';

interface PersonalizationStepProps {
  onContinue: (data?: any) => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataChange?: (data: any) => void;
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

const PersonalizationStep: React.FC<PersonalizationStepProps> = ({ 
  onContinue: _onContinue, 
  updateHeaderContent, 
  onValidationChange,
  onDataChange,
  onboardingData = {},
  stepData
}) => {
  // Tabs State
  const [activeTab, setActiveTab] = useState<PersonalizationTab>('text');

  // AI Generation state (Ported from PersonaStep)
  const [generationStep, setGenerationStep] = useState<string>('analyzing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Persona data
  const [corePersona, setCorePersona] = useState<any>(null);
  const [platformPersonas, setPlatformPersonas] = useState<Record<string, any>>({});
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin', 'blog']);
  // Phase 2: deterministic completeness + data-sufficiency scores.
  // Backed by the backend's `PersonaPromptBuilder.compute_completeness` +
  // `OnboardingDataCollector.calculate_data_sufficiency`. Optional — when
  // absent, EvidenceAccordion falls back to LLM-confidence-only.
  const [completeness, setCompleteness] = useState<{
    score?: number | null;
    structural_score?: number | null;
    missing?: string[] | null;
  } | null>(null);
  const [dataSufficiency, setDataSufficiency] = useState<number | null>(null);

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('core');
  const [, setHasCheckedCache] = useState(false);
  const [configurationOptions, setConfigurationOptions] = useState<any>(null);

  // Asset Status State
  const [brandAvatarSet, setBrandAvatarSet] = useState(false);
  const [voiceCloneSet, setVoiceCloneSet] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [voiceUrl, setVoiceUrl] = useState<string>('');
  const [introVideoUrl, setIntroVideoUrl] = useState<string>('');
  
  // Modal State — `hasTriggeredModal` is persisted in sessionStorage so the
  // auto-open only fires once per browser session (avoids re-popping the
  // modal every time the user navigates back to Step 4).
  const TEST_DRIVE_SEEN_KEY = 'test_drive_modal_seen';
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
    // Mark as seen so we don't auto-open again this session
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
         // Prefer base64 if available (immediate), else URL
         avatarDisplayUrl = avatarResp.image_base64 
            ? (avatarResp.image_base64.startsWith('data:') ? avatarResp.image_base64 : `data:image/png;base64,${avatarResp.image_base64}`)
            : avatarResp.image_url || '';
      } else {
        // Fallback to local storage
        try {
          const localAvatar = localStorage.getItem('brand_avatar_selection');
          if (localAvatar) {
            const parsed = JSON.parse(localAvatar);
            if (parsed.set) {
              isAvatarSet = true;
              // Try to recover image from Studio storage
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
         // Fallback to local storage
         try {
           const localVoice = localStorage.getItem('brand_voice_selection');
           if (localVoice) {
             const parsed = JSON.parse(localVoice);
             if (parsed.set) {
               isVoiceSet = true;
               // Try to recover audio from Studio storage
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

  // Sync data to parent Wizard
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

  // Generation steps (Ported from PersonaStep)
  const generationSteps: GenerationStep[] = [
    {
      id: 'analyzing',
      name: 'Analyzing Your Data',
      description: 'Processing website analysis, competitor research, and content insights',
      icon: <AssessmentIcon />,
      completed: generationStep !== 'analyzing',
      progress: generationStep === 'analyzing' ? 100 : 100
    },
    {
      id: 'generating',
      name: 'Generating Brand Voice',
      description: 'Creating your unique brand writing style and identity',
      icon: <PsychologyIcon />,
      completed: ['adapting', 'assessing', 'preview'].includes(generationStep),
      progress: ['adapting', 'assessing', 'preview'].includes(generationStep) ? 100 : 0
    },
    {
      id: 'adapting',
      name: 'Adapting to Platforms',
      description: 'Tailoring your brand voice for different content platforms',
      icon: <AutoAwesomeIcon />,
      completed: ['assessing', 'preview'].includes(generationStep),
      progress: ['assessing', 'preview'].includes(generationStep) ? 100 : 0
    },
    {
      id: 'assessing',
      name: 'Quality Assessment',
      description: 'Evaluating persona accuracy and optimization potential',
      icon: <AssessmentIcon />,
      completed: generationStep === 'preview',
      progress: generationStep === 'preview' ? 100 : 0
    }
  ];

  // Load cached persona data (Ported from PersonaStep)
  const loadCachedPersonaData = useCallback(() => {
    try {
      const cachedData = localStorage.getItem('persona_generation_data');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const cacheTime = new Date(parsedData.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          setCorePersona(parsedData.core_persona);
          setPlatformPersonas(parsedData.platform_personas);
          setQualityMetrics(parsedData.quality_metrics);
          setCompleteness(parsedData.completeness ?? null);
          setDataSufficiency(
            typeof parsedData.data_sufficiency === 'number' ? parsedData.data_sufficiency : null
          );
          setShowPreview(true);
          setGenerationStep('preview');
          setProgress(100);
          setSuccess('Loaded your saved Brand Voice. Click "Regenerate" for a fresh analysis.');
          return true;
        } else {
          localStorage.removeItem('persona_generation_data');
        }
      }
    } catch (err) {
      console.warn('Failed to load cached Brand Voice:', err);
    }
    return false;
  }, []);

  const loadServerCachedPersonaData = useCallback(async () => {
    try {
      const resp = await aiApiClient.get('/api/onboarding/step4/persona-latest');
      if (resp.data && resp.data.success && resp.data.persona) {
        const p = resp.data.persona;
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
          localStorage.setItem('persona_generation_data', JSON.stringify({
            ...p,
            timestamp: p.timestamp || new Date().toISOString(),
          }));
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
  }, []);

  const savePersonaDataToCache = useCallback((personaData: any) => {
    try {
      const cacheData = {
        ...personaData,
        timestamp: new Date().toISOString(),
        selected_platforms: selectedPlatforms
      };
      localStorage.setItem('persona_generation_data', JSON.stringify(cacheData));
    } catch (err) {
      console.warn('Failed to cache persona data:', err);
    }
  }, [selectedPlatforms]);

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
    onboardingData,
    stepData,
    updateHeaderContent,
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
      // Set initial header
      updateHeaderContent({
        title: 'Define Your Brand Persona',
        description: 'Go beyond text. Define how your brand sounds, looks, and speaks. Configure your brand voice, generate an AI avatar, and prepare for voice cloning.'
      });

      // Load configuration options first (lightweight)
      try {
        const options = await getPersonalizationConfigurationOptions();
        setConfigurationOptions(options.options);
      } catch (e) {
        console.error('Failed to load configuration options:', e);
      }

      // Then initialize persona generation (potentially heavy)
      await initialize();
    };

    initSequence();
  }, [updateHeaderContent, initialize]);

  const handleRegenerate = () => {
    setShowPreview(false);
    setCorePersona(null);
    setPlatformPersonas({});
    setQualityMetrics(null);
    generatePersonas();
  };

  useEffect(() => {
    const hasValidData = !!(corePersona && platformPersonas && Object.keys(platformPersonas).length > 0 && qualityMetrics);
    const isComplete = !isGenerating && hasValidData && generationStep === 'preview' && brandAvatarSet && voiceCloneSet;
    
    if (onValidationChange) {
      onValidationChange(isComplete);
    }

    // Trigger Test Persona Modal when all requirements are met (only once per session)
    if (isComplete && !hasTriggeredModal && !showTestPersonaModal) {
        setHasTriggeredModal(true);
        try {
          sessionStorage.setItem(TEST_DRIVE_SEEN_KEY, '1');
        } catch { /* ignore */ }
        setShowTestPersonaModal(true);
    }
  }, [corePersona, platformPersonas, qualityMetrics, isGenerating, generationStep, onValidationChange, brandAvatarSet, voiceCloneSet, hasTriggeredModal, showTestPersonaModal]);

  if (!configurationOptions) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
          Loading personalization options...
        </Typography>
      </Box>
    );
  }

  const websiteUrl =
    onboardingData?.websiteAnalysis?.website_url ||
    onboardingData?.websiteAnalysis?.website ||
    onboardingData?.website ||
    '';
  let domainName: string | undefined;
  try {
    const normalizedUrl = websiteUrl && !/^https?:\/\//i.test(websiteUrl) ? `https://${websiteUrl}` : websiteUrl;
    const hostname = normalizedUrl ? new URL(normalizedUrl).hostname : '';
    domainName = hostname ? hostname.replace(/^www\./i, '') : undefined;
  } catch {
    domainName = undefined;
  }

  return (
    <Box sx={{
      transition: 'background-color 0.3s ease',
      bgcolor: 'transparent',
    }}>
      {/* Step 4 Hero — explainer card at top of step. Now contains the tab switcher
          (clickable source tiles) and the inline completion bar with progress +
          Regenerate + All-set buttons. The standalone tab row is gone. */}
      <Step4Hero
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t)}
        voiceDone={!!(corePersona && Object.keys(platformPersonas).length > 0 && qualityMetrics)}
        visualDone={brandAvatarSet}
        cloneDone={voiceCloneSet}
        isRegenerating={isGenerating}
        onRegenerate={handleRegenerate}
        onTestDrive={openTestDriveModal}
      />

      <Box sx={{ minHeight: 400 }}>
        {activeTab === 'text' && (
          <Box>
            <PersonaLoadingState
              showPreview={showPreview}
              isGenerating={isGenerating}
              corePersona={corePersona}
              progress={progress}
              generationStep={generationStep}
              generationSteps={generationSteps}
              progressMessages={progressMessages}
              error={error}
              pollingError={null}
              success={success}
              handleRegenerate={handleRegenerate}
              generatePersonas={generatePersonas}
              setShowPreview={setShowPreview}
              setSuccess={setSuccess}
            />

            <PersonaPreviewSection
              showPreview={showPreview}
              corePersona={corePersona}
              platformPersonas={platformPersonas}
              qualityMetrics={qualityMetrics}
              selectedPlatforms={selectedPlatforms}
              expandedAccordion={expandedAccordion}
              setExpandedAccordion={setExpandedAccordion}
              setCorePersona={setCorePersona}
              setPlatformPersonas={setPlatformPersonas}
              handleRegenerate={handleRegenerate}
              completeness={completeness}
              data_sufficiency={dataSufficiency}
            />

             <ComingSoonSection onTestPersona={openTestDriveModal} />
          </Box>
        )}

        {activeTab === 'image' && (
          <BrandAvatarStudio 
            domainName={domainName} 
            onAvatarSet={() => {
              setBrandAvatarSet(true);
              checkAssetStatus();
            }} 
          />
        )}

        {activeTab === 'audio' && (
          <VoiceAvatarPlaceholder 
            domainName={domainName} 
            onVoiceSet={() => {
              setVoiceCloneSet(true);
              checkAssetStatus();
            }} 
          />
        )}
      </Box>

      {/* Inline error/success — friendly, with retry on errors */}
      {(error || success) && (
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 1, borderRadius: 2 }}
              action={
                <Button
                  size="small"
                  color="error"
                  variant="text"
                  onClick={handleRegenerate}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Try again
                </Button>
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                We hit a snag
              </Typography>
              <Typography variant="caption">{error}</Typography>
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 1, borderRadius: 2 }}>
              {success}
            </Alert>
          )}
        </Box>
      )}

      {/* Test Persona Modal */}
      <TestPersonaModal
        open={showTestPersonaModal}
        onClose={closeTestDriveModal}
        avatarUrl={avatarUrl}
        voiceUrl={voiceUrl}
        corePersona={corePersona}
        hasVoiceClone={voiceCloneSet}
        hasBrandAvatar={brandAvatarSet}
        onVideoGenerated={(url) => setIntroVideoUrl(url || '')}
      />
    </Box>
  );
};

export default PersonalizationStep;
