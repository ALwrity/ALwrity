import React from 'react';
import {
  Box,
  Button,
  Typography,
  Tooltip
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import CheckCircle from '@mui/icons-material/CheckCircle';
import {
  WIZARD_ACTIVE_NEXT_BUTTON_GRADIENT,
  WIZARD_ACTIVE_NEXT_BUTTON_HOVER_GRADIENT,
} from './onboardingButtonStyles';

interface WizardNavigationProps {
  activeStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  isLastStep: boolean;
  isCurrentStepValid?: boolean;
  nextLabel?: string;
  validationMessage?: string;
}

export const WizardNavigation: React.FC<WizardNavigationProps> = ({
  activeStep,
  totalSteps,
  onBack,
  onNext,
  isLastStep,
  isCurrentStepValid = true,
  nextLabel = 'Continue',
  validationMessage
}) => {
  const isInitStep = activeStep === 0;
  const tooltipText = isInitStep
    ? 'Review the intro steps, then click to start Step 2: Website.'
    : (!isCurrentStepValid ? (validationMessage || 'Complete the current step requirements to continue') : '');

  return (
    <Box
      data-testid="wizard-footer-bar"
      sx={{
        p: { xs: 1.5, md: 2.24 },
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(0,0,0,0.02)',
      }}
    >
      <Button
        variant="outlined"
        onClick={onBack}
        disabled={activeStep === 0}
        startIcon={<ArrowBack />}
        sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          borderColor: 'rgba(0,0,0,0.2)',
          color: 'text.primary',
          '&:hover': {
            borderColor: 'rgba(0,0,0,0.4)',
            background: 'rgba(0,0,0,0.04)',
          },
          '&:disabled': {
            borderColor: 'rgba(0,0,0,0.1)',
            color: 'rgba(0,0,0,0.3)',
          }
        }}
      >
        Back
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ opacity: 0.7, fontWeight: 500 }}>
          Step {activeStep + 1} of {totalSteps}
        </Typography>
        {isLastStep && (
          <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
        )}
      </Box>

      {!isLastStep && (
        <Tooltip 
          title={tooltipText}
          placement="top"
        >
          <span>
            <Button
              variant="contained"
              onClick={onNext}
              disabled={!isCurrentStepValid}
              endIcon={<ArrowForward />}
              id="wizard-next-button"
              data-testid="wizard-next-button"
              data-active-gradient={WIZARD_ACTIVE_NEXT_BUTTON_GRADIENT}
              data-hover-gradient={WIZARD_ACTIVE_NEXT_BUTTON_HOVER_GRADIENT}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                background: isCurrentStepValid
                  ? WIZARD_ACTIVE_NEXT_BUTTON_GRADIENT
                  : 'rgba(0,0,0,0.1)',
                boxShadow: isCurrentStepValid
                  ? '0 4px 14px rgba(236, 72, 153, 0.28)'
                  : 'none',
                '&:hover': {
                  background: isCurrentStepValid
                    ? WIZARD_ACTIVE_NEXT_BUTTON_HOVER_GRADIENT
                    : 'rgba(0,0,0,0.1)',
                  transform: isCurrentStepValid ? 'translateY(-1px)' : 'none',
                  boxShadow: isCurrentStepValid
                    ? '0 6px 18px rgba(168, 85, 247, 0.35)'
                    : 'none',
                },
                '&:disabled': {
                  background: 'rgba(0,0,0,0.1)',
                  color: 'rgba(0,0,0,0.4)',
                  boxShadow: 'none',
                  transform: 'none',
                },
              }}
            >
              {nextLabel}
            </Button>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};
