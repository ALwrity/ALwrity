import React from 'react';
import { ProfileStrengthTicker } from './ProfileStrengthTicker';

interface OptimiseProfileHoverHintProps {
  children: React.ReactNode;
  profileStrengthPercent?: number | null;
  strengthLabel?: string;
  strengthTooltip?: string;
  className?: string;
  /** When false, hover popover is omitted (e.g. loading state). */
  showPopover?: boolean;
}

/** Hover popover on profile ✦ only: "LinkedIn Profile" title + strength ticker. */
export const OptimiseProfileHoverHint: React.FC<OptimiseProfileHoverHintProps> = ({
  children,
  profileStrengthPercent = null,
  strengthLabel = '',
  strengthTooltip = '',
  className,
  showPopover = true,
}) => {
  const rootClass = ['linkedin-profile-optimise-hover-wrap', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {children}
      {showPopover && profileStrengthPercent != null && (
        <div className="linkedin-profile-optimise-hover-tracker" role="tooltip">
          <p className="linkedin-profile-optimise-hover-title">LinkedIn Profile</p>
          <ProfileStrengthTicker
            percent={profileStrengthPercent}
            strengthLabel={strengthLabel}
            strengthTooltip={strengthTooltip}
            variant="popover"
          />
        </div>
      )}
    </div>
  );
};
