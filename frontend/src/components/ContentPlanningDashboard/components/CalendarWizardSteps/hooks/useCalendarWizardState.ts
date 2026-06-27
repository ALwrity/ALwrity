import { useState, useCallback, useMemo, useRef } from 'react';
import { CalendarConfig, WizardStep, ValidationError, WizardState, WizardActions } from '../types';

// All interfaces are now imported from types.ts

export const useCalendarWizardState = (
  onGenerateCalendar: (calendarConfig: CalendarConfig) => void
): [WizardState, WizardActions] => {
  // Store the callback in a ref to prevent it from causing re-renders
  const onGenerateCalendarRef = useRef(onGenerateCalendar);
  onGenerateCalendarRef.current = onGenerateCalendar;
  
  const [activeStep, setActiveStep] = useState(0);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>(() => createDefaultConfig());
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Define steps with validation - streamlined 2-step wizard
  const steps: WizardStep[] = useMemo(() => [
    {
      label: 'Calendar Configuration',
      icon: null, // Will be set by parent component
      description: 'Configure your calendar settings and preferences',
      isCompleted: false,
      hasErrors: false
    },
    {
      label: 'Generate Calendar',
      icon: null,
      description: 'Review and generate your optimized content calendar',
      isCompleted: false,
      hasErrors: false
    }
  ], []);

  // Validation rules for each step - streamlined 2-step validation
  const validationRules = useMemo(() => ({
    0: (config: CalendarConfig): ValidationError[] => {
      const errors: ValidationError[] = [];
      // Basic calendar setup validation
      if (!config.calendarType) {
        errors.push({ field: 'calendarType', message: 'Calendar type is required', step: 0 });
      }
      if (!config.startDate) {
        errors.push({ field: 'startDate', message: 'Start date is required', step: 0 });
      }
      if (config.calendarDuration <= 0) {
        errors.push({ field: 'calendarDuration', message: 'Calendar duration must be greater than 0', step: 0 });
      }
      if (config.postingFrequency <= 0) {
        errors.push({ field: 'postingFrequency', message: 'Posting frequency must be greater than 0', step: 0 });
      }
      if (config.contentVolume <= 0) {
        errors.push({ field: 'contentVolume', message: 'Content volume must be greater than 0', step: 0 });
      }
      // Platform and scheduling validation
      if (config.priorityPlatforms.length === 0) {
        errors.push({ field: 'priorityPlatforms', message: 'At least one platform is required', step: 0 });
      }
      if (!config.timeZone) {
        errors.push({ field: 'timeZone', message: 'Time zone is required', step: 0 });
      }
      if (!config.contentDistribution) {
        errors.push({ field: 'contentDistribution', message: 'Content distribution is required', step: 0 });
      }
      if (!config.reviewCycle) {
        errors.push({ field: 'reviewCycle', message: 'Review cycle is required', step: 0 });
      }
      return errors;
    },
    1: (config: CalendarConfig): ValidationError[] => {
      // Step 1 is the generation step, no additional validation needed
      return [];
    }
  }), []);

  // Update calendar configuration
  const updateCalendarConfig = useCallback((updates: Partial<CalendarConfig>) => {
    setCalendarConfig(prev => ({ ...prev, ...updates }));
    // Clear validation errors for updated fields
    setValidationErrors(prev => prev.filter(error => 
      !Object.keys(updates).some(key => error.field.startsWith(key))
    ));
  }, []);

  // Validate a specific step
  const validateStep = useCallback((step: number): boolean => {
    const validator = validationRules[step as keyof typeof validationRules];
    if (!validator) return true;

    const errors = validator(calendarConfig);
    setValidationErrors(prev => {
      const filtered = prev.filter(error => error.step !== step);
      return [...filtered, ...errors];
    });

    return errors.length === 0;
  }, [calendarConfig, validationRules]);

  // Validate all steps
  const validateAllSteps = useCallback((): boolean => {
    const allErrors: ValidationError[] = [];
    Object.keys(validationRules).forEach(stepKey => {
      const step = parseInt(stepKey);
      const validator = validationRules[step as keyof typeof validationRules];
      if (validator) {
        allErrors.push(...validator(calendarConfig));
      }
    });
    setValidationErrors(allErrors);
    return allErrors.length === 0;
  }, [calendarConfig, validationRules]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setValidationErrors([]);
    setError(null);
  }, []);

  // Check if user can proceed to a specific step
  const canProceedToStep = useCallback((step: number): boolean => {
    // Can always go back
    if (step < activeStep) return true;
    
    // Can't skip steps
    if (step > activeStep + 1) return false;
    
    // Validate current step before proceeding
    if (step === activeStep + 1) {
      // Inline validation to avoid circular dependency
      const validator = validationRules[activeStep as keyof typeof validationRules];
      if (!validator) return true;
      
      const errors = validator(calendarConfig);
      return errors.length === 0;
    }
    
    return true;
  }, [activeStep, calendarConfig, validationRules]);

  // Get step status
  const getStepStatus = useCallback((step: number): 'completed' | 'current' | 'pending' | 'error' => {
    if (step === activeStep) return 'current';
    if (step < activeStep) return 'completed';
    if (validationErrors.some(error => error.step === step)) return 'error';
    return 'pending';
  }, [activeStep, validationErrors]);

  // Reset wizard to initial state
  const resetWizard = useCallback(() => {
    setActiveStep(0);
    setCalendarConfig(createDefaultConfig());
    setValidationErrors([]);
    setIsLoading(false);
    setError(null);
    setIsGenerating(false);
    setGenerationProgress(0);
  }, []); // Remove initialConfig from dependencies to prevent infinite loop

  // Enhanced step navigation with validation
  const setActiveStepWithValidation = useCallback((step: number) => {
    if (canProceedToStep(step)) {
      setActiveStep(step);
      clearErrors();
    }
  }, [canProceedToStep, clearErrors]);

  // Generate calendar - simplified to just call the callback
  // Let the modal handle all progress display
  const generateCalendar = useCallback(async () => {
    if (!validateAllSteps()) {
      setError('Please fix validation errors before generating calendar');
      return;
    }

    setError(null);

    try {
      // Simply call the callback - let the modal handle progress
      await onGenerateCalendarRef.current(calendarConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate calendar');
    }
  }, [calendarConfig, validateAllSteps]);

  const state: WizardState = useMemo(() => ({
    activeStep,
    calendarConfig,
    steps,
    validationErrors,
    isLoading,
    error,
    isGenerating,
    generationProgress
  }), [
    activeStep,
    calendarConfig,
    steps,
    validationErrors,
    isLoading,
    error,
    isGenerating,
    generationProgress
  ]);

  const actions: WizardActions = useMemo(() => ({
    setActiveStep: setActiveStepWithValidation,
    updateCalendarConfig,
    validateStep,
    validateAllSteps,
    clearErrors,
    setError,
    setLoading: setIsLoading,
    setGenerating: setIsGenerating,
    setGenerationProgress,
    resetWizard,
    canProceedToStep,
    getStepStatus
  }), [
    setActiveStepWithValidation,
    updateCalendarConfig,
    validateStep,
    validateAllSteps,
    clearErrors,
    setError,
    setIsLoading,
    setIsGenerating,
    setGenerationProgress,
    resetWizard,
    canProceedToStep,
    getStepStatus
  ]);

  return [state, actions];
};

// Helper function to get a valid timezone from user's timezone or fallback to default
const getValidTimezone = (userTimezone: string): string => {
  const validTimezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];
  
  // If user's timezone is in our valid list, use it
  if (validTimezones.includes(userTimezone)) {
    return userTimezone;
  }
  
  // Otherwise, try to map common timezones to our valid options
  const timezoneMap: { [key: string]: string } = {
    'Asia/Colombo': 'Asia/Kolkata',  // Sri Lanka time → IST (same UTC+5:30)
    'Asia/Dhaka': 'Asia/Tokyo',    // Bangladesh time
    'Asia/Karachi': 'Asia/Tokyo',  // Pakistan time
    'UTC': 'Europe/London',        // UTC to GMT
    'GMT': 'Europe/London',        // GMT to London
    'EST': 'America/New_York',     // EST to Eastern Time
    'PST': 'America/Los_Angeles',  // PST to Pacific Time
    'CST': 'America/Chicago',      // CST to Central Time
    'MST': 'America/Denver',       // MST to Mountain Time
  };
  
  // Check if we have a mapping for the user's timezone
  if (timezoneMap[userTimezone]) {
    return timezoneMap[userTimezone];
  }
  
  // Default fallback
  return 'America/New_York';
};

// Helper function to create default calendar config
const createDefaultConfig = (): CalendarConfig => {
  return {
    // Calendar Structure
    calendarType: 'monthly',
    calendarDuration: 4, // 4 weeks/months
    startDate: new Date().toISOString().split('T')[0], // Today's date
    
    // Posting Configuration
    postingFrequency: 3, // 3 posts per week
    contentVolume: 12, // 12 pieces per period
    
    // Platform Scheduling
    priorityPlatforms: ['LinkedIn', 'Twitter'],
    timeZone: getValidTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), // User's timezone or fallback
    
    // Calendar Preferences
    excludeDates: [],
    contentDistribution: 'even',
    reviewCycle: 'weekly',
    
    // Generation Options
    includeWeekends: false,
    autoSchedule: true,
    generateTopics: true
  };
};
