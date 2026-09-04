import React from 'react';
import {
  Box,
  Alert,
  Typography,
  Button,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface OnboardingCompletionCTAProps {
  hasCompletedOnboarding: boolean;
  hasActiveStrategy: boolean;
  onCreateStrategy: () => void;
  onDismiss: () => void;
}

const OnboardingCompletionCTA: React.FC<OnboardingCompletionCTAProps> = ({
  hasCompletedOnboarding,
  hasActiveStrategy,
  onCreateStrategy,
  onDismiss,
}) => {
  if (!hasCompletedOnboarding || hasActiveStrategy) {
    return null;
  }
  
  return (
    <Alert
      severity="info"
      sx={{ 
        mb: 3, 
        p: 2,
        backgroundColor: '#e3f2fd',
        border: '1px solid #2196f3',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoAwesomeIcon sx={{ color: '#2196f3', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#0d47a1' }}>
            🎉 Your Marketing OS is ready!
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              onCreateStrategy();
              onDismiss();
            }}
            sx={{
              backgroundColor: '#2196f3',
              '&:hover': { backgroundColor: '#1976d2' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create Content Strategy
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={onDismiss}
            sx={{
              borderColor: '#2196f3',
              color: '#2196f3',
              '&:hover': { borderColor: '#1976d2', backgroundColor: 'rgba(33, 150, 243, 0.04)' },
            }}
          >
            Maybe later
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ mt: 1, color: '#1976d2' }}>
        Your onboarding is complete! Create your first content strategy to plan your marketing impact.
      </Typography>
    </Alert>
  );
};

export default OnboardingCompletionCTA;