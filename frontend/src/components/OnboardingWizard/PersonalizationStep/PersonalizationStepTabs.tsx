import React from 'react';
import { Box } from '@mui/material';
import { PersonaLoadingState } from '../PersonaStep/PersonaLoadingState';
import { PersonaPreviewSection } from '../PersonaStep/PersonaPreviewSection';
import { BrandAvatarStudio } from './components/BrandAvatarStudio';
import { VoiceAvatarPlaceholder } from './components/VoiceAvatarPlaceholder';
import type { PersonaPlatform } from '../../../api/personaApi';

type PersonalizationTab = 'text' | 'image' | 'audio';

interface PersonalizationStepTabsProps {
  activeTab: PersonalizationTab;
  showPreview: boolean;
  isGenerating: boolean;
  corePersona: any;
  progress: number;
  generationStep: string;
  generationSteps: any[];
  progressMessages: string[];
  error: string | null;
  success: string | null;
  platformPersonas: Record<string, any>;
  qualityMetrics: any;
  platforms: PersonaPlatform[];
  completeness: any;
  dataSufficiency: number | null;
  domainName?: string;
  setCorePersona: (persona: any) => void;
  setPlatformPersonas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  handleRegenerate: () => void;
  generatePersonas: () => Promise<void>;
  setShowPreview: (show: boolean) => void;
  setSuccess: (message: string | null) => void;
  onGenerateNow: (platformId: string) => Promise<void>;
  onAvatarSet: () => void;
  onVoiceSet: () => void;
}

export const PersonalizationStepTabs: React.FC<PersonalizationStepTabsProps> = ({
  activeTab,
  showPreview,
  isGenerating,
  corePersona,
  progress,
  generationStep,
  generationSteps,
  progressMessages,
  error,
  success,
  platformPersonas,
  qualityMetrics,
  platforms,
  completeness,
  dataSufficiency,
  domainName,
  setCorePersona,
  setPlatformPersonas,
  handleRegenerate,
  generatePersonas,
  setShowPreview,
  setSuccess,
  onGenerateNow,
  onAvatarSet,
  onVoiceSet,
}) => (
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
          platforms={platforms}
          setCorePersona={setCorePersona}
          setPlatformPersonas={setPlatformPersonas}
          onGenerateNow={onGenerateNow}
          completeness={completeness}
          data_sufficiency={dataSufficiency}
        />
      </Box>
    )}
    {activeTab === 'image' && (
      <BrandAvatarStudio domainName={domainName} onAvatarSet={onAvatarSet} />
    )}
    {activeTab === 'audio' && (
      <VoiceAvatarPlaceholder domainName={domainName} onVoiceSet={onVoiceSet} />
    )}
  </Box>
);
