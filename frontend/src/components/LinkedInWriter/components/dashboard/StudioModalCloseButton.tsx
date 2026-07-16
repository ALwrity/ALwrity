import React from 'react';

interface StudioModalCloseButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Consistent ✕ close control for LinkedIn Studio popups. */
export const StudioModalCloseButton: React.FC<StudioModalCloseButtonProps> = ({
  onClick,
  ariaLabel = 'Close',
  disabled = false,
  className = 'linkedin-studio-modal-close',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={className}
  >
    ✕
  </button>
);
