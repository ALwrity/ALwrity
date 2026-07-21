import React from 'react';
import { CircularProgress } from '@mui/material';

const NO_GAPS_MAINTENANCE_TIPS = [
  'Re-check your profile after headline, role, or photo changes.',
  'Post consistently — fresh activity keeps your profile discoverable.',
] as const;

interface ProfileOptimizationBatchBannerProps {
  remainingInBacklog: number;
  isLoadingNextBatch?: boolean;
  onLoadNextBatch?: () => void;
  /** Modal footer owns the CTA — show text-only strip in the body. */
  hideInlineAction?: boolean;
}

export const ProfileOptimizationBatchBanner: React.FC<ProfileOptimizationBatchBannerProps> = ({
  remainingInBacklog,
  isLoadingNextBatch = false,
  onLoadNextBatch,
  hideInlineAction = false,
}) => {
  const backlogLabel =
    remainingInBacklog === 1
      ? '1 more suggestion in your backlog'
      : `${remainingInBacklog} more suggestions in your backlog`;

  return (
    <div className="profile-opt-batch-banner" role="status">
      <span className="profile-opt-batch-banner__icon" aria-hidden>
        ✓
      </span>
      <p className="profile-opt-batch-banner__text">
        <strong>Batch complete.</strong> {backlogLabel}
      </p>
      {!hideInlineAction && onLoadNextBatch && (
        <button
          type="button"
          className="profile-opt-batch-banner__btn"
          onClick={onLoadNextBatch}
          disabled={isLoadingNextBatch}
        >
          {isLoadingNextBatch ? (
            <>
              <CircularProgress size={14} sx={{ color: 'inherit' }} />
              Loading…
            </>
          ) : (
            'Load next batch'
          )}
        </button>
      )}
    </div>
  );
};

interface ProfileOptimizationNoGapsStateProps {
  message?: string | null;
  onClose?: () => void;
}

export const ProfileOptimizationNoGapsState: React.FC<ProfileOptimizationNoGapsStateProps> = ({
  message,
  onClose,
}) => (
  <div className="profile-opt-no-gaps">
    <div className="profile-opt-no-gaps__head">
      <span className="profile-opt-no-gaps__icon" aria-hidden>
        ✓
      </span>
      <div className="profile-opt-no-gaps__copy">
        <p className="profile-opt-no-gaps__title">Your profile looks strong</p>
        <p className="profile-opt-no-gaps__message">
          {message ||
            'No high-priority gaps found right now. Keep your profile fresh with the tips below.'}
        </p>
      </div>
    </div>
    <ul className="profile-opt-no-gaps__tips">
      {NO_GAPS_MAINTENANCE_TIPS.map((tip) => (
        <li key={tip}>{tip}</li>
      ))}
    </ul>
    {onClose && (
      <button type="button" className="profile-opt-no-gaps__close" onClick={onClose}>
        Done
      </button>
    )}
  </div>
);

interface ProfileOptimizationRecheckBadgeProps {
  recheckDelta: { previous: number; current: number };
  onDismiss?: () => void;
  className?: string;
}

export function formatRecheckDeltaLabel(delta: { previous: number; current: number }): string {
  if (delta.current > delta.previous) {
    return `+${delta.current - delta.previous}% · ${delta.previous}→${delta.current}`;
  }
  if (delta.current < delta.previous) {
    return `${delta.current - delta.previous}% · ${delta.previous}→${delta.current}`;
  }
  return `Unchanged at ${delta.current}%`;
}

export function formatRecheckDeltaTooltip(delta: { previous: number; current: number }): string {
  if (delta.current > delta.previous) {
    return `Score improved from ${delta.previous}% to ${delta.current}% based on your live LinkedIn profile.`;
  }
  if (delta.current < delta.previous) {
    return `Score changed from ${delta.previous}% to ${delta.current}% after re-evaluating your live profile.`;
  }
  return `Score stayed at ${delta.current}%. No new gaps detected on your live LinkedIn profile.`;
}

export const ProfileOptimizationRecheckBadge: React.FC<ProfileOptimizationRecheckBadgeProps> = ({
  recheckDelta,
  onDismiss,
  className,
}) => {
  const improved = recheckDelta.current > recheckDelta.previous;
  const declined = recheckDelta.current < recheckDelta.previous;

  return (
    <p
      className={[
        'profile-opt-recheck-badge',
        improved && 'profile-opt-recheck-badge--up',
        declined && 'profile-opt-recheck-badge--down',
        !improved && !declined && 'profile-opt-recheck-badge--neutral',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      title={formatRecheckDeltaTooltip(recheckDelta)}
    >
      {formatRecheckDeltaLabel(recheckDelta)}
      {onDismiss && (
        <button
          type="button"
          className="profile-opt-recheck-badge__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss re-check result"
        >
          ×
        </button>
      )}
    </p>
  );
};
