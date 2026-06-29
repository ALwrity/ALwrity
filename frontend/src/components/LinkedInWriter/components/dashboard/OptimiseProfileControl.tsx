import React from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';

/** Matches Connect / Disconnect pill button height */
export const PROFILE_ACTION_BTN_HEIGHT = 44;

const SEGMENT_COLORS = [
  '#4338ca',
  '#3b82f6',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#4ade80',
  '#d1d5db',
];

interface ProfileStrengthTickerProps {
  percent: number;
  strengthLabel?: string;
}

function ProfileStrengthTicker({ percent, strengthLabel }: ProfileStrengthTickerProps) {
  const segments = 7;
  const clamped = Math.max(0, Math.min(100, percent));
  const filledCount = Math.round((clamped / 100) * segments);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
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
  isDisabled?: boolean;
  isLoading?: boolean;
  variant?: 'ticker' | 'capsule';
}

export const OptimiseProfileControl: React.FC<OptimiseProfileControlProps> = ({
  onOptimiseProfile,
  profileStrengthPercent = null,
  strengthLabel = '',
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
        style={{
          width: btnSize,
          height: btnSize,
          flexShrink: 0,
          borderRadius: '50%',
          border: '2px solid #0a66c2',
          background: '#ffffff',
          color: '#0f172a',
          fontSize: 8,
          fontWeight: 700,
          lineHeight: 1.1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 4,
          boxShadow: '0 2px 6px rgba(10, 102, 194, 0.12)',
        }}
      >
        {isLoading ? (
          '…'
        ) : (
          <>
            <span>Optimise</span>
            <span>Profile</span>
          </>
        )}
      </button>

      {profileStrengthPercent != null && (
        <ProfileStrengthTicker percent={profileStrengthPercent} strengthLabel={strengthLabel} />
      )}
    </div>
  );
};
