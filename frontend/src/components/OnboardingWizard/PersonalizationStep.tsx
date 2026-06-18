import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Alert, 
  Divider,
  Stack,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { 
  TextFields, 
  Face, 
  RecordVoiceOver,
  InfoOutlined,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Assessment as AssessmentIcon,
  Lightbulb
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
  
  // Modal State
  const [showTestPersonaModal, setShowTestPersonaModal] = useState(false);
  const [hasTriggeredModal, setHasTriggeredModal] = useState(false);

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

    // Trigger Test Persona Modal when all requirements are met
    if (isComplete && !hasTriggeredModal && !showTestPersonaModal) {
        setHasTriggeredModal(true);
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

  const tabs = [
    { 
      id: 'text', 
      label: 'Brand Identity', 
      icon: <TextFields />,
      tooltip: 'Define your writing style, brand voice, and content characteristics.'
    },
    { 
      id: 'image', 
      label: 'Brand Avatar', 
      icon: <Face />,
      tooltip: 'Create or enhance a visual avatar for your brand using AI.'
    },
    { 
      id: 'audio', 
      label: 'Voice Clone', 
      icon: <RecordVoiceOver />,
      tooltip: 'Create a premium AI voice model based on your unique vocal characteristics.'
    },
  ];

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
      {/* Tabbed Navigation Styled as Buttons */}
      <Stack 
        direction="row" 
        spacing={2} 
        justifyContent="center" 
        sx={{ mb: 6 }}
      >
        {tabs.map((tab) => (
          <Tooltip key={tab.id} title={tab.tooltip} arrow placement="top">
            <Button
              variant={activeTab === tab.id ? 'contained' : 'outlined'}
              startIcon={tab.icon}
              onClick={() => setActiveTab(tab.id as PersonalizationTab)}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 3,
                textTransform: 'none',
                fontWeight: 'bold',
                boxShadow: activeTab === tab.id ? 4 : 0,
                transition: 'all 0.2s ease',
                background: activeTab === tab.id ? 'linear-gradient(45deg, #7C3AED 0%, #EC4899 100%)' : undefined,
                color: activeTab === tab.id ? '#FFFFFF' : undefined,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 2,
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {tab.label}
                <Lightbulb 
                  sx={{ 
                    fontSize: 18,
                    color: (
                      (tab.id === 'text' && corePersona) || 
                      (tab.id === 'image' && brandAvatarSet) || 
                      (tab.id === 'audio' && voiceCloneSet)
                    ) 
                      ? (activeTab === tab.id ? '#A7F3D0' : '#10B981') // Light green on active, Green on inactive
                      : (activeTab === tab.id ? '#FCA5A5' : '#EF4444'), // Light red on active, Red on inactive
                    filter: 'drop-shadow(0 0 2px currentColor)',
                    transition: 'color 0.3s ease'
                  }} 
                />
              </Box>
            </Button>
          </Tooltip>
        ))}
      </Stack>

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
            />

            <ComingSoonSection onTestPersona={() => setShowTestPersonaModal(true)} />
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

      <Divider sx={{ my: 4 }} />

      {activeTab === 'text' && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoOutlined color="action" fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              All steps (Identity, Avatar, and Voice) are required to complete your brand personalization.
            </Typography>
          </Box>

          <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            
            {/* 'Save & Continue' button removed as per requirements. 
                Navigation is now handled by the main Wizard button (2). */}
          </Box>
        </Box>
      )}

      {/* Test Persona Modal */}
      <TestPersonaModal 
        open={showTestPersonaModal} 
        onClose={() => setShowTestPersonaModal(false)}
        avatarUrl={avatarUrl}
        voiceUrl={voiceUrl}
        onVideoGenerated={(url) => setIntroVideoUrl(url || '')}
      />
    </Box>
  );
};

export default PersonalizationStep;
