import React from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CircularProgress from '@mui/material/CircularProgress';
import { ProfileStrengthTicker } from './ProfileStrengthTicker';

/** Header nav optimise button — sized to fit fixed 72px bar via CSS alignment */
export const PROFILE_ACTION_BTN_HEIGHT = 55;

interface OptimiseProfileControlProps {
  onOptimiseProfile: () => void;
  profileStrengthPercent?: number | null;
  strengthLabel?: string;
  strengthTooltip?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  variant?: 'ticker' | 'capsule' | 'tab';
}

export const OptimiseProfileControl: React.FC<OptimiseProfileControlProps> = ({
  onOptimiseProfile,
  profileStrengthPercent = null,
  strengthLabel = '',
  strengthTooltip = '',
  isDisabled = false,
  isLoading = false,
  variant = 'ticker',
}) => {
  const disabled = isDisabled || isLoading;
  const label = isLoading ? 'Loading…' : 'Optimise Profile';

  if (variant === 'tab') {
    return (
      <button
        type="button"
        className="linkedin-writer-header-studio-tab linkedin-writer-header-studio-tab--optimise"
        onClick={onOptimiseProfile}
        disabled={disabled}
        title={strengthTooltip || label}
        aria-label={label}
        role="tab"
      >
        {isLoading ? (
          <span className="linkedin-writer-header-studio-tab-label">Loading…</span>
        ) : (
          <span className="linkedin-writer-header-studio-tab-label linkedin-writer-header-studio-tab-label--stacked">
            <span>Optimise</span>
            <span>Profile</span>
          </span>
        )}
        <span className="linkedin-writer-header-studio-tab-icon" aria-hidden>
          ✦
        </span>
      </button>
    );
  }

  if (variant === 'capsule') {
    return (
      <button
        type="button"
        onClick={onOptimiseProfile}
        disabled={disabled}
        title={strengthTooltip || label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 22px',
          borderRadius: 999,
          border: '2px solid #0a66c2',
          background: 'linear-gradient(180deg, #f8fbff 0%, #eef6fc 100%)',
          color: '#0f172a',
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          boxShadow: '0 2px 8px rgba(10, 102, 194, 0.12)',
        }}
      >
        <span>{label}</span>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#0a66c2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden
        >
          <OpenInNewIcon sx={{ fontSize: 16, color: '#fff' }} />
        </span>
      </button>
    );
  }

  const btnSize = PROFILE_ACTION_BTN_HEIGHT;

  return (
    <div className="linkedin-optimise-profile-control">
      <button
        type="button"
        className="linkedin-optimise-profile-btn"
        onClick={onOptimiseProfile}
        disabled={disabled}
        aria-label={label}
        title={strengthTooltip || label}
        style={{ width: btnSize, height: btnSize }}
      >
        {isLoading ? (
          <CircularProgress size={20} thickness={4} sx={{ color: '#0a66c2' }} />
        ) : (
          <>
            <span>Optimise</span>
            <span>Profile</span>
          </>
        )}
      </button>

      {profileStrengthPercent != null && (
        <ProfileStrengthTicker
          percent={profileStrengthPercent}
          strengthLabel={strengthLabel}
          strengthTooltip={strengthTooltip}
        />
      )}
    </div>
  );
};
