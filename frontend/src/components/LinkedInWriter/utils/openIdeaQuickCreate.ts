import type { PerformanceContentType } from "../components/dashboard/performancePulse/types";
import type { QuickCreateReturnTarget } from "../components/dashboard/workflowWedgeNavigation";

export interface OpenIdeaQuickCreateParams {
  type: PerformanceContentType;
  topic: string;
  key_points?: string;
  target_audience?: string;
  returnTo?: QuickCreateReturnTarget;
}

/** Dispatches Quick Create for a saved or recommended idea. */
export function openIdeaQuickCreate({
  type,
  topic,
  key_points,
  target_audience,
  returnTo,
}: OpenIdeaQuickCreateParams): void {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:openQuickCreate", {
      detail: {
        type,
        topic,
        ...(key_points ? { key_points } : {}),
        ...(target_audience ? { target_audience } : {}),
        ...(returnTo ? { returnTo } : {}),
      },
    }),
  );
}
