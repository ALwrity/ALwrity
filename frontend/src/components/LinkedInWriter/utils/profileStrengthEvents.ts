import type {
  LinkedInProfileValidation,
  LinkedInAIProfileIntelligence,
  LinkedInProfileOptimizationItem,
  LinkedInTopicRecommendation,
} from '../../../api/linkedinSocial';

// ---------------------------------------------------------------------------
// Profile Strength event
// ---------------------------------------------------------------------------

export const PROFILE_STRENGTH_UPDATED_EVENT = 'linkedinwriter:profileStrengthUpdated';

export type ProfileStrengthUpdatedDetail = {
  profileValidation: LinkedInProfileValidation;
  /** Phase 5 AI intelligence — included when available so subscribers (e.g. UserBadge) never need a separate API call. */
  aiProfileIntelligence?: LinkedInAIProfileIntelligence | null;
};

export function dispatchProfileStrengthUpdated(
  profileValidation: LinkedInProfileValidation,
  aiProfileIntelligence?: LinkedInAIProfileIntelligence | null,
): void {
  window.dispatchEvent(
    new CustomEvent<ProfileStrengthUpdatedDetail>(PROFILE_STRENGTH_UPDATED_EVENT, {
      detail: { profileValidation, aiProfileIntelligence },
    })
  );
}

// ---------------------------------------------------------------------------
// Persona event — broadcast from Header.tsx (which owns PlatformPersonaContext)
// so that global components outside the provider (e.g. UserBadge) can display
// the active writing voice without needing their own API call or context access.
// ---------------------------------------------------------------------------

export const LINKEDIN_PERSONA_UPDATED_EVENT = 'linkedinwriter:personaUpdated';

/** Lightweight snapshot — only the fields needed for nav-menu display. */
export type LinkedInPersonaSnapshot = {
  personaName: string;
  archetype: string;
  coreBelief?: string | null;
  defaultTone?: string | null;
};

export function dispatchLinkedInPersonaUpdated(snapshot: LinkedInPersonaSnapshot): void {
  window.dispatchEvent(
    new CustomEvent<LinkedInPersonaSnapshot>(LINKEDIN_PERSONA_UPDATED_EVENT, {
      detail: snapshot,
    })
  );
}

// ---------------------------------------------------------------------------
// Priority Action event — computed from Phase 7 optimization items or Phase 6
// topic recommendations, dispatched so UserBadge can show the "#1 Today" card
// without any additional API call.
// ---------------------------------------------------------------------------

export const LINKEDIN_PRIORITY_ACTION_EVENT = 'linkedinwriter:priorityActionUpdated';

const PRIORITY_SESSION_KEY = 'linkedin_priority_action_v1';

/** Effort display label used in the UI. */
const EFFORT_LABELS: Record<string, string> = {
  Low: '~5 min',
  Medium: '~15 min',
  High: '~30 min',
};

export type PriorityActionSnapshot = {
  type: 'optimization' | 'topic';
  /** Short headline shown in the card. */
  title: string;
  /** One-line rationale, truncated in the UI. */
  why: string;
  impact: 'High' | 'Medium' | 'Low';
  /** Present only for optimization items. */
  effort?: 'Low' | 'Medium' | 'High';
  /** Human-readable effort time estimate. */
  effortLabel?: string;
  /** Custom event dispatched when the user clicks the CTA. */
  ctaEvent: string;
};

/**
 * Pure function: picks the highest-ROI action from available data.
 * Priority order:
 *   1. Optimization item — High impact + Low effort (quick win)
 *   2. Optimization item — High impact (any effort)
 *   3. Topic recommendation — High growth impact
 *   4. First optimization item (any priority)
 */
export function selectTopPriorityAction(
  optimizationItems: LinkedInProfileOptimizationItem[] | null | undefined,
  topicRecommendations: LinkedInTopicRecommendation[] | null | undefined,
): PriorityActionSnapshot | null {
  const optItems = optimizationItems ?? [];
  const topics = topicRecommendations ?? [];

  const toOptSnap = (item: LinkedInProfileOptimizationItem): PriorityActionSnapshot => ({
    type: 'optimization',
    title: item.issue,
    why: item.why_it_matters,
    impact: item.impact,
    effort: item.effort,
    effortLabel: EFFORT_LABELS[item.effort] ?? undefined,
    ctaEvent: 'linkedinwriter:openOptimiseProfile',
  });

  // 1. Quick win
  const quickWin = optItems.find((i) => i.impact === 'High' && i.effort === 'Low');
  if (quickWin) return toOptSnap(quickWin);

  // 2. High impact optimization (any effort)
  const highImpact = optItems.find((i) => i.impact === 'High');
  if (highImpact) return toOptSnap(highImpact);

  // 3. High-growth topic recommendation
  const highTopic = topics.find((r) => r.growth_impact === 'High');
  if (highTopic) {
    return {
      type: 'topic',
      title: highTopic.title,
      why: highTopic.why_this_fits,
      impact: 'High',
      ctaEvent: 'linkedinwriter:openBrainstorm',
    };
  }

  // 4. First optimization item (any priority)
  const firstOpt = optItems[0];
  if (firstOpt) return toOptSnap(firstOpt);

  return null;
}

export function dispatchLinkedInPriorityAction(snapshot: PriorityActionSnapshot | null): void {
  // Persist so UserBadge can restore the card across menu open/close cycles in the same session.
  try {
    if (snapshot) sessionStorage.setItem(PRIORITY_SESSION_KEY, JSON.stringify(snapshot));
  } catch (_) { /* sessionStorage unavailable — no-op */ }

  window.dispatchEvent(
    new CustomEvent<PriorityActionSnapshot | null>(LINKEDIN_PRIORITY_ACTION_EVENT, {
      detail: snapshot,
    })
  );
}

/** Reads the last persisted priority action from sessionStorage (survives menu open/close). */
export function readCachedPriorityAction(): PriorityActionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PRIORITY_SESSION_KEY);
    return raw ? (JSON.parse(raw) as PriorityActionSnapshot) : null;
  } catch (_) {
    return null;
  }
}
