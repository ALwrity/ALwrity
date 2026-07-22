import React from 'react';
import { AlwrityModalCloseIconButton } from '../../../shared/AlwrityModalCloseIconButton';

interface StudioModalCloseButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
}

/** Consistent ✕ close control for LinkedIn Studio popups. */
export const StudioModalCloseButton: React.FC<StudioModalCloseButtonProps> = ({
  onClick,
  ariaLabel = 'Close',
  disabled = false,
  className,
  variant = 'light',
}) => (
  <AlwrityModalCloseIconButton
    onClick={onClick}
    ariaLabel={ariaLabel}
    disabled={disabled}
    className={className}
    variant={variant}
  />
);
