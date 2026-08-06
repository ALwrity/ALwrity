import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Alert, 
  Fade,
  Container,
  Grid,
  Snackbar,
} from '@mui/material';
import Lock from '@mui/icons-material/Lock';
import OnboardingButton from './common/OnboardingButton';
import { 
  HelpSection, 
  BenefitsModal, 
  useApiKeyStep 
} from './ApiKeyStep/utils';
import ApiKeyCarousel from './ApiKeyStep/utils/ApiKeyCarousel';
import ApiKeySidebar from './ApiKeyStep/utils/ApiKeySidebar';

interface ApiKeyStepProps {
  onContinue: (stepData?: any) => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
}

const ApiKeyStep: React.FC<ApiKeyStepProps> = ({ onContinue, updateHeaderContent, onValidationChange }) => {
  const [focusedProvider, setFocusedProvider] = useState<any>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [successDismissed, setSuccessDismissed] = useState(false);
  
  const {
    loading,
    error,
    success,
    showHelp,
    savedKeys,
    benefitsModalOpen,
    selectedProvider,
    providers,
    isValid,
    currentProviderIndex,
    setCurrentProviderIndex,
    showCompletionToast,
    setShowCompletionToast,
    setShowHelp,
    handleContinue,
    handleBenefitsClick,
    handleCloseBenefitsModal,
  } = useApiKeyStep(onContinue);

  const handleProviderFocus = (provider: any) => {
    setFocusedProvider(provider);
  };

  useEffect(() => {
    // Update header content when component mounts
    updateHeaderContent({
      title: 'Connect Your AI Services',
      description: 'Configure your AI providers to unlock intelligent content creation, research capabilities, and enhanced user assistance.'
    });
    
    // Set initial focused provider
    if (providers.length > 0) {
      setFocusedProvider(providers[currentProviderIndex] ?? providers[0]);
    }
  }, [updateHeaderContent, providers, currentProviderIndex]);

  // Notify parent of validation changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  // Reset dismissed state whenever a new error/success message comes in,
  // so a fresh message is always shown even if the previous one was dismissed.
  useEffect(() => {
    if (error) setErrorDismissed(false);
  }, [error]);

  useEffect(() => {
    if (success) setSuccessDismissed(false);
  }, [success]);

  return (
    <>
      <Fade in={true} timeout={500}>
        <Container maxWidth="lg" sx={{ py: 2 }}>
          {/* Main Content Layout */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            {/* Carousel Section */}
            <Grid item xs={12} lg={8}>
              <ApiKeyCarousel
                providers={providers}
                currentProvider={currentProviderIndex}
                setCurrentProvider={setCurrentProviderIndex}
                onProviderFocus={handleProviderFocus}
              />
            </Grid>
            
            {/* Sidebar Section */}
            <Grid item xs={12} lg={4}>
              <ApiKeySidebar
                currentProvider={focusedProvider}
                allProviders={providers}
                currentStep={currentProviderIndex + 1}
                totalSteps={providers.length}
              />
              </Grid>
          </Grid>

          {/* Get Help Section */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
            <OnboardingButton
              variant="text"
              onClick={() => setShowHelp(!showHelp)}
              size="small"
              sx={{ mb: 2 }}
            >
              {showHelp ? 'Hide Setup Help' : 'Need Setup Help?'}
            </OnboardingButton>
        </Box>

        {/* Benefits Modal */}
          <BenefitsModal
          open={benefitsModalOpen}
          onClose={handleCloseBenefitsModal}
            selectedProvider={selectedProvider}
          />

        {/* Help Section */}
          <HelpSection showHelp={showHelp} />

        {/* Alerts */}
        <Box sx={{ mt: 3 }}>
          {error && !errorDismissed && (
            <Fade in={true}>
              <Alert
                severity="error"
                role="alert"
                aria-live="assertive"
                onClose={() => setErrorDismissed(true)}
                sx={{ 
                mb: 2, 
                borderRadius: 2,
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                {error}
              </Alert>
            </Fade>
          )}
          
          {success && !successDismissed && (
            <Fade in={true}>
              <Alert
                severity="success"
                role="status"
                aria-live="polite"
                onClose={() => setSuccessDismissed(true)}
                sx={{ 
                mb: 2, 
                borderRadius: 2,
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                {success}
              </Alert>
            </Fade>
          )}
        </Box>


        {/* Security Notice */}
          <Box sx={{ 
            mt: 4, 
            textAlign: 'center',
            p: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
            border: '1px solid #E2E8F0',
          }}>
            <Typography variant="body2" sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
              gap: 1,
            fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 500,
              color: '#475569',
              fontSize: '0.95rem',
          }}>
              <Lock sx={{ fontSize: 18, color: '#10B981' }} />
            Your API keys are encrypted and stored securely on your device
          </Typography>
        </Box>
        </Container>
      </Fade>

      {/* Completion Toast */}
      <Snackbar
        open={showCompletionToast}
        autoHideDuration={5000}
        onClose={() => setShowCompletionToast(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
          },
        }}
      >
        <Alert 
          onClose={() => setShowCompletionToast(false)} 
          severity="success"
          sx={{ 
            width: '100%',
            background: 'transparent',
            color: 'white',
            '& .MuiAlert-icon': {
              color: 'white',
            },
          }}
        >
          🎉 All API keys configured! Click Continue to proceed to Website Analysis.
        </Alert>
      </Snackbar>
    </>
  );
};

export default ApiKeyStep;  