/**
 * Plan wedge navigation — Quick Create return targets and shared labels.
 */
import type { QuickCreateReturnTarget } from "./workflowWedgeNavigation";

export const PLAN_RETURN = {
  wedge: {
    wedge: "plan" as const,
    label: "Plan",
  },
  savedIdeas: {
    wedge: "plan" as const,
    label: "My Saved Ideas",
    reopenPlanSavedIdeas: true,
  },
} satisfies Record<string, QuickCreateReturnTarget>;

/** Fired after Quick Create back when return target is My Saved Ideas. */
export const OPEN_PLAN_SAVED_IDEAS_EVENT = "linkedinwriter:openPlanSavedIdeas";

/** Notify Plan wedge to reopen My Saved Ideas after Quick Create back navigation. */
export function signalReopenPlanSavedIdeas(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PLAN_SAVED_IDEAS_EVENT));
}

export { openQuickCreateFromWedge } from "./workflowWedgeNavigation";
