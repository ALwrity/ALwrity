import { OPEN_WORKFLOW_WEDGE_EVENT } from "./workflowWedgeNavigation";

/** Closes Growth Engine overlay when navigating from GE card to daily quick view. */
export const CLOSE_GROWTH_ENGINE_FOR_QUICK_VIEW_EVENT =
  "linkedinwriter:closeGrowthEngineForQuickView";

/**
 * Open Engagement wedge → Conversations to Join (daily top-3 quick view).
 * Dispatches workflow wedge + signals WelcomeMessage to close Growth Engine modal.
 */
export function openConversationsToJoinQuickView(): void {
  window.dispatchEvent(
    new CustomEvent(CLOSE_GROWTH_ENGINE_FOR_QUICK_VIEW_EVENT),
  );
  window.dispatchEvent(
    new CustomEvent(OPEN_WORKFLOW_WEDGE_EVENT, {
      detail: { wedge: "engagement", sub: "opportunities" },
    }),
  );
}
