import React from 'react';
import { Box, Fade, Paper } from '@mui/material';
import { OnboardingSuccessToast } from '../common/OnboardingSuccessToast';
import { WizardHeader } from '../common/WizardHeader';
import { WizardStepper } from '../common/WizardStepper';
import { WizardRetryBar } from '../common/WizardRetryBar';
import { WizardNavigation } from '../common/WizardNavigation';
import {
  ONBOARDING_STEP_CONTENT_PADDING_TOP,
  ONBOARDING_STEP_CONTENT_PADDING_X,
} from '../common/wizardChromeLayout';

interface StepHeaderContent {
  title: string;
  description: string;
}

interface WizardShellProps {
  activeStep: number;
  steps: Array<{ label: string; description: string; icon: string }>;
  stepHeaderContent: StepHeaderContent;
  showProgressMessage: boolean;
  progressMessage: string;
  progressMessageIsError: boolean;
  resumeToast: string | null;
  onDismissResumeToast: () => void;
  showHelp: boolean;
  isMobile: boolean;
  email: string;
  backgroundTasks: any;
  completedFrontier: number;
  furthestAccessibleStep: number;
  setupProgressPercent: number;
  retryStepNumber: number | null;
  successMessage: string | null;
  isCurrentStepValid: boolean;
  validationMessage: string;
  renderStepContent: (step: number) => React.ReactNode;
  onHelpToggle: () => void;
  onEmailChange: (email: string) => void;
  onViewBackgroundResults: (taskKey: string) => void;
  onStepClick: (stepIndex: number) => void;
  onBack: () => void;
  onNext: (stepData?: any) => void;
  retryStepCompletion: () => Promise<void>;
  dismissRetry: () => void;
  setSuccessMessage: (message: string | null) => void;
}

export const WizardShell: React.FC<WizardShellProps> = ({
  activeStep,
  steps,
  stepHeaderContent,
  showProgressMessage,
  progressMessage,
  progressMessageIsError,
  resumeToast,
  onDismissResumeToast,
  showHelp,
  isMobile,
  email,
  backgroundTasks,
  completedFrontier,
  furthestAccessibleStep,
  setupProgressPercent,
  retryStepNumber,
  successMessage,
  isCurrentStepValid,
  validationMessage,
  renderStepContent,
  onHelpToggle,
  onEmailChange,
  onViewBackgroundResults,
  onStepClick,
  onBack,
  onNext,
  retryStepCompletion,
  dismissRetry,
  setSuccessMessage,
}) => (
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
        background:
          'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
        pointerEvents: 'none',
      },
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
      <WizardHeader
        stepHeaderContent={stepHeaderContent}
        showProgressMessage={showProgressMessage}
        progressMessage={progressMessage}
        progressMessageIsError={progressMessageIsError}
        showHelp={showHelp}
        isMobile={isMobile}
        onHelpToggle={onHelpToggle}
        email={email}
        onEmailChange={onEmailChange}
        backgroundTasks={backgroundTasks}
        onViewBackgroundResults={onViewBackgroundResults}
      />

      <WizardStepper
        activeStep={activeStep}
        completedFrontier={completedFrontier}
        furthestAccessibleStep={furthestAccessibleStep}
        isMobile={isMobile}
        steps={steps}
        onStepClick={onStepClick}
        progress={setupProgressPercent}
        resumeToast={resumeToast}
        onDismissResumeToast={onDismissResumeToast}
      />

      <WizardRetryBar
        retryStepNumber={retryStepNumber}
        progressMessage={progressMessage}
        retryStepCompletion={retryStepCompletion}
        dismissRetry={dismissRetry}
      />

      <Box
        sx={{
          px: ONBOARDING_STEP_CONTENT_PADDING_X,
          pt:
            activeStep === 0
              ? ONBOARDING_STEP_CONTENT_PADDING_TOP.connect
              : ONBOARDING_STEP_CONTENT_PADDING_TOP.default,
          pb: activeStep === 0 ? { xs: 0.5, md: 1 } : { xs: 1.5, md: 2 },
          flexGrow: 1,
          width: '100%',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 4, md: 8 },
            right: { xs: 16, md: 32 },
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 1.5,
            pointerEvents: 'none',
            '& > *': { pointerEvents: 'auto' },
          }}
        >
          {successMessage && (
            <OnboardingSuccessToast
              message={successMessage}
              onDismiss={() => setSuccessMessage(null)}
            />
          )}
        </Box>

        <Fade in={true} timeout={400}>
          <Box sx={{ width: '100%', overflow: 'visible' }}>{renderStepContent(activeStep)}</Box>
        </Fade>
      </Box>

      {activeStep !== steps.length - 1 && (
        <WizardNavigation
          activeStep={activeStep}
          totalSteps={steps.length}
          onBack={onBack}
          onNext={onNext}
          isLastStep={activeStep === steps.length - 1}
          isCurrentStepValid={isCurrentStepValid}
          validationMessage={validationMessage}
          nextLabel={activeStep === 0 ? 'ALwrity Your Growth' : 'Continue'}
        />
      )}
    </Paper>
  </Box>
);
