import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Container,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  CheckCircle,
  Refresh as RefreshIcon,
  Psychology as BrainIcon,
  AutoAwesome as StrategyIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useStrategySetupState } from '../../hooks/useStrategySetupState';
import BrandBrainView from './BrandBrainView';
import AutofillPreview from './AutofillPreview';
import StrategyInsightsView from './StrategyInsightsView';
import CalendarProgressView from './CalendarProgressView';

const STEPS = [
  { label: 'Brand Brain & Inputs', description: 'Review your brand profile and strategy inputs', icon: <BrainIcon /> },
  { label: 'Strategy', description: 'Generate and activate your strategy', icon: <StrategyIcon /> },
  { label: 'Calendar', description: 'Generate your content calendar', icon: <CalendarIcon /> },
];

interface StrategySetupWizardProps {
  onComplete?: () => void;
  embedded?: boolean;
}

const StrategySetupWizard: React.FC<StrategySetupWizardProps> = ({ onComplete, embedded }) => {
  const { state, loading, error, setStep, saveStepData, setProgress, completeWizard } = useStrategySetupState();

  const [localStep, setLocalStep] = useState(() => state?.current_step ?? 1);
  const [stepData, setStepData] = useState<Record<string, any>>(() => {
    if (state?.step_data) return state.step_data;
    return {};
  });

  const activeStep = localStep - 1;

  const handleNext = useCallback(async () => {
    if (activeStep < STEPS.length - 1) {
      const next = activeStep + 2;
      setLocalStep(next);
      await setStep(next);
      await setProgress(Math.round((next / STEPS.length) * 100));
    } else {
      await completeWizard();
      onComplete?.();
    }
  }, [activeStep, setStep, setProgress, completeWizard, onComplete]);

  const handleBack = useCallback(async () => {
    if (activeStep > 0) {
      const prev = activeStep;
      setLocalStep(prev);
      await setStep(prev);
      await setProgress(Math.round((prev / STEPS.length) * 100));
    }
  }, [activeStep, setStep, setProgress]);

  const handleBrandBrainLoaded = useCallback((data: any) => {
    setStepData(prev => ({ ...prev, brandBrain: data }));
    saveStepData({ step1: { brandBrain: data } });
  }, [saveStepData]);

  const handleAutofillLoaded = useCallback((fields: any) => {
    setStepData(prev => {
      const updated = { ...prev, autofillFields: fields };
      saveStepData({ step1: updated });
      return updated;
    });
  }, [saveStepData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !state) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Alert severity="error" action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
            Reload
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (state?.status === 'completed') {
    return (
      <Container maxWidth="md">
        <Alert severity="success" icon={<CheckCircle fontSize="inherit" />} sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight={600}>Setup Complete</Typography>
          <Typography variant="body2">
            You've completed the strategy setup wizard. Your strategy and calendar are ready.
          </Typography>
        </Alert>
      </Container>
    );
  }

  const wizardContent = (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((step, index) => (
          <Step key={step.label} completed={index < activeStep}>
            <StepLabel
              StepIconComponent={() => (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: index <= activeStep ? 'primary.main' : 'grey.300',
                  color: index <= activeStep ? 'white' : 'grey.600',
                  fontSize: 18,
                }}>
                  {index < activeStep ? <CheckCircle fontSize="small" /> : step.icon}
                </Box>
              )}
            >
              <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ minHeight: 400, mb: 3 }}>
        {activeStep === 0 && (
          <Box>
            <BrandBrainView onDataLoaded={handleBrandBrainLoaded} />
            <Box sx={{ mt: 4 }}>
              <AutofillPreview onDataLoaded={handleAutofillLoaded} />
            </Box>
          </Box>
        )}
        {activeStep === 1 && (
          <StrategyInsightsView onActivated={(strategyId) => {
            setStepData(prev => ({ ...prev, activatedStrategyId: strategyId }));
            saveStepData({ step2: { activated_strategy_id: strategyId } });
          }} />
        )}
        {activeStep === 2 && (
          <CalendarProgressView
            strategyId={stepData.activatedStrategyId || state?.step_data?.step2?.activated_strategy_id || null}
            onGenerated={() => {
              setProgress(100);
              saveStepData({ step3: { generated: true } });
            }}
          />
        )}
      </Box>

      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
        borderRadius: '0 0 12px 12px',
      }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBack />}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          endIcon={activeStep === STEPS.length - 1 ? <CheckCircle /> : <ArrowForward />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          {activeStep === STEPS.length - 1 ? 'Complete' : 'Continue'}
        </Button>
      </Box>
    </Box>
  );

  if (embedded) {
    return wizardContent;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        {wizardContent}
      </Paper>
    </Container>
  );
};

export default StrategySetupWizard;
