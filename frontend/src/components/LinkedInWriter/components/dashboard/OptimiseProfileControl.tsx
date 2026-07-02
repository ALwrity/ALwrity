import React from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import CircularProgress from '@mui/material/CircularProgress';
import { getProfileStrengthSegmentFillCount } from '../../utils/profileStrengthUtils';

/** Larger button size for better visibility in the header nav */
export const PROFILE_ACTION_BTN_HEIGHT = 64;

const SEGMENT_COLORS = [
  '#4338ca', // indigo-700
  '#3b82f6', // blue-500
  '#0ea5e9', // sky-500
  '#14b8a6', // teal-500
  '#22c55e', // green-500
  '#16a34a', // green-600 (darker for WCAG contrast)
  '#64748b', // slate-500 (darker gray for contrast)
];

interface ProfileStrengthTickerProps {
  percent: number;
  strengthLabel?: string;
  strengthTooltip?: string;
}

function ProfileStrengthTicker({ percent, strengthLabel, strengthTooltip }: ProfileStrengthTickerProps) {
  const segments = 7;
  const clamped = Math.max(0, Math.min(100, percent));
  const filledCount = getProfileStrengthSegmentFillCount(clamped, segments);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={
        strengthTooltip
          ? `${clamped}% profile strength. ${strengthTooltip}`
          : `${clamped}% profile strength${strengthLabel ? `. ${strengthLabel}` : ''}`
      }
      style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}
      title={strengthTooltip}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{clamped}%</span>
        {strengthLabel && (
          <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b', lineHeight: 1.2 }}>
            {strengthLabel}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {SEGMENT_COLORS.slice(0, segments).map((color, i) => {
          const isFilled = i < filledCount;
          return (
            <div
              key={i}
              style={{
                width: 26,
                height: 10,
                borderRadius: 3,
                background: isFilled ? color : '#e5e7eb',
                border: isFilled ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1d5d6',
                flexShrink: 0,
                transition: 'background 200ms ease',
              }}
            />
          );
        })}
        {filledCount > 0 && filledCount < segments && (
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '2px solid #14b8a6',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -4,
              marginRight: -4,
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              flexShrink: 0,
            }}
          >
            <CheckIcon sx={{ fontSize: 13, color: '#14b8a6' }} />
          </span>
        )}
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2px solid ${clamped >= 95 ? '#22c55e' : '#d1d5db'}`,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <StarIcon
            sx={{
              fontSize: 12,
              color: clamped >= 95 ? '#22c55e' : '#9ca3af',
            }}
          />
        </span>
      </div>
    </div>
  );
}

interface OptimiseProfileControlProps {
  onOptimiseProfile: () => void;
  profileStrengthPercent?: number | null;
  strengthLabel?: string;
  strengthTooltip?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  variant?: 'ticker' | 'capsule';
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        onClick={onOptimiseProfile}
        disabled={disabled}
        aria-label={label}
        title={strengthTooltip || label}
        style={{
          width: btnSize,
          height: btnSize,
          flexShrink: 0,
          borderRadius: '50%',
          border: '2px solid #0a66c2',
          background: '#ffffff',
          color: '#0f172a',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 8,
          boxShadow: '0 3px 10px rgba(10, 102, 194, 0.18)',
        }}
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
