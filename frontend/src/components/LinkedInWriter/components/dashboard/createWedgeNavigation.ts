/**
 * Create wedge navigation — Quick Create return targets and open helpers.
 */
import type { QuickCreateReturnTarget } from "./workflowWedgeNavigation";

export {
  openQuickCreateFromWedge,
  openWorkflowWedge,
} from "./workflowWedgeNavigation";

export const CREATE_RETURN = {
  wedge: {
    wedge: "create" as const,
    label: "Quick Create",
  },
} satisfies Record<string, QuickCreateReturnTarget>;
