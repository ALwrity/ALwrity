import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  Box, 
  Paper,
  Fade,
  Slide,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { getCurrentStep, setCurrentStep } from '../../api/onboarding';
import { apiClient, longRunningApiClient, isBackendCooldownActive, logBackendCooldownSkipOnce } from '../../api/client';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useUser } from '@clerk/clerk-react';
import WebsiteStep from './WebsiteStep';
import LinkedInConnectStep from './LinkedInConnectStep';
import CompetitorAnalysisStep from './CompetitorAnalysisStep';
import LinkedInResearchStep from './LinkedInResearchStep';
import PersonalizationStep from './PersonalizationStep';
import FinalStep from './FinalStep';
import { WizardHeader } from './common/WizardHeader';
import { WizardStepper } from './common/WizardStepper';
import { WizardRetryBar } from './common/WizardRetryBar';
import { WizardNavigation } from './common/WizardNavigation';
import { WizardLoadingState } from './common/WizardLoadingState';
import SystemStatusChip from './common/SystemStatusChip';
import {
  getOnboardingProgressState,
  progressPercentAfterStepComplete,
} from './common/onboardingProgressState';


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
  const { loading, currentStep, completionPercentage, data, refresh, markStepComplete } = useOnboarding();
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [showHelp, setShowHelp] = useState(false);
  const [showProgressMessage, setShowProgressMessage] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  // Retry state for step completion failures
  const [retryStepNumber, setRetryStepNumber] = useState<number | null>(null);
  const [retryStepData, setRetryStepData] = useState<any>(null);
  const [retryNextStep, setRetryNextStep] = useState<number>(0);
  // sessionId removed - backend uses Clerk user ID from auth token
  const [stepData, setStepData] = useState<any>(null);
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
  const [backgroundTasks, setBackgroundTasks] = useState<{
    tasks: Record<string, {
      status: string;
      started_at: string | null;
      progress_pct: number;
      failure_reason?: string | null;
      recurring?: boolean;
      last_success?: string | null;
      next_execution?: string | null;
    }>;
    total: number;
    completed_count: number;
    failed_count: number;
    all_done: boolean;
  } | null>(null);
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
  const progressState = useMemo(
    () => getOnboardingProgressState(completionPercentage, steps.length, isOnboardingComplete),
    [completionPercentage, steps.length, isOnboardingComplete]
  );

  const { percent: setupProgressPercent, completedFrontier, furthestAccessibleStep } = progressState;

  // Prevent activeStep from sitting ahead of what completion_percentage unlocks.
  useEffect(() => {
    if (activeStep > furthestAccessibleStep) {
      setActiveStep(furthestAccessibleStep);
      try {
        localStorage.setItem('onboarding_active_step', String(furthestAccessibleStep));
      } catch (_e) {}
    }
  }, [activeStep, furthestAccessibleStep]);

  useEffect(() => {
    if (activeStep < 1) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const fetchTasks = async () => {
      if (cancelled) return;
      // Skip when the backend is in its cooling-down period.
      if (isBackendCooldownActive()) {
        logBackendCooldownSkipOnce('Wizard');
        return;
      }
      try {
        const res = await longRunningApiClient.get('/api/onboarding/tasks/status');
        if (cancelled) return;
        if (res.data.tasks) {
          setBackgroundTasks(res.data);
          if (res.data.all_done && interval) {
            clearInterval(interval);
            interval = undefined;
          }
        }
      } catch {
        // Non-critical — wizard continues regardless
      }
    };
    fetchTasks();
    // Faster polling (30s) for active background tasks after website step
    interval = setInterval(fetchTasks, 30000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [activeStep]);

  // Step validation function
  const isStepDataValid = useCallback((step: number, data: any): boolean => {
    trace(`Wizard: Validating step ${step} with data:`, data);
    
    switch (step) {
      case 0: // Website Analysis — website URL or LinkedIn connection is sufficient
        if (onboardingType === 'linkedin') {
          return !!(data?.integrations?.connectedPlatforms?.includes('linkedin'));
        }
        return !!(data && (data.website || data.website_url || data?.integrations?.connectedPlatforms?.includes('linkedin')));
      
      case 1: // Competitor Analysis / LinkedIn Research
        if (onboardingType === 'linkedin') {
          return !!(data && (data.research_depth || data.content_types || data.growth_summary));
        }
        return !!(data && (data.competitors || data.researchSummary || data.sitemapAnalysis));
      
      case 2: // Persona Generation
        const hasValidPersonaData = data &&
                                  data.corePersona &&
                                  data.platformPersonas &&
                                  Object.keys(data.platformPersonas).length > 0 &&
                                  data.qualityMetrics;
        // Website path requires brand avatar + voice clone; LinkedIn path only needs persona
        if (onboardingType === 'linkedin') {
          return !!hasValidPersonaData;
        }
        const hasBrandAvatar = data?.brandAvatar?.set;
        const hasVoiceClone = data?.voiceClone?.set;
        return !!hasValidPersonaData && !!hasBrandAvatar && !!hasVoiceClone;
      
      case 3: // Final Step
        return true;
      
      default:
        return false;
    }
  }, []);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Use refs to avoid dependency cycles
  const stepDataRef = useRef(stepData);
  const competitorDataCollectorRef = useRef(competitorDataCollector);
  const websiteDataCollectorRef = useRef<(() => any) | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    stepDataRef.current = stepData;
  }, [stepData]);
  
  useEffect(() => {
    competitorDataCollectorRef.current = competitorDataCollector;
    trace('Wizard: competitorDataCollector changed:', competitorDataCollector);
  }, [competitorDataCollector]);

  // Validate current step data
  useEffect(() => {
    // For step 0 (Website) and step 2 (Persona), use the step validation state if available
    if ((activeStep === 0 || activeStep === 2) && stepValidationStates[activeStep] !== undefined) {
      setIsCurrentStepValid(stepValidationStates[activeStep]);
      return;
    }
    
    // For other steps, use the existing validation logic
    let dataToValidate = stepData;
    if (activeStep === 1 && competitorDataCollector) {
      dataToValidate = competitorDataCollector;
    }
    
    const isValid = isStepDataValid(activeStep, dataToValidate);
    setIsCurrentStepValid(isValid);

    // Set validation message
    if (activeStep === 2) {
      if (!isValid) {
        const pData = dataToValidate || {};
        if (!pData.corePersona) setValidationMessage('Please generate your Brand Identity (Text) first.');
        else if (onboardingType !== 'linkedin' && !pData.brandAvatar?.set) setValidationMessage('Please generate your Brand Avatar.');
        else if (onboardingType !== 'linkedin' && !pData.voiceClone?.set) setValidationMessage('Please generate your Voice Clone.');
        else setValidationMessage('Complete all personalization steps to continue.');
      } else {
        setValidationMessage('');
      }
    } else {
      setValidationMessage('');
    }
  }, [activeStep, stepData, isStepDataValid, competitorDataCollector, stepValidationStates]);
  
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
      if (step1Data?.data) {
        const d = step1Data.data;
        setStepData((prev: any) => ({
          ...prev,
          ...d,
          website: d.website || d.website_url,
          analysis: d.analysis || d
        }));
      }
      const step2Data = getBackendStep(onboarding.steps, 1);
      if (step2Data?.data) {
        setStepData((prev: any) => ({ ...prev, ...step2Data.data }));
      }
      const step3Data = getBackendStep(onboarding.steps, 2);
      if (step3Data?.data) {
        setStepData((prev: any) => ({ ...prev, ...step3Data.data }));
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
  }, [data, currentStep, steps.length, furthestAccessibleStep]);

  const handleNext = useCallback(async (rawStepData?: any) => {
    const isLinkedIn = onboardingType === 'linkedin';
    trace('Wizard: handleNext called - step:', activeStep, steps[activeStep]?.label);
    
    // Check if rawStepData is a React SyntheticEvent or native Event
    if (rawStepData && typeof rawStepData === 'object') {
      if (typeof rawStepData.preventDefault === 'function') {
        rawStepData.preventDefault();
      }
      if (typeof rawStepData.stopPropagation === 'function') {
        rawStepData.stopPropagation();
      }
    }

    // If it's an event, treat it as no data passed (undefined)
    let currentStepData = rawStepData && typeof rawStepData === 'object' && ('nativeEvent' in rawStepData || 'target' in rawStepData)
      ? undefined
      : rawStepData;
    
    trace('Wizard: Processed currentStepData:', currentStepData);

    // Special handling for WebsiteStep (step 0) — use data collector
    if (activeStep === 0) {
      if (currentStepData) {
        // Data from onContinue, use as-is
      } else {
        const collector = websiteDataCollectorRef.current;
        if (collector && typeof collector === 'function') {
          currentStepData = collector();
          trace('Wizard: Collected website step data from collector');
        } else {
          console.warn('Wizard: websiteDataCollector not available');
        }
      }
    }

    // Special handling for CompetitorAnalysisStep (step 1)
    if (activeStep === 1) {
      
      if (currentStepData) {
        // Data from onContinue, use as-is
      } else {
        const collector = competitorDataCollectorRef.current;
        if (collector && typeof collector === 'function') {
          currentStepData = collector();
        } else if (collector && typeof collector === 'object') {
          currentStepData = collector;
        } else {
          console.warn('Wizard: competitorDataCollector not available; using empty data');
          const currentData = stepDataRef.current;
          currentStepData = {
            competitors: [],
            researchSummary: null,
            sitemapAnalysis: null,
            userUrl: currentData?.website || '',
            industryContext: currentData?.industryContext,
            analysisTimestamp: new Date().toISOString()
          };
        }
      }
    }

    // Merge research data with existing step data for CompetitorAnalysisStep
    // or LinkedInResearchStep.
    if (activeStep === 1 && currentStepData) {
      const currentData = stepDataRef.current || {};
      const researchData = currentStepData || {};

      const hasWebsiteResearch = !!(researchData.competitors || researchData.researchSummary || researchData.sitemapAnalysis);
      const hasLinkedInResearch = !!(researchData.growth_summary || researchData.research_depth || researchData.content_types);

      if (hasWebsiteResearch || hasLinkedInResearch) {
        currentStepData = {
          ...currentData,
          ...researchData,
          competitors: researchData.competitors || currentData.competitors,
          researchSummary: researchData.researchSummary || currentData.researchSummary,
          sitemapAnalysis: researchData.sitemapAnalysis || currentData.sitemapAnalysis,
          growth_summary: researchData.growth_summary || currentData.growth_summary,
          research_depth: researchData.research_depth || currentData.research_depth,
          content_types: researchData.content_types || currentData.content_types,
          stepType: hasLinkedInResearch ? 'linkedin_research' : 'research',
          completedAt: new Date().toISOString()
        };

        trace('Wizard: Merged research data:', currentStepData);
      } else {
        console.warn('Wizard: No research data provided, using existing step data');
        currentStepData = currentData;
      }
    }

    // Special handling for PersonaStep (step 2)
    if (activeStep === 2) {
      trace('Wizard: Handling PersonaStep data, has corePersona:', !!currentStepData?.corePersona);

      if (currentStepData && currentStepData.corePersona && currentStepData.qualityMetrics) {
        // Data from onContinue, use as-is
      } else {
        const currentData = stepDataRef.current || {};
        const hasValidPersonaData = currentData.corePersona && 
                                   currentData.platformPersonas && 
                                   Object.keys(currentData.platformPersonas).length > 0 &&
                                   currentData.qualityMetrics;
        
        if (hasValidPersonaData) {
          currentStepData = currentData;
        } else {
          console.warn('Wizard: No valid persona data available for PersonaStep - cannot complete step');
          setShowProgressMessage(false);
          setProgressMessage('');
          return;
        }
      }
    }

    // Store step data in state
    if (currentStepData) {
      setStepData(currentStepData);
    }

    trace('Wizard: handleNext called - activeStep:', activeStep, '→ nextStep:', activeStep + 1);
    
    setDirection('right');
    const nextStep = activeStep + 1;
    const currentStepNumber = activeStep + 1;

    const showSuccessProgressToast = (stepNumber: number) => {
      const progressPct = progressPercentAfterStepComplete(stepNumber, steps.length);
      setProgressMessage(`Your data is saved, moving to the next step. Progress is ${progressPct}%`);
      setShowProgressMessage(true);
      setTimeout(() => {
        setShowProgressMessage(false);
      }, 3000);
    };
    
    // Complete the current step. Backend and frontend use identical 1-indexed
    // step numbers after the Phase-1 backend renumber (4 steps + completion at 5).

    const hasCoreStepData = currentStepData && typeof currentStepData === 'object' && (
      currentStepData.website || 
      currentStepData.businessData || 
      currentStepData.competitors ||
      currentStepData.researchSummary ||
      currentStepData.sitemapAnalysis ||
      currentStepData.growth_summary ||
      currentStepData.research_depth ||
      currentStepData.content_types ||
      currentStepData.corePersona || 
      currentStepData.platformPersonas ||
      currentStepData.qualityMetrics ||
      currentStepData.postingCadence ||
      currentStepData.preferredFormats ||
      currentStepData.contentTopics ||
      currentStepData.engagementGoals
    );

    const hasIntegrationsData = !!(currentStepData && typeof currentStepData === 'object' && currentStepData.integrations);

    const stepWasCompleted = hasCoreStepData || hasIntegrationsData;

    trace('Wizard: Step completion check - step:', currentStepNumber, 'hasData:', !!currentStepData);

    if (!stepWasCompleted) {
      console.warn('Wizard: No serialized step data supplied; skipping backend completion for step', currentStepNumber);
      return;
    } else {
      // Inject onboarding_type into payload so the backend strategy dispatch
      // can create the session with the correct type on step 1.
      if (currentStepData && typeof currentStepData === 'object') {
        currentStepData.onboarding_type = onboardingType;
      }
      try {
        const stepResult = await setCurrentStep(currentStepNumber, currentStepData);
        trace('Wizard: Step completion result:', stepResult);

        const responseData: any = (stepResult && stepResult.response) || stepResult;
        const warnings: string[] = responseData?.warnings || [];
        if (warnings.length > 0) {
          console.warn('Wizard: Step completed with warnings:', warnings);
          setShowProgressMessage(true);
          setProgressMessage(`Step completed but with issues: ${warnings.join(', ')}`);
          setTimeout(() => {
            setShowProgressMessage(false);
            showSuccessProgressToast(currentStepNumber);
          }, 4000);
        } else {
          showSuccessProgressToast(currentStepNumber);
        }
      } catch (error: any) {
        console.error('Wizard: BLOCKING ERROR - Failed to complete step with backend.', error);

        let errorMessage = 'Failed to complete step. Please try again.';
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.message) {
          errorMessage = error.message;
        }

        // Save retry state so user can retry or continue anyway
        setRetryStepNumber(currentStepNumber);
        setRetryStepData(currentStepData);
        setRetryNextStep(nextStep);

        // Show retryable error message
        setShowProgressMessage(true);
        setProgressMessage(`${errorMessage}`);
        return;
      }

      const stepResponse = await getCurrentStep();
      trace('Wizard: Backend step after completion:', stepResponse.step);
    }
    
    setActiveStep(nextStep);
    // Keep localStorage for fast UX restore on refresh
    try {
      localStorage.setItem('onboarding_active_step', String(nextStep));
    } catch (_e) {}
    // Context handles backend state sync
    markStepComplete(currentStepNumber);
    
  }, [activeStep, onComplete]);

  const retryStepCompletion = useCallback(async () => {
    if (retryStepNumber === null || !retryStepData) return;
    const stepToRetry = retryStepNumber;
    const dataToRetry = retryStepData;
    const next = retryNextStep;
    // Clear retry state before re-attempting
    setRetryStepNumber(null);
    setRetryStepData(null);
    setRetryNextStep(0);
    setShowProgressMessage(false);
    setProgressMessage('');

    try {
      await setCurrentStep(stepToRetry, { ...dataToRetry, onboarding_type: onboardingType });
      const stepResponse = await getCurrentStep();
      trace('Wizard: Retry step completion OK:', stepResponse.step);
      setActiveStep(next);
      try {
        localStorage.setItem('onboarding_active_step', String(next));
      } catch (_e) {}
      markStepComplete(stepToRetry);
    } catch (error: any) {
      console.error('Wizard: Retry also failed:', error);
      let msg = 'Retry failed. Please try again or continue anyway.';
      if (error.response?.data?.detail) msg = error.response.data.detail;
      else if (error.message) msg = error.message;
      setRetryStepNumber(stepToRetry);
      setRetryStepData(dataToRetry);
      setRetryNextStep(next);
      setShowProgressMessage(true);
      setProgressMessage(`${msg}`);
    }
  }, [retryStepNumber, retryStepData, retryNextStep, onboardingType, markStepComplete]);

  const dismissRetry = useCallback(() => {
    const next = retryNextStep;
    setRetryStepNumber(null);
    setRetryStepData(null);
    setRetryNextStep(0);
    setShowProgressMessage(false);
    setProgressMessage('');
    if (next > 0) {
      setActiveStep(next);
      try {
        localStorage.setItem('onboarding_active_step', String(next));
      } catch (_e) {}
    }
  }, [retryNextStep]);

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
    if (stepIndex <= furthestAccessibleStep) {
      setDirection(stepIndex > activeStep ? 'right' : 'left');
      setActiveStep(stepIndex);
      try {
        localStorage.setItem('onboarding_active_step', String(stepIndex));
      } catch (_e) {}
    }
  };

  // "View Results" from the background-tasks banner: navigate back to the
  // Website step and scroll to the Smart Background Setup section.
  const handleViewBackgroundResults = (taskKey: string) => {
    handleStepClick(0);
    // Wait for the step to mount before scrolling.
    setTimeout(() => {
      document.getElementById('smart-background-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
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
          title: "Let ALwrity Learn Your Brand",
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
    websiteAnalysis: stepData?.analysis,
    competitorResearch: stepData?.competitors,
    sitemapAnalysis: stepData?.sitemapAnalysis,
    businessData: stepData?.businessData
  }), [stepData?.analysis, stepData?.competitors, stepData?.sitemapAnalysis, stepData?.businessData]);

  const personaStepData = useMemo(() => ({
    corePersona: stepData?.corePersona,
    platformPersonas: stepData?.platformPersonas,
    qualityMetrics: stepData?.qualityMetrics,
    selectedPlatforms: stepData?.selectedPlatforms
  }), [stepData?.corePersona, stepData?.platformPersonas, stepData?.qualityMetrics, stepData?.selectedPlatforms]);

  const handleStepDataChange = useCallback((data: any) => {
    trace('Wizard: handleStepDataChange:', data ? Object.keys(data) : 'empty');
    setStepData((prev: any) => ({
      ...prev,
      ...data
    }));
  }, []);

  const renderStepContent = (step: number) => {
    // Step 0 branches by onboarding type: WebsiteStep for website, LinkedInConnectStep for linkedin
    const step0Component = onboardingType === 'linkedin' ? (
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
      />
    );

    const stepComponents = [
      step0Component,
      // Step 1 branches by onboarding type: CompetitorAnalysisStep for website, LinkedInResearchStep for linkedin
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
          key="research" 
          onContinue={handleNext} 
          onBack={handleBack}
          userUrl={stepData?.website || stepData?.website_url || localStorage.getItem('website_url') || ''}
          industryContext={stepData?.industryContext}
          initialData={stepData}
          onDataReady={handleCompetitorDataReady}
        />
      ),
      <PersonalizationStep 
        key="personalization" 
        onContinue={handleNext} 
        onValidationChange={onStep2Valid}
        onDataChange={handleStepDataChange}
        onboardingType={onboardingType}
        onboardingData={personaOnboardingData}
        stepData={personaStepData}
      />,
      <FinalStep key="final" onContinue={handleComplete} updateHeaderContent={updateHeaderContent} onboardingType={onboardingType} />
    ];

    return (
      <Slide direction={direction} in={true} mountOnEnter unmountOnExit key={`step-${step}`}>
        <Box sx={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
          {stepComponents[step]}
        </Box>
      </Slide>
    );
  };

  // Show loading state if loading
  if (loading) {
    return <WizardLoadingState loading={loading} />;
  }

  return (
    <Box
      className="light-theme-container"
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
          pointerEvents: 'none',
        }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: '100%',
          width: '100%',
          minHeight: '100vh',
          borderRadius: 0,
          overflow: 'visible',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: 'none',
          position: 'relative',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header with Stepper */}
        <WizardHeader
          stepHeaderContent={stepHeaderContent}
          showProgressMessage={showProgressMessage}
          progressMessage={progressMessage}
          showHelp={showHelp}
          isMobile={isMobile}
          onHelpToggle={() => setShowHelp(!showHelp)}
          email={email}
          onEmailChange={handleEmailChange}
        />

        {/* Separated Step Progression Stepper (White Background Box below Navigation Bar) */}
        <WizardStepper
          activeStep={activeStep}
          completedFrontier={completedFrontier}
          furthestAccessibleStep={furthestAccessibleStep}
          isMobile={isMobile}
          steps={steps}
          onStepClick={handleStepClick}
          progress={setupProgressPercent}
        />

        {/* Retry bar for step completion failures */}
        <WizardRetryBar
          retryStepNumber={retryStepNumber}
          progressMessage={progressMessage}
          retryStepCompletion={retryStepCompletion}
          dismissRetry={dismissRetry}
        />

        {/* Background tasks status banner (visible after Step 2) */}
        {backgroundTasks && backgroundTasks.tasks && Object.keys(backgroundTasks.tasks).length > 0 && (
          <SystemStatusChip
            activeTasks={backgroundTasks.total - backgroundTasks.completed_count - backgroundTasks.failed_count}
            totalTasks={backgroundTasks.total}
            tasks={backgroundTasks.tasks}
            onViewResults={handleViewBackgroundResults}
          />
        )}

        {/* Content */}
        <Box sx={{ p: { xs: 2, md: 4 }, pt: { xs: 2, md: 3 }, flexGrow: 1, width: '100%', overflow: 'visible' }}>
          <Fade in={true} timeout={400}>
            <Box sx={{ width: '100%', overflow: 'visible' }}>
              {renderStepContent(activeStep)}
            </Box>
          </Fade>
        </Box>

        {/* Navigation - Hide on final step */}
        {activeStep !== steps.length - 1 && (
          <WizardNavigation
            activeStep={activeStep}
            totalSteps={steps.length}
            onBack={handleBack}
            onNext={handleNext}
            isLastStep={activeStep === steps.length - 1}
            isCurrentStepValid={isCurrentStepValid}
            validationMessage={validationMessage}
            nextLabel={activeStep === 0 ? 'ALwrity Your Growth' : 'Continue'}
          />
        )}
      </Paper>
    </Box>
  );
};

export default Wizard; 
