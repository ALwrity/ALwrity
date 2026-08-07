/**
 * Navigation helpers for Engagement wedge → Quick Create flows (back buttons).
 */

export type WorkflowModalId =
  | "plan"
  | "create"
  | "publish"
  | "analysis"
  | "engagement"
  | "remarket";

export type EngagementSubModal =
  | "comment"
  | "opportunities"
  | "pulse"
  | "grow_network";

export interface QuickCreateReturnTarget {
  wedge: WorkflowModalId;
  sub?: EngagementSubModal;
  label: string;
}

export const OPEN_WORKFLOW_WEDGE_EVENT = "linkedinwriter:openWorkflowWedge";

export interface OpenWorkflowWedgeDetail {
  wedge: WorkflowModalId;
  sub?: EngagementSubModal;
}

export interface OpenQuickCreateFromWedgeDetail {
  type?: string;
  topic?: string;
  key_points?: string;
  reference_context?: string;
  reference_mode?: "repurpose" | "write_more";
  target_audience?: string;
  industry?: string;
  post_type?: string;
  returnTo?: QuickCreateReturnTarget;
}

export function openWorkflowWedge(detail: OpenWorkflowWedgeDetail): void {
  window.dispatchEvent(
    new CustomEvent<OpenWorkflowWedgeDetail>(OPEN_WORKFLOW_WEDGE_EVENT, {
      detail,
    }),
  );
}

export function openQuickCreateFromWedge(
  detail: OpenQuickCreateFromWedgeDetail,
): void {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:openQuickCreate", { detail }),
  );
}

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
  pulse: {
    wedge: "engagement" as const,
    sub: "pulse" as const,
    label: "Post Pulse",
  },
  grow_network: {
    wedge: "engagement" as const,
    sub: "grow_network" as const,
    label: "Grow Network",
  },
};
