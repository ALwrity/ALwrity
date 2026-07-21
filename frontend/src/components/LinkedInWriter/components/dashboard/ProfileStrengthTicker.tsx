import React from 'react';
import CheckIcon from '@mui/icons-material/Check';
import StarIcon from '@mui/icons-material/Star';
import { getProfileStrengthSegmentFillCount } from '../../utils/profileStrengthUtils';

const SEGMENT_COLORS = [
  '#4338ca',
  '#3b82f6',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#16a34a',
  '#64748b',
];

export interface ProfileStrengthTickerProps {
  percent: number;
  strengthLabel?: string;
  strengthTooltip?: string;
  /** Compact layout for avatar hover popover. */
  variant?: 'default' | 'popover' | 'inline';
}

export const ProfileStrengthTicker: React.FC<ProfileStrengthTickerProps> = ({
  percent,
  strengthLabel = '',
  strengthTooltip = '',
  variant = 'default',
}) => {
  const segments = 7;
  const clamped = Math.max(0, Math.min(100, percent));
  const filledCount = getProfileStrengthSegmentFillCount(clamped, segments);
  const isPopover = variant === 'popover';
  const isInline = variant === 'inline';

  if (isInline) {
    return (
      <span
        className="linkedin-profile-strength-ticker--inline"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          strengthTooltip
            ? `${clamped}% profile strength. ${strengthTooltip}`
            : `${clamped}% profile strength${strengthLabel ? `. ${strengthLabel}` : ''}`
        }
      >
        <span className="linkedin-profile-strength-ticker--inline-row">
          <span className="linkedin-profile-strength-ticker--inline-percent">{clamped}%</span>
          <span className="linkedin-profile-strength-ticker--inline-segments" aria-hidden>
            {SEGMENT_COLORS.slice(0, segments).map((color, i) => (
              <span
                key={i}
                className="linkedin-profile-strength-ticker--inline-segment"
                style={{ background: i < filledCount ? color : '#e5e7eb' }}
              />
            ))}
          </span>
        </span>
        {strengthLabel ? (
          <span className="linkedin-profile-strength-ticker--inline-label">{strengthLabel}</span>
        ) : null}
      </span>
    );
  }

  return (
    <div
      className={isPopover ? 'linkedin-profile-strength-ticker--popover' : undefined}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={
        strengthTooltip
          ? `${clamped}% profile strength. ${strengthTooltip}`
          : `${clamped}% profile strength${strengthLabel ? `. ${strengthLabel}` : ''}`
      }
      style={{ display: 'flex', flexDirection: 'column', gap: isPopover ? 4 : 2, minWidth: 0 }}
      title={strengthTooltip}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: isPopover ? 14 : 12,
            fontWeight: 800,
            color: '#0f172a',
          }}
        >
          {clamped}%
        </span>
        {strengthLabel && (
          <span
            style={{
              fontSize: isPopover ? 11 : 9,
              fontWeight: 500,
              color: '#64748b',
              lineHeight: 1.2,
            }}
          >
            {strengthLabel}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {SEGMENT_COLORS.slice(0, segments).map((color, i) => {
          const isFilled = i < filledCount;
          return (
            <div
              key={i}
              style={{
                width: isPopover ? 22 : 20,
                height: isPopover ? 9 : 8,
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
};
