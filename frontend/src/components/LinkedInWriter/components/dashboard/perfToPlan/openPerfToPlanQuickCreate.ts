import { REMARKET_RETURN } from "../remarketWedgeNavigation";
import { openQuickCreateFromWedge } from "../workflowWedgeNavigation";

/** Opens Quick Create with back navigation to Perf → Plan modal. */
export function openPerfToPlanQuickCreate(
  type: string,
  topic: string,
  keyPoints: string,
): void {
  openQuickCreateFromWedge({
    type,
    topic,
    key_points: keyPoints,
    returnTo: REMARKET_RETURN.perf_plan,
  });
}
