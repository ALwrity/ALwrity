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

/** Standard ✕ close control — matches Landing mobile detail dialog (section 4). */
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
      className={className}
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        bgcolor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15, 23, 42, 0.06)',
        border: isDark ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(148, 163, 184, 0.45)',
        color: isDark ? '#fff' : '#475569',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.45)' : '0 1px 4px rgba(15, 23, 42, 0.08)',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15, 23, 42, 0.1)',
          color: isDark ? '#fff' : '#0f172a',
        },
        '&.Mui-disabled': {
          opacity: 0.45,
        },
      }}
    >
      <CloseIcon sx={{ fontSize: 20 }} />
    </IconButton>
  );
};
