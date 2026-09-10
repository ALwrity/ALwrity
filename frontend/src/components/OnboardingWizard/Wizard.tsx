import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useUser } from '@clerk/clerk-react';
import { WizardLoadingState } from './common/WizardLoadingState';
import { useOnboardingTasksStatus } from '../../hooks/useOnboardingTasksStatus';
import {
  getOnboardingProgressState,
} from './common/onboardingProgressState';
import { useOnboardingResumeToast } from './common/useOnboardingResumeToast';
import {
  resolveCurrentWebsiteSessionKey,
} from './common/onboardingStorageKeys';
import type { OnboardingArtifactStep } from './common/onboardingArtifactRestore';
import { useOnboardingArtifactRestoreToast } from './common/useOnboardingArtifactRestoreToast';
import {
  applyLiveWebsiteSessionToStepData,
  mergeArtifactAwareSeedIntoStepData,
  readLiveWebsiteAnalysisFromStorage,
  readLiveWebsiteUrlFromStorage,
} from './common/wizardLiveWebsiteSession';
import {
  getStepValidationMessage,
  isStepDataValid,
  resolveStepValidationData,
} from './common/wizardStepValidation';
import {
  buildConnectStepSnapshot,
  getConnectPayloadForGuard,
  type ConnectStepSnapshot,
  shouldBlockProgressNavigation,
} from './common/wizardStepNavigationGuard';
import { STEP0_NAV_TITLE } from './WebsiteStep/constants/websiteStepLayout';
import {
  applyDownstreamDirtyProgressOverride,
  clearDownstreamDirtyFlag,
  clearDownstreamLocalCaches,
  isEffectiveStartFreshSession,
  isWebsiteStartFreshSession,
  setCommittedStep1WebsiteUrl,
  stripDownstreamStepData,
} from './utils/onboardingWebsiteReset';
import { invalidateDownstreamOnboardingSteps } from '../../api/onboarding';
import { buildResearchStepDataPatch } from './utils/onboardingResearchSessionChange';
import { WizardStepContent } from './Wizard/WizardStepContent';
import { useWizardStepAdvance, useWizardStepRetry } from './Wizard/useWizardStepAdvance';
import { WizardShell } from './Wizard/WizardShell';


// Set to true in dev to restore verbose per-action tracing
const DEV_DEBUG = false;
const trace = DEV_DEBUG ? console.log : (..._args: any[]) => {};

const websiteSteps = [
  { label: 'Connect Platforms', description: 'Set up your website and platforms', icon: '🌐' },
  { label: 'Research', description: 'Discover competitors', icon: '🔍' },
  { label: 'Personalization', description: 'Customize your experience', icon: '⚙️' },
  { label: 'Finish', description: 'Complete setup', icon: '✅' }
];

interface WizardProps {
  onComplete?: () => void;
}

interface StepHeaderContent {
  title: string;
  description: string;
}

const getBackendStep = (backendSteps: any[], frontendIndex: number) =>
  backendSteps.find(step => step.step_number === frontendIndex + 1);

const Wizard: React.FC<WizardProps> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const { loading, currentStep, completionPercentage, data, refresh, markStepComplete, resetOptimisticProgressFloor } =
    useOnboarding();
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [showHelp, setShowHelp] = useState(false);
  const [showProgressMessage, setShowProgressMessage] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressMessageIsError, setProgressMessageIsError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Retry state for step completion failures
  const [retryStepNumber, setRetryStepNumber] = useState<number | null>(null);
  const [retryStepData, setRetryStepData] = useState<any>(null);
  const [retryNextStep, setRetryNextStep] = useState<number>(0);
  // sessionId removed - backend uses Clerk user ID from auth token
  const [stepData, setStepData] = useState<any>(null);
  const [lastRestoredSteps, setLastRestoredSteps] = useState<OnboardingArtifactStep[]>([]);
  const [downstreamLocked, setDownstreamLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('onboarding_downstream_dirty') === 'true';
    } catch {
      return false;
    }
  });
  const { user } = useUser();
  const [email, setEmail] = useState<string>('');

  // Sync email from backend onboarding step data or Clerk fallback
  useEffect(() => {
    if (data?.onboarding?.steps) {
      const step1Data = getBackendStep(data.onboarding.steps, 0);
      if (step1Data?.data?.email) {
        setEmail(step1Data.data.email);
        return;
      }
    }
    if (stepData?.email) {
      setEmail(stepData.email);
      return;
    }
    if (user) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      const firstEmail = user.emailAddresses?.[0]?.emailAddress;
      const resolvedEmail = primaryEmail || firstEmail || '';
      if (resolvedEmail) {
        setEmail(resolvedEmail);
      }
    }
  }, [data, stepData?.email, user]);

  // Auto-clear success message after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleEmailChange = useCallback((newEmail: string) => {
    setEmail(newEmail);
    setStepData((prev: any) => ({
      ...prev,
      email: newEmail
    }));
  }, []);
  const [competitorDataCollector, setCompetitorDataCollector] = useState<(() => any) | null>(null);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState<boolean>(false);
  const [stepValidationStates, setStepValidationStates] = useState<Record<number, boolean>>({});
  const [stepHeaderContent, setStepHeaderContent] = useState<StepHeaderContent>({
    title: websiteSteps[0].label,
    description: websiteSteps[0].description
  });
  const [validationMessage, setValidationMessage] = useState<string>('');
  const { data: backgroundTasks } = useOnboardingTasksStatus();
  // Default onboarding type from enabled features when no session exists yet.
  const defaultOnboardingType = useMemo(() => {
    const enabled = new Set(
      (process.env.REACT_APP_ENABLED_FEATURES || 'all')
        .toLowerCase()
        .split(',')
        .map(f => f.trim())
    );
    return enabled.has('linkedin') && !enabled.has('all') ? 'linkedin' : 'website';
  }, []);

  const onboardingType = data?.onboarding?.onboarding_type || defaultOnboardingType;
  const steps = useMemo(() => websiteSteps, []);

  const isOnboardingComplete = data?.onboarding?.is_completed ?? false;

  // Progress-first SSOT: ring, checkmarks, and step access all derive from completion_percentage.
  const progressState = useMemo(() => {
    const base = getOnboardingProgressState(completionPercentage, steps.length, isOnboardingComplete);
    if (!downstreamLocked) {
      return base;
    }
    return applyDownstreamDirtyProgressOverride(base);
  }, [completionPercentage, steps.length, isOnboardingComplete, downstreamLocked]);

  const { percent: setupProgressPercent, completedFrontier, furthestAccessibleStep } = progressState;
  const isConnectStepOfficiallyComplete = completedFrontier >= 0 && !downstreamLocked;

  useEffect(() => {
    if (isConnectStepOfficiallyComplete && !isEffectiveStartFreshSession()) {
      setDownstreamLocked(false);
      clearDownstreamDirtyFlag();
    }
  }, [isConnectStepOfficiallyComplete]);

  const { resumeToast, dismissResumeToast } = useOnboardingResumeToast({
    loading,
    completionPercentage,
    currentStep,
    totalSteps: steps.length,
    isCompleted: isOnboardingComplete,
    stepLabels: steps.map((step) => step.label),
  });

  const { restoreToast, dismissRestoreToast } = useOnboardingArtifactRestoreToast({
    loading,
    activeStep,
    backendSteps: data?.onboarding?.steps,
    isStartFreshSession: isWebsiteStartFreshSession(),
    restoredSteps: lastRestoredSteps,
  });

  const displayResumeToast = restoreToast ?? resumeToast;
  const handleDismissResumeToast = useCallback(() => {
    dismissRestoreToast();
    dismissResumeToast();
  }, [dismissRestoreToast, dismissResumeToast]);

  // Prevent activeStep from sitting ahead of what completion_percentage unlocks.
  useEffect(() => {
    if (activeStep > furthestAccessibleStep) {
      setActiveStep(furthestAccessibleStep);
      try {
        localStorage.setItem('onboarding_active_step', String(furthestAccessibleStep));
      } catch (_e) {}
    }
  }, [activeStep, furthestAccessibleStep]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const stepDataRef = useRef(stepData);
  const competitorDataCollectorRef = useRef(competitorDataCollector);
  const websiteDataCollectorRef = useRef<(() => any) | null>(null);
  const lastCommittedConnectRef = useRef<ConnectStepSnapshot | null>(null);

  const commitConnectStepSnapshot = useCallback(
    (payload: unknown) => {
      const snapshot = buildConnectStepSnapshot(onboardingType, payload);
      if (snapshot) {
        lastCommittedConnectRef.current = snapshot;
      }
    },
    [onboardingType]
  );

  const showProgressNavigationMessage = useCallback((message: string) => {
    setProgressMessageIsError(true);
    setShowProgressMessage(true);
    setProgressMessage(message);
    setTimeout(() => {
      setShowProgressMessage(false);
      setProgressMessageIsError(false);
    }, 4000);
  }, []);

  useEffect(() => {
    stepDataRef.current = stepData;
  }, [stepData]);

  useEffect(() => {
    competitorDataCollectorRef.current = competitorDataCollector;
    trace('Wizard: competitorDataCollector changed:', competitorDataCollector);
  }, [competitorDataCollector]);

  // Validate current step data
  useEffect(() => {
    if (activeStep === 0 && isConnectStepOfficiallyComplete) {
      setIsCurrentStepValid(true);
      setValidationMessage('');
      return;
    }

    const resolved = resolveStepValidationData({
      activeStep,
      stepData,
      competitorDataCollector,
      stepValidationStates,
    });

    const isValid =
      typeof resolved === 'boolean'
        ? resolved
        : isStepDataValid(activeStep, resolved, onboardingType);

    setIsCurrentStepValid(isValid);
    setValidationMessage(
      getStepValidationMessage(activeStep, resolved, onboardingType, isValid)
    );
  }, [
    activeStep,
    stepData,
    competitorDataCollector,
    stepValidationStates,
    onboardingType,
    isConnectStepOfficiallyComplete,
  ]);

  const handleWebsiteAnalysisChanged = useCallback(
    async ({
      websiteUrl,
      reason,
    }: {
      websiteUrl: string;
      reason: 'reanalyze' | 'new_website' | 'start_fresh' | 'load_existing';
    }) => {
      console.log('[Wizard] Website analysis changed — invalidating downstream steps:', {
        websiteUrl,
        reason,
      });

      setDownstreamLocked(true);
      clearDownstreamLocalCaches();
      resetOptimisticProgressFloor();
      setStepData((prev: any) => {
        const next = stripDownstreamStepData(prev) as Record<string, unknown>;
        delete next.analysis;
        delete next.crawlResult;
        delete next.domainName;
        if (websiteUrl) {
          next.website = websiteUrl;
          next.website_url = websiteUrl;
        } else {
          delete next.website;
          delete next.website_url;
        }
        return next;
      });

      try {
        await invalidateDownstreamOnboardingSteps({
          website_url: websiteUrl || undefined,
          reason,
        });
      } catch (err) {
        console.error('[Wizard] Backend invalidate-downstream failed; continuing with local reset:', err);
      }

      try {
        await refresh({ silent: reason === 'start_fresh' });
      } catch (err) {
        console.error('[Wizard] Refresh after website analysis change failed:', err);
      }

      if (activeStep > 0) {
        setActiveStep(0);
        try {
          localStorage.setItem('onboarding_active_step', '0');
        } catch (_e) {}
      }
    },
    [activeStep, refresh, resetOptimisticProgressFloor]
  );

  // Handle validation changes from individual steps
  const handleStepValidationChange = useCallback((step: number, isValid: boolean) => {
    trace(`Wizard: handleStepValidationChange - step: ${step}, isValid: ${isValid}`);
    setStepValidationStates(prev => {
      if (prev[step] === isValid) {
        return prev;
      }
      const newState = { ...prev, [step]: isValid };
      trace(`Wizard: Updated stepValidationStates:`, newState);
      return newState;
    });
  }, []);

  const onStep0Valid = useCallback((v: boolean) => handleStepValidationChange(0, v), [handleStepValidationChange]);
  const onStep1Valid = useCallback((v: boolean) => handleStepValidationChange(1, v), [handleStepValidationChange]);
  const onStep2Valid = useCallback((v: boolean) => handleStepValidationChange(2, v), [handleStepValidationChange]);
  
  // Memoize the onDataReady callback to prevent infinite loops
  const handleCompetitorDataReady = useCallback((dataCollector: (() => any) | undefined) => {
    trace('Wizard: onDataReady called with:', dataCollector);
    if (typeof dataCollector === 'function') {
      setCompetitorDataCollector(dataCollector);
    } else {
      console.error('Wizard: dataCollector is not a function:', dataCollector);
    }
  }, []);

  const handleWebsiteDataReady = useCallback((dataCollector: (() => any) | undefined) => {
    if (typeof dataCollector === 'function') {
      websiteDataCollectorRef.current = dataCollector;
    } else {
      console.error('Wizard: website dataCollector is not a function:', dataCollector);
    }
  }, []);

  // Seed stepData from OnboardingContext when data loads
  useEffect(() => {
    if (!data?.onboarding?.steps) return;
    
    const { onboarding } = data;
    
    // Merge step payload data from backend.
    // Renumbered: 1=Connect, 2=Research, 3=Personalization (frontend 0,1,2).
    if (onboarding.steps && Array.isArray(onboarding.steps)) {
      const step1Data = getBackendStep(onboarding.steps, 0);
      const step2Data = getBackendStep(onboarding.steps, 1);
      const step3Data = getBackendStep(onboarding.steps, 2);
      const liveWebsiteUrl = readLiveWebsiteUrlFromStorage();
      const liveAnalysis = readLiveWebsiteAnalysisFromStorage();

      const seedPayload = {
        connect: {
          data: step1Data?.data || null,
          hasData: step1Data?.has_data === true,
        },
        research: {
          data: step2Data?.data || null,
          hasData: step2Data?.has_data === true,
        },
        personalization: {
          data: step3Data?.data || null,
          hasData: step3Data?.has_data === true,
        },
      };

      setStepData((prev: any) => {
        const { stepData: merged, restoredSteps } = mergeArtifactAwareSeedIntoStepData(
          prev,
          seedPayload,
          liveWebsiteUrl,
          liveAnalysis,
          { suppressBackendConnectSeed: isEffectiveStartFreshSession() }
        );
        setLastRestoredSteps(restoredSteps);
        return merged;
      });

      if (step1Data?.data) {
        const d = step1Data.data;
        const committedWebsite = d.website || d.website_url;
        const connectHasRestorableData =
          step1Data.has_data === true || step1Data.status === 'completed';
        if (
          committedWebsite &&
          connectHasRestorableData &&
          !isEffectiveStartFreshSession()
        ) {
          setCommittedStep1WebsiteUrl(committedWebsite);
          setDownstreamLocked(false);
          commitConnectStepSnapshot(step1Data.data);
        }
      }
    }

    // Set active step from context (1-based → 0-based), clamped to unlocked frontier.
    let computedStep = Math.max(0, Math.min(steps.length - 1, currentStep - 1));
    if (onboarding.is_completed) {
      computedStep = steps.length - 1;
    }
    const lsStep = localStorage.getItem('onboarding_active_step');
    if (lsStep !== null) {
      const lsIdx = Math.max(0, Math.min(steps.length - 1, parseInt(lsStep, 10)));
      if (!Number.isNaN(lsIdx) && lsIdx > computedStep && lsIdx <= furthestAccessibleStep) {
        computedStep = lsIdx;
      }
    }
    computedStep = Math.min(computedStep, furthestAccessibleStep);
    setActiveStep(computedStep);
    if (onboarding.steps) {
      localStorage.setItem('onboarding_active_step', String(computedStep));
    }

  }, [data, currentStep, steps.length, furthestAccessibleStep, completedFrontier, commitConnectStepSnapshot]);

  const { handleNext } = useWizardStepAdvance({
    activeStep,
    stepsLength: steps.length,
    onboardingType,
    competitorDataCollectorRef,
    websiteDataCollectorRef,
    stepDataRef,
    setStepData,
    setDirection,
    setActiveStep,
    setShowProgressMessage,
    setProgressMessage,
    setProgressMessageIsError,
    setSuccessMessage,
    setRetryStepNumber,
    setRetryStepData,
    setRetryNextStep,
    commitConnectStepSnapshot,
    markStepComplete,
    setDownstreamLocked,
  });

  const { retryStepCompletion, dismissRetry } = useWizardStepRetry({
    retryStepNumber,
    retryStepData,
    retryNextStep,
    onboardingType,
    setRetryStepNumber,
    setRetryStepData,
    setRetryNextStep,
    setShowProgressMessage,
    setProgressMessage,
    setProgressMessageIsError,
    setActiveStep,
    markStepComplete,
    commitConnectStepSnapshot,
    setDownstreamLocked,
  });

  const handleBack = useCallback(async () => {
    setDirection('left');
    const prevStep = activeStep - 1;
    setActiveStep(prevStep);
    try {
      localStorage.setItem('onboarding_active_step', String(prevStep));
    } catch (_e) {}
    // Do not complete a step when navigating back; just update UI state
    // Backend step progression should only occur on forward completion with valid data
  }, [activeStep]);

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex > furthestAccessibleStep) {
      return;
    }

    const blockResult = shouldBlockProgressNavigation(stepIndex, {
      onboardingType,
      completedFrontier,
      furthestAccessibleStep,
      lastCommitted: lastCommittedConnectRef.current,
      currentConnectPayload: getConnectPayloadForGuard(
        websiteDataCollectorRef.current,
        stepDataRef.current
      ),
    });

    if (blockResult.blocked) {
      showProgressNavigationMessage(blockResult.message);
      return;
    }

    setDirection(stepIndex > activeStep ? 'right' : 'left');
    setActiveStep(stepIndex);
    try {
      localStorage.setItem('onboarding_active_step', String(stepIndex));
    } catch (_e) {}
  };

  const [backgroundSetupFocus, setBackgroundSetupFocus] = useState<{
    token: number;
    taskKey?: string;
  }>({ token: 0 });

  const handleViewBackgroundResults = (taskKey: string) => {
    handleStepClick(0);
    setBackgroundSetupFocus((prev) => ({ token: prev.token + 1, taskKey }));
  };

  const updateHeaderContent = useCallback((content: StepHeaderContent) => {
    setStepHeaderContent(prev => {
      if (prev.title === content.title && prev.description === content.description) {
        return prev;
      }
      return content;
    });
  }, []);

  // Synchronize default header content based on step index when it changes
  // This serves as a foolproof fallback or default, ensuring going back/forth is completely regular!
  useEffect(() => {
    const step = activeStep;
    if (step === 0) {
      if (onboardingType === 'linkedin') {
        setStepHeaderContent({
          title: "Connect Your LinkedIn",
          description: "Connect your LinkedIn account so ALwrity can analyze your profile, posts, and writing style. This powers your persona and content strategy."
        });
      } else {
        setStepHeaderContent({
          title: STEP0_NAV_TITLE,
          description: "Let Alwrity analyze your website to understand your brand voice, writing style, and content characteristics. This helps us generate content that matches your existing tone and resonates with your audience."
        });
      }
    } else if (step === 1) {
      if (onboardingType === 'linkedin') {
        setStepHeaderContent({
          title: "Industry Research",
          description: "ALwrity analyzed your industry and profile to discover trending topics, content gaps, and creators worth following. Review the findings, then continue."
        });
      } else {
        setStepHeaderContent({
          title: "Industry Research",
          description: "Discover competitor ideas and explore growth insights."
        });
      }
    } else if (step === 2) {
      setStepHeaderContent({
        title: "Define Your Brand Persona",
        description: "Go beyond text. Define how your brand sounds, looks, and speaks. Configure your brand voice, generate an AI avatar, and prepare for voice cloning."
      });
    } else if (step === 3) {
      if (onboardingType === 'linkedin') {
        setStepHeaderContent({
          title: "Review & Launch Your LinkedIn Workspace 🚀",
          description: "Review your LinkedIn profile, persona, and content preferences before launching your AI-powered LinkedIn growth workspace."
        });
      } else {
        setStepHeaderContent({
          title: "Review & Launch Alwrity 🚀",
          description: "Review your configuration and confirm all settings before launching your AI-powered content creation workspace."
        });
      }
    }
  }, [activeStep, onboardingType]);

  const handleComplete = useCallback(async () => {
    console.log('Wizard: handleComplete called - completing onboarding');
    try {
      // Call onComplete to notify parent component
      onComplete?.();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }, [onComplete]);

  // Memoize data objects passed as props to avoid recreating them each render
  const personaOnboardingData = useMemo(() => ({
    website: stepData?.website || stepData?.website_url || '',
    websiteAnalysis: stepData?.analysis,
    competitorResearch: stepData?.competitors,
    sitemapAnalysis: stepData?.sitemapAnalysis,
    businessData: stepData?.businessData
  }), [
    stepData?.website,
    stepData?.website_url,
    stepData?.analysis,
    stepData?.competitors,
    stepData?.sitemapAnalysis,
    stepData?.businessData,
  ]);

  const websiteSessionKey = useMemo(
    () =>
      resolveCurrentWebsiteSessionKey(
        stepData?.website || stepData?.website_url || readLiveWebsiteUrlFromStorage(),
        stepData?.analysis
      ),
    [stepData?.website, stepData?.website_url, stepData?.analysis]
  );

  const personaStepData = useMemo(() => ({
    corePersona: stepData?.corePersona,
    platformPersonas: stepData?.platformPersonas,
    qualityMetrics: stepData?.qualityMetrics,
    selectedPlatforms: stepData?.selectedPlatforms
  }), [stepData?.corePersona, stepData?.platformPersonas, stepData?.qualityMetrics, stepData?.selectedPlatforms]);

  const handleLiveWebsiteSessionChange = useCallback(
    (payload: { website: string; analysis: any }) => {
      setStepData((prev: any) =>
        applyLiveWebsiteSessionToStepData(prev, {
          website: payload.website,
          analysis: payload.analysis,
        })
      );
    },
    []
  );

  const handleResearchSessionChange = useCallback((payload: Record<string, unknown>) => {
    setStepData((prev: any) => ({
      ...prev,
      ...buildResearchStepDataPatch(payload),
    }));
  }, []);

  const handleStepDataChange = useCallback((data: any) => {
    trace('Wizard: handleStepDataChange:', data ? Object.keys(data) : 'empty');
    setStepData((prev: any) => ({
      ...prev,
      ...data
    }));
  }, []);

  const backendConnectWebsite = useMemo(() => {
    const step1 = data?.onboarding?.steps?.find((s: any) => s.step_number === 1);
    return String(step1?.data?.website || step1?.data?.website_url || '').trim();
  }, [data?.onboarding?.steps]);

  const backendResearchData = useMemo(() => {
    const step2 = data?.onboarding?.steps?.find((s: any) => s.step_number === 2);
    return (step2?.data as Record<string, unknown> | undefined) || null;
  }, [data?.onboarding?.steps]);

  const backendStep2HasData = useMemo(() => {
    const step2 = data?.onboarding?.steps?.find((s: any) => s.step_number === 2);
    return step2?.has_data === true;
  }, [data?.onboarding?.steps]);

  const renderStepContent = (step: number) => (
    <WizardStepContent
      step={step}
      direction={direction}
      onboardingType={onboardingType}
      websiteSessionKey={websiteSessionKey}
      stepData={stepData}
      email={email}
      backgroundTasks={backgroundTasks}
      backgroundSetupFocus={backgroundSetupFocus}
      successMessage={successMessage}
      setSuccessMessage={setSuccessMessage}
      completedFrontier={completedFrontier}
      isConnectStepOfficiallyComplete={isConnectStepOfficiallyComplete}
      personaOnboardingData={personaOnboardingData}
      personaStepData={personaStepData}
      handleNext={handleNext}
      handleBack={handleBack}
      handleComplete={handleComplete}
      handleViewBackgroundResults={handleViewBackgroundResults}
      updateHeaderContent={updateHeaderContent}
      onStep0Valid={onStep0Valid}
      onStep1Valid={onStep1Valid}
      onStep2Valid={onStep2Valid}
      handleWebsiteDataReady={handleWebsiteDataReady}
      handleCompetitorDataReady={handleCompetitorDataReady}
      handleStepDataChange={handleStepDataChange}
      onWebsiteAnalysisChanged={handleWebsiteAnalysisChanged}
      onLiveWebsiteSessionChange={handleLiveWebsiteSessionChange}
      onResearchSessionChange={handleResearchSessionChange}
      backendResearchData={backendResearchData}
      backendConnectWebsite={backendConnectWebsite}
      backendStep2HasData={backendStep2HasData}
    />
  );

  // Show loading state if loading
  if (loading) {
    return <WizardLoadingState loading={loading} />;
  }

  return (
    <WizardShell
      activeStep={activeStep}
      steps={steps}
      stepHeaderContent={stepHeaderContent}
      showProgressMessage={showProgressMessage}
      progressMessage={progressMessage}
      progressMessageIsError={progressMessageIsError}
      resumeToast={displayResumeToast}
      onDismissResumeToast={handleDismissResumeToast}
      showHelp={showHelp}
      isMobile={isMobile}
      email={email}
      backgroundTasks={backgroundTasks}
      completedFrontier={completedFrontier}
      furthestAccessibleStep={furthestAccessibleStep}
      setupProgressPercent={setupProgressPercent}
      retryStepNumber={retryStepNumber}
      successMessage={successMessage}
      isCurrentStepValid={isCurrentStepValid}
      validationMessage={validationMessage}
      renderStepContent={renderStepContent}
      onHelpToggle={() => setShowHelp(!showHelp)}
      onEmailChange={handleEmailChange}
      onViewBackgroundResults={handleViewBackgroundResults}
      onStepClick={handleStepClick}
      onBack={handleBack}
      onNext={handleNext}
      retryStepCompletion={retryStepCompletion}
      dismissRetry={dismissRetry}
      setSuccessMessage={setSuccessMessage}
    />
  );
};

export default Wizard;
