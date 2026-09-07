import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface OnboardingResumeToastProps {
  message: string;
  onDismiss: () => void;
}

export const OnboardingResumeToast: React.FC<OnboardingResumeToastProps> = ({
  message,
  onDismiss,
}) => (
  <Box
    data-testid="onboarding-resume-toast"
    role="status"
    aria-live="polite"
    sx={{
      bgcolor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 2,
      boxShadow:
        '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      px: 1.5,
      py: 1,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1,
      width: 'fit-content',
      maxWidth: { xs: '240px', sm: '320px', md: '360px' },
      animation: 'fadeIn 0.3s ease-out',
    }}
  >
    <Typography
      variant="body2"
      sx={{
        color: '#1F2937',
        fontWeight: 600,
        fontSize: { xs: '0.75rem', sm: '0.8125rem' },
        lineHeight: 1.45,
      }}
    >
      {message}
    </Typography>
    <IconButton
      size="small"
      aria-label="Dismiss welcome back message"
      onClick={onDismiss}
      sx={{
        ml: 'auto',
        mt: -0.25,
        p: 0.25,
        color: '#9CA3AF',
        '&:hover': { color: '#4B5563' },
        flexShrink: 0,
      }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  </Box>
);
