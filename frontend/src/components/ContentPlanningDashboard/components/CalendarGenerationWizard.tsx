import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Chip
} from '@mui/material';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import CampaignIcon from '@mui/icons-material/Campaign';
import { useCalendarAutoStart } from '../../../hooks/useCalendarAutoStart';

// Import modular step components
import {
  CalendarConfigurationStep,
  GenerateCalendarStep,
  useCalendarWizardState,
  WizardErrorBoundary,
  CalendarGenerationLoading
} from './CalendarWizardSteps';

// Import types
import { type CalendarConfig } from './CalendarWizardSteps/types';

interface CalendarGenerationWizardProps {
  userData: any;
  onGenerateCalendar: (calendarConfig: any) => void;
  strategyContext?: any;
  fromStrategyActivation?: boolean;
}

const CalendarGenerationWizard: React.FC<CalendarGenerationWizardProps> = ({
  userData,
  onGenerateCalendar,
  strategyContext,
  fromStrategyActivation = false
}) => {
  // SIMPLIFIED CALENDAR WIZARD - Focused on calendar-specific inputs only
  // Strategy context is used internally during generation, not for mapping
  
    // Only log when component mounts or key props change
  useEffect(() => {
    console.log('🔍 CalendarGenerationWizard: Starting calendar wizard', {
      fromStrategyActivation,
      hasStrategyContext: !!strategyContext
    });
  }, [fromStrategyActivation, strategyContext]);

  // Use enhanced state management with calendar-specific config
  const [state, actions] = useCalendarWizardState(onGenerateCalendar);
  const { 
    activeStep, 
    calendarConfig,
    validationErrors, 
    isLoading, 
    error, 
    isGenerating, 
    generationProgress 
  } = state;

  // Streamlined 2 steps for calendar-specific inputs
  const steps = [
    {
      label: 'Calendar Configuration',
      icon: <CalendarIcon />,
      description: 'Configure all your calendar settings and preferences'
    },
    {
      label: 'Generate Calendar',
      icon: <CampaignIcon />,
      description: 'Review and generate your optimized content calendar'
    }
  ];

  const handleNext = useCallback(() => {
    if (actions.validateStep(activeStep)) {
      actions.setActiveStep(activeStep + 1);
    }
  }, [actions, activeStep]);

  const handleBack = useCallback(() => {
    actions.setActiveStep(activeStep - 1);
  }, [actions, activeStep]);

  // Create stable callback for generate calendar
  const handleGenerateCalendar = useCallback(() => {
    console.log('🎯 CalendarGenerationWizard: handleGenerateCalendar called');
    console.log('🎯 CalendarGenerationWizard: calendarConfig:', calendarConfig);
    onGenerateCalendar(calendarConfig);
  }, [onGenerateCalendar, calendarConfig]);

  // Phase 4: Auto-start generation when arriving from strategy activation.
  // Fires exactly once; user can opt out via autoGenerate:false in nav state.
  const location = useLocation();
  const { shouldAutoStart, consumeAutoStart, hasConsumed } = useCalendarAutoStart({
    fromStrategyActivation,
    locationState: location.state,
    strategyContext,
    onAutoStart: handleGenerateCalendar,
    isGenerating,
  });

  useEffect(() => {
    if (shouldAutoStart && !isGenerating && !hasConsumed) {
      console.log('⚡ CalendarGenerationWizard: auto-starting generation from strategy activation');
      // Jump to the final (Generate) step so the UI reflects generation state.
      actions.setActiveStep(steps.length - 1);
      consumeAutoStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart, isGenerating, hasConsumed, consumeAutoStart]);

  // REMOVED: Show loading state if generating - Let modal handle progress display
  // The modal should open immediately and show progress inside

  // Show error state if there's an error
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={actions.resetWizard}
          sx={{ mr: 1 }}
        >
          Reset Wizard
        </Button>
      </Box>
    );
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <CalendarConfigurationStep
            calendarConfig={calendarConfig}
            onConfigUpdate={actions.updateCalendarConfig}
            strategyContext={strategyContext}
            isFromStrategyActivation={fromStrategyActivation}
          />
        );
      case 1:
        return (
          <GenerateCalendarStep
            calendarConfig={calendarConfig}
            onGenerateCalendar={handleGenerateCalendar}
            strategyContext={strategyContext}
            isFromStrategyActivation={fromStrategyActivation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <WizardErrorBoundary>
      <Box sx={{ p: 3 }}>
        {/* Simplified header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Content Calendar Wizard
          </Typography>
          {fromStrategyActivation && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Chip 
                label="Strategy Context Available"
                color="success"
                variant="outlined"
              />
            </Box>
          )}
        </Box>

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                icon={step.icon}
                optional={index === steps.length - 1 ? (
                  <Typography variant="caption">Generate Calendar</Typography>
                ) : null}
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  {renderStepContent(index)}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={(e) => {
                        console.log('🎯 Button clicked:', { index, isLastStep: index === steps.length - 1 });
                        if (index === steps.length - 1) {
                          handleGenerateCalendar();
                        } else {
                          handleNext();
                        }
                      }}
                      sx={{ mr: 1 }}
                      disabled={isLoading || !actions.canProceedToStep(index + 1)}
                    >
                      {index === steps.length - 1 ? 'Generate Calendar' : 'Continue'}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={handleBack}
                      sx={{ mr: 1 }}
                    >
                      Back
                    </Button>
                  </Box>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>
    </WizardErrorBoundary>
  );
};

export default CalendarGenerationWizard;
