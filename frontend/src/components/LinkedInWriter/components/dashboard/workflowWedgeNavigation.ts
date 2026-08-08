/**
 * Shared workflow wedge navigation — Quick Create return targets and deep links.
 */

export type WorkflowModalId =
  | "plan"
  | "create"
  | "publish"
  | "analysis"
  | "engagement"
  | "remarket";

export type EngagementSubModal = "comment" | "opportunities" | "grow_network";

export type RemarkSubModal =
  | "repurpose"
  | "transformer"
  | "refresh"
  | "reviver"
  | "perf_plan"
  | "pulse";

export type WorkflowSubModal = EngagementSubModal | RemarkSubModal;

export interface QuickCreateReturnTarget {
  wedge: WorkflowModalId;
  sub?: WorkflowSubModal;
  label: string;
  /** Plan wedge: reopen My Saved Ideas drill-down after Quick Create back. */
  reopenPlanSavedIdeas?: boolean;
}

export interface OpenWorkflowWedgeDetail {
  wedge: WorkflowModalId;
  sub?: WorkflowSubModal;
}

/** Legacy deep link: engagement wedge + pulse sub (Performance Pulse moved to Remarket). */
export type LegacyEngagementPulseDetail = {
  wedge: "engagement";
  sub: "pulse";
};

export type OpenWorkflowWedgeDetailInput =
  | OpenWorkflowWedgeDetail
  | LegacyEngagementPulseDetail;

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

export const OPEN_WORKFLOW_WEDGE_EVENT = "linkedinwriter:openWorkflowWedge";

/**
 * Maps deprecated `{ wedge: "engagement", sub: "pulse" }` to Remarket Performance Pulse.
 */
export function resolveWorkflowWedgeDetail(
  detail: OpenWorkflowWedgeDetailInput,
): OpenWorkflowWedgeDetail {
  if (detail.wedge === "engagement" && detail.sub === "pulse") {
    return { wedge: "remarket", sub: "pulse" };
  }
  return detail;
}

export function openWorkflowWedge(detail: OpenWorkflowWedgeDetailInput): void {
  window.dispatchEvent(
    new CustomEvent<OpenWorkflowWedgeDetail>(OPEN_WORKFLOW_WEDGE_EVENT, {
      detail: resolveWorkflowWedgeDetail(detail),
    }),
  );
}

/** Open Performance Pulse (Remarket wedge) from analytics panels or sidebar. */
export function openPerformancePulse(): void {
  openWorkflowWedge({ wedge: "remarket", sub: "pulse" });
}

export function openQuickCreateFromWedge(
  detail: OpenQuickCreateFromWedgeDetail,
): void {
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:openQuickCreate", { detail }),
  );
}
