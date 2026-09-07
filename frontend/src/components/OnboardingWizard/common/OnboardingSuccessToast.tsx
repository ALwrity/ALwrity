import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';

interface OnboardingSuccessToastProps {
  message: string;
  onDismiss: () => void;
}

export const OnboardingSuccessToast: React.FC<OnboardingSuccessToastProps> = ({
  message,
  onDismiss,
}) => (
  <Box
    role="status"
    aria-live="polite"
    sx={{
      bgcolor: '#FFFFFF',
      border: '1px solid #10B981',
      borderRadius: 2,
      boxShadow:
        '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      p: 1.5,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      width: 'fit-content',
      maxWidth: { xs: '280px', sm: '360px', md: '420px' },
      animation: 'fadeIn 0.3s ease-out',
    }}
  >
    <CheckCircleIcon sx={{ color: '#10B981', fontSize: 20, flexShrink: 0 }} />
    <Typography
      variant="body2"
      sx={{ color: '#1F2937', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 }}
    >
      {message}
    </Typography>
    <IconButton
      size="small"
      aria-label="Dismiss success message"
      onClick={onDismiss}
      sx={{
        ml: 'auto',
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
