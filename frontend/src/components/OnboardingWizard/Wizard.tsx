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
import { apiClient } from '../../api/client';
import IntroStep from './IntroStep';
import WebsiteStep from './WebsiteStep';
import CompetitorAnalysisStep from './CompetitorAnalysisStep';
import PersonalizationStep from './PersonalizationStep';
import IntegrationsStep from './IntegrationsStep';
import FinalStep from './FinalStep';
import { WizardHeader } from './common/WizardHeader';
import { WizardNavigation } from './common/WizardNavigation';
import { WizardLoadingState } from './common/WizardLoadingState';
import SystemStatusChip from './common/SystemStatusChip';

// Set to true in dev to restore verbose per-action tracing
const DEV_DEBUG = false;
const trace = DEV_DEBUG ? console.log : (..._args: any[]) => {};

const steps = [
  { label: 'Init', description: 'Start your ALwrity onboarding.', icon: '🔑' },
  { label: 'Website', description: 'Set up your website', icon: '🌐' },
  { label: 'Research', description: 'Discover competitors', icon: '🔍' },
  { label: 'Personalization', description: 'Customize your experience', icon: '⚙️' },
  { label: 'Integrations', description: 'Connect additional services', icon: '🔗' },
  { label: 'Finish', description: 'Complete setup', icon: '✅' }
];

interface WizardProps {
  onComplete?: () => void;
}

interface StepHeaderContent {
  title: string;
  description: string;
}

const Wizard: React.FC<WizardProps> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgressState] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [showHelp, setShowHelp] = useState(false);
  const [showProgressMessage, setShowProgressMessage] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  // sessionId removed - backend uses Clerk user ID from auth token
  const [stepData, setStepData] = useState<any>(null);
  const [competitorDataCollector, setCompetitorDataCollector] = useState<(() => any) | null>(null);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState<boolean>(false);
  const [stepValidationStates, setStepValidationStates] = useState<Record<number, boolean>>({});
  const [stepHeaderContent, setStepHeaderContent] = useState<StepHeaderContent>({
    title: steps[0].label,
    description: steps[0].description
  });
  const [introCompleted, setIntroCompleted] = useState<boolean>(false);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [backgroundTasks, setBackgroundTasks] = useState<{
    tasks: Record<string, { status: string; started_at: string | null; progress_pct: number }>;
    total: number;
    completed_count: number;
    failed_count: number;
    all_done: boolean;
  } | null>(null);

  useEffect(() => {
    if (activeStep < 2) return;
    const fetchTasks = async () => {
      try {
        const res = await apiClient.get('/api/onboarding/tasks/status');
        if (res.data.tasks) {
          setBackgroundTasks(res.data);
        }
      } catch {
        // Non-critical — wizard continues regardless
      }
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, [activeStep]);

  // Step validation function
  const isStepDataValid = useCallback((step: number, data: any): boolean => {
    trace(`Wizard: Validating step ${step} with data:`, data);
    
    switch (step) {
      case 0: // API Keys
        return !!(data && data.api_keys && Object.keys(data.api_keys).length > 0);
      
      case 1: // Website Analysis
        return !!(data && (data.website || data.website_url));
      
      case 2: // Competitor Analysis
        return !!(data && (data.competitors || data.researchSummary || data.sitemapAnalysis));
      
      case 3: // Persona Generation
        const hasValidPersonaData = data && 
                                  data.corePersona && 
                                  data.platformPersonas && 
                                  Object.keys(data.platformPersonas).length > 0 &&
                                  data.qualityMetrics;
        const hasBrandAvatar = data?.brandAvatar?.set;
        const hasVoiceClone = data?.voiceClone?.set;
        return !!hasValidPersonaData && !!hasBrandAvatar && !!hasVoiceClone;
      
      case 4: // Integrations
      case 5: // Final Step
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
    trace('Wizard: stepData changed:', stepData);
    
    // Persist stepData to localStorage to survive refreshes
    if (stepData && Object.keys(stepData).length > 0) {
      try {
        localStorage.setItem('onboarding_step_data', JSON.stringify(stepData));
      } catch (e) {
        console.warn('Wizard: Failed to persist stepData to localStorage', e);
      }
    }
  }, [stepData]);
  
  useEffect(() => {
    competitorDataCollectorRef.current = competitorDataCollector;
    trace('Wizard: competitorDataCollector changed:', competitorDataCollector);
  }, [competitorDataCollector]);

  // Validate current step data
  useEffect(() => {
    if (activeStep === 0) {
      setIsCurrentStepValid(true);
      return;
    }
    
    // For step 1 (Website) and step 3 (Persona), use the step validation state if available
    if ((activeStep === 1 || activeStep === 3) && stepValidationStates[activeStep] !== undefined) {
      setIsCurrentStepValid(stepValidationStates[activeStep]);
      return;
    }
    
    // For other steps, use the existing validation logic
    let dataToValidate = stepData;
    if (activeStep === 2 && competitorDataCollector) {
      dataToValidate = competitorDataCollector;
    }
    
    const isValid = isStepDataValid(activeStep, dataToValidate);
    setIsCurrentStepValid(isValid);

    // Set validation message
    if (activeStep === 3) {
      if (!isValid) {
        const pData = dataToValidate || {};
        if (!pData.corePersona) setValidationMessage('Please generate your Brand Identity (Text) first.');
        else if (!pData.brandAvatar?.set) setValidationMessage('Please generate your Brand Avatar.');
        else if (!pData.voiceClone?.set) setValidationMessage('Please generate your Voice Clone.');
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

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Restore stepData from localStorage if available (robustness against refresh)
        try {
          const cachedStepData = localStorage.getItem('onboarding_step_data');
          if (cachedStepData) {
            const parsedData = JSON.parse(cachedStepData);
            trace('Wizard: Restored stepData from localStorage backup:', Object.keys(parsedData));
            setStepData((prev: any) => ({ ...prev, ...parsedData }));
          }
        } catch (e) {
          console.warn('Wizard: Failed to restore stepData from localStorage', e);
        }

        // Fast local restore: try localStorage active step first (non-authoritative)
        const cachedActiveStep = localStorage.getItem('onboarding_active_step');
        if (cachedActiveStep !== null) {
          const stepIdx = Math.max(0, Math.min(steps.length - 1, parseInt(cachedActiveStep, 10)));
          if (!Number.isNaN(stepIdx)) {
            setActiveStep(stepIdx);
          }
        }
        
        // Check if we already have init data from App (cached in sessionStorage)
        let cachedInit = sessionStorage.getItem('onboarding_init');
        
        // Check for staleness BEFORE parsing/using
        if (cachedInit) {
          const lsStep = localStorage.getItem('onboarding_active_step');
          if (lsStep !== null) {
            const lsIdx = parseInt(lsStep, 10);
            if (!Number.isNaN(lsIdx)) {
              // Parse cached data to get backend state
              try {
                const parsedCache = JSON.parse(cachedInit);
                const backendStep = parsedCache.onboarding?.current_step || 0;
                // backendStep is 1-based (usually). 
                // computedStep would be backendStep + 1.
                // If lsIdx (active step index) >= backendStep + 1, it's significantly ahead.
                // Example: lsIdx=2 (Step 3), backendStep=1 (Step 2). Diff is 1.
                // If backendStep=0 (Step 1 active), lsIdx=2. Diff is 2.
                
                // If local progress is significantly ahead, discard cache
                if (lsIdx > backendStep) {
                   console.warn(`Wizard: Local progress (step ${lsIdx}) ahead of cached backend state (step ${backendStep}). Discarding stale cache.`);
                   sessionStorage.removeItem('onboarding_init');
                   cachedInit = null; // Disable cache usage
                }
              } catch (e) {
                console.warn('Wizard: Error parsing cached init data for staleness check', e);
                // If we can't parse it, better to discard it
                sessionStorage.removeItem('onboarding_init');
                cachedInit = null;
              }
            }
          }
        }
        
        if (cachedInit) {
          const data = JSON.parse(cachedInit);
          
          // Extract data from batch response
          const { onboarding, session } = data;
          
          // Check if user should start from step 1 due to new API key flow
          if (onboarding.current_step === 1 && onboarding.completion_percentage === 0) {
            // Clear cache and start fresh
            sessionStorage.removeItem('onboarding_init');
            localStorage.removeItem('onboarding_active_step');
            localStorage.removeItem('onboarding_data');
            setActiveStep(0); // Start from step 1 (index 0)
            setLoading(false);
            return;
          }

          // Load step data, especially research data from step 3 and persona data from step 4
          if (onboarding.steps && Array.isArray(onboarding.steps)) {
            const step2Data = onboarding.steps.find((step: any) => step.step_number === 2);
            if (step2Data && step2Data.data) {
              const normalizedData = {
                ...step2Data.data,
                website: step2Data.data.website || step2Data.data.website_url,
                analysis: step2Data.data.analysis || step2Data.data
              };
              setStepData((prevData: any) => ({ ...prevData, ...normalizedData }));
            }

            const step3Data = onboarding.steps.find((step: any) => step.step_number === 3);
            if (step3Data && step3Data.data) {
              setStepData((prevData: any) => ({ ...prevData, ...step3Data.data }));
            }

            const step4Data = onboarding.steps.find((step: any) => step.step_number === 4);
            if (step4Data && step4Data.data) {
              setStepData((prevData: any) => ({ ...prevData, ...step4Data.data }));
            }
          }

          const introFlag = localStorage.getItem('onboarding_intro_completed');
          if (introFlag === 'true' || onboarding.completion_percentage > 0 || onboarding.current_step > 1) {
            setIntroCompleted(true);
          }

          let computedStep = Math.max(1, Math.min(steps.length, onboarding.current_step + 1));
          if (onboarding.is_completed) {
            computedStep = steps.length;
          }

          const lsStep = localStorage.getItem('onboarding_active_step');
          if (lsStep !== null) {
            const lsIdx = Math.max(0, Math.min(steps.length - 1, parseInt(lsStep, 10)));
            if (!Number.isNaN(lsIdx)) {
              if (lsIdx + 1 >= computedStep - 1 && lsIdx + 1 <= computedStep + 1) {
                computedStep = lsIdx + 1;
              }
            }
          }
          
          setActiveStep(computedStep - 1);
          setProgressState(onboarding.completion_percentage);

          setLoading(false);
          return;
        }
        
        console.log('Wizard: No cached init data, calling /api/onboarding/init');
        
        let response;
        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const startTime = Date.now();
          try {
            console.log(`Wizard: Batch init attempt ${attempt + 1}/${maxRetries}`);
            response = await apiClient.get('/api/onboarding/init');
            console.log(`Wizard: Batch init call success (${Date.now() - startTime}ms)`, {
              status: response.status,
              dataKeys: Object.keys(response.data)
            });
            break; // Success, exit loop
          } catch (err: any) {
            console.warn(`Wizard: Batch init attempt ${attempt + 1} failed (${Date.now() - startTime}ms):`, err.message);
            lastError = err;
            
            // If it's the last attempt, don't wait
            if (attempt === maxRetries - 1) break;
            
            // Wait with exponential backoff: 1s, 2s, 4s...
            const delay = 1000 * Math.pow(2, attempt);
            console.log(`Wizard: Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (!response) {
          throw lastError || new Error('Failed to initialize onboarding after retries');
        }

        const { onboarding, session } = response.data;

        // Load step data, especially research data from step 3 and persona data from step 4
        if (onboarding.steps && Array.isArray(onboarding.steps)) {
          // Load website data from step 2 (Crucial for URL persistence)
          const step2Data = onboarding.steps.find((step: any) => step.step_number === 2);
          if (step2Data && step2Data.data) {
            trace('Wizard: Loading website data from step 2:', Object.keys(step2Data.data));
            const normalizedData = {
              ...step2Data.data,
              website: step2Data.data.website || step2Data.data.website_url,
              // Ensure analysis is present for downstream steps
              analysis: step2Data.data.analysis || step2Data.data
            };
            setStepData((prevData: any) => ({ ...prevData, ...normalizedData }));
          }

          // Load research preferences from step 3
          const step3Data = onboarding.steps.find((step: any) => step.step_number === 3);
          if (step3Data && step3Data.data) {
            trace('Wizard: Loading research data from step 3:', Object.keys(step3Data.data));
            setStepData((prevData: any) => ({ ...prevData, ...step3Data.data }));
          }

          // Load persona data from step 4
          const step4Data = onboarding.steps.find((step: any) => step.step_number === 4);
          if (step4Data && step4Data.data) {
            trace('Wizard: Loading persona data from step 4:', Object.keys(step4Data.data));
            setStepData((prevData: any) => ({ ...prevData, ...step4Data.data }));
          }
        }

        // Cache for future use
        sessionStorage.setItem('onboarding_init', JSON.stringify(response.data));

        const introFlag = localStorage.getItem('onboarding_intro_completed');
        if (introFlag === 'true' || onboarding.completion_percentage > 0 || onboarding.current_step > 1) {
          setIntroCompleted(true);
        }

        // Set state from API response
        // Calculate the most appropriate step to show
        // If current_step is X, it means X is completed, so we should be on X + 1
        let computedStep = Math.max(1, Math.min(steps.length, onboarding.current_step + 1));
        
        // If onboarding is marked as completed, stay on the last step
        if (onboarding.is_completed) {
          computedStep = steps.length;
        }

        // If localStorage has a higher step index, prefer it for UX continuity
        const lsStep = localStorage.getItem('onboarding_active_step');
        if (lsStep !== null) {
          const lsIdx = Math.max(0, Math.min(steps.length - 1, parseInt(lsStep, 10)));
          if (!Number.isNaN(lsIdx)) {
            // We only trust localStorage if it's within 1 step of what the backend says
            if (lsIdx + 1 >= computedStep - 1 && lsIdx + 1 <= computedStep + 1) {
              computedStep = lsIdx + 1;
            }
          }
        }
        
        console.log('Wizard: Final computed step (API):', computedStep, 'from backend step:', onboarding.current_step);
        setActiveStep(computedStep - 1);
        setProgressState(onboarding.completion_percentage);
        // Note: Session managed by Clerk auth, no need to track separately

        console.log('Wizard: Initialized from API:', {
          step: onboarding.current_step,
          progress: onboarding.completion_percentage,
          userId: session.session_id,  // Clerk user ID from backend
          hasPersonaData: !!stepData
        });
      } catch (error: any) {
        console.error('Wizard: Error initializing onboarding:', {
          message: error.message,
          code: error.code,
          response: error.response?.status,
          url: error.config?.url,
          stack: error.stack
        });
        // Error handling is managed by global API client interceptors
      } finally {
        console.log('Wizard: Initialization finished');
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - stepData is used for logging only

  const handleNext = useCallback(async (rawStepData?: any) => {
    trace('Wizard: handleNext called - step:', activeStep, steps[activeStep]?.label);
    
    if (activeStep === 0) {
      setIntroCompleted(true);
      try {
        localStorage.setItem('onboarding_intro_completed', 'true');
      } catch (_e) {}
      // Do not return here; continue into normal next-step flow so the user
      // is taken directly to the Website step.
    }
    
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

    // Special handling for WebsiteStep (step 1) — use data collector
    if (activeStep === 1) {
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

    // Special handling for CompetitorAnalysisStep (step 2)
    if (activeStep === 2) {
      
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
    if (activeStep === 2 && currentStepData) {
      const currentData = stepDataRef.current || {};
      const researchData = currentStepData || {};

      if (researchData.competitors || researchData.researchSummary || researchData.sitemapAnalysis) {
        currentStepData = {
          ...currentData,
          ...researchData,
          competitors: researchData.competitors || currentData.competitors,
          researchSummary: researchData.researchSummary || currentData.researchSummary,
          sitemapAnalysis: researchData.sitemapAnalysis || currentData.sitemapAnalysis,
          stepType: 'research',
          completedAt: new Date().toISOString()
        };

        trace('Wizard: Merged research data:', currentStepData);
      } else {
        console.warn('Wizard: No research data provided, using existing step data');
        currentStepData = currentData;
      }
    }

    // Special handling for PersonaStep (step 3)
    if (activeStep === 3) {
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
          setLoading(false);
          setShowProgressMessage(false);
          setProgressMessage('');
          return;
        }
      }
    }

    // Special handling for IntegrationsStep (step 4)
    if (activeStep === 4) {
      const currentData = stepDataRef.current || {};
      if (!currentStepData && currentData && typeof currentData === 'object') {
        if (currentData.integrations) {
          currentStepData = {
            integrations: currentData.integrations,
          };
        } else {
          currentStepData = currentData;
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
    
    // Show progress message
    const newProgress = ((nextStep + 1) / steps.length) * 100;
    setProgressMessage(`Your data is saved, moving to the next step. Progress is ${Math.round(newProgress)}%`);
    setShowProgressMessage(true);
    
    // Hide message after 3 seconds
    setTimeout(() => {
      setShowProgressMessage(false);
    }, 3000);
    
    // Complete the current step (activeStep + 1 because steps are 1-indexed)
    const currentStepNumber = activeStep + 1;

    const hasCoreStepData = currentStepData && typeof currentStepData === 'object' && (
      currentStepData.website || 
      currentStepData.businessData || 
      currentStepData.competitors ||
      currentStepData.researchSummary ||
      currentStepData.sitemapAnalysis ||
      currentStepData.corePersona || 
      currentStepData.platformPersonas ||
      currentStepData.qualityMetrics
    );

    const hasIntegrationsData = !!(currentStepData && typeof currentStepData === 'object' && currentStepData.integrations);

    const stepWasCompleted = hasCoreStepData || hasIntegrationsData;

    trace('Wizard: Step completion check - step:', currentStepNumber, 'hasData:', !!currentStepData);

    if (!stepWasCompleted) {
      console.warn('Wizard: No serialized step data supplied; skipping backend completion for step', currentStepNumber);
      if (activeStep !== 0) {
        return;
      }
    } else {
      try {
        const stepResult = await setCurrentStep(currentStepNumber, currentStepData);
        trace('Wizard: Step completion result:', stepResult);

        // Check for warnings in the response (legacy support)
        const responseData = stepResult.response || stepResult;
        if (responseData.warnings && responseData.warnings.length > 0) {
          console.warn('Wizard: Step completed with warnings:', responseData.warnings);
          // Show warnings to user - could add a toast notification or alert here
          setShowProgressMessage(true);
          setProgressMessage(`Step completed but with issues: ${responseData.warnings.join(', ')}`);
          setTimeout(() => {
            setShowProgressMessage(false);
            setProgressMessage(`Your data is saved, moving to the next step. Progress is ${Math.round(newProgress)}%`);
          }, 4000); // Show warnings for longer
        }
      } catch (error: any) {
        console.error('Wizard: BLOCKING ERROR - Failed to complete step with backend. Aborting progression.', error);

        // Handle blocking database errors
        let errorMessage = 'Failed to complete step. Please try again.';
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.message) {
          errorMessage = error.message;
        }

        // Show blocking error message
        setShowProgressMessage(true);
        setProgressMessage(`❌ CRITICAL ERROR: ${errorMessage}`);
        setLoading(false);

        // Don't proceed to next step on blocking errors
        return;
      }

      const stepResponse = await getCurrentStep();
      trace('Wizard: Backend step after completion:', stepResponse.step);
    }
    
    setActiveStep(nextStep);
    try {
      localStorage.setItem('onboarding_active_step', String(nextStep));
      
      const cachedInit = sessionStorage.getItem('onboarding_init');
      if (cachedInit) {
        try {
          const data = JSON.parse(cachedInit);
          if (data.onboarding) {
             data.onboarding.current_step = currentStepNumber;
             data.onboarding.completion_percentage = newProgress;
             sessionStorage.setItem('onboarding_init', JSON.stringify(data));
          }
        } catch (e) {
          console.warn('Wizard: Failed to update session cache', e);
        }
      }
    } catch (_e) {}
    
    setProgressState(newProgress);
  }, [activeStep, onComplete, introCompleted]);

  const handleBack = useCallback(async () => {
    setDirection('left');
    const prevStep = activeStep - 1;
    setActiveStep(prevStep);
    // Do not complete a step when navigating back; just update UI state
    // Backend step progression should only occur on forward completion with valid data
    
    // Update progress
    const newProgress = ((prevStep + 1) / steps.length) * 100;
    setProgressState(newProgress);
  }, [activeStep]);

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= activeStep) {
      setDirection(stepIndex > activeStep ? 'right' : 'left');
      setActiveStep(stepIndex);
      // Do not complete a step on arbitrary step navigation; only adjust UI
    }
  };

  const updateHeaderContent = useCallback((content: StepHeaderContent) => {
    setStepHeaderContent(prev => {
      if (prev.title === content.title && prev.description === content.description) {
        return prev;
      }
      return content;
    });
  }, []);

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
    const stepComponents = [
      <IntroStep
        key="intro"
        updateHeaderContent={updateHeaderContent}
      />,
      <WebsiteStep key="website" onContinue={handleNext} updateHeaderContent={updateHeaderContent} onValidationChange={(isValid) => handleStepValidationChange(1, isValid)} onDataReady={handleWebsiteDataReady} />,
      <CompetitorAnalysisStep 
        key="research" 
        onContinue={handleNext} 
        onBack={handleBack}
        userUrl={stepData?.website || stepData?.website_url || localStorage.getItem('website_url') || ''}
        industryContext={stepData?.industryContext}
        onDataReady={handleCompetitorDataReady}
        initialData={stepData}
      />,
      <PersonalizationStep 
        key="personalization" 
        onContinue={handleNext} 
        updateHeaderContent={updateHeaderContent}
        onValidationChange={(isValid: boolean) => handleStepValidationChange(3, isValid)}
        onDataChange={handleStepDataChange}
        onboardingData={personaOnboardingData}
        stepData={personaStepData}
      />,
      <IntegrationsStep 
        key="integrations" 
        onContinue={handleNext} 
        updateHeaderContent={updateHeaderContent} 
        onValidationChange={(isValid: boolean) => handleStepValidationChange(4, isValid)}
        onDataChange={handleStepDataChange}
      />,
      <FinalStep key="final" onContinue={handleComplete} updateHeaderContent={updateHeaderContent} />
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
        p: { xs: 2, md: 4 },
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
        elevation={24}
        sx={{
          maxWidth: '100%',
          width: '100%',
          borderRadius: 4,
          overflow: 'visible',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header with Stepper */}
        <WizardHeader
          activeStep={activeStep}
          progress={progress}
          stepHeaderContent={stepHeaderContent}
          showProgressMessage={showProgressMessage}
          progressMessage={progressMessage}
          showHelp={showHelp}
          isMobile={isMobile}
          steps={steps}
          onStepClick={handleStepClick}
          onHelpToggle={() => setShowHelp(!showHelp)}
        />

        {/* Background tasks status chip (visible after Step 2) */}
        {backgroundTasks && !backgroundTasks.all_done && (
          <SystemStatusChip
            activeTasks={backgroundTasks.total - backgroundTasks.completed_count - backgroundTasks.failed_count}
            totalTasks={backgroundTasks.total}
          />
        )}

        {/* Content */}
        <Box sx={{ p: { xs: 1, md: 2 }, pt: 1, width: '100%', overflow: 'visible' }}>
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
