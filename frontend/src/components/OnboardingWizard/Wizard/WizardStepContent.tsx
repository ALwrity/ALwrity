import React from 'react';
import { Box, Slide } from '@mui/material';
import WebsiteStep from '../WebsiteStep';
import LinkedInConnectStep from '../LinkedInConnectStep';
import CompetitorAnalysisStep from '../CompetitorAnalysisStep';
import LinkedInResearchStep from '../LinkedInResearchStep';
import PersonalizationStep from '../PersonalizationStep';
import FinalStep from '../FinalStep';
import { ONBOARDING_STORAGE_KEYS } from '../common/onboardingStorageKeys';
import {
  mergeResearchSeedIntoStepData,
  shouldHydrateResearchFromBackend,
} from '../CompetitorAnalysisStep/competitorResearchRestore';
import { readLiveWebsiteUrlFromStorage } from '../common/wizardLiveWebsiteSession';

interface StepHeaderContent {
  title: string;
  description: string;
}

export interface WizardStepContentProps {
  step: number;
  direction: 'left' | 'right';
  onboardingType: string;
  websiteSessionKey: string;
  stepData: any;
  email: string;
  backgroundTasks: any;
  successMessage: string | null;
  setSuccessMessage: (message: string | null) => void;
  completedFrontier: number;
  isConnectStepOfficiallyComplete: boolean;
  personaOnboardingData: Record<string, unknown>;
  personaStepData: Record<string, unknown>;
  handleNext: (stepData?: any) => void;
  handleBack: () => void;
  handleComplete: () => void;
  handleViewBackgroundResults: (taskKey: string) => void;
  updateHeaderContent: (content: StepHeaderContent) => void;
  onStep0Valid: (valid: boolean) => void;
  onStep1Valid: (valid: boolean) => void;
  onStep2Valid: (valid: boolean) => void;
  handleWebsiteDataReady: (collector: (() => any) | undefined) => void;
  handleCompetitorDataReady: (collector: (() => any) | undefined) => void;
  handleStepDataChange: (data: any) => void;
  onWebsiteAnalysisChanged?: (params: {
    websiteUrl: string;
    reason: 'reanalyze' | 'new_website' | 'start_fresh' | 'load_existing';
  }) => void | Promise<void>;
  onLiveWebsiteSessionChange?: (payload: { website: string; analysis: any }) => void;
  backendResearchData?: Record<string, unknown> | null;
  backendConnectWebsite?: string;
}

export const WizardStepContent: React.FC<WizardStepContentProps> = ({
  step,
  direction,
  onboardingType,
  websiteSessionKey,
  stepData,
  email,
  backgroundTasks,
  successMessage,
  setSuccessMessage,
  completedFrontier,
  isConnectStepOfficiallyComplete,
  personaOnboardingData,
  personaStepData,
  handleNext,
  handleBack,
  handleComplete,
  handleViewBackgroundResults,
  updateHeaderContent,
  onStep0Valid,
  onStep1Valid,
  onStep2Valid,
  handleWebsiteDataReady,
  handleCompetitorDataReady,
  handleStepDataChange,
  onWebsiteAnalysisChanged,
  onLiveWebsiteSessionChange,
  backendResearchData = null,
  backendConnectWebsite = '',
}) => {
  const liveWebsiteUrl =
    stepData?.website ||
    stepData?.website_url ||
    readLiveWebsiteUrlFromStorage() ||
    '';

  const researchInitialData =
    shouldHydrateResearchFromBackend(
      stepData,
      backendResearchData,
      backendConnectWebsite,
      liveWebsiteUrl,
      completedFrontier >= 1
    ) && backendResearchData
      ? mergeResearchSeedIntoStepData(stepData, backendResearchData, backendConnectWebsite)
      : stepData;

  const step0Component =
    onboardingType === 'linkedin' ? (
      <LinkedInConnectStep
        key="linkedin-connect"
        onContinue={handleNext}
        updateHeaderContent={updateHeaderContent}
        onValidationChange={onStep0Valid}
        onDataReady={handleWebsiteDataReady}
      />
    ) : (
      <WebsiteStep
        key="website"
        onContinue={handleNext}
        updateHeaderContent={updateHeaderContent}
        onValidationChange={onStep0Valid}
        onDataReady={handleWebsiteDataReady}
        email={email}
        backgroundTasks={backgroundTasks}
        onViewBackgroundResults={handleViewBackgroundResults}
        success={successMessage}
        setSuccess={setSuccessMessage}
        isConnectStepCompleted={isConnectStepOfficiallyComplete}
        onWebsiteAnalysisChanged={onWebsiteAnalysisChanged}
        onLiveWebsiteSessionChange={onLiveWebsiteSessionChange}
      />
    );

  const stepComponents = [
    step0Component,
    onboardingType === 'linkedin' ? (
      <LinkedInResearchStep
        key="linkedin-research"
        onContinue={handleNext}
        updateHeaderContent={updateHeaderContent}
        onValidationChange={onStep1Valid}
        onDataReady={handleCompetitorDataReady}
      />
    ) : (
      <CompetitorAnalysisStep
        key={`research-${websiteSessionKey}`}
        onContinue={handleNext}
        onBack={handleBack}
        userUrl={
          liveWebsiteUrl ||
          localStorage.getItem(ONBOARDING_STORAGE_KEYS.websiteUrl) ||
          ''
        }
        industryContext={stepData?.industryContext}
        initialData={researchInitialData}
        researchStepCompleted={completedFrontier >= 1}
        onDataReady={handleCompetitorDataReady}
        onValidationChange={onStep1Valid}
      />
    ),
    <PersonalizationStep
      key={`personalization-${websiteSessionKey}`}
      onContinue={handleNext}
      onValidationChange={onStep2Valid}
      onDataChange={handleStepDataChange}
      onboardingType={onboardingType}
      onboardingData={personaOnboardingData}
      stepData={personaStepData}
    />,
    <FinalStep
      key="final"
      onContinue={handleComplete}
      updateHeaderContent={updateHeaderContent}
      onboardingType={onboardingType}
    />,
  ];

  return (
    <Slide direction={direction} in={true} mountOnEnter unmountOnExit key={`step-${step}`}>
      <Box sx={{ minHeight: 'auto', display: 'flex', flexDirection: 'column' }}>
        {stepComponents[step]}
      </Box>
    </Slide>
  );
};
