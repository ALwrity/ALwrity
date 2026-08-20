/**
 * Pending Plan-step focus after Studio Hub → Video Creator deep-link.
 */
export interface YouTubePlanFocus {
  brainstorm?: boolean;
  savedIdeas?: boolean;
}

let pendingPlanFocus: YouTubePlanFocus | null = null;

export function queueYouTubePlanFocus(focus: YouTubePlanFocus): void {
  pendingPlanFocus = { ...pendingPlanFocus, ...focus };
}

export function consumeYouTubePlanFocus(): YouTubePlanFocus | null {
  const next = pendingPlanFocus;
  pendingPlanFocus = null;
  return next;
}
