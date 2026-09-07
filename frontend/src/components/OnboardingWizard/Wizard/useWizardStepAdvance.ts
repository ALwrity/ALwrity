import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getCurrentStep, setCurrentStep } from '../../../api/onboarding';
import { buildStepSavedSuccessMessage } from '../common/onboardingResumeMessage';

const DEV_DEBUG = false;
const trace = DEV_DEBUG ? console.log : (..._args: unknown[]) => {};

interface UseWizardStepAdvanceOptions {
  activeStep: number;
  stepsLength: number;
  onboardingType: string;
  competitorDataCollectorRef: MutableRefObject<((() => any) | null)>;
  websiteDataCollectorRef: MutableRefObject<((() => any) | null)>;
  stepDataRef: MutableRefObject<any>;
  setStepData: Dispatch<SetStateAction<any>>;
  setDirection: Dispatch<SetStateAction<'left' | 'right'>>;
  setActiveStep: Dispatch<SetStateAction<number>>;
  setShowProgressMessage: Dispatch<SetStateAction<boolean>>;
  setProgressMessage: Dispatch<SetStateAction<string>>;
  setProgressMessageIsError: Dispatch<SetStateAction<boolean>>;
  setSuccessMessage: Dispatch<SetStateAction<string | null>>;
  setRetryStepNumber: Dispatch<SetStateAction<number | null>>;
  setRetryStepData: Dispatch<SetStateAction<any>>;
  setRetryNextStep: Dispatch<SetStateAction<number>>;
  commitConnectStepSnapshot: (payload: any) => void;
  markStepComplete: (stepNumber: number) => void;
  setDownstreamLocked: Dispatch<SetStateAction<boolean>>;
}

export function useWizardStepAdvance({
  activeStep,
  stepsLength,
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
}: UseWizardStepAdvanceOptions) {
  const handleNext = useCallback(
    async (rawStepData?: any) => {
      const traceLabel = stepsLength;
      trace('Wizard: handleNext called - step:', activeStep, traceLabel);

      if (rawStepData && typeof rawStepData === 'object') {
        if (typeof rawStepData.preventDefault === 'function') rawStepData.preventDefault();
        if (typeof rawStepData.stopPropagation === 'function') rawStepData.stopPropagation();
      }

      let currentStepData =
        rawStepData &&
        typeof rawStepData === 'object' &&
        ('nativeEvent' in rawStepData || 'target' in rawStepData)
          ? undefined
          : rawStepData;

      if (activeStep === 0) {
        if (!currentStepData) {
          const collector = websiteDataCollectorRef.current;
          if (collector && typeof collector === 'function') {
            currentStepData = collector();
          } else {
            console.warn('Wizard: websiteDataCollector not available');
          }
        }
      }

      if (activeStep === 1) {
        if (!currentStepData) {
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
              analysisTimestamp: new Date().toISOString(),
            };
          }
        }
      }

      if (activeStep === 1 && currentStepData) {
        const currentData = stepDataRef.current || {};
        const researchData = currentStepData || {};
        const hasWebsiteResearch = !!(
          researchData.competitors ||
          researchData.researchSummary ||
          researchData.sitemapAnalysis
        );
        const hasLinkedInResearch = !!(
          researchData.growth_summary ||
          researchData.research_depth ||
          researchData.content_types
        );

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
            completedAt: new Date().toISOString(),
          };
        } else {
          console.warn('Wizard: No research data provided, using existing step data');
          currentStepData = currentData;
        }
      }

      if (activeStep === 2) {
        if (!(currentStepData?.corePersona && currentStepData?.qualityMetrics)) {
          const currentData = stepDataRef.current || {};
          const hasValidPersonaData =
            currentData.corePersona &&
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

      if (currentStepData) {
        setStepData(currentStepData);
      }

      setDirection('right');
      const nextStep = activeStep + 1;
      const currentStepNumber = activeStep + 1;

      const showSuccessProgressToast = (stepNumber: number) => {
        setProgressMessageIsError(false);
        setShowProgressMessage(false);
        setProgressMessage('');
        setSuccessMessage(buildStepSavedSuccessMessage(stepNumber, stepsLength));
      };

      const showErrorProgressToast = (message: string) => {
        setProgressMessageIsError(true);
        setShowProgressMessage(true);
        setProgressMessage(message);
        setTimeout(() => {
          setShowProgressMessage(false);
          setProgressMessageIsError(false);
        }, 4000);
      };

      const hasCoreStepData =
        currentStepData &&
        typeof currentStepData === 'object' &&
        (currentStepData.website ||
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
          currentStepData.engagementGoals);

      const hasIntegrationsData = !!(
        currentStepData &&
        typeof currentStepData === 'object' &&
        currentStepData.integrations
      );
      const stepWasCompleted = hasCoreStepData || hasIntegrationsData;

      if (!stepWasCompleted) {
        console.warn(
          'Wizard: No serialized step data supplied; skipping backend completion for step',
          currentStepNumber
        );
        return;
      }

      if (currentStepData && typeof currentStepData === 'object') {
        currentStepData.onboarding_type = onboardingType;
      }

      try {
        const stepResult = await setCurrentStep(currentStepNumber, currentStepData);
        const responseData: any = (stepResult && stepResult.response) || stepResult;
        const warnings: string[] = responseData?.warnings || [];
        if (warnings.length > 0) {
          console.warn('Wizard: Step completed with warnings:', warnings);
          setSuccessMessage(
            `Step saved with notes: ${warnings.join(', ')}. ${buildStepSavedSuccessMessage(
              currentStepNumber,
              stepsLength
            ).replace('Step saved — ', '')}`
          );
        } else {
          showSuccessProgressToast(currentStepNumber);
        }
      } catch (error: any) {
        console.error('Wizard: BLOCKING ERROR - Failed to complete step with backend.', error);
        const errorMessage =
          error.response?.data?.detail || error.message || 'Failed to complete step. Please try again.';
        setRetryStepNumber(currentStepNumber);
        setRetryStepData(currentStepData);
        setRetryNextStep(nextStep);
        showErrorProgressToast(errorMessage);
        return;
      }

      await getCurrentStep();

      if (activeStep === 0 && currentStepData) {
        setDownstreamLocked(false);
        commitConnectStepSnapshot(currentStepData);
      }

      setActiveStep(nextStep);
      try {
        localStorage.setItem('onboarding_active_step', String(nextStep));
      } catch {
        /* ignore */
      }
      markStepComplete(currentStepNumber);
    },
    [
      activeStep,
      commitConnectStepSnapshot,
      competitorDataCollectorRef,
      markStepComplete,
      onboardingType,
      setActiveStep,
      setDirection,
      setDownstreamLocked,
      setProgressMessage,
      setProgressMessageIsError,
      setRetryNextStep,
      setRetryStepData,
      setRetryStepNumber,
      setShowProgressMessage,
      setStepData,
      setSuccessMessage,
      stepDataRef,
      stepsLength,
      websiteDataCollectorRef,
    ]
  );

  return { handleNext };
}

export function useWizardStepRetry({
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
}: {
  retryStepNumber: number | null;
  retryStepData: any;
  retryNextStep: number;
  onboardingType: string;
  setRetryStepNumber: Dispatch<SetStateAction<number | null>>;
  setRetryStepData: Dispatch<SetStateAction<any>>;
  setRetryNextStep: Dispatch<SetStateAction<number>>;
  setShowProgressMessage: Dispatch<SetStateAction<boolean>>;
  setProgressMessage: Dispatch<SetStateAction<string>>;
  setProgressMessageIsError: Dispatch<SetStateAction<boolean>>;
  setActiveStep: Dispatch<SetStateAction<number>>;
  markStepComplete: (stepNumber: number) => void;
  commitConnectStepSnapshot: (payload: any) => void;
  setDownstreamLocked: Dispatch<SetStateAction<boolean>>;
}) {
  const retryStepCompletion = useCallback(async () => {
    if (retryStepNumber === null || !retryStepData) return;
    const stepToRetry = retryStepNumber;
    const dataToRetry = retryStepData;
    const next = retryNextStep;
    setRetryStepNumber(null);
    setRetryStepData(null);
    setRetryNextStep(0);
    setShowProgressMessage(false);
    setProgressMessage('');

    try {
      await setCurrentStep(stepToRetry, { ...dataToRetry, onboarding_type: onboardingType });
      await getCurrentStep();
      setActiveStep(next);
      try {
        localStorage.setItem('onboarding_active_step', String(next));
      } catch {
        /* ignore */
      }
      markStepComplete(stepToRetry);
      if (stepToRetry === 1) {
        setDownstreamLocked(false);
        commitConnectStepSnapshot(dataToRetry);
      }
    } catch (error: any) {
      console.error('Wizard: Retry also failed:', error);
      const msg = error.response?.data?.detail || error.message || 'Retry failed. Please try again or continue anyway.';
      setRetryStepNumber(stepToRetry);
      setRetryStepData(dataToRetry);
      setRetryNextStep(next);
      setProgressMessageIsError(true);
      setShowProgressMessage(true);
      setProgressMessage(msg);
    }
  }, [
    commitConnectStepSnapshot,
    markStepComplete,
    onboardingType,
    retryNextStep,
    retryStepData,
    retryStepNumber,
    setActiveStep,
    setProgressMessage,
    setProgressMessageIsError,
    setRetryNextStep,
    setRetryStepData,
    setRetryStepNumber,
    setShowProgressMessage,
    setDownstreamLocked,
  ]);

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
      } catch {
        /* ignore */
      }
    }
  }, [
    retryNextStep,
    setActiveStep,
    setProgressMessage,
    setRetryNextStep,
    setRetryStepData,
    setRetryStepNumber,
    setShowProgressMessage,
  ]);

  return { retryStepCompletion, dismissRetry };
}
