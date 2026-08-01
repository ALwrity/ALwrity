import React from 'react';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export type AlwrityModalCloseVariant = 'light' | 'dark';

interface AlwrityModalCloseIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /** light = white popup headers; dark = landing / dark dialogs */
  variant?: AlwrityModalCloseVariant;
}

/** Standard circular ✕ close control — consistent across LinkedIn Studio popups. */
export const AlwrityModalCloseIconButton: React.FC<AlwrityModalCloseIconButtonProps> = ({
  onClick,
  ariaLabel = 'Close',
  disabled = false,
  className,
  variant = 'light',
}) => {
  const isDark = variant === 'dark';

  return (
    <IconButton
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      size="small"
      className={['alwrity-modal-close-btn', className].filter(Boolean).join(' ')}
      sx={{
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#f8fafc',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.35)'
          : '1px solid #e2e8f0',
        color: isDark ? '#ffffff' : '#64748b',
        boxShadow: 'none',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.24)' : '#f1f5f9',
          color: isDark ? '#ffffff' : '#475569',
        },
        '&.Mui-disabled': {
          opacity: 0.45,
        },
      }}
    >
      <CloseIcon sx={{ fontSize: 18, strokeWidth: 0.5 }} />
    </IconButton>
  );
};
