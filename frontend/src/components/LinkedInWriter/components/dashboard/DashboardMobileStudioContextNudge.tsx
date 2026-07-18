import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getDisplayProfileStrengthPercent } from '../../utils/profileStrengthUtils';
import {
  LINKEDIN_PRIORITY_ACTION_EVENT,
  PROFILE_STRENGTH_UPDATED_EVENT,
  readCachedPriorityAction,
  type PriorityActionSnapshot,
  type ProfileStrengthUpdatedDetail,
} from '../../utils/profileStrengthEvents';

const DISMISS_SESSION_KEYS = {
  mobile: 'linkedin_mobile_studio_context_nudge_dismissed',
  desktop: 'linkedin_desktop_studio_priority_nudge_dismissed',
} as const;

type NudgeTone = 'priority' | 'strength' | 'ready' | 'connect';

interface NudgeContent {
  tone: NudgeTone;
  label: string;
  detail: string | null;
  actionLabel: string | null;
  onAction?: () => void;
}

export interface DashboardMobileStudioContextNudgeProps {
  connected: boolean;
  isConnecting?: boolean;
  onConnect?: () => void;
  /** mobile = strength/connect hints; desktop = priority action only (≥961px). */
  variant?: 'mobile' | 'desktop';
}

function resolveNudgeContent(
  {
    connected,
    isConnecting,
    onConnect,
    priorityAction,
    profileStrengthPercent,
    runPriorityAction,
  }: {
    connected: boolean;
    isConnecting: boolean;
    onConnect?: () => void;
    priorityAction: PriorityActionSnapshot | null;
    profileStrengthPercent: number | null;
    runPriorityAction: () => void;
  },
  { includePriority }: { includePriority: boolean }
): NudgeContent {
  if (includePriority && connected && priorityAction) {
    return {
      tone: 'priority',
      label: `#1 today · ${priorityAction.title}`,
      detail: priorityAction.why,
      actionLabel: priorityAction.type === 'topic' ? 'Open Plan' : 'Optimise',
      onAction: runPriorityAction,
    };
  }

  if (connected && profileStrengthPercent != null && profileStrengthPercent < 70) {
    return {
      tone: 'strength',
      label: `Profile ${profileStrengthPercent}% — strengthen your presence`,
      detail: 'Use Optimise Profile in the tabs above for step-by-step suggestions.',
      actionLabel: 'Optimise',
      onAction: () => window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile')),
    };
  }

  if (connected) {
    return {
      tone: 'ready',
      label: 'AI drafts, you review — start with Plan or Create',
      detail: null,
      actionLabel: null,
      onAction: undefined,
    };
  }

  return {
    tone: 'connect',
    label: 'Plan & Create work without connecting',
    detail: 'Link LinkedIn when you are ready to publish and track performance.',
    actionLabel: isConnecting ? 'Connecting…' : 'Connect',
    onAction: onConnect,
  };
}

/**
 * Contextual studio hint — mobile strength only below workflow header (connect nudge hidden);
 * desktop priority action in the main toolbar stack (≥961px).
 */
export const DashboardMobileStudioContextNudge: React.FC<DashboardMobileStudioContextNudgeProps> = ({
  connected,
  isConnecting = false,
  onConnect,
  variant = 'mobile',
}) => {
  const isDesktop = variant === 'desktop';
  const dismissKey = DISMISS_SESSION_KEYS[variant];

  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(dismissKey) === '1'
  );
  const [priorityAction, setPriorityAction] = useState<PriorityActionSnapshot | null>(() =>
    connected ? readCachedPriorityAction() : null
  );
  const [profileStrengthPercent, setProfileStrengthPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!connected) {
      setPriorityAction(null);
      setProfileStrengthPercent(null);
      return undefined;
    }

    setPriorityAction(readCachedPriorityAction());

    const onPriority = (event: Event) => {
      const detail = (event as CustomEvent<PriorityActionSnapshot | null>).detail ?? null;
      setPriorityAction(detail);
    };

    const onStrength = (event: Event) => {
      const validation = (event as CustomEvent<ProfileStrengthUpdatedDetail>).detail
        ?.profileValidation;
      if (validation) {
        setProfileStrengthPercent(getDisplayProfileStrengthPercent(validation));
      }
    };

    window.addEventListener(LINKEDIN_PRIORITY_ACTION_EVENT, onPriority);
    window.addEventListener(PROFILE_STRENGTH_UPDATED_EVENT, onStrength);
    return () => {
      window.removeEventListener(LINKEDIN_PRIORITY_ACTION_EVENT, onPriority);
      window.removeEventListener(PROFILE_STRENGTH_UPDATED_EVENT, onStrength);
    };
  }, [connected]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  }, [dismissKey]);

  const runPriorityAction = useCallback(() => {
    if (!priorityAction?.ctaEvent) return;
    window.dispatchEvent(new CustomEvent(priorityAction.ctaEvent));
  }, [priorityAction]);

  const content = useMemo(
    () =>
      resolveNudgeContent(
        {
          connected,
          isConnecting,
          onConnect,
          priorityAction,
          profileStrengthPercent,
          runPriorityAction,
        },
        { includePriority: isDesktop }
      ),
    [
      connected,
      isConnecting,
      isDesktop,
      onConnect,
      priorityAction,
      profileStrengthPercent,
      runPriorityAction,
    ]
  );

  const shouldHide =
    dismissed ||
    content.tone === 'ready' ||
    (isDesktop && content.tone !== 'priority') ||
    (!isDesktop && content.tone === 'priority') ||
    (!isDesktop && content.tone === 'connect');

  if (shouldHide) {
    return null;
  }

  return (
    <div
      className={`linkedin-dashboard-mobile-studio-nudge linkedin-dashboard-mobile-studio-nudge--${content.tone}${
        isDesktop ? ' linkedin-dashboard-studio-nudge--desktop' : ''
      }`}
      data-tour={isDesktop ? 'li-desktop-priority-nudge' : 'li-mobile-studio-nudge'}
    >
      <div className="linkedin-dashboard-mobile-studio-nudge-body">
        <p className="linkedin-dashboard-mobile-studio-nudge-label">{content.label}</p>
        {content.detail && (
          <p className="linkedin-dashboard-mobile-studio-nudge-detail">{content.detail}</p>
        )}
      </div>
      <div className="linkedin-dashboard-mobile-studio-nudge-actions">
        {content.actionLabel && content.onAction && (
          <button
            type="button"
            className="linkedin-dashboard-mobile-studio-nudge-cta"
            onClick={content.onAction}
            disabled={content.tone === 'connect' && isConnecting}
          >
            {content.actionLabel}
          </button>
        )}
        <button
          type="button"
          className="linkedin-dashboard-mobile-studio-nudge-dismiss"
          onClick={dismiss}
          aria-label="Dismiss studio tip"
        >
          ×
        </button>
      </div>
    </div>
  );
};
