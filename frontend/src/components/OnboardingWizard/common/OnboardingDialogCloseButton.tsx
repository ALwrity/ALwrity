import React from 'react';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface OnboardingDialogCloseButtonProps {
  onClick: () => void;
  /** Defaults to "Close dialog" */
  ariaLabel?: string;
  /** Slightly larger hit target for dialog headers */
  size?: 'small' | 'medium';
}

/**
 * LinkedIn-style circular close control for onboarding dialogs and modals.
 */
export const OnboardingDialogCloseButton: React.FC<OnboardingDialogCloseButtonProps> = ({
  onClick,
  ariaLabel = 'Close dialog',
  size = 'small',
}) => {
  const dimension = size === 'medium' ? 36 : 32;
  const iconSize = size === 'medium' ? 20 : 18;

  return (
    <IconButton
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid="onboarding-dialog-close"
      size={size}
      sx={{
        width: dimension,
        height: dimension,
        flexShrink: 0,
        bgcolor: '#f3f4f6',
        border: '1px solid #e5e7eb',
        color: '#6b7280',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        '&:hover': {
          bgcolor: '#e5e7eb',
          borderColor: '#d1d5db',
          color: '#374151',
        },
      }}
    >
      <CloseIcon sx={{ fontSize: iconSize, strokeWidth: 0.5 }} />
    </IconButton>
  );
};

export default OnboardingDialogCloseButton;
