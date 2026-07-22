import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { ProfileStrengthTicker } from './ProfileStrengthTicker';
import { ConnectLockBadge } from './ConnectLockIcon';

interface OptimiseProfileRailButtonProps {
  variant?: 'main' | 'tab';
  onClick: () => void;
  isLoading?: boolean;
  profileStrengthPercent?: number | null;
  strengthLabel?: string;
  strengthTooltip?: string;
  connectLocked?: boolean;
}

export const OptimiseProfileRailButton: React.FC<OptimiseProfileRailButtonProps> = ({
  variant = 'main',
  onClick,
  isLoading = false,
  profileStrengthPercent = null,
  strengthLabel = '',
  strengthTooltip = '',
  connectLocked = false,
}) => {
  const isTab = variant === 'tab';
  const rootClass = [
    'linkedin-optimise-profile-rail-btn',
    isTab && 'linkedin-optimise-profile-rail-btn--tab',
    connectLocked && 'linkedin-studio-connect-locked',
    connectLocked && 'linkedin-studio-connect-locked--lock-right',
  ]
    .filter(Boolean)
    .join(' ');

  const ariaLabel = isLoading
    ? 'Loading profile strength'
    : connectLocked
      ? 'Connect LinkedIn to optimise your profile'
      : `LinkedIn Profile — Optimise Profile${profileStrengthPercent != null ? `, ${profileStrengthPercent}% strength` : ''}`;

  return (
    <button
      type="button"
      className={rootClass}
      onClick={onClick}
      disabled={isLoading}
      aria-label={ariaLabel}
      title={
        connectLocked
          ? undefined
          : strengthTooltip || 'LinkedIn Profile — Optimise your profile'
      }
      role={isTab ? 'tab' : undefined}
    >
      {isLoading ? (
        <span className="linkedin-optimise-profile-rail-btn__loading">
          <CircularProgress size={isTab ? 16 : 18} thickness={4} sx={{ color: '#64748b' }} />
          <span>Loading…</span>
        </span>
      ) : (
        <>
          <span className="linkedin-optimise-profile-rail-btn__icon" aria-hidden>
            ✦
          </span>
          <span className="linkedin-optimise-profile-rail-btn__copy">
            <span
              className={[
                'linkedin-optimise-profile-rail-btn__title',
                isTab && 'linkedin-optimise-profile-rail-btn__title--stacked',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isTab ? (
                <>
                  <span>Optimise</span>
                  <span>Profile</span>
                </>
              ) : (
                'Optimise Profile'
              )}
            </span>
            {profileStrengthPercent != null && !connectLocked && !isTab && (
              <ProfileStrengthTicker
                percent={profileStrengthPercent}
                strengthLabel={strengthLabel}
                strengthTooltip={strengthTooltip}
                variant="inline"
              />
            )}
          </span>
          {connectLocked && <ConnectLockBadge size={11} />}
        </>
      )}
    </button>
  );
};
