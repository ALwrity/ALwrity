/**
 * Navigation helpers for Engagement wedge → Quick Create flows (back buttons).
 */
import { REMARKET_RETURN } from "./remarketWedgeNavigation";

export type {
  WorkflowModalId,
  EngagementSubModal,
  RemarkSubModal,
  WorkflowSubModal,
  QuickCreateReturnTarget,
  OpenWorkflowWedgeDetail,
  OpenWorkflowWedgeDetailInput,
  LegacyEngagementPulseDetail,
  OpenQuickCreateFromWedgeDetail,
} from "./workflowWedgeNavigation";

export {
  OPEN_WORKFLOW_WEDGE_EVENT,
  openWorkflowWedge,
  openQuickCreateFromWedge,
  openPerformancePulse,
  resolveWorkflowWedgeDetail,
} from "./workflowWedgeNavigation";

export const ENGAGEMENT_RETURN = {
  comment: {
    wedge: "engagement" as const,
    sub: "comment" as const,
    label: "Comment Assistant",
  },
  opportunities: {
    wedge: "engagement" as const,
    sub: "opportunities" as const,
    label: "Opportunities",
  },
  grow_network: {
    wedge: "engagement" as const,
    sub: "grow_network" as const,
    label: "Grow Network",
  },
  /**
   * @deprecated Performance Pulse moved to Remarket wedge — use REMARKET_RETURN.pulse.
   * Kept so legacy deep links and return targets still resolve correctly.
   */
  pulse: REMARKET_RETURN.pulse,
};

export { REMARKET_RETURN } from "./remarketWedgeNavigation";
