import React from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { type GenerationStep } from './PersonaStep/PersonaGenerationProgress';
import { TestPersonaModal } from './PersonalizationStep/components/TestPersonaModal';
import { Step4Hero } from './PersonaStep/Step4Hero';
import { PersonalizationStepTabs } from './PersonalizationStep/PersonalizationStepTabs';
import {
  usePersonalizationStepController,
  type PersonalizationStepProps,
} from './PersonalizationStep/usePersonalizationStepController';

const PersonalizationStep: React.FC<PersonalizationStepProps> = (props) => {
  const {
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
  } = usePersonalizationStepController(props);

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

  return (
    <Box sx={{
      transition: 'background-color 0.3s ease',
      bgcolor: 'transparent',
    }}>
      <Step4Hero
        activeTab={activeTab}
        onTabChange={handleTabChange}
        voiceDone={!!(corePersona && Object.keys(platformPersonas).length > 0 && qualityMetrics)}
        visualDone={brandAvatarSet}
        cloneDone={voiceCloneSet}
        isRegenerating={isGenerating}
        onRegenerate={handleRegenerate}
        onTestDrive={openTestDriveModal}
      />

      <PersonalizationStepTabs
        activeTab={activeTab}
        showPreview={showPreview}
        isGenerating={isGenerating}
        corePersona={corePersona}
        progress={progress}
        generationStep={generationStep}
        generationSteps={generationSteps}
        progressMessages={progressMessages}
        error={error}
        success={success}
        platformPersonas={platformPersonas}
        qualityMetrics={qualityMetrics}
        platforms={platforms}
        completeness={completeness}
        dataSufficiency={dataSufficiency}
        domainName={domainName}
        setCorePersona={setCorePersona}
        setPlatformPersonas={setPlatformPersonas}
        handleRegenerate={handleRegenerate}
        generatePersonas={generatePersonas}
        setShowPreview={setShowPreview}
        setSuccess={setSuccess}
        onGenerateNow={handleGenerateNow}
        onAvatarSet={() => {
          setBrandAvatarSet(true);
          checkAssetStatus();
        }}
        onVoiceSet={() => {
          setVoiceCloneSet(true);
          checkAssetStatus();
        }}
      />

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

      <Backdrop
        open={!!generatingPlatform}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: '#fff', flexDirection: 'column', gap: 2 }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Generating {generatingPlatformName} persona…
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
          This takes a few seconds. Please don't close the window.
        </Typography>
      </Backdrop>
    </Box>
  );
};

export default PersonalizationStep;
